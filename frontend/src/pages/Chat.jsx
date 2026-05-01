import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    setLoading(true);
    api('/chat/sessions').then(data => setSessions(data.sessions || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadSession = async (sessionId) => {
    setActiveSession(sessionId);
    try {
      const data = await api(`/chat/${sessionId}/history`);
      setMessages(data.messages || []);
    } catch { setMessages([]); }
  };

  const newChat = () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`;
    setActiveSession(id); setMessages([]);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const sessionId = activeSession || (() => { const id = crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`; setActiveSession(id); return id; })();
    const text = input;
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }]);
    setInput(''); setSending(true);
    try {
      const data = await api('/chat', { method: 'POST', body: JSON.stringify({ sessionId, message: text }) });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() }]);
      api('/chat/sessions').then(d => setSessions(d.sessions || [])).catch(() => {});
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, timestamp: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    await api(`/chat/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    if (activeSession === sessionId) { setActiveSession(null); setMessages([]); }
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - var(--nav-height) - 4rem)' }}>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title">💬 RentPi Assistant</h1>
        <p className="page-subtitle">AI-powered assistant with session memory</p>
      </div>

      <div className="chat-layout" style={{ height: 'calc(100% - 80px)' }}>
        {/* Sidebar */}
        <div className="chat-sidebar">
          <button id="new-chat-btn" className="btn btn-primary" style={{ width: '100%', marginBottom: '.5rem' }} onClick={newChat}>
            ✨ New Chat
          </button>
          {loading && <div className="skeleton" style={{ height: 50, borderRadius: 'var(--radius-sm)' }} />}
          {sessions.map(s => (
            <div key={s.sessionId}
              className={`chat-session ${activeSession === s.sessionId ? 'active' : ''}`}
              onClick={() => loadSession(s.sessionId)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <span style={{ fontSize: '.9rem' }}>💬</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="chat-session-name">{s.name || 'Chat Session'}</div>
                  <div className="chat-session-time">{new Date(s.lastMessageAt).toLocaleDateString()}</div>
                </div>
                <button className="btn btn-ghost btn-icon" style={{ padding: '2px 6px', fontSize: '.7rem', color: 'var(--danger)', flexShrink: 0 }}
                  onClick={e => deleteSession(e, s.sessionId)}>✕</button>
              </div>
            </div>
          ))}
          {!loading && sessions.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.82rem', padding: '1rem .5rem' }}>
              No sessions yet. Start a new chat!
            </div>
          )}
        </div>

        {/* Main Chat */}
        <div className="chat-main">
          <div className="chat-messages">
            {messages.length === 0 && !sending && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '3rem', padding: '1rem' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🤖</div>
                <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '.35rem', color: 'var(--text-primary)' }}>
                  RentPi AI Assistant
                </p>
                <p style={{ fontSize: '.88rem' }}>Ask me about products, availability, trends, or discounts</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                  {['What products are available?', 'Show top trending items', 'Check loyalty discounts', 'Analyze surge patterns'].map(q => (
                    <button key={q} className="btn btn-secondary btn-sm" style={{ fontSize: '.78rem' }}
                      onClick={() => setInput(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
                {m.content}
                <div style={{ fontSize: '.65rem', opacity: .6, marginTop: '.3rem', textAlign: m.role === 'user' ? 'right' : 'left' }}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {sending && (
              <div className="chat-bubble chat-assistant">
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          <form className="chat-input-area" onSubmit={sendMessage}>
            <input id="chat-input" className="form-input chat-input" value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about products, availability, trends..."
              disabled={sending} />
            <button id="chat-send" className="btn btn-primary" disabled={sending || !input.trim()}>
              Send ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
