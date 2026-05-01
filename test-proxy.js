const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(createProxyMiddleware('/users', {
  target: 'http://localhost:8001',
  changeOrigin: true,
}));

app.listen(8080, () => console.log('Proxy on 8080'));
