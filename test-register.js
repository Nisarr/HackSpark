const http = require('http');

const data = JSON.stringify({
  name: 'Test',
  email: 'test@example.com',
  password: 'password123'
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 8000,
  path: '/users/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', err => console.log('Error:', err.message));
req.write(data);
req.end();
