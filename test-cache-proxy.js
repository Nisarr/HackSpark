/**
 * Self-contained test: spins up a mock backend + api-gateway, then tests caching.
 * No Docker needed.
 */

const http = require('http');

// ── Track how many requests actually hit the backend ──
let backendHitCount = 0;

// ── Mock Backend (simulates rental-service, analytics-service, etc.) ──
const mockBackend = http.createServer((req, res) => {
  backendHitCount++;

  // POST /chat must be checked before the generic /chat/sessions match
  if (req.url.startsWith('/chat') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId: 'test', reply: 'Hello!' }));
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });

  if (req.url.startsWith('/rentals/products')) {
    res.end(JSON.stringify({ data: [{ id: 1, name: 'Test Product' }], total: 1, totalPages: 1 }));
  } else if (req.url.startsWith('/analytics/')) {
    res.end(JSON.stringify({ recommendations: [{ productId: 1, name: 'Test', score: 9.5 }] }));
  } else if (req.url.startsWith('/chat/sessions')) {
    res.end(JSON.stringify({ sessions: [] }));
  } else if (req.url.includes('/history')) {
    res.end(JSON.stringify({ messages: [] }));
  } else if (req.url.startsWith('/users/')) {
    res.end(JSON.stringify({ userId: 1, discountPercent: 15, securityScore: 85 }));
  } else {
    res.end(JSON.stringify({ status: 'OK' }));
  }
});

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Start mock backend on port 9099
  await new Promise(resolve => mockBackend.listen(9099, resolve));
  console.log('[mock-backend] listening on port 9099');

  // Start the api-gateway with service URLs pointing to mock
  const { execSync, spawn } = require('child_process');
  const gateway = spawn('node', ['src/index.js'], {
    cwd: 'd:\\HackSpark\\hackspark-starter\\api-gateway',
    env: {
      ...process.env,
      PORT: '8000',
      USER_SERVICE_URL: 'http://localhost:9099',
      RENTAL_SERVICE_URL: 'http://localhost:9099',
      ANALYTICS_SERVICE_URL: 'http://localhost:9099',
      AGENTIC_SERVICE_URL: 'http://localhost:9099',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  gateway.stdout.on('data', d => process.stdout.write(`[gw] ${d}`));
  gateway.stderr.on('data', d => process.stderr.write(`[gw-err] ${d}`));

  // Wait for gateway to start
  await sleep(3000);

  const API = 'http://localhost:8000';
  let allPassed = true;

  // ─── TEST 1: Rate Limit ───
  console.log('\n═══ TEST 1: Rate Limit (30 req/min per token) ═══');
  const token1 = `rl-test-${Date.now()}`;
  let ok = 0, limited = 0;
  const rlRequests = [];
  for (let i = 0; i < 35; i++) {
    rlRequests.push(
      fetch(`${API}/status`, { headers: { Authorization: `Bearer ${token1}` } })
        .then(r => { if (r.status === 200) ok++; else if (r.status === 429) limited++; })
        .catch(() => {})
    );
  }
  await Promise.all(rlRequests);
  const rlPass = ok === 30 && limited === 5;
  console.log(`  Success: ${ok} | Rate-limited: ${limited}`);
  console.log(`  ${rlPass ? '✅ PASS' : '❌ FAIL'}`);
  if (!rlPass) allPassed = false;

  // Wait for rate limit to partially refill
  console.log('\n  ⏳ Waiting 3s...');
  await sleep(3000);

  // ─── TEST 2: Caching — repeated GETs served from cache ───
  console.log('\n═══ TEST 2: Cache Deduplication ═══');
  const token2 = `cache-test-${Date.now()}`;
  backendHitCount = 0;

  // Fire 10 rapid GETs to the same endpoint
  const cacheResults = [];
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${API}/rentals/products?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    cacheResults.push({
      status: res.status,
      cache: res.headers.get('x-cache'),
    });
  }

  const hits = cacheResults.filter(r => r.cache === 'HIT').length;
  const misses = cacheResults.filter(r => r.cache === 'MISS').length;
  console.log(`  10 rapid GETs: ${hits} cache HITs, ${misses} cache MISSes`);
  console.log(`  Backend was actually hit: ${backendHitCount} times`);

  // Only 1 request should have actually hit the backend
  // The rest should be cache hits. Allow for the cache warmer too.
  const cachePass = hits >= 8 && backendHitCount <= 3;
  console.log(`  ${cachePass ? '✅ PASS' : '❌ FAIL'}: Only ${backendHitCount} backend hits for 10 requests`);
  if (!cachePass) allPassed = false;

  // ─── TEST 3: Double-mount simulation ───
  console.log('\n═══ TEST 3: React Double-Mount Simulation ═══');
  backendHitCount = 0;
  const token3 = `mount-test-${Date.now()}`;

  // Simulate 3 pages mounting twice each (6 requests, 3 unique)
  const pages = [
    '/analytics/recommendations?date=2024-01-01&limit=9',
    '/analytics/recommendations?date=2024-01-01&limit=9',
    '/chat/sessions',
    '/chat/sessions',
    '/users/42/discount',
    '/users/42/discount',
  ];

  const mountResults = await Promise.all(
    pages.map(path =>
      fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token3}` } })
        .then(async r => ({ path, status: r.status, cache: r.headers.get('x-cache') }))
        .catch(() => ({ path, status: 'ERR', cache: null }))
    )
  );

  const mountHits = mountResults.filter(r => r.cache === 'HIT').length;
  console.log(`  6 requests (3 unique × 2 double-mounts):`);
  mountResults.forEach(r => console.log(`    ${r.cache || 'N/A'.padEnd(4)} ${r.status} ${r.path}`));
  console.log(`  Backend hits: ${backendHitCount} (should be ≤ 3)`);

  const mountPass = backendHitCount <= 3;
  console.log(`  ${mountPass ? '✅ PASS' : '❌ FAIL'}: Double-mounts served from cache`);
  if (!mountPass) allPassed = false;

  // ─── TEST 4: POST bypasses cache ───
  console.log('\n═══ TEST 4: POST Bypasses Cache ═══');
  backendHitCount = 0;
  const token4 = `post-test-${Date.now()}`;

  const postRes = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token4}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId: 'test-sess', message: 'hello' }),
  });

  const postCache = postRes.headers.get('x-cache');
  console.log(`  POST /chat: status=${postRes.status}, cache=${postCache || 'none'}`);

  // Key assertion: POST must NEVER be served from cache
  const postPass = postCache !== 'HIT' && postRes.status === 200;
  console.log(`  ${postPass ? '✅ PASS' : '❌ FAIL'}: POST always hits backend (not cached)`);
  if (!postPass) allPassed = false;

  // ─── TEST 5: Cache invalidation after mutation ───
  console.log('\n═══ TEST 5: Cache Invalidation After Mutation ═══');
  const token5 = `inv-test-${Date.now()}`;

  // First, cache /chat/sessions
  await fetch(`${API}/chat/sessions`, { headers: { Authorization: `Bearer ${token5}` } });
  const beforeRes = await fetch(`${API}/chat/sessions`, { headers: { Authorization: `Bearer ${token5}` } });
  const beforeCache = beforeRes.headers.get('x-cache');
  console.log(`  Before POST: /chat/sessions cache=${beforeCache}`);

  // POST to /chat should invalidate /chat/sessions cache
  await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token5}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'test-inv', message: 'hi' }),
  });

  const afterRes = await fetch(`${API}/chat/sessions`, { headers: { Authorization: `Bearer ${token5}` } });
  const afterCache = afterRes.headers.get('x-cache');
  console.log(`  After POST:  /chat/sessions cache=${afterCache}`);

  const invPass = beforeCache === 'HIT' && afterCache === 'MISS';
  console.log(`  ${invPass ? '✅ PASS' : '❌ FAIL'}: Cache invalidated after mutation`);
  if (!invPass) allPassed = false;

  // ─── Summary ───
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  All Tests: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}                          ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  // Cleanup
  gateway.kill();
  mockBackend.close();
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
