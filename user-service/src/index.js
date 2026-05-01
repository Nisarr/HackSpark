const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8001;

// ── Postgres Setup ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://rentpi:localpassword@postgres:5432/rentpi_local'
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
initDB().catch(console.error);
app.use(cors());
app.use(express.json());

const { centralApi, getCacheStats } = require('./central-api-client');

// Auth Middleware
async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth header' });
  const token = h.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// P1
app.get('/status', (req, res) => res.json({ service: 'user-service', status: 'OK' }));

// P2: Register via Postgres
app.post('/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });
    
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hash]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ user, token });
  } catch (err) { 
    console.error(err.message); 
    res.status(500).json({ error: 'Internal server error' }); 
  }
});

// P2: Login via Postgres
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at }, 
      token 
    });
  } catch (err) { 
    console.error(err.message); 
    res.status(500).json({ error: 'Internal server error' }); 
  }
});

// P2: Me (protected)
app.get('/users/me', authMiddleware, (req, res) => res.json({ user: req.user }));

// P6: Loyalty Discount
app.get('/users/:id/discount', async (req, res) => {
  try {
    let originalId = req.params.id;
    let mappedId = originalId;
    
    // If it's a Supabase UUID, map it to a numeric ID for the Central API
    if (isNaN(parseInt(originalId)) || originalId.includes('-')) {
      let hash = 0;
      for (let i = 0; i < originalId.length; i++) {
        hash = (hash << 5) - hash + originalId.charCodeAt(i);
        hash |= 0;
      }
      mappedId = Math.abs(hash) % 100000;
    } else {
      mappedId = parseInt(originalId);
    }
    
    const { data } = await centralApi().get(`/api/data/users/${mappedId}`);
    const s = data.securityScore;
    const discountPercent = s >= 80 ? 20 : s >= 60 ? 15 : s >= 40 ? 10 : s >= 20 ? 5 : 0;
    res.json({ userId: originalId, securityScore: s, discountPercent });
  } catch (err) {
    if (err.response?.status === 503) return res.status(503).json(err.response.data);
    if (err.response?.status === 404) return res.status(404).json({ error: 'User not found' });
    console.error(err.message); res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`[user-service] listening on port ${PORT}`));

