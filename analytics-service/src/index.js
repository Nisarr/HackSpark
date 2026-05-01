const express = require('express');
const cors = require('cors');
const { centralApi, getCacheStats } = require('./central-api-client');

const app = express();
const PORT = process.env.PORT || 8003;

app.use(cors());
app.use(express.json());

// ── P1: Health Check ──
app.get('/status', async (req, res) => {
  const cacheStats = await getCacheStats();
  res.json({ service: 'analytics-service', status: 'OK', cache: cacheStats });
});

// ── P11: Peak 7-day Sliding Window ──
app.get('/analytics/peak-window', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: 'from and to must be valid YYYY-MM strings' });
    }
    if (from > to) return res.status(400).json({ error: 'from must not be after to' });

    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    const monthDiff = (ty - fy) * 12 + (tm - fm);
    if (monthDiff > 11) return res.status(400).json({ error: 'Max range is 12 months' });

    // Fetch daily stats for each month
    const dailyMap = {};
    let cy = fy, cm = fm;
    while (cy < ty || (cy === ty && cm <= tm)) {
      const month = `${cy}-${String(cm).padStart(2, '0')}`;
      try {
        const { data } = await centralApi().get('/api/data/rentals/stats', {
          params: { group_by: 'date', month },
        });
        for (const d of data.data) dailyMap[d.date] = d.count;
      } catch (err) {
        if (err.response?.status === 503) throw err;
      }
      cm++;
      if (cm > 12) { cm = 1; cy++; }
    }

    // Build array of every calendar day in range with counts (missing = 0)
    // Use Date.UTC to avoid local timezone offset issues when formatting to ISO string
    const rangeStart = new Date(Date.UTC(fy, fm - 1, 1));
    const rangeEnd = new Date(Date.UTC(ty, tm, 0)); // last day of `to` month

    const days = [];
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      const dateStr = cursor.toISOString().split('T')[0];
      days.push({ date: dateStr, count: dailyMap[dateStr] || 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    if (days.length < 7) {
      return res.status(400).json({ error: 'Not enough data for a 7-day window' });
    }

    // Sliding window of size 7 (O(n))
    let windowSum = 0;
    for (let i = 0; i < 7; i++) windowSum += days[i].count;

    let bestSum = windowSum;
    let bestStart = 0;

    for (let i = 7; i < days.length; i++) {
      windowSum += days[i].count - days[i - 7].count;
      if (windowSum > bestSum) {
        bestSum = windowSum;
        bestStart = i - 6;
      }
    }

    res.json({
      from, to,
      peakWindow: {
        from: days[bestStart].date,
        to: days[bestStart + 6].date,
        totalRentals: bestSum,
      },
    });
  } catch (err) {
    if (err.response?.status === 503) return res.status(503).json(err.response.data);
    console.error('[analytics-service] peak-window error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P13: Surge Days (monotonic stack — O(n)) ──
app.get('/analytics/surge-days', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month must be a valid YYYY-MM string' });
    }

    const { data } = await centralApi().get('/api/data/rentals/stats', {
      params: { group_by: 'date', month },
    });

    const countMap = {};
    for (const d of data.data) countMap[d.date] = d.count;

    // Build full month array (fill missing with 0)
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, count: countMap[dateStr] || 0 });
    }

    // Monotonic stack: next greater element (right to left)
    const result = new Array(days.length).fill(null);
    const stack = []; // stack of indices

    for (let i = days.length - 1; i >= 0; i--) {
      // Pop elements that are not strictly greater
      while (stack.length > 0 && days[stack[stack.length - 1]].count <= days[i].count) {
        stack.pop();
      }
      if (stack.length > 0) {
        const j = stack[stack.length - 1];
        result[i] = {
          date: days[i].date,
          count: days[i].count,
          nextSurgeDate: days[j].date,
          daysUntil: j - i,
        };
      } else {
        result[i] = {
          date: days[i].date,
          count: days[i].count,
          nextSurgeDate: null,
          daysUntil: null,
        };
      }
      stack.push(i);
    }

    res.json({ month, data: result });
  } catch (err) {
    if (err.response?.status === 503) return res.status(503).json(err.response.data);
    console.error('[analytics-service] surge-days error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P14: Seasonal Recommendations ──
async function fetchRecommendations(date, limitNum) {
  const targetDate = new Date(date);
  const year = targetDate.getFullYear();

    // Build 15-day windows (7 days before and after) for past 2 years
    const windows = [];
    for (let y = year - 2; y < year; y++) {
      const centerDate = new Date(y, targetDate.getMonth(), targetDate.getDate());
      const windowStart = new Date(centerDate);
      windowStart.setDate(windowStart.getDate() - 7);
      const windowEnd = new Date(centerDate);
      windowEnd.setDate(windowEnd.getDate() + 7);
      windows.push({ from: windowStart, to: windowEnd });
    }

    // Fetch rentals for those windows
    const productScores = {};
    for (const w of windows) {
      const fromStr = w.from.toISOString().split('T')[0];
      const toStr = w.to.toISOString().split('T')[0];

      let page = 1;
      let hasMore = true;
      while (hasMore) {
        try {
          const { data } = await centralApi().get('/api/data/rentals', {
            params: { from: fromStr, to: toStr, page, limit: 100 },
          });
          for (const r of data.data) {
            productScores[r.productId] = (productScores[r.productId] || 0) + 1;
          }
          hasMore = data.data.length === 100;
          page++;
        } catch (err) {
          if (err.response?.status === 503) throw err;
          hasMore = false;
        }
      }
    }

    if (Object.keys(productScores).length === 0) {
      return [];
    }

    // Sort by score descending, take top limit
    const sorted = Object.entries(productScores)
      .map(([pid, score]) => ({ productId: parseInt(pid), score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limitNum);

    // Batch fetch product details
    const pids = sorted.map(s => s.productId);
    const productMap = {};
    for (let i = 0; i < pids.length; i += 50) {
      const batch = pids.slice(i, i + 50);
      try {
        const { data } = await centralApi().get('/api/data/products/batch', {
          params: { ids: batch.join(',') },
        });
        for (const p of data.data) productMap[p.id] = p;
      } catch (err) {
        if (err.response?.status === 503) throw err;
      }
    }

  const recommendations = sorted.map(s => ({
    productId: s.productId,
    name: productMap[s.productId]?.name || `Product #${s.productId}`,
    category: productMap[s.productId]?.category || 'UNKNOWN',
    score: s.score,
  }));

  return recommendations;
}

app.get('/analytics/recommendations', async (req, res) => {
  try {
    const { date, limit: limitStr } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be a valid YYYY-MM-DD string' });
    }
    const limitNum = parseInt(limitStr) || 10;
    if (limitNum < 1 || limitNum > 50) {
      return res.status(400).json({ error: 'limit must be 1-50' });
    }

    const recommendations = await fetchRecommendations(date, limitNum);
    res.json({ date, recommendations });
  } catch (err) {
    if (err.response?.status === 503) return res.status(503).json(err.response.data);
    console.error('[analytics-service] recommendations error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[analytics-service] listening on port ${PORT}`);
});

// ── B1: gRPC Server ──
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, 'proto', 'analytics.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const analyticsProto = grpc.loadPackageDefinition(packageDefinition).analytics;

function getRecommendationsGrpc(call, callback) {
  const { date, limit } = call.request;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid date format' });
  }
  const limitNum = limit || 10;
  
  fetchRecommendations(date, limitNum)
    .then(recommendations => {
      callback(null, { date, recommendations });
    })
    .catch(err => {
      console.error('[analytics-service] gRPC error:', err.message);
      callback({ code: grpc.status.INTERNAL, message: 'Internal server error' });
    });
}

const grpcServer = new grpc.Server();
grpcServer.addService(analyticsProto.AnalyticsService.service, {
  GetRecommendations: getRecommendationsGrpc
});

grpcServer.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('[analytics-service] gRPC bind error:', err);
    return;
  }
  console.log(`[analytics-service] gRPC listening on port ${port}`);
});
