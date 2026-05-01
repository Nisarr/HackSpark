const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/rentpi_agentic';
const CENTRAL_API_URL = process.env.CENTRAL_API_URL;
const CENTRAL_API_TOKEN = process.env.CENTRAL_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003';
const RENTAL_URL = process.env.RENTAL_SERVICE_URL || 'http://rental-service:8002';

app.use(cors());
app.use(express.json());

// ── MongoDB schemas (P16) ──
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true, index: true },
  name: String,
  createdAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now },
});

const messageSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  role: { type: String, enum: ['user', 'assistant'] },
  content: String,
  timestamp: { type: Date, default: Date.now },
});

const Session = mongoose.model('Session', sessionSchema);
const Message = mongoose.model('Message', messageSchema);

// ── Connect MongoDB ──
mongoose.connect(MONGO_URI)
  .then(() => console.log('[agentic-service] MongoDB connected'))
  .catch(err => console.error('[agentic-service] MongoDB error:', err.message));

// ── Gemini client ──
let genAI, model;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

// ── Central API client ──
function centralApi() {
  return axios.create({
    baseURL: CENTRAL_API_URL,
    headers: { Authorization: `Bearer ${CENTRAL_API_TOKEN}` },
    timeout: 10000,
  });
}

// ── P15: Topic guard ──
const RENTPI_KEYWORDS = [
  'rental', 'rent', 'product', 'category', 'price', 'discount',
  'available', 'availability', 'renter', 'owner', 'rentpi',
  'booking', 'gear', 'surge', 'peak', 'trending', 'recommend',
  'lease', 'hire', 'borrow', 'equipment', 'tool', 'vehicle',
  'electronic', 'furniture', 'outdoor', 'sport', 'music',
  'camera', 'busy', 'free', 'streak', 'season', 'categories',
];

function isOnTopic(message) {
  const lower = message.toLowerCase();
  return RENTPI_KEYWORDS.some(kw => lower.includes(kw));
}

// ── P15: Data grounding ──
async function fetchGroundingData(message) {
  const lower = message.toLowerCase();
  let context = '';

  try {
    if (lower.includes('most rent') || lower.includes('category') && (lower.includes('most') || lower.includes('popular'))) {
      const { data } = await centralApi().get('/api/data/rentals/stats', { params: { group_by: 'category' } });
      context += `Category rental stats: ${JSON.stringify(data.data)}\n`;
    }

    if (lower.includes('trending') || lower.includes('recommend') || lower.includes('season')) {
      const today = new Date().toISOString().split('T')[0];
      try {
        const { data } = await axios.get(`${ANALYTICS_URL}/analytics/recommendations`, { params: { date: today, limit: 5 }, timeout: 5000 });
        context += `Today's recommendations: ${JSON.stringify(data.recommendations)}\n`;
      } catch { /* analytics might not be ready */ }
    }

    if (lower.includes('peak') || lower.includes('busiest') || lower.includes('rush')) {
      const fromMonth = lower.match(/(\d{4}-\d{2})/);
      if (fromMonth) {
        try {
          const { data } = await axios.get(`${ANALYTICS_URL}/analytics/peak-window`, { params: { from: fromMonth[1], to: fromMonth[1] }, timeout: 5000 });
          context += `Peak window data: ${JSON.stringify(data)}\n`;
        } catch { /* skip */ }
      }
    }

    if (lower.includes('surge')) {
      const monthMatch = lower.match(/(\d{4}-\d{2})/);
      if (monthMatch) {
        try {
          const { data } = await axios.get(`${ANALYTICS_URL}/analytics/surge-days`, { params: { month: monthMatch[1] }, timeout: 5000 });
          context += `Surge data: ${JSON.stringify(data.data?.slice(0, 10))}\n`;
        } catch { /* skip */ }
      }
    }

    if (lower.includes('available') || lower.includes('availability')) {
      const pidMatch = lower.match(/product\s*#?\s*(\d+)/i);
      const dateMatches = lower.match(/\d{4}-\d{2}-\d{2}/g);
      if (pidMatch && dateMatches && dateMatches.length >= 2) {
        try {
          const { data } = await axios.get(`${RENTAL_URL}/rentals/products/${pidMatch[1]}/availability`, {
            params: { from: dateMatches[0], to: dateMatches[1] }, timeout: 5000,
          });
          context += `Availability data: ${JSON.stringify(data)}\n`;
        } catch { /* skip */ }
      }
    }

    if (lower.includes('discount') || lower.includes('security score')) {
      const userMatch = lower.match(/user\s*#?\s*(\d+)/i);
      if (userMatch) {
        try {
          const { data } = await centralApi().get(`/api/data/users/${userMatch[1]}`);
          context += `User data: ${JSON.stringify(data)}\n`;
        } catch { /* skip */ }
      }
    }
  } catch (err) {
    console.error('[agentic-service] grounding error:', err.message);
  }

  return context;
}

// ── P1: Health Check ──
app.get('/status', (req, res) => {
  res.json({ service: 'agentic-service', status: 'OK' });
});

// ── P15 + P16: Chat endpoint ──
app.post('/chat', async (req, res) => {
  try {
    const { sessionId: rawSessionId, message } = req.body;
    const sessionId = rawSessionId || uuidv4();

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // P15: Topic guard — refuse off-topic without LLM call
    if (!isOnTopic(message)) {
      const refusal = "I'm RentPi's assistant and can only help with rental-related questions — products, availability, pricing, categories, discounts, trends, and more. How can I help you with RentPi?";

      // Still save the message exchange
      await Message.create({ sessionId, role: 'user', content: message });
      await Message.create({ sessionId, role: 'assistant', content: refusal });

      // Update or create session
      let session = await Session.findOne({ sessionId });
      if (!session) {
        session = await Session.create({ sessionId, name: 'Off-topic Inquiry', lastMessageAt: new Date() });
      } else {
        session.lastMessageAt = new Date();
        await session.save();
      }

      return res.json({ sessionId, reply: refusal });
    }

    if (!model) {
      return res.json({ sessionId, reply: "AI service is not configured. Please set GEMINI_API_KEY." });
    }

    // P16: Load conversation history
    const history = await Message.find({ sessionId }).sort({ timestamp: 1 });
    const isNewSession = history.length === 0;

    // P15: Fetch grounding data
    const groundingContext = await fetchGroundingData(message);

    // Build conversation for Gemini
    const systemPrompt = `You are RentPi Assistant, a helpful AI for the RentPi rental marketplace platform. 
Answer ONLY questions about RentPi: rentals, products, categories, pricing, availability, discounts, trends.
Use the provided data context to answer accurately. NEVER invent numbers or data.
If data is unavailable, say so explicitly. Be concise and helpful.

${groundingContext ? `DATA CONTEXT:\n${groundingContext}` : ''}`;

    const chatHistory = history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: systemPrompt,
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    // Save messages to MongoDB
    await Message.create({ sessionId, role: 'user', content: message });
    await Message.create({ sessionId, role: 'assistant', content: reply });

    // P16: Create or update session
    let session = await Session.findOne({ sessionId });
    if (isNewSession || !session) {
      // Auto-generate session name via lightweight LLM call
      let sessionName = 'New Chat';
      try {
        const nameResult = await model.generateContent(
          `Given this first user message, reply with ONLY a short 3-5 word title for this conversation. No punctuation. Message: "${message}"`
        );
        sessionName = nameResult.response.text().trim();
      } catch { /* fallback name */ }

      session = await Session.create({
        sessionId,
        name: sessionName,
        lastMessageAt: new Date(),
      });
    } else {
      session.lastMessageAt = new Date();
      await session.save();
    }

    res.json({ sessionId, reply });
  } catch (err) {
    console.error('[agentic-service] chat error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P16: List sessions ──
app.get('/chat/sessions', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ lastMessageAt: -1 });
    res.json({
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        name: s.name,
        lastMessageAt: s.lastMessageAt,
      })),
    });
  } catch (err) {
    console.error('[agentic-service] sessions error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P16: Session history ──
app.get('/chat/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const messages = await Message.find({ sessionId }).sort({ timestamp: 1 });
    res.json({
      sessionId,
      name: session.name,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    });
  } catch (err) {
    console.error('[agentic-service] history error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── P16: Delete session ──
app.delete('/chat/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await Session.deleteOne({ sessionId });
    await Message.deleteMany({ sessionId });
    res.json({ message: 'Session deleted' });
  } catch (err) {
    console.error('[agentic-service] delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[agentic-service] listening on port ${PORT}`);
});
