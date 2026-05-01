const http = require('http');

const data = JSON.stringify({
  sessionId: 'test-123',
  message: 'recommendation'
});

const req = http.request({
  hostname: 'localhost',
  port: 8104,
  path: '/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', err => console.log('Error:', err.message));
req.write(data);
req.end();
