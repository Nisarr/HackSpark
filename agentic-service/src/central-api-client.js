/**
 * Central API Client with Redis Cache + Rate Limiting (Optimized)
 * 
 * Features:
 *   - L1 in-memory cache + L2 Redis cache (two-tier)
 *   - Redis-backed token bucket rate limiter (20 req/min, shared across all services)
 *   - Request coalescing (dedup concurrent identical GETs)
 *   - Non-blocking cache writes (fire-and-forget)
 *   - 429 retry with exponential backoff as fallback
 *   - Queue-and-wait when rate limit tokens exhausted
 */

const axios = require('axios');
const Redis = require('ioredis');

const CENTRAL_API_URL = process.env.CENTRAL_API_URL;
const CENTRAL_API_TOKEN = process.env.CENTRAL_API_TOKEN;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// ── Redis Connection ──
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
  enableReadyCheck: false,
});

let redisConnected = false;

redis.on('connect', () => {
  redisConnected = true;
  console.log('[central-api-client] Redis connected');
});
redis.on('error', (err) => {
  redisConnected = false;
  console.error('[central-api-client] Redis error:', err.message);
});

// Connect on startup (non-blocking)
redis.connect().catch(() => {});

// ── Rate Limiter Config ──
const RATE_LIMIT_KEY = 'ratelimit:central-api';
const MAX_TOKENS = 20;           // 20 req/min (below the 30 hard limit)
const WINDOW_MS = 60 * 1000;     // 1 minute window
const MAX_WAIT_MS = 30000;       // Max wait time for a token
const POLL_INTERVAL_MS = 100;    // Check every 100ms for available token (was 500ms)

// Optimized Lua script — single HMSET/PEXPIRE path
const TOKEN_BUCKET_LUA = `
  local key = KEYS[1]
  local max_tokens = tonumber(ARGV[1])
  local window_ms = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])

  if tokens == nil then
    tokens = max_tokens
    last_refill = now
  end

  local elapsed = now - last_refill
  if elapsed >= window_ms then
    tokens = max_tokens
    last_refill = now
  elseif elapsed > 0 then
    local refill = math.floor((elapsed / window_ms) * max_tokens)
    if refill > 0 then
      tokens = math.min(max_tokens, tokens + refill)
      last_refill = now
    end
  end

  local acquired = 0
  if tokens > 0 then
    tokens = tokens - 1
    acquired = 1
  end

  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
  redis.call('PEXPIRE', key, window_ms * 2)
  return acquired
`;

// In-memory fallback rate limiter (when Redis is down)
const fallbackBucket = {
  tokens: MAX_TOKENS,
  lastRefill: Date.now(),
};

function fallbackTryConsume() {
  const now = Date.now();
  const elapsed = now - fallbackBucket.lastRefill;
  
  if (elapsed >= WINDOW_MS) {
    fallbackBucket.tokens = MAX_TOKENS;
    fallbackBucket.lastRefill = now;
  } else if (elapsed > 0) {
    const refill = Math.floor((elapsed / WINDOW_MS) * MAX_TOKENS);
    if (refill > 0) {
      fallbackBucket.tokens = Math.min(MAX_TOKENS, fallbackBucket.tokens + refill);
      fallbackBucket.lastRefill = now;
    }
  }

  if (fallbackBucket.tokens > 0) {
    fallbackBucket.tokens--;
    return true;
  }
  return false;
}

/**
 * Acquire a rate limit token. Waits if none available.
 * @returns {Promise<void>}
 */
async function acquireToken() {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      if (redisConnected) {
        const result = await redis.eval(
          TOKEN_BUCKET_LUA, 1, RATE_LIMIT_KEY,
          MAX_TOKENS, WINDOW_MS, Date.now()
        );
        if (result === 1) return;
      } else {
        if (fallbackTryConsume()) return;
      }
    } catch (err) {
      // Redis error — use fallback
      if (fallbackTryConsume()) return;
    }

    // Wait and retry (100ms instead of 500ms for faster token acquisition)
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timeout — let it through but log warning
  console.warn('[central-api-client] Rate limit token wait timeout — allowing request');
}

// ══════════════════════════════════════════════════════════════════════════════
// ── L1 In-Memory Cache (hot data, ~10s TTL, zero-latency reads) ──
// ══════════════════════════════════════════════════════════════════════════════

const memoryCache = new Map();
const MEMORY_CACHE_MAX_SIZE = 200;
const MEMORY_CACHE_TTL_RATIO = 0.15; // L1 TTL = 15% of L2 TTL (keeps data fresh)

function getFromMemory(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setMemory(key, data, l2TtlSeconds) {
  // Evict oldest entries if at capacity (simple FIFO eviction)
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  const ttlMs = Math.max(l2TtlSeconds * MEMORY_CACHE_TTL_RATIO * 1000, 5000); // Min 5s
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// Periodic L1 cleanup (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expiresAt) memoryCache.delete(key);
  }
}, 30000);

// ── L2 Redis Cache Config ──
const CACHE_PREFIX = 'cache:central:';

// TTL map by URL pattern (seconds)
const CACHE_TTL_MAP = [
  { pattern: /\/api\/data\/categories/,         ttl: 600 },  // 10 min
  { pattern: /\/api\/data\/products\/batch/,     ttl: 300 },  // 5 min
  { pattern: /\/api\/data\/products\/\d+/,       ttl: 300 },  // 5 min
  { pattern: /\/api\/data\/products/,            ttl: 120 },  // 2 min
  { pattern: /\/api\/data\/rentals\/stats/,      ttl: 180 },  // 3 min
  { pattern: /\/api\/data\/rentals/,             ttl: 60  },  // 1 min
  { pattern: /\/api\/data\/users\/\d+/,          ttl: 120 },  // 2 min (user/discount)
];

function getCacheTTL(url) {
  for (const entry of CACHE_TTL_MAP) {
    if (entry.pattern.test(url)) return entry.ttl;
  }
  return 60; // default 1 min
}

function buildCacheKey(url, params) {
  const sortedParams = params
    ? Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
    : '';
  return `${CACHE_PREFIX}${url}${sortedParams ? '?' + sortedParams : ''}`;
}

/**
 * Try to get cached response from Redis (L2)
 */
async function getFromCache(cacheKey) {
  if (!redisConnected) return null;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    // Cache miss or parse error — proceed to API
  }
  return null;
}

/**
 * Store response in Redis cache (L2) — fire and forget (non-blocking)
 */
function setCache(cacheKey, data, ttlSeconds) {
  if (!redisConnected) return;
  redis.setex(cacheKey, ttlSeconds, JSON.stringify(data)).catch((err) => {
    console.warn('[central-api-client] Cache write failed:', err.message);
  });
}

// ── Axios Client ──
const centralApiClient = axios.create({
  baseURL: CENTRAL_API_URL,
  headers: { Authorization: `Bearer ${CENTRAL_API_TOKEN}` },
  timeout: 10000,  // Reduced from 15s to 10s
});

// 429 retry interceptor (fallback safety net)
centralApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config.retryCount = config.retryCount || 0;

    if (error.response && error.response.status === 429) {
      if (config.retryCount >= 3) {
        const lastRetryAfter = error.response.data?.retryAfterSeconds || 60;
        error.response.status = 503;
        error.response.data = {
          error: 'Central API unavailable after 3 retries',
          lastRetryAfter,
          suggestion: 'Try again in ~2 minutes',
        };
        return Promise.reject(error);
      }

      const retryAfter = error.response.data?.retryAfterSeconds || 5;
      const delay = retryAfter * Math.pow(2, config.retryCount);
      const jitter = delay * 0.2 * (Math.random() * 2 - 1);
      const finalDelayMs = Math.round((delay + jitter) * 1000);

      config.retryCount += 1;
      console.log(
        `[retry ${config.retryCount}/3] waiting ${Math.round(finalDelayMs / 1000)}s before retrying ${config.method.toUpperCase()} ${config.url}`
      );

      await new Promise(resolve => setTimeout(resolve, finalDelayMs));

      // Re-acquire token before retry
      await acquireToken();

      return centralApiClient(config);
    }

    return Promise.reject(error);
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ── Request Coalescing ──
// Deduplicates concurrent identical GET requests so only one hits the API
// ══════════════════════════════════════════════════════════════════════════════

const inflightRequests = new Map();

/**
 * Two-tier cached + rate-limited + coalesced GET request
 * L1 (memory) → L2 (Redis) → coalesce → acquire token → API
 */
async function cachedGet(url, options = {}) {
  const cacheKey = buildCacheKey(url, options.params);

  // 1. Check L1 in-memory cache (zero latency)
  const memCached = getFromMemory(cacheKey);
  if (memCached) {
    return { data: memCached, status: 200, statusText: 'OK (L1 cache)', cached: true };
  }

  // 2. Check L2 Redis cache
  const redisCached = await getFromCache(cacheKey);
  if (redisCached) {
    // Promote to L1 for subsequent reads
    const ttl = getCacheTTL(url);
    setMemory(cacheKey, redisCached, ttl);
    return { data: redisCached, status: 200, statusText: 'OK (L2 cache)', cached: true };
  }

  // 3. Request coalescing — if same request is in-flight, wait for it
  const existing = inflightRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  // 4. Cache miss — acquire token and fetch from API
  const fetchPromise = (async () => {
    await acquireToken();
    const response = await centralApiClient.get(url, options);

    // Store in both cache tiers
    const ttl = getCacheTTL(url);
    setMemory(cacheKey, response.data, ttl);
    setCache(cacheKey, response.data, ttl); // fire-and-forget

    return response;
  })();

  // Track in-flight request
  inflightRequests.set(cacheKey, fetchPromise);
  fetchPromise.finally(() => inflightRequests.delete(cacheKey));

  return fetchPromise;
}

/**
 * Proxied Central API client that uses caching for GET requests
 * Drop-in replacement for the old centralApi() function
 * Returns an object with .get() that uses caching + rate limiting
 */
function centralApi() {
  return {
    get: cachedGet,
    // Non-GET methods go through rate limiter but skip cache
    post: async (url, data, options) => {
      await acquireToken();
      return centralApiClient.post(url, data, options);
    },
    put: async (url, data, options) => {
      await acquireToken();
      return centralApiClient.put(url, data, options);
    },
    delete: async (url, options) => {
      await acquireToken();
      return centralApiClient.delete(url, options);
    },
  };
}

/**
 * Invalidate cache entries matching a pattern
 */
async function invalidateCache(pattern) {
  // Clear L1
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) memoryCache.delete(key);
  }
  // Clear L2
  if (!redisConnected) return;
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.warn('[central-api-client] Cache invalidation failed:', err.message);
  }
}

/**
 * Get cache stats for monitoring (O(1) — no KEYS scan)
 */
async function getCacheStats() {
  const l1Entries = memoryCache.size;
  if (!redisConnected) return { connected: false, l1Entries };
  try {
    const bucket = await redis.hmget(RATE_LIMIT_KEY, 'tokens', 'last_refill');
    const dbSize = await redis.dbsize();
    return {
      connected: true,
      l1Entries,
      l2Entries: dbSize,
      rateLimitTokens: parseInt(bucket[0]) || 0,
      rateLimitLastRefill: parseInt(bucket[1]) || 0,
      inflightRequests: inflightRequests.size,
    };
  } catch (err) {
    return { connected: false, error: err.message, l1Entries };
  }
}

module.exports = { centralApi, invalidateCache, getCacheStats, redis };
