const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : (import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8000');

// ── Request Deduplication ──
// If the same GET URL is already in-flight, return the same Promise
// instead of firing a second network request.
const inflightRequests = new Map();

// ── Rate Limit State ──
// Shared across all components so the entire app knows when to show loading
let rateLimitState = {
  isLimited: false,
  retryAt: 0,       // timestamp when we can retry
  listeners: new Set(),
};

/** Subscribe to rate limit state changes */
export function onRateLimitChange(callback) {
  rateLimitState.listeners.add(callback);
  return () => rateLimitState.listeners.delete(callback);
}

/** Get current rate limit state */
export function getRateLimitState() {
  return {
    isLimited: rateLimitState.isLimited,
    retryAt: rateLimitState.retryAt,
    remainingMs: Math.max(0, rateLimitState.retryAt - Date.now()),
  };
}

function setRateLimited(retryAfterSeconds) {
  rateLimitState.isLimited = true;
  rateLimitState.retryAt = Date.now() + (retryAfterSeconds * 1000);
  rateLimitState.listeners.forEach(fn => fn(getRateLimitState()));

  // Auto-clear after the retry period
  setTimeout(() => {
    rateLimitState.isLimited = false;
    rateLimitState.retryAt = 0;
    rateLimitState.listeners.forEach(fn => fn(getRateLimitState()));
  }, retryAfterSeconds * 1000);
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const method = (options.method || 'GET').toUpperCase();
  const url = `${API_BASE}${path}`;

  // If rate limited, wait for the cooldown before sending
  if (rateLimitState.isLimited) {
    const waitMs = rateLimitState.retryAt - Date.now();
    if (waitMs > 0) {
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  // Deduplication: only for GET requests (safe & idempotent)
  if (method === 'GET') {
    const existing = inflightRequests.get(url);
    if (existing) {
      return existing;
    }

    const promise = doFetch(url, { ...options, headers, method })
      .finally(() => {
        inflightRequests.delete(url);
      });

    inflightRequests.set(url, promise);
    return promise;
  }

  // Non-GET requests: always pass through
  return doFetch(url, { ...options, headers, method });
}

async function doFetch(url, options, retryCount = 0) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);

  // Handle rate limit / 503 from gateway
  if (res.status === 503 || res.status === 429) {
    const retryAfter = data?.retryAfterSeconds
      || parseInt(res.headers.get('Retry-After') || '60', 10);

    setRateLimited(retryAfter);

    // Auto-retry once after waiting
    if (retryCount < 1) {
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return doFetch(url, options, retryCount + 1);
    }

    // After retry still fails — throw with retry info
    const error = new Error('Rate limit exceeded — please wait and try again');
    error.status = 503;
    error.retryAfterSeconds = retryAfter;
    error.data = data;
    throw error;
  }

  if (!res.ok) {
    const error = new Error(data?.error || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}
