async function testRateLimit() {
  const url = 'http://localhost:8000/status';
  const token = 'test-token-123';
  let successCount = 0;
  let rateLimitCount = 0;
  let otherErrorCount = 0;

  console.log(`Sending 35 requests to ${url} with token ${token}...`);

  const requests = [];
  for (let i = 0; i < 35; i++) {
    requests.push(
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }).then(res => {
        if (res.status === 200) {
          successCount++;
        } else if (res.status === 429) {
          rateLimitCount++;
        } else {
          otherErrorCount++;
        }
      }).catch(err => {
        otherErrorCount++;
      })
    );
  }

  await Promise.all(requests);

  console.log('--- Test Results ---');
  console.log(`Successful Requests (200 OK): ${successCount}`);
  console.log(`Rate Limited Requests (429): ${rateLimitCount}`);
  console.log(`Other Errors: ${otherErrorCount}`);

  if (successCount === 30 && rateLimitCount === 5) {
    console.log('✅ Rate limit is working correctly! (Exactly 30 requests succeeded)');
  } else {
    console.log('❌ Rate limit test failed!');
  }
}

testRateLimit();
