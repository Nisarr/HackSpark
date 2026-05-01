const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : (import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8000');

// ── Request Deduplication ──
// If the same GET URL is already in-flight, return the same Promise
// instead of firing a second network request.
const inflightRequests = new Map();

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const method = (options.method || 'GET').toUpperCase();
  const url = `${API_BASE}${path}`;

  // Deduplication: only for GET requests (safe & idempotent)
  if (method === 'GET') {
    const existing = inflightRequests.get(url);
    if (existing) {
      return existing;
    }

    const promise = doFetch(url, { ...options, headers, method })
      .finally(() => {
        // Remove from in-flight map once resolved/rejected
        inflightRequests.delete(url);
      });

    inflightRequests.set(url, promise);
    return promise;
  }

  // Non-GET requests: always pass through
  return doFetch(url, { ...options, headers, method });
}

async function doFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}
