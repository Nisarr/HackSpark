const express = require('express');
const cors = require('cors');
const { centralApi, getCacheStats } = require('./central-api-client');

const app = express();
const PORT = process.env.PORT || 8002;

app.use(cors());
app.use(express.json());

// ── Category helper (caching handled by central-api-client via Redis) ──
async function getCategories() {
  const { data } = await centralApi().get('/api/data/categories');
  return data.categories;
}

// ── P1: Health Check ──
app.get('/status', async (req, res) => {
  const cacheStats = await getCacheStats();
  res.json({ service: 'rental-service', status: 'OK', cache: cacheStats });
});

// ── P3 + P5: List products (proxy with category validation) ──
app.get('/rentals/products', async (req, res) => {
  try {
    const { category, page, limit, owner_id } = req.query;

    // P5: Validate category if provided
    if (category) {
      const validCategories = await getCategories();
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: `Invalid category '${category}'`,
          validCategories,
        });
      }
    }

    const params = {};
    if (category) params.category = category;
    if (page) params.page = page;
    if (limit) params.limit = limit;
    if (owner_id) params.owner_id = owner_id;

    const { data } = await centralApi().get('/api/data/products', { params });
    res.json(data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    console.error('[rental-service] products error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P3: Get product by ID ──
app.get('/rentals/products/:id', async (req, res) => {
  try {
    const { data } = await centralApi().get(`/api/data/products/${req.params.id}`);
    res.json(data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    console.error('[rental-service] product by id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P7: Product Availability (interval merging) ──
app.get('/rentals/products/:id/availability', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required (YYYY-MM-DD)' });
    }

    const reqFrom = new Date(from);
    const reqTo = new Date(to);
    if (isNaN(reqFrom) || isNaN(reqTo)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Fetch all rentals for this product (paginate through all)
    let allRentals = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const { data } = await centralApi().get('/api/data/rentals', {
        params: { product_id: productId, page, limit: 100 },
      });
      allRentals = allRentals.concat(data.data);
      hasMore = data.data.length === 100 && page < data.totalPages;
      page++;
    }

    // Build intervals and merge overlapping ones
    const intervals = allRentals.map(r => ({
      start: new Date(r.rentalStart),
      end: new Date(r.rentalEnd),
    }));
    intervals.sort((a, b) => a.start - b.start);

    const merged = [];
    for (const interval of intervals) {
      if (merged.length === 0 || interval.start > merged[merged.length - 1].end) {
        merged.push({ start: new Date(interval.start), end: new Date(interval.end) });
      } else {
        merged[merged.length - 1].end = new Date(Math.max(merged[merged.length - 1].end, interval.end));
      }
    }

    // Filter busy periods that overlap with requested range
    const busyPeriods = merged.filter(m => m.start <= reqTo && m.end >= reqFrom);

    // Find free windows within the requested range
    const freeWindows = [];
    let cursor = new Date(reqFrom);

    for (const busy of busyPeriods) {
      if (cursor < busy.start) {
        const freeEnd = new Date(Math.min(busy.start.getTime() - 86400000, reqTo));
        if (cursor <= freeEnd) {
          freeWindows.push({
            start: cursor.toISOString().split('T')[0],
            end: freeEnd.toISOString().split('T')[0],
          });
        }
      }
      cursor = new Date(Math.max(cursor, new Date(busy.end.getTime() + 86400000)));
    }

    if (cursor <= reqTo) {
      freeWindows.push({
        start: cursor.toISOString().split('T')[0],
        end: reqTo.toISOString().split('T')[0],
      });
    }

    const available = busyPeriods.length === 0 ||
      busyPeriods.every(b => b.end < reqFrom || b.start > reqTo);

    res.json({
      productId,
      from,
      to,
      available,
      busyPeriods: busyPeriods.map(b => ({
        start: b.start.toISOString().split('T')[0],
        end: b.end.toISOString().split('T')[0],
      })),
      freeWindows,
    });
  } catch (err) {
    console.error('[rental-service] availability error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P8: Kth Busiest Date (min-heap approach) ──
app.get('/rentals/kth-busiest-date', async (req, res) => {
  try {
    const { from, to, k } = req.query;

    // Validation
    const fromMatch = from && /^\d{4}-\d{2}$/.test(from);
    const toMatch = to && /^\d{4}-\d{2}$/.test(to);
    if (!fromMatch || !toMatch) {
      return res.status(400).json({ error: 'from and to must be valid YYYY-MM strings' });
    }

    const kNum = parseInt(k);
    if (!k || isNaN(kNum) || kNum < 1) {
      return res.status(400).json({ error: 'k must be a positive integer' });
    }

    // Check from <= to
    if (from > to) {
      return res.status(400).json({ error: 'from must not be after to' });
    }

    // Check max 12 months range
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    const monthDiff = (ty - fy) * 12 + (tm - fm);
    if (monthDiff > 11) {
      return res.status(400).json({ error: 'Max range is 12 months' });
    }

    // Fetch stats for each month in range
    const allDates = [];
    let cy = fy, cm = fm;
    while (cy < ty || (cy === ty && cm <= tm)) {
      const month = `${cy}-${String(cm).padStart(2, '0')}`;
      try {
        const { data } = await centralApi().get('/api/data/rentals/stats', {
          params: { group_by: 'date', month },
        });
        allDates.push(...data.data);
      } catch (err) {
        if (err.response?.status === 503) throw err;
      }
      cm++;
      if (cm > 12) { cm = 1; cy++; }
    }

    if (kNum > allDates.length) {
      return res.status(404).json({ error: `k=${kNum} exceeds total distinct dates (${allDates.length})` });
    }

    // Min-heap of size k to find kth largest (optimized approach)
    // Using a simple partial sort: maintain array of top k items
    const topK = [];
    for (const entry of allDates) {
      topK.push(entry);
      topK.sort((a, b) => b.count - a.count);
      if (topK.length > kNum) topK.pop();
    }

    // Wait — for bonus points we need better than full sort.
    // QuickSelect approach: partition to find kth largest
    // Actually let's use a proper min-heap:
    const heap = [];

    function heapPush(val) {
      heap.push(val);
      let i = heap.length - 1;
      while (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        if (heap[parent].count <= heap[i].count) break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
      }
    }

    function heapPop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          let smallest = i;
          const left = 2 * i + 1, right = 2 * i + 2;
          if (left < heap.length && heap[left].count < heap[smallest].count) smallest = left;
          if (right < heap.length && heap[right].count < heap[smallest].count) smallest = right;
          if (smallest === i) break;
          [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
          i = smallest;
        }
      }
      return top;
    }

    // Push all dates, keep only top k
    for (const entry of allDates) {
      heapPush(entry);
      if (heap.length > kNum) heapPop();
    }

    // The root of the min-heap is the kth largest
    const result = heap[0];

    res.json({ from, to, k: kNum, date: result.date, rentalCount: result.count });
  } catch (err) {
    console.error('[rental-service] kth-busiest error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P9: Top Categories per User (batch + min-heap) ──
app.get('/rentals/users/:id/top-categories', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const kNum = parseInt(req.query.k);
    if (isNaN(kNum) || kNum < 1) {
      return res.status(400).json({ error: 'k must be a positive integer' });
    }

    // Fetch all rentals for this user
    let allRentals = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const { data } = await centralApi().get('/api/data/rentals', {
        params: { renter_id: userId, page, limit: 100 },
      });
      allRentals = allRentals.concat(data.data);
      hasMore = data.data.length === 100 && page < data.totalPages;
      page++;
    }

    if (allRentals.length === 0) {
      return res.json({ userId, topCategories: [] });
    }

    // Collect unique product IDs
    const productIds = [...new Set(allRentals.map(r => r.productId))];

    // Batch fetch products (max 50 per call)
    const productMap = {};
    for (let i = 0; i < productIds.length; i += 50) {
      const batch = productIds.slice(i, i + 50);
      const { data } = await centralApi().get('/api/data/products/batch', {
        params: { ids: batch.join(',') },
      });
      for (const p of data.data) {
        productMap[p.id] = p;
      }
    }

    // Tally category counts
    const categoryCounts = {};
    for (const rental of allRentals) {
      const product = productMap[rental.productId];
      if (product) {
        categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
      }
    }

    // Min-heap to find top k categories
    const entries = Object.entries(categoryCounts).map(([category, rentalCount]) => ({ category, rentalCount }));

    // Use min-heap of size k
    const heap = [];
    function push(val) {
      heap.push(val);
      let i = heap.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (heap[p].rentalCount <= heap[i].rentalCount) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    }
    function pop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          let s = i, l = 2*i+1, r = 2*i+2;
          if (l < heap.length && heap[l].rentalCount < heap[s].rentalCount) s = l;
          if (r < heap.length && heap[r].rentalCount < heap[s].rentalCount) s = r;
          if (s === i) break;
          [heap[i], heap[s]] = [heap[s], heap[i]];
          i = s;
        }
      }
      return top;
    }

    for (const entry of entries) {
      push(entry);
      if (heap.length > kNum) pop();
    }

    // Extract and sort descending
    const topCategories = [];
    while (heap.length > 0) topCategories.push(pop());
    topCategories.sort((a, b) => b.rentalCount - a.rentalCount);

    res.json({ userId, topCategories });
  } catch (err) {
    console.error('[rental-service] top-categories error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P10: Longest Free Streak ──
app.get('/rentals/products/:id/free-streak', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const year = parseInt(req.query.year);
    if (isNaN(year)) {
      return res.status(400).json({ error: 'year must be a valid integer' });
    }

    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year}-12-31`);

    // Fetch all rentals for this product
    let allRentals = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const { data } = await centralApi().get('/api/data/rentals', {
        params: { product_id: productId, page, limit: 100 },
      });
      allRentals = allRentals.concat(data.data);
      hasMore = data.data.length === 100 && page < data.totalPages;
      page++;
    }

    // Filter and clamp rentals to the target year
    const intervals = allRentals
      .map(r => ({
        start: new Date(r.rentalStart),
        end: new Date(r.rentalEnd),
      }))
      .filter(r => r.start <= yearEnd && r.end >= yearStart)
      .map(r => ({
        start: new Date(Math.max(r.start, yearStart)),
        end: new Date(Math.min(r.end, yearEnd)),
      }));

    // Sort by start and merge overlapping intervals
    intervals.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const interval of intervals) {
      if (merged.length === 0 || interval.start > merged[merged.length - 1].end) {
        merged.push({ start: new Date(interval.start), end: new Date(interval.end) });
      } else {
        merged[merged.length - 1].end = new Date(Math.max(merged[merged.length - 1].end, interval.end));
      }
    }

    // No rentals in that year → entire year is free
    if (merged.length === 0) {
      const days = Math.floor((yearEnd - yearStart) / 86400000) + 1;
      return res.json({
        productId, year,
        longestFreeStreak: {
          from: yearStart.toISOString().split('T')[0],
          to: yearEnd.toISOString().split('T')[0],
          days,
        },
      });
    }

    // Find the longest gap
    let longest = { from: null, to: null, days: 0 };

    // Gap before first rental
    const daysBefore = Math.floor((merged[0].start - yearStart) / 86400000);
    if (daysBefore > longest.days) {
      longest = {
        from: yearStart.toISOString().split('T')[0],
        to: new Date(merged[0].start.getTime() - 86400000).toISOString().split('T')[0],
        days: daysBefore,
      };
    }

    // Gaps between rentals
    for (let i = 1; i < merged.length; i++) {
      const gapStart = new Date(merged[i - 1].end.getTime() + 86400000);
      const gapEnd = new Date(merged[i].start.getTime() - 86400000);
      const days = Math.floor((gapEnd - gapStart) / 86400000) + 1;
      if (days > longest.days) {
        longest = {
          from: gapStart.toISOString().split('T')[0],
          to: gapEnd.toISOString().split('T')[0],
          days,
        };
      }
    }

    // Gap after last rental
    const lastEnd = merged[merged.length - 1].end;
    const daysAfter = Math.floor((yearEnd - lastEnd) / 86400000);
    if (daysAfter > longest.days) {
      longest = {
        from: new Date(lastEnd.getTime() + 86400000).toISOString().split('T')[0],
        to: yearEnd.toISOString().split('T')[0],
        days: daysAfter,
      };
    }

    res.json({ productId, year, longestFreeStreak: longest });
  } catch (err) {
    console.error('[rental-service] free-streak error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P12: Unified Feed (K-way merge) ──
app.get('/rentals/merged-feed', async (req, res) => {
  try {
    const { productIds: pidsStr, limit: limitStr } = req.query;

    if (!pidsStr) {
      return res.status(400).json({ error: 'productIds is required' });
    }

    const productIds = [...new Set(pidsStr.split(',').map(Number).filter(n => !isNaN(n)))];
    if (productIds.length < 1 || productIds.length > 10) {
      return res.status(400).json({ error: 'productIds must be 1-10 comma-separated integers' });
    }

    const limit = parseInt(limitStr) || 30;
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'limit must be a positive integer, max 100' });
    }

    // Fetch first page of rentals for each product (sorted by rentalStart)
    const streams = await Promise.all(
      productIds.map(async (pid) => {
        try {
          const { data } = await centralApi().get('/api/data/rentals', {
            params: { product_id: pid, page: 1, limit: 100 },
          });
          return data.data.map(r => ({ ...r, productId: pid }));
        } catch (err) {
          if (err.response?.status === 503) throw err;
          return [];
        }
      })
    );

    // K-way merge using a min-heap on rentalStart
    // Each heap entry: { rental, streamIdx, posInStream }
    const heap = [];

    function cmp(a, b) {
      return new Date(a.rental.rentalStart) - new Date(b.rental.rentalStart);
    }
    function hPush(val) {
      heap.push(val);
      let i = heap.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (cmp(heap[p], heap[i]) <= 0) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    }
    function hPop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          let s = i, l = 2*i+1, r = 2*i+2;
          if (l < heap.length && cmp(heap[l], heap[s]) < 0) s = l;
          if (r < heap.length && cmp(heap[r], heap[s]) < 0) s = r;
          if (s === i) break;
          [heap[i], heap[s]] = [heap[s], heap[i]];
          i = s;
        }
      }
      return top;
    }

    // Initialize heap with first element from each non-empty stream
    for (let i = 0; i < streams.length; i++) {
      if (streams[i].length > 0) {
        hPush({ rental: streams[i][0], streamIdx: i, posInStream: 0 });
      }
    }

    const feed = [];
    while (feed.length < limit && heap.length > 0) {
      const { rental, streamIdx, posInStream } = hPop();
      feed.push({
        rentalId: rental.id,
        productId: rental.productId,
        rentalStart: rental.rentalStart,
        rentalEnd: rental.rentalEnd,
      });

      // Push next element from same stream
      const nextPos = posInStream + 1;
      if (nextPos < streams[streamIdx].length) {
        hPush({ rental: streams[streamIdx][nextPos], streamIdx, posInStream: nextPos });
      }
    }

    res.json({ productIds, limit, feed });
  } catch (err) {
    console.error('[rental-service] merged-feed error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[rental-service] listening on port ${PORT}`);
});
