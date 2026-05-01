import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef(null);

  // Load sessions
  useEffect(() => {
    setLoading(true);
    api('/chat/sessions')
      .then(data => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async (sessionId) => {
    setActiveSession(sessionId);
    try {
      const data = await api(`/chat/${sessionId}/history`);
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  };

  const newChat = () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`;
    setActiveSession(id);
    setMessages([]);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const sessionId = activeSession || (crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`);
    if (!activeSession) setActiveSession(sessionId);

    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const data = await api('/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId, message: userMsg.content }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() }]);

      // Refresh sessions list
      api('/chat/sessions').then(d => setSessions(d.sessions || [])).catch(() => {});
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, timestamp: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    await api(`/chat/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    if (activeSession === sessionId) { setActiveSession(null); setMessages([]); }
  };

  return (
    <div>
      <h1 className="page-title">RentPi Assistant</h1>
      <div className="chat-layout">
        <div className="chat-sidebar">
          <button id="new-chat-btn" className="btn btn-primary" style={{ width: '100%', marginBottom: '.75rem' }} onClick={newChat}>
            + New Chat
          </button>
          {sessions.map(s => (
            <div key={s.sessionId}
              className={`chat-session ${activeSession === s.sessionId ? 'active' : ''}`}
              onClick={() => loadSession(s.sessionId)}>
              <div className="chat-session-name">{s.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="chat-session-time">{new Date(s.lastMessageAt).toLocaleDateString()}</div>
                <button className="btn btn-danger" style={{ padding: '2px 6px', fontSize: '.7rem' }}
                  onClick={(e) => deleteSession(e, s.sessionId)}>✕</button>
              </div>
            </div>
          ))}
        </div>

        <div className="chat-main">
          <div className="chat-messages">
            {messages.length === 0 && !sending && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '4rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                <p>Ask me anything about RentPi!</p>
                <p style={{ fontSize: '.85rem' }}>Products, availability, trends, discounts...</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="chat-bubble chat-assistant">
                <div className="typing-dots"><span></span><span></span><span></span></div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>
          <form className="chat-input-area" onSubmit={sendMessage}>
            <input id="chat-input" className="form-input chat-input" value={input}
              onChange={e => setInput(e.target.value)} placeholder="Ask about products, availability, trends..."
              disabled={sending} />
            <button id="chat-send" className="btn btn-primary" disabled={sending || !input.trim()}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
