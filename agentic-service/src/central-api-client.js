/**
 * Central API Client with Redis Cache + Rate Limiting
 * 
 * Features:
 *   - Redis-backed token bucket rate limiter (20 req/min, shared across all services)
 *   - Response caching in Redis with per-endpoint TTL
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
const MAX_TOKENS = 20;           // 20 req/min (5 below the 25 hard limit)
const WINDOW_MS = 60 * 1000;     // 1 minute window
const MAX_WAIT_MS = 30000;       // Max wait time for a token
const POLL_INTERVAL_MS = 500;    // Check every 500ms for available token

// Lua script for atomic token bucket consumption
// Returns: 1 if token acquired, 0 if no tokens available
const TOKEN_BUCKET_LUA = `
  local key = KEYS[1]
  local max_tokens = tonumber(ARGV[1])
  local window_ms = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])

  -- Initialize if first call
  if tokens == nil then
    tokens = max_tokens
    last_refill = now
  end

  -- Refill tokens based on elapsed time
  local elapsed = now - last_refill
  if elapsed >= window_ms then
    -- Full window elapsed, refill completely
    tokens = max_tokens
    last_refill = now
  elseif elapsed > 0 then
    -- Partial refill: tokens accumulate linearly
    local refill = math.floor((elapsed / window_ms) * max_tokens)
    if refill > 0 then
      tokens = math.min(max_tokens, tokens + refill)
      last_refill = now
    end
  end

  -- Try to consume a token
  if tokens > 0 then
    tokens = tokens - 1
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
    redis.call('PEXPIRE', key, window_ms * 2)
    return 1
  else
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
    redis.call('PEXPIRE', key, window_ms * 2)
    return 0
  end
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

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timeout — let it through but log warning
  console.warn('[central-api-client] Rate limit token wait timeout — allowing request');
}

// ── Cache Config ──
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
 * Try to get cached response from Redis
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
 * Store response in Redis cache
 */
async function setCache(cacheKey, data, ttlSeconds) {
  if (!redisConnected) return;
  try {
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    // Non-critical — log and continue
    console.warn('[central-api-client] Cache write failed:', err.message);
  }
}

// ── Axios Client ──
const centralApiClient = axios.create({
  baseURL: CENTRAL_API_URL,
  headers: { Authorization: `Bearer ${CENTRAL_API_TOKEN}` },
  timeout: 15000,
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

/**
 * Cached + rate-limited GET request
 * Checks Redis cache first, acquires rate limit token, then calls API
 */
async function cachedGet(url, options = {}) {
  const cacheKey = buildCacheKey(url, options.params);

  // 1. Check cache
  const cached = await getFromCache(cacheKey);
  if (cached) {
    return { data: cached, status: 200, statusText: 'OK (cached)', cached: true };
  }

  // 2. Acquire rate limit token
  await acquireToken();

  // 3. Make the actual request
  const response = await centralApiClient.get(url, options);

  // 4. Cache the response
  const ttl = getCacheTTL(url);
  await setCache(cacheKey, response.data, ttl);

  return response;
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
 * Get cache stats for monitoring
 */
async function getCacheStats() {
  if (!redisConnected) return { connected: false };
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}*`);
    const bucket = await redis.hmget(RATE_LIMIT_KEY, 'tokens', 'last_refill');
    return {
      connected: true,
      cachedEntries: keys.length,
      rateLimitTokens: parseInt(bucket[0]) || 0,
      rateLimitLastRefill: parseInt(bucket[1]) || 0,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = { centralApi, invalidateCache, getCacheStats, redis };
