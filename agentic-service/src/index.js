const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/rentpi_agentic';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003';
const RENTAL_URL = process.env.RENTAL_SERVICE_URL || 'http://rental-service:8002';
const ANALYTICS_GRPC_URL = process.env.ANALYTICS_GRPC_URL || 'analytics-service:50051';

app.use(cors());
app.use(express.json());

// ── B1: gRPC Client ──
const PROTO_PATH = path.join(__dirname, 'proto', 'analytics.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const analyticsProto = grpc.loadPackageDefinition(packageDefinition).analytics;
const analyticsGrpcClient = new analyticsProto.AnalyticsService(
  ANALYTICS_GRPC_URL,
  grpc.credentials.createInsecure()
);

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

// ── Groq client ──
let groq;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (GROQ_API_KEY) {
  const Groq = require('groq-sdk');
  groq = new Groq({ apiKey: GROQ_API_KEY });
}

// ── Central API client (shared Redis rate limiter + cache) ──
const { centralApi, getCacheStats } = require('./central-api-client');

// ── Tool Definitions for Agentic Data Fetching ──
const { toolDefinitions, toolImplementations } = require('./tools');

// ── P15: Topic guard ──
const RENTPI_KEYWORDS = [
  'rental', 'rent', 'product', 'category', 'price', 'discount',
  'available', 'availability', 'renter', 'owner', 'rentpi',
  'booking', 'gear', 'surge', 'peak', 'trending', 'recommend',
  'lease', 'hire', 'borrow', 'equipment', 'tool', 'vehicle',
  'electronic', 'furniture', 'outdoor', 'sport', 'music',
  'camera', 'busy', 'free', 'streak', 'season', 'categories',
  'stat', 'total', 'count', 'top', 'most', 'popular', 'user',
  'inventory', 'listing', 'order', 'item',
];

function isOnTopic(message) {
  const lower = message.toLowerCase();
  return RENTPI_KEYWORDS.some(kw => lower.includes(kw));
}

// ── P15: Data grounding (REPLACED BY TOOL CALLING) ──
// Old fetchGroundingData function removed in favor of dynamic tools.

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

    if (!groq) {
      return res.json({ sessionId, reply: "AI service is not configured. Please set GROQ_API_KEY." });
    }

    // P16: Load conversation history
    const history = await Message.find({ sessionId }).sort({ timestamp: 1 });
    const isNewSession = history.length === 0;

    // P15: Groq Tool Calling Loop
    const systemPrompt = `You are RentPi Assistant, a helpful AI for the RentPi rental marketplace platform. 
Answer questions about RentPi: rentals, products, categories, pricing, availability, discounts, trends.
You have access to tools to fetch real-time data from the platform. ALWAYS use tools when asked about specific data, statistics, or availability.
NEVER invent numbers or data. If a tool returns an error or no data, inform the user that the information is currently unavailable.
Today's date is ${new Date().toISOString().split('T')[0]}.`;

    let groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    let reply = '';
    let toolCallCount = 0;
    const MAX_TOOL_CALLS = 5;

    while (toolCallCount < MAX_TOOL_CALLS) {
      const completion = await groq.chat.completions.create({
        messages: groqMessages,
        model: "llama-3.1-8b-instant",
        tools: toolDefinitions,
        tool_choice: "auto",
      });

      const responseMessage = completion.choices[0].message;
      groqMessages.push(responseMessage);

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        reply = responseMessage.content;
        break;
      }

      // Execute tool calls
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`[agentic-service] Calling tool: ${functionName}`, functionArgs);
        
        const implementation = toolImplementations[functionName];
        let toolResult;
        if (implementation) {
          toolResult = await implementation(functionArgs);
        } else {
          toolResult = { error: `Tool ${functionName} not implemented` };
        }

        groqMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: functionName,
          content: JSON.stringify(toolResult),
        });
      }

      toolCallCount++;
    }

    if (!reply) reply = "I'm sorry, I encountered an issue while processing your request.";

    // Save messages to MongoDB
    await Message.create({ sessionId, role: 'user', content: message });
    await Message.create({ sessionId, role: 'assistant', content: reply });

    // P16: Create or update session
    let session = await Session.findOne({ sessionId });
    if (isNewSession || !session) {
      // Auto-generate session name via lightweight LLM call
      let sessionName = 'New Chat';
      try {
        const nameCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: `Given this first user message, reply with ONLY a short 3-5 word title for this conversation. No punctuation. Message: "${message}"` }
          ],
          model: "llama-3.1-8b-instant",
        });
        sessionName = nameCompletion.choices[0]?.message?.content?.trim() || 'New Chat';
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
    if (err.response?.status === 503) return res.status(503).json(err.response.data);
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
