const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8000;

// ── Service URLs ──
const SERVICES = {
  'user-service':      process.env.USER_SERVICE_URL      || 'http://user-service:8001',
  'rental-service':    process.env.RENTAL_SERVICE_URL    || 'http://rental-service:8002',
  'analytics-service': process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003',
  'agentic-service':   process.env.AGENTIC_SERVICE_URL   || 'http://agentic-service:8004',
};

app.use(cors());

// ── P1: Aggregated Health Check ──
app.get('/status', async (req, res) => {
  const downstream = {};

  const checks = Object.entries(SERVICES).map(async ([name, url]) => {
    try {
      const { data } = await axios.get(`${url}/status`, { timeout: 3000 });
      downstream[name] = data.status || 'OK';
    } catch {
      downstream[name] = 'UNREACHABLE';
    }
  });

  await Promise.allSettled(checks);

  res.json({
    service: 'api-gateway',
    status: 'OK',
    downstream,
  });
});

// ── Global Rate Limiting (Max 20 req/min) ──
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  keyGenerator: () => 'global', // Apply limit globally across all IPs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ── Proxy: /users/* → user-service ──
app.use('/users', createProxyMiddleware({
  target: SERVICES['user-service'],
  changeOrigin: true,
  pathRewrite: (path, req) => `/users${req.url}`,
}));

// ── Proxy: /rentals/* → rental-service ──
app.use('/rentals', createProxyMiddleware({
  target: SERVICES['rental-service'],
  changeOrigin: true,
  pathRewrite: (path, req) => `/rentals${req.url}`,
}));

// ── Proxy: /analytics/* → analytics-service ──
app.use('/analytics', createProxyMiddleware({
  target: SERVICES['analytics-service'],
  changeOrigin: true,
  pathRewrite: (path, req) => `/analytics${req.url}`,
}));

// ── Proxy: /chat/* → agentic-service ──
app.use('/chat', createProxyMiddleware({
  target: SERVICES['agentic-service'],
  changeOrigin: true,
  pathRewrite: (path, req) => `/chat${req.url}`,
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api-gateway] listening on port ${PORT}`);
});
