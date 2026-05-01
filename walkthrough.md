# RentPi — Complete Work Done & Judges Walkthrough

> **Team Project: RentPi Microservices Platform**
> Built for HACKSPARK — Technocracy Lite, RUET

---

## Executive Summary

We built a **complete, production-grade microservices platform** with 6 services, 3 databases, an AI chatbot, and a polished React frontend — all orchestrated via Docker Compose with a single `docker-compose up --build` command. Every problem statement from P1 through P19, plus both bonus problems B1 and B2, has been implemented.

**Total potential score: 1,060 base + 125 bonus = 1,185 points**

---

## Architecture We Built

```
Browser → Frontend (React/Vite on Nginx, :3000)
              ↓
         API Gateway (:8000) ← In-memory cache + rate limiting + request dedup
           ↓    ↓    ↓    ↓
    user  rental analytics agentic
    :8001  :8002   :8003    :8004
      ↓              ↓ gRPC  ↓
   Supabase      Redis    MongoDB
   (Auth)       (Cache)   (Chat)
              ↓
     Central API (Judge's VPS) — rate-limited 30 req/min
```

**Key architectural decisions:**
- **Redis** added as a shared caching + rate-limiting layer across all backend services
- **Supabase** chosen for authentication (production-grade auth with JWT)
- **Groq LLaMA 3.1** for AI chatbot (fast inference, free tier)
- **gRPC** for internal agentic→analytics communication (Bonus B1)
- **Nginx** serves the built React app in production (tiny image ~40MB)

---

## Chapter 1: The Foundation (130 pts)

### P1: Health Checks (20 pts) ✅

**File:** `api-gateway/src/index.js` (lines 264-291)

Every service exposes `GET /status` returning `{ "service": "<name>", "status": "OK" }`.

The API gateway aggregates all four downstream services **in parallel** using `Promise.allSettled()`. If any service is unreachable, it reports `"UNREACHABLE"` instead of crashing.

**How to explain:** "We use `Promise.allSettled` not `Promise.all` — if one service is down, the gateway still responds with partial status instead of throwing an error. This is critical for production reliability."

---

### P2: User Authentication (40 pts) ✅

**File:** `user-service/src/index.js`

We chose **Supabase Auth** instead of rolling our own bcrypt+JWT system. This gives us:
- Industry-standard password hashing (bcrypt under the hood)
- JWT tokens that are cryptographically signed
- Email uniqueness enforcement (409 on duplicate)
- Rate limiting on auth attempts

**Endpoints implemented:**
| Endpoint | What it does |
|----------|-------------|
| `POST /users/register` | Creates user via `supabase.auth.admin.createUser()` with `email_confirm: true` to bypass email verification rate limits, then auto-signs them in |
| `POST /users/login` | `supabase.auth.signInWithPassword()` → returns JWT |
| `GET /users/me` | Auth middleware verifies token via `supabase.auth.getUser()`, returns profile |

**How to explain:** "We used `admin.createUser` with `email_confirm: true` because Supabase free tier limits confirmation emails to 3/hour. The admin API bypasses this entirely while still hashing passwords with bcrypt."

---

### P3: Product Proxy (30 pts) ✅

**File:** `rental-service/src/index.js` (lines 97-141)

Transparent proxy that:
- Attaches Bearer token from env automatically
- Forwards all query params (`category`, `page`, `limit`, `owner_id`) as-is
- Translates Central API errors (404, 429, 5xx) to appropriate responses

**How to explain:** "The proxy never exposes the team token to callers. All Central API calls go through our `centralApi()` client which auto-attaches the token and handles rate limiting."

---

### P4: Docker Compose & Multistage Builds (40 pts) ✅

**Files:** `docker-compose.yml`, all `Dockerfile` files, all `.dockerignore` files

**Single command:** `docker-compose up --build` starts all 8 containers.

**Multistage Dockerfiles** — every service uses:
```dockerfile
# Build stage
FROM node:20-alpine AS builder
# ... install all deps, copy source

# Runtime stage
FROM node:20-alpine
# ... npm install --omit=dev, copy only src/
```

**Frontend uses nginx:alpine** (~40MB) — builds the React app in the builder stage, copies only the `dist/` folder to nginx.

**Infrastructure:**
- Named volumes: `postgres_data`, `mongo_data`, `redis_data`
- Health checks on every service pointing to `/status`
- Proper `depends_on` with `condition: service_healthy`
- Custom bridge network `rentpi-net`

---

## Chapter 2: The Data Layer (345 pts + 25 bonus)

### P5: Paginated Product Listing with Category Filter (50 pts) ✅

**File:** `rental-service/src/index.js` (lines 97-127)

- Validates category against cached list from Central API
- Returns `400` with `validCategories` array if invalid
- Returns full pagination envelope: `{ data, page, limit, total, totalPages }`
- Categories fetched once and cached via Redis (10 min TTL) — not re-fetched per request

**How to explain:** "We cache the categories list in Redis with a 10-minute TTL. This means we call `/api/data/categories` at most once every 10 minutes across ALL services, saving rate limit budget."

---

### P6: The Loyalty Discount (35 pts) ✅

**File:** `user-service/src/index.js` (lines 97-123)

Fetches `securityScore` from Central API and computes discount tier:

| Score Range | Discount |
|-------------|----------|
| 80–100 | 20% |
| 60–79 | 15% |
| 40–59 | 10% |
| 20–39 | 5% |
| 0–19 | 0% |

Handles UUID-to-numeric mapping for Supabase users, and returns `404` for non-existent users.

---

### P7: Is It Available? (65 pts) ✅

**File:** `rental-service/src/index.js` (lines 143-243)

**Algorithm: Interval Merging (sort + single-pass merge)**

1. Fetch all rentals for the product (paginated)
2. Sort intervals by start date
3. Single-pass merge: if current interval overlaps with last merged, extend; otherwise add new
4. Filter merged busy periods that overlap the requested range
5. Compute free windows by scanning gaps between busy periods

**How to explain:** "The key insight is sorting intervals by start date first. Then a single left-to-right pass merges overlapping intervals — if the current interval's start is before the previous end, they overlap. This is O(n log n) for the sort and O(n) for the merge. A naive pairwise check would be O(n²)."

---

### P8: The Record Day (70 + 15 bonus pts) ✅

**File:** `rental-service/src/index.js` (lines 245-313)

**Algorithm: Min-Heap for Top-K (O(n log k) instead of O(n log n))**

We implemented a custom `MinHeap` class. Instead of sorting all dates:
1. Maintain a min-heap of size k
2. For each date-count pair, push to heap
3. If heap size > k, pop the smallest (evict)
4. After processing all entries, the heap root is the kth largest

**How to explain:** "We only need the kth busiest, not a full sort. Our min-heap keeps exactly k elements — the root is always the kth largest. Push is O(log k), and we do it n times, so total is O(n log k). For k=3 and n=180 days, this is dramatically faster than sorting. This earns the +15 bonus."

---

### P9: What Does This Renter Love? (60 + 10 bonus pts) ✅

**File:** `rental-service/src/index.js` (lines 315-392)

**Algorithm: Batch Fetch + Min-Heap Top-K**

1. Fetch all rentals by `renter_id` (paginated)
2. Collect unique product IDs, batch-fetch via `/products/batch?ids=...` (max 50 per call)
3. Tally category counts from product metadata
4. Use same MinHeap approach for top-k categories

**How to explain:** "Same heap trick as P8 — O(n log k) for finding top categories. We use the batch endpoint to fetch products 50 at a time, minimizing API calls. If a user rented 100 unique products, that's only 2 batch calls instead of 100 individual calls."

---

### P10: The Long Vacation (65 pts) ✅

**File:** `rental-service/src/index.js` (lines 394-511)

**Algorithm: Interval Merge → Gap Scan (reuses P7's core logic)**

1. Fetch all rentals, filter to target year, clamp to year boundaries
2. Sort + merge overlapping intervals (same as P7)
3. Scan gaps: before first rental, between merged intervals, after last rental
4. Track the longest gap

**How to explain:** "This shares the interval-merging sub-problem with P7. Once we have clean non-overlapping intervals, finding the longest gap is a simple linear scan. We clamp rentals that span year boundaries — a rental from Dec 2022 to Feb 2023 only contributes Jan 1 – Feb end for year 2023."

---

## Chapter 3: The Intelligence Layer (355 pts + 10 bonus)

### P11: The Seven-Day Rush (80 pts) ✅

**File:** `analytics-service/src/index.js` (lines 17-93)

**Algorithm: O(n) Sliding Window**

1. Fetch daily stats for each month, build a map
2. Fill ALL calendar days in range (missing dates = 0 rentals)
3. Initialize window sum for first 7 days
4. Slide: `windowSum += days[i].count - days[i-7].count`
5. Track best sum and position

**How to explain:** "We use `Date.UTC` to avoid timezone bugs when building the day array. The sliding window adds the new day and subtracts the day falling out — no inner loop, pure O(n). Judges can verify: there's exactly one `for` loop with a constant-time body."

---

### P12: The Unified Feed (80 pts) ✅

**File:** `rental-service/src/index.js` (lines 513-618)

**Algorithm: K-way Merge using Min-Heap**

1. Fetch first page of rentals for each product (already sorted by rentalStart)
2. Initialize min-heap with first element from each stream
3. Pop minimum, push to result, advance that stream's pointer
4. Stop when result has `limit` entries

We implemented inline heap functions (`hPush`, `hPop`) with a comparator on `rentalStart`.

**How to explain:** "We have K sorted arrays. Instead of concatenating and sorting (O(N·K·log(N·K))), we use a K-way merge with a min-heap. Each pop+push is O(log K), and we do it `limit` times, so total is O(limit · log K). For 10 products and limit=30, that's 30 × log(10) ≈ 100 operations vs sorting potentially thousands of records."

---

### P13: Chasing the Surge (55 pts) ✅

**File:** `analytics-service/src/index.js` (lines 95-153)

**Algorithm: Monotonic Stack — O(n) single pass**

1. Build full month array (fill missing dates with count=0)
2. Left-to-right pass with a stack of indices
3. When current day's count is strictly higher than stack top, pop and resolve
4. Remaining stack entries get `nextSurgeDate: null`

**How to explain:** "The naive O(n²) approach scans forward for each day. Our monotonic stack processes each day exactly once — push once, pop at most once. The stack maintains days 'waiting' for a higher count. When we find one, we pop all resolved days. Total: O(n) with n≈31. Judges can verify: single `for` loop, no nesting."

---

### P14: What's In Season? (60 + 10 bonus pts) ✅

**File:** `analytics-service/src/index.js` (lines 155-251)

1. Build 15-day windows (±7 days from target date) for past 2 years
2. Fetch rentals in those windows, tally product scores
3. Sort by score descending, take top `limit`
4. Batch-fetch product details for enrichment

Uses `Date.UTC` and proper date arithmetic to handle year-boundary edge cases (e.g., Jan 3 → Dec 27 – Jan 10 window).

---

### P15: RentPi Assistant (80 pts) ✅

**File:** `agentic-service/src/index.js`

**LLM: Groq LLaMA 3.1 8B Instant** (fast, free tier)

**Three-layer architecture:**

1. **Topic Guard** — Keyword-based pre-filter with 40+ RentPi-related keywords. Off-topic messages get a polite refusal WITHOUT any LLM call.

2. **Data Grounding** — Before calling the LLM, we fetch real data based on the question:
   | Question Type | Data Source |
   |--------------|-------------|
   | Category stats | Central API `/rentals/stats?group_by=category` |
   | Trending/recommendations | **gRPC** call to analytics-service (B1!) |
   | Peak window | HTTP to analytics-service |
   | Surge days | HTTP to analytics-service |
   | Availability | HTTP to rental-service |
   | User discount | Central API `/users/:id` |

3. **LLM Call** — Injects fetched data as `DATA CONTEXT` in the system prompt. The prompt explicitly says "NEVER invent numbers" and "if data unavailable, say so."

---

### P16: Chat That Remembers (60 pts) ✅

**File:** `agentic-service/src/index.js`

**MongoDB Collections:**
- `sessions`: `sessionId`, `name`, `createdAt`, `lastMessageAt`
- `messages`: `sessionId`, `role`, `content`, `timestamp`

**Features:**
- `GET /chat/sessions` — sorted by `lastMessageAt` descending
- `GET /chat/:sessionId/history` — all messages in order
- `DELETE /chat/:sessionId` — deletes session + all messages
- Auto-generated session names via lightweight LLM call on first message
- Full conversation history passed to LLM for multi-turn coherence
- `lastMessageAt` updated after every message

---

## Chapter 4: The Face (170 pts)

### P17: The Pixels Reborn (80 pts) ✅

**Stack:** React 18 + Vite + TailwindCSS + Lucide Icons + React Router

**All API calls go exclusively through the API gateway** — never directly to downstream services or Central API.

**Required Pages:**

| Route | Implementation |
|-------|---------------|
| `/login` | Login form → `POST /users/login` via gateway, stores JWT in localStorage |
| `/register` | Register form → `POST /users/register`, auto-redirects to products |
| `/products` | Paginated grid with category dropdown filter, skeleton loading, stats bar |
| `/availability` | Product ID + date range picker → shows busy periods (red) and free windows (green) |
| `/chat` | Full chatbot UI with session sidebar, history loading, typing indicators |

**Two Additional Pages (our choice):**

1. **`/discount` — Loyalty Discount Checker:** Enter a user ID, see their security score, discount percentage, and membership tier (Platinum/Gold/Silver/Bronze/Standard) with visual progress bars and tier-specific gradient styling.

2. **`/pulse` — Platform Pulse (KPI Dashboard):** Real-time KPIs showing total products, total rentals, active users, and a full category performance breakdown with animated bar charts.

**Additional pages beyond the required 2:**
- `/analytics` — Surge Day Analyzer + Peak 7-Day Window finder with interactive bar charts
- `/trending` — Seasonal recommendations with ranked cards

**UX Features:**
- Dark/Light mode toggle with system preference detection
- Skeleton loading states on every page
- Error states with friendly messages
- Glassmorphism design system
- Animated page transitions
- Protected routes (redirect to login if not authenticated)
- Floating AI chat widget accessible from every page
- Rate limit overlay with countdown timer

---

### P18: "What's Trending Today?" Widget (50 pts) ✅

**File:** `frontend/src/pages/Trending.jsx`

- On load: `GET /analytics/recommendations?date=TODAY&limit=9` — date is dynamic (`new Date().toISOString().split('T')[0]`)
- Responsive cards with product name, category badge, seasonal score
- Skeleton loading cards (not blank screen)
- Error state with retry button
- Refresh button that re-fetches with current date
- Top 3 have special gold/silver/bronze styling, #1 gets a crown emoji

---

### P19: Lean Images (40 pts) ✅

**All Dockerfiles use multistage builds:**

| Service | Strategy | Target |
|---------|----------|--------|
| api-gateway | `node:20-alpine` + `npm install --omit=dev` | < 150 MB |
| user-service | `node:20-alpine` + `npm install --omit=dev` | < 150 MB |
| rental-service | `node:20-alpine` + `npm install --omit=dev` | < 150 MB |
| analytics-service | `node:20-alpine` + `npm install --omit=dev` | < 150 MB |
| agentic-service | `node:20-alpine` + `npm install --omit=dev` | < 300 MB |
| frontend | Build with Vite → serve with `nginx:alpine` | < 50 MB |

**Every service has `.dockerignore`** excluding `node_modules/`, `.git/`, `*.md`, etc.

---

## Bonus Problems (90 pts)

### B1: gRPC Internal Communication (50 pts) ✅

**Proto file:** `analytics-service/src/proto/analytics.proto` (identical copy in `agentic-service/src/proto/`)

```protobuf
service AnalyticsService {
  rpc GetRecommendations (RecommendationRequest) returns (RecommendationResponse);
}
```

**Server:** `analytics-service/src/index.js` (lines 257-296) — gRPC server on port 50051
**Client:** `agentic-service/src/index.js` (lines 20-29) — gRPC client connecting to `analytics-service:50051`

**Used for:** When the chatbot needs trending/recommendation data, it calls `analyticsGrpcClient.GetRecommendations()` via gRPC instead of HTTP. This is visible in the `fetchGroundingData()` function (lines 93-106).

**How to explain:** "For the trending/recommendation grounding path in the chatbot, we replaced the HTTP call with gRPC. The analytics-service runs both an Express HTTP server on port 8003 AND a gRPC server on port 50051. The agentic-service connects to the gRPC server for internal communication while all external HTTP endpoints still work."

---

### B2: Graceful Rate Limit Handling (40 pts) ✅

**File:** `rental-service/src/central-api-client.js` (shared across all services)

**Implementation: Redis Token Bucket + Exponential Backoff**

**Layer 1: Proactive Rate Limiting (Redis Token Bucket)**
- Lua script for atomic token consumption
- 20 tokens/minute (conservative, 10 below the 30 hard limit)
- Shared across ALL services via Redis
- Queue-and-wait when tokens exhausted (polls every 500ms)
- In-memory fallback when Redis is down

**Layer 2: Reactive 429 Handling (Exponential Backoff with Jitter)**
- On 429: read `retryAfterSeconds`, wait, retry
- Backoff formula: `retryAfterSeconds × 2^attempt` with ±20% random jitter
- Max 3 retries with logging: `[retry 1/3] waiting 18s before retrying GET /api/data/products`
- After 3 failures: returns `503` with `{ error, lastRetryAfter, suggestion }`

**Layer 3: Response Caching (Redis)**
- Per-endpoint TTL (categories: 10min, products: 2min, stats: 3min, rentals: 1min)
- Cache-first: check Redis before making any API call
- Dramatically reduces actual API calls

**How to explain:** "We have three layers of protection. First, a Redis token bucket limits us to 20 req/min proactively — shared across all service instances via a Lua script for atomicity. Second, if we somehow get a 429, exponential backoff kicks in with jitter to prevent thundering herd. Third, Redis caching means repeated requests for the same data never hit the Central API at all."

---

## Additional Engineering Beyond Requirements

### API Gateway Caching Layer
**File:** `api-gateway/src/index.js`

The gateway implements its own caching layer between the frontend and backend services:
- In-memory cache with TTL-based eviction
- In-flight request deduplication (concurrent requests for same URL share one backend call)
- Cache invalidation on mutations (POST/PUT/DELETE)
- Background cache warmer (pre-fetches high-traffic endpoints)
- Cache stats exposed via `/status` endpoint

### Frontend Rate Limit Handling
**File:** `frontend/src/api.js` + `frontend/src/components/RateLimitOverlay.jsx`

- Global rate limit state management with pub/sub pattern
- Automatic retry with backoff on 503/429
- Full-screen overlay with animated countdown when rate-limited
- Request deduplication on the frontend (same GET URL → same Promise)

### Supabase Auth (Production-Grade)
Instead of basic bcrypt + local Postgres auth, we used Supabase which provides:
- bcrypt password hashing
- JWT with proper expiry and refresh
- Admin API for bypassing email rate limits
- Built-in protection against brute force

---

## Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, TailwindCSS 3, React Router 6, Lucide Icons |
| API Gateway | Express.js, Axios, express-rate-limit |
| User Service | Express.js, Supabase Auth SDK |
| Rental Service | Express.js, Axios, ioredis, custom MinHeap |
| Analytics Service | Express.js, Axios, ioredis, @grpc/grpc-js |
| Agentic Service | Express.js, Mongoose, Groq SDK (LLaMA 3.1), @grpc/grpc-js |
| Databases | PostgreSQL 16, MongoDB 7, Redis 7 |
| Infrastructure | Docker, Docker Compose, Nginx |
| Auth | Supabase (BaaS) |
| AI | Groq Cloud (LLaMA 3.1 8B Instant) |
| IPC | gRPC (Protocol Buffers) |

---

## Score Summary

| # | Problem | Points | Status |
|---|---------|--------|--------|
| P1 | Health Checks | 20 | ✅ |
| P2 | User Authentication | 40 | ✅ |
| P3 | Product Proxy | 30 | ✅ |
| P4 | Docker Compose + Multistage | 40 | ✅ |
| P5 | Paginated Product Listing | 50 | ✅ |
| P6 | The Loyalty Discount | 35 | ✅ |
| P7 | Is It Available? | 65 | ✅ |
| P8 | The Record Day | 70 + **15** | ✅ (MinHeap) |
| P9 | What Does This Renter Love? | 60 + **10** | ✅ (MinHeap) |
| P10 | The Long Vacation | 65 | ✅ |
| P11 | The Seven-Day Rush | 80 | ✅ (Sliding Window) |
| P12 | The Unified Feed | 80 | ✅ (K-way Merge Heap) |
| P13 | Chasing the Surge | 55 | ✅ (Monotonic Stack) |
| P14 | What's In Season? | 60 + **10** | ✅ |
| P15 | RentPi Assistant | 80 | ✅ (Groq LLaMA) |
| P16 | Chat That Remembers | 60 | ✅ (MongoDB) |
| P17 | The RentPi Dashboard | 80 | ✅ (8 pages) |
| P18 | Trending Widget | 50 | ✅ |
| P19 | Lean Images | 40 | ✅ |
| B1 | gRPC Bonus | **50** | ✅ |
| B2 | Rate Limit Handling | **40** | ✅ |
| **TOTAL** | | **1,060 + 125 = 1,185** | |

---

## Quick Demo Guide for Judges

```bash
# 1. Start everything
docker-compose up --build

# 2. Check health
curl http://localhost:8000/status

# 3. Register a user
curl -X POST http://localhost:8000/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Judge","email":"judge@test.com","password":"password123"}'

# 4. Browse products
curl "http://localhost:8000/rentals/products?page=1&limit=5"

# 5. Check availability
curl "http://localhost:8000/rentals/products/42/availability?from=2024-03-01&to=2024-03-14"

# 6. Check discount
curl "http://localhost:8000/users/42/discount"

# 7. Chat with AI
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo","message":"Which category had the most rentals?"}'

# 8. Open frontend
# http://localhost:3000
```

---

*Built with passion during HACKSPARK — Technocracy Lite*
