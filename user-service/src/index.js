const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8001;

// ── Supabase Setup ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[user-service] Missing SUPABASE_URL or SUPABASE_KEY');
}
const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder');

app.use(cors());
app.use(express.json());

const { centralApi, getCacheStats } = require('./central-api-client');

// Supabase Auth Middleware
async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth header' });
  const token = h.split(' ')[1];
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  
  req.user = { id: user.id, name: user.user_metadata?.name || 'Unknown', email: user.email };
  next();
}

// P1
app.get('/status', (req, res) => res.json({ service: 'user-service', status: 'OK' }));

// P2: Register via Supabase
app.post('/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) {
      if (error.status === 422 || error.message.toLowerCase().includes('already registered')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      return res.status(400).json({ error: error.message });
    }

    const token = data.session?.access_token || null;
    res.status(201).json({ 
      user: { id: data.user.id, name: data.user.user_metadata?.name || name, email: data.user.email, created_at: data.user.created_at },
      token 
    });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// P2: Login via Supabase
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) return res.status(401).json({ error: 'Invalid credentials' });
    
    res.json({ 
      user: { id: data.user.id, name: data.user.user_metadata?.name || 'Unknown', email: data.user.email, created_at: data.user.created_at }, 
      token: data.session.access_token 
    });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
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

