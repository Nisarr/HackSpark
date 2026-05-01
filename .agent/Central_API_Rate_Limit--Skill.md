# RentPi Agent Guidelines: Central API Rate Limit Protection

> **CRITICAL RULE: The Central API has a hard limit of 30 requests per minute per token. Every violation costs -20 points. Our internal budget is capped at 20 req/min to leave safety margin. NEVER bypass the rate limiter.**

---

## Architecture Overview

```
┌───────────────┐            ┌──────────────────┐              ┌─────────────┐
│   Frontend    │──fetch()──→│   API Gateway    │──proxy──→    │  Backend    │
│  (React/Vite) │            │   (port 8000)    │              │  Services   │
│  port 3000    │            │                  │              │ 8001-8004   │
│               │            │  ┌────────────┐  │              │             │
│  api.js       │            │  │ In-memory  │  │              │  Each svc   │
│  - dedup      │            │  │ cache      │  │              │  uses       │
│  - retry      │            │  │ TTL-based  │  │              │  central-   │
│  - overlay    │            │  └────────────┘  │              │  api-client │
└───────────────┘            │  30 req/min/tok  │              │  .js        │
                             └──────────────────┘              │             │
                                                               │ ┌─────────┐│
                                                               │ │ Redis   ││
                                                               │ │ Token   ││
                                                               │ │ Bucket  ││
                                                               │ │ 20/min  ││
                                                               │ │ shared  ││
                                                               │ └─────────┘│
                                                               └──────┬──────┘
                                                                      │
                                                              ≤20 req/min
                                                                      │
                                                               ┌──────▼──────┐
                                                               │ Central API │
                                                               │  (external) │
                                                               │ 30 req/min  │
                                                               │   HARD CAP  │
                                                               └─────────────┘
```

### Four Protection Layers

| Layer | Component | What It Does |
|-------|-----------|--------------|
| **1** | Frontend `api.js` | Deduplicates in-flight GET requests; shows loading overlay on 503 |
| **2** | API Gateway cache | Serves repeated GETs from in-memory cache (TTL 15s–180s) |
| **3** | API Gateway rate limiter | 30 req/min per token — prevents frontend from overwhelming backends |
| **4** | `central-api-client.js` Redis token bucket | **All 4 backend services share a single 20 req/min budget** to central API |

---

## Rules for Writing New Code

### ❌ NEVER DO THIS

```javascript
// WRONG: Direct axios/fetch call to central API
const axios = require('axios');
const client = axios.create({
  baseURL: process.env.CENTRAL_API_URL,
  headers: { Authorization: `Bearer ${process.env.CENTRAL_API_TOKEN}` },
});
const { data } = await client.get('/api/data/products');
```

```javascript
// WRONG: Using fetch() to call central API directly
const res = await fetch(`${CENTRAL_API_URL}/api/data/products`);
```

```javascript
// WRONG: Importing centralApiClient directly and bypassing rate limiter
const centralApiClient = require('./central-api-client').centralApiClient;
await centralApiClient.get('/api/data/products');
```

### ✅ ALWAYS DO THIS

```javascript
// CORRECT: Use the centralApi() function from central-api-client.js
const { centralApi } = require('./central-api-client');

// For GET requests (automatically cached in Redis + rate limited):
const { data } = await centralApi().get('/api/data/products', { params });

// For POST/PUT/DELETE (rate limited but not cached):
const { data } = await centralApi().post('/api/data/something', body);
```

---

## Adding a New Backend Service

When creating a new microservice that needs central API data:

### Step 1: Copy `central-api-client.js`
```bash
cp rental-service/src/central-api-client.js new-service/src/central-api-client.js
```

### Step 2: Add `ioredis` to `package.json`
```json
{
  "dependencies": {
    "ioredis": "^5.4.1",
    "axios": "^1.7.0"
  }
}
```

### Step 3: Import and use in your service
```javascript
const { centralApi, getCacheStats } = require('./central-api-client');

// All calls go through the shared rate limiter
app.get('/my-endpoint', async (req, res) => {
  const { data } = await centralApi().get('/api/data/products');
  res.json(data);
});
```

### Step 4: Add `REDIS_URL` and dependencies in `docker-compose.yml`
```yaml
new-service:
  environment:
    CENTRAL_API_URL:   ${CENTRAL_API_URL}
    CENTRAL_API_TOKEN: ${CENTRAL_API_TOKEN}
    REDIS_URL:         redis://redis:6379     # ← REQUIRED
  depends_on:
    redis:
      condition: service_healthy              # ← REQUIRED
```

### Step 5: Add cache TTL for new endpoints (if needed)
In `central-api-client.js`, add patterns to `CACHE_TTL_MAP`:
```javascript
const CACHE_TTL_MAP = [
  // ... existing entries ...
  { pattern: /\/api\/data\/my-new-endpoint/,  ttl: 120 },  // 2 min
];
```

---

## Adding a New Frontend Page/Component

### Rule: All API calls MUST go through `api.js`

```jsx
// CORRECT
import { api } from '../api';

export default function MyPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/rentals/products?page=1')
      .then(setData)
      .catch(console.error);
  }, []);
}
```

```jsx
// WRONG — never use fetch() or axios directly in components
const res = await fetch('http://localhost:8000/rentals/products');
```

The `api()` function automatically:
- Adds the auth token
- Deduplicates concurrent GET requests
- Handles 503/429 (rate limit) → shows loading overlay → auto-retries
- Points to the gateway (port 8000), never to backend services directly

---

## Adding a New Gateway Route

When the API gateway needs to proxy a new backend route:

### Step 1: Add cache TTL rule (if GET endpoint)
In `api-gateway/src/index.js`, add to `CACHE_TTL_RULES`:
```javascript
{ pattern: /^GET:\/my-route\//,  ttl: 120 },  // 2 min cache
```

### Step 2: Add route resolver
In `resolveServiceURL()`:
```javascript
if (originalUrl.startsWith('/my-route'))
  return { target: SERVICES['new-service'], rewrite: originalUrl };
```

### Step 3: Register the route
```javascript
app.all('/my-route/*', cachedProxyHandler);
```

---

## Cache TTL Reference

### Gateway In-Memory Cache (api-gateway)

| Route Pattern | TTL | Purpose |
|---|---|---|
| `GET /rentals/products*` | 120s | Product listings |
| `GET /rentals/*/availability*` | 60s | Availability (changes faster) |
| `GET /analytics/*` | 180s | Historical analytics data |
| `GET /users/*/discount` | 120s | User discount tiers |
| `GET /chat/sessions` | 30s | Chat session list |
| `GET /chat/*/history` | 15s | Chat message history |

### Redis Cache (central-api-client.js — shared by all backend services)

| Central API Route | TTL | Purpose |
|---|---|---|
| `/api/data/categories` | 600s (10 min) | Category list (rarely changes) |
| `/api/data/products/batch` | 300s (5 min) | Batch product lookups |
| `/api/data/products/:id` | 300s (5 min) | Individual product |
| `/api/data/products` | 120s (2 min) | Product listings |
| `/api/data/rentals/stats` | 180s (3 min) | Rental statistics |
| `/api/data/rentals` | 60s (1 min) | Rental records |
| `/api/data/users/:id` | 120s (2 min) | User profiles/discount |

---

## How Rate Limiting Works

### Redis Token Bucket (shared across ALL services)

- **Key:** `ratelimit:central-api` in Redis
- **Budget:** 20 tokens per 60-second window
- **Algorithm:** Token bucket with linear refill via Lua script (atomic)
- **When exhausted:** Service waits up to 30s polling every 500ms for a token
- **Fallback:** In-memory bucket if Redis is down

### Gateway Per-Client Limiter

- **Budget:** 30 req/min per token (or per IP)
- **Library:** `express-rate-limit`
- **Response:** HTTP 429 with `Retry-After` header

### Frontend Behavior on Rate Limit

- `api.js` detects 503/429 response
- Broadcasts to `RateLimitOverlay` component
- Shows animated loading spinner with countdown
- Auto-retries once after cooldown period
- If still limited, throws error to calling component

---

## Service Audit Checklist

Run this whenever adding new code to verify no violations:

```bash
# 1. No bare axios.create() with CENTRAL_API anywhere except central-api-client.js
grep -r "axios.create.*CENTRAL" --include="*.js" --exclude="central-api-client.js"
# Expected: 0 results

# 2. No direct fetch() to central API
grep -r "fetch.*CENTRAL_API\|fetch.*api/data" --include="*.js" --include="*.jsx"
# Expected: 0 results

# 3. All services import from central-api-client
grep -r "require.*central-api-client" --include="index.js"
# Expected: 4 results (user, rental, analytics, agentic)

# 4. All services have ioredis
grep -r "ioredis" --include="package.json"
# Expected: 4 results

# 5. All services have REDIS_URL in docker-compose
grep "REDIS_URL" docker-compose.yml
# Expected: 4 results (user, rental, analytics, agentic)

# 6. No frontend components use fetch() directly
grep -r "fetch\(" --include="*.jsx" frontend/src/
# Expected: 0 results

# 7. Frontend only calls gateway, never backend services directly
grep -r "8001\|8002\|8003\|8004" --include="*.js" --include="*.jsx" frontend/src/
# Expected: 0 results
```

---

## File Map

```
hackspark-starter/
├── api-gateway/src/
│   └── index.js                  # Gateway cache proxy + rate limiter (30/min/token)
│
├── user-service/src/
│   ├── index.js                  # Uses centralApi() for /api/data/users/:id
│   └── central-api-client.js     # ★ Shared rate limiter (Redis token bucket 20/min)
│
├── rental-service/src/
│   ├── index.js                  # Uses centralApi() for products, rentals, categories
│   └── central-api-client.js     # ★ Same file, same Redis key
│
├── analytics-service/src/
│   ├── index.js                  # Uses centralApi() for rental stats, products
│   └── central-api-client.js     # ★ Same file, same Redis key
│
├── agentic-service/src/
│   ├── index.js                  # Uses centralApi() for grounding data in chat
│   └── central-api-client.js     # ★ Same file, same Redis key
│
├── frontend/src/
│   ├── api.js                    # Single entry point for all API calls (dedup + retry)
│   ├── App.jsx                   # Renders <RateLimitOverlay /> globally
│   ├── components/
│   │   └── RateLimitOverlay.jsx  # Loading animation on rate limit (countdown + spinner)
│   └── index.css                 # Overlay CSS (glassmorphism + spinner animations)
│
└── docker-compose.yml            # All 4 services have REDIS_URL + redis dependency
```

---

## Quick Decision Matrix

| Scenario | What to do |
|---|---|
| Need central API data in a backend service | Use `centralApi().get(url, { params })` |
| Need to add a new central API endpoint | Add TTL entry to `CACHE_TTL_MAP` in `central-api-client.js` |
| Need to call another internal service | Use `axios.get('http://service:port/path')` directly (internal, no rate limit) |
| Frontend needs data | Use `api('/path')` from `api.js` — always goes through gateway |
| Frontend needs to POST data | Use `api('/path', { method: 'POST', body: JSON.stringify(data) })` |
| New service needs central API access | Copy `central-api-client.js`, add `ioredis`, add `REDIS_URL` to docker-compose |
| Rate limit is hit | Frontend auto-shows overlay + auto-retries; backend waits for token |
