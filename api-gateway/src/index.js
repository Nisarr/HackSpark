const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8000;

// ── Service URLs ──
const SERVICES = {
  'user-service':      process.env.USER_SERVICE_URL      || 'http://user-service:8001',
  'rental-service':    process.env.RENTAL_SERVICE_URL    || 'http://rental-service:8002',
  'analytics-service': process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003',
  'agentic-service':   process.env.AGENTIC_SERVICE_URL   || 'http://agentic-service:8004',
};

app.use(cors());
app.use(express.json());

// ── Global Rate Limiting (Max 30 req/min/token) ──
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    return req.socket.remoteAddress || 'unknown';
  },
  validate: { xForwardedForHeader: false, default: true },
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ══════════════════════════════════════════════════════════════════════════════
// ── In-Memory Cache Layer ──
// Caches GET responses from backend services so repeated frontend requests
// (page reloads, rapid navigation, React re-mounts) never hit backends.
// ══════════════════════════════════════════════════════════════════════════════

const cache = new Map();

// TTL config: route pattern → TTL in seconds
const CACHE_TTL_RULES = [
  { pattern: /^GET:\/rentals\/products\?/,       ttl: 120 },  // product listing
  { pattern: /^GET:\/rentals\/products$/,         ttl: 120 },  // product listing (no query)
  { pattern: /^GET:\/rentals\/products\/\d+\/availability/, ttl: 60 },
  { pattern: /^GET:\/rentals\/products\/\d+\/free-streak/, ttl: 120 },
  { pattern: /^GET:\/rentals\/products\/\d+$/,    ttl: 120 },  // single product
  { pattern: /^GET:\/rentals\/kth-busiest/,       ttl: 180 },  // analytics-like
  { pattern: /^GET:\/rentals\/users\/\d+\/top-categories/, ttl: 120 },
  { pattern: /^GET:\/rentals\/merged-feed/,       ttl: 60  },  // merged feed
  { pattern: /^GET:\/rentals\/kpi/,               ttl: 120 },  // KPI dashboard
  { pattern: /^GET:\/analytics\//,                ttl: 180 },  // analytics endpoints
  { pattern: /^GET:\/users\/.*\/discount/,        ttl: 120 },  // discount lookup
  { pattern: /^GET:\/chat\/sessions/,             ttl: 30  },  // session list
  { pattern: /^GET:\/chat\/[^\/]+\/history/,      ttl: 15  },  // chat history
];

function getCacheTTL(cacheKey) {
  for (const rule of CACHE_TTL_RULES) {
    if (rule.pattern.test(cacheKey)) return rule.ttl;
  }
  return 0; // no caching by default
}

function buildCacheKey(method, url) {
  return `${method}:${url}`;
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCache(key, data, statusCode, ttlSeconds) {
  if (ttlSeconds <= 0) return;
  cache.set(key, {
    data,
    statusCode,
    expiresAt: Date.now() + (ttlSeconds * 1000),
    cachedAt: Date.now(),
  });
}

// Invalidate cache entries matching a prefix
function invalidateCache(prefix) {
  for (const key of cache.keys()) {
    if (key.includes(prefix)) {
      cache.delete(key);
    }
  }
}

// In-flight request deduplication
// When the same URL is being fetched, concurrent requests wait for the first
const inflightRequests = new Map();

// Cache stats endpoint
let cacheHits = 0;
let cacheMisses = 0;

// Periodic cache cleanup (every 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}, 60 * 1000);

// ══════════════════════════════════════════════════════════════════════════════
// ── Cached Proxy Handler ──
// For GET requests: check cache first, proxy if miss, cache the response.
// For mutations: proxy directly and invalidate related cache entries.
// ══════════════════════════════════════════════════════════════════════════════

function resolveServiceURL(originalUrl) {
  if (originalUrl.startsWith('/users'))     return { target: SERVICES['user-service'],      rewrite: originalUrl };
  if (originalUrl.startsWith('/rentals'))   return { target: SERVICES['rental-service'],    rewrite: originalUrl };
  if (originalUrl.startsWith('/analytics')) return { target: SERVICES['analytics-service'], rewrite: originalUrl };
  if (originalUrl.startsWith('/chat'))      return { target: SERVICES['agentic-service'],   rewrite: originalUrl };
  return null;
}

async function cachedProxyHandler(req, res) {
  const service = resolveServiceURL(req.originalUrl);
  if (!service) {
    return res.status(404).json({ error: 'Unknown route' });
  }

  const method = req.method.toUpperCase();
  const fullUrl = req.originalUrl;
  const cacheKey = buildCacheKey(method, fullUrl);

  // ── GET requests: check cache ──
  if (method === 'GET') {
    const ttl = getCacheTTL(cacheKey);
    if (ttl > 0) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        cacheHits++;
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Age', `${Math.round((Date.now() - cached.cachedAt) / 1000)}s`);
        return res.status(cached.statusCode).json(cached.data);
      }
    }
    cacheMisses++;

    // In-flight dedup: if same URL is already being fetched, wait for it
    const existing = inflightRequests.get(cacheKey);
    if (existing) {
      try {
        const result = await existing;
        cacheHits++;
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Age', '0s');
        return res.status(result.status).json(result.data);
      } catch (err) {
        return res.status(502).json({ error: 'Backend service unavailable' });
      }
    }

    // Cache miss — proxy to backend (with dedup tracking)
    const fetchPromise = axios({
      method: 'GET',
      url: `${service.target}${service.rewrite}`,
      headers: {
        ...filterHeaders(req.headers),
        host: undefined,
      },
      timeout: 10000,
      validateStatus: () => true, // Don't throw on non-2xx
    }).then(response => {
      // Cache successful responses
      if (response.status >= 200 && response.status < 300 && ttl > 0) {
        setCache(cacheKey, response.data, response.status, ttl);
      }
      return { status: response.status, data: response.data };
    }).finally(() => {
      inflightRequests.delete(cacheKey);
    });

    inflightRequests.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      // Forward rate limit info to frontend
      if (result.status === 429 || result.status === 503) {
        const retryAfter = result.data?.retryAfterSeconds || result.data?.lastRetryAfter || 60;
        res.set('Retry-After', String(retryAfter));
        return res.status(503).json({
          error: 'Rate limit exceeded — please wait',
          retryAfterSeconds: retryAfter,
        });
      }
      res.set('X-Cache', 'MISS');
      return res.status(result.status).json(result.data);
    } catch (err) {
      console.error(`[cache-proxy] GET ${fullUrl} error:`, err.message);
      return res.status(502).json({ error: 'Backend service unavailable' });
    }
  }

  // ── Mutations (POST/PUT/DELETE): proxy + invalidate ──
  try {
    const response = await axios({
      method,
      url: `${service.target}${service.rewrite}`,
      data: req.body,
      headers: {
        ...filterHeaders(req.headers),
        host: undefined,
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    // Invalidate related cache entries after mutations
    if (fullUrl.startsWith('/chat')) {
      invalidateCache('/chat/sessions');
      // Also invalidate the specific session history if we can determine it
      const sessionMatch = fullUrl.match(/\/chat\/([^\/]+)/);
      if (sessionMatch) {
        invalidateCache(`/chat/${sessionMatch[1]}/history`);
      }
    }
    if (fullUrl.startsWith('/rentals')) {
      invalidateCache('/rentals/');
    }
    if (fullUrl.startsWith('/users')) {
      invalidateCache('/users/');
    }

    // Forward rate limit info to frontend
    if (response.status === 429 || response.status === 503) {
      const retryAfter = response.data?.retryAfterSeconds || response.data?.lastRetryAfter || 60;
      res.set('Retry-After', String(retryAfter));
      return res.status(503).json({
        error: 'Rate limit exceeded — please wait',
        retryAfterSeconds: retryAfter,
      });
    }
    return res.status(response.status).json(response.data);
  } catch (err) {
    console.error(`[cache-proxy] ${method} ${fullUrl} error:`, err.message);
    return res.status(502).json({ error: 'Backend service unavailable' });
  }
}

// Filter out hop-by-hop headers that shouldn't be forwarded
function filterHeaders(headers) {
  const filtered = { ...headers };
  delete filtered['host'];
  delete filtered['connection'];
  delete filtered['transfer-encoding'];
  delete filtered['content-length']; // Let axios recalculate
  return filtered;
}

// ── P1: Aggregated Health Check ──
app.get('/status', async (req, res) => {
  const downstream = {};

  const checks = Object.entries(SERVICES).map(async ([name, url]) => {
    try {
      const { data } = await axios.get(`${url}/status`, { timeout: 3000 });
      downstream[name] = data.status || 'OK';
    } catch {
      downstream[name] = 'UNREACHABLE';
    }
  });

  await Promise.allSettled(checks);

  res.json({
    service: 'api-gateway',
    status: 'OK',
    downstream,
    cache: {
      entries: cache.size,
      hits: cacheHits,
      misses: cacheMisses,
      hitRate: cacheHits + cacheMisses > 0
        ? `${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)}%`
        : 'N/A',
    },
  });
});

// ── Cached Routes: /users, /rentals, /analytics, /chat ──
// All requests go through the cache proxy instead of raw http-proxy-middleware
app.all('/users/*', cachedProxyHandler);
app.all('/rentals/*', cachedProxyHandler);
app.all('/analytics/*', cachedProxyHandler);

// Chat routes — more specific patterns first
app.get('/chat/sessions', cachedProxyHandler);
app.get('/chat/:sessionId/history', cachedProxyHandler);
app.post('/chat', cachedProxyHandler);
app.delete('/chat/:sessionId', cachedProxyHandler);
app.all('/chat/*', cachedProxyHandler);

// ══════════════════════════════════════════════════════════════════════════════
// ── Background Cache Warmer ──
// Pre-fetches high-traffic endpoints at controlled intervals so the cache
// stays warm and users always get instant responses. Budget: ~4 req/cycle.
// ══════════════════════════════════════════════════════════════════════════════

const WARM_ENDPOINTS = [
  '/rentals/products?page=1&limit=20',
  '/rentals/kpi',
];

async function warmCache() {
  for (const endpoint of WARM_ENDPOINTS) {
    const cacheKey = buildCacheKey('GET', endpoint);
    const existing = getFromCache(cacheKey);
    if (existing) continue; // Already cached, skip

    const service = resolveServiceURL(endpoint);
    if (!service) continue;

    try {
      const response = await axios.get(`${service.target}${service.rewrite}`, { timeout: 10000 });
      if (response.status >= 200 && response.status < 300) {
        const ttl = getCacheTTL(cacheKey);
        if (ttl > 0) setCache(cacheKey, response.data, response.status, ttl);
      }
    } catch (err) {
      // Non-critical — just log
      console.warn(`[cache-warmer] failed to warm ${endpoint}:`, err.message);
    }

    // Small delay between warmup requests
    await new Promise(r => setTimeout(r, 3000));
  }
}

// Warm cache every 90 seconds (well within rate budget)
setInterval(warmCache, 90 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api-gateway] listening on port ${PORT}`);
  console.log(`[api-gateway] cache proxy enabled with TTL-based eviction`);
  // Initial cache warm after 5 seconds
  setTimeout(warmCache, 5000);
});
