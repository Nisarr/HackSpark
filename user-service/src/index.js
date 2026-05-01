const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
const CENTRAL_API_URL = process.env.CENTRAL_API_URL;
const CENTRAL_API_TOKEN = process.env.CENTRAL_API_TOKEN;

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('[user-service] DB initialized');
}
initDB().catch(err => console.error('[user-service] DB init error:', err.message));

function centralApi() {
  return axios.create({
    baseURL: CENTRAL_API_URL,
    headers: { Authorization: `Bearer ${CENTRAL_API_TOKEN}` },
    timeout: 10000,
  });
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth header' });
  try {
    req.user = jwt.verify(h.split(' ')[1], JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

// P1
app.get('/status', (req, res) => res.json({ service: 'user-service', status: 'OK' }));

// P2: Register
app.post('/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const dup = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (dup.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,created_at', [name, email, hash]);
    const user = r.rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ user, token });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// P2: Login
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    if (!(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at }, token });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// P2: Me (protected)
app.get('/users/me', authMiddleware, (req, res) => res.json({ user: req.user }));

// P6: Loyalty Discount
app.get('/users/:id/discount', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    const { data } = await centralApi().get(`/api/data/users/${userId}`);
    const s = data.securityScore;
    const discountPercent = s >= 80 ? 20 : s >= 60 ? 15 : s >= 40 ? 10 : s >= 20 ? 5 : 0;
    res.json({ userId, securityScore: s, discountPercent });
  } catch (err) {
    if (err.response?.status === 404) return res.status(404).json({ error: 'User not found' });
    console.error(err.message); res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`[user-service] listening on port ${PORT}`));
