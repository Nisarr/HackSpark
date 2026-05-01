const http = require('http');

const BASE = 'http://localhost:9004';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  const results = [];
  const sessionId = 'test-session-' + Date.now();

  // ═══════════ Test 1: Health Check ═══════════
  console.log('\n═══ Test 1: GET /status ═══');
  try {
    const r = await request('GET', '/status');
    console.log('  Status:', r.status, '| Body:', JSON.stringify(r.body));
    results.push({ test: 'Health Check', pass: r.status === 200 && r.body.status === 'OK' });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Health Check', pass: false }); }

  // ═══════════ Test 2: Chat - Categories (tool: get_categories) ═══════════
  console.log('\n═══ Test 2: POST /chat - Categories ═══');
  try {
    const r = await request('POST', '/chat', { sessionId, message: 'What rental categories does RentPi have?' });
    console.log('  Status:', r.status);
    console.log('  Reply:', r.body.reply?.substring(0, 200));
    results.push({ test: 'Chat Categories', pass: r.status === 200 && r.body.reply && r.body.sessionId === sessionId });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Chat Categories', pass: false }); }

  // ═══════════ Test 3: Chat - Rental Stats (tool: get_rental_stats) ═══════════
  console.log('\n═══ Test 3: POST /chat - Rental Stats ═══');
  try {
    const r = await request('POST', '/chat', { message: 'Which category has the most rentals? Give me the stats.' });
    console.log('  Status:', r.status);
    console.log('  Reply:', r.body.reply?.substring(0, 200));
    results.push({ test: 'Chat Rental Stats', pass: r.status === 200 && r.body.reply });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Chat Rental Stats', pass: false }); }

  // ═══════════ Test 4: Chat - User Discount (tool: get_user_info / get_user_discount) ═══════════
  console.log('\n═══ Test 4: POST /chat - User Discount ═══');
  try {
    const r = await request('POST', '/chat', { message: 'What discount does user #100 get?' });
    console.log('  Status:', r.status);
    console.log('  Reply:', r.body.reply?.substring(0, 200));
    results.push({ test: 'Chat User Discount', pass: r.status === 200 && r.body.reply });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Chat User Discount', pass: false }); }

  // ═══════════ Test 5: Chat - Off-topic guard ═══════════
  console.log('\n═══ Test 5: POST /chat - Off-topic guard ═══');
  try {
    const r = await request('POST', '/chat', { message: 'Write me a poem about the moon' });
    console.log('  Status:', r.status);
    console.log('  Reply:', r.body.reply?.substring(0, 200));
    const isRefusal = r.body.reply?.includes("RentPi's assistant");
    results.push({ test: 'Off-topic Guard', pass: r.status === 200 && isRefusal });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Off-topic Guard', pass: false }); }

  // ═══════════ Test 6: Chat - No message body ═══════════
  console.log('\n═══ Test 6: POST /chat - Missing message ═══');
  try {
    const r = await request('POST', '/chat', {});
    console.log('  Status:', r.status, '| Body:', JSON.stringify(r.body));
    results.push({ test: 'Missing Message 400', pass: r.status === 400 });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Missing Message 400', pass: false }); }

  // ═══════════ Test 7: List sessions ═══════════
  console.log('\n═══ Test 7: GET /chat/sessions ═══');
  try {
    const r = await request('GET', '/chat/sessions');
    console.log('  Status:', r.status, '| Sessions count:', r.body.sessions?.length);
    results.push({ test: 'List Sessions', pass: r.status === 200 && Array.isArray(r.body.sessions) });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'List Sessions', pass: false }); }

  // ═══════════ Test 8: Session history ═══════════
  console.log('\n═══ Test 8: GET /chat/:sessionId/history ═══');
  try {
    const r = await request('GET', `/chat/${sessionId}/history`);
    console.log('  Status:', r.status, '| Messages count:', r.body.messages?.length);
    results.push({ test: 'Session History', pass: r.status === 200 && Array.isArray(r.body.messages) && r.body.messages.length >= 2 });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Session History', pass: false }); }

  // ═══════════ Test 9: Delete session ═══════════
  console.log('\n═══ Test 9: DELETE /chat/:sessionId ═══');
  try {
    const r = await request('DELETE', `/chat/${sessionId}`);
    console.log('  Status:', r.status, '| Body:', JSON.stringify(r.body));
    results.push({ test: 'Delete Session', pass: r.status === 200 });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Delete Session', pass: false }); }

  // ═══════════ Test 10: Verify deleted ═══════════
  console.log('\n═══ Test 10: GET /chat/:sessionId/history (after delete) ═══');
  try {
    const r = await request('GET', `/chat/${sessionId}/history`);
    console.log('  Status:', r.status, '| Body:', JSON.stringify(r.body));
    results.push({ test: 'Deleted Session 404', pass: r.status === 404 });
  } catch (e) { console.log('  ERROR:', e.message); results.push({ test: 'Deleted Session 404', pass: false }); }

  // ═══════════ Summary ═══════════
  console.log('\n\n══════════════════════════════');
  console.log('       TEST SUMMARY');
  console.log('══════════════════════════════');
  let passCount = 0;
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`  ${icon} ${r.test}`);
    if (r.pass) passCount++;
  }
  console.log(`\n  Result: ${passCount}/${results.length} passed`);
  console.log('══════════════════════════════\n');
}

runTests().catch(e => console.error('Fatal:', e));
