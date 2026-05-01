import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    try {
      const data = await api('/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId, message: text }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong. ${err.message}` }]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = ['What products are available?', 'Show trending items', 'How does loyalty discount work?'];

  return (
    <>
      {open && (
        <div className="chat-popup">
          <div className="chat-popup-header">
            <div className="chat-popup-avatar">🤖</div>
            <div>
              <div className="chat-popup-title">RentPi Assistant</div>
              <div className="chat-popup-status">Online · AI Powered</div>
            </div>
            <button className="chat-popup-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="chat-popup-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <div className="chat-empty-icon">🤖</div>
                <p style={{ fontWeight: 600, marginBottom: '.35rem' }}>Hi! I'm your RentPi Assistant</p>
                <p style={{ fontSize: '.8rem' }}>Ask me about products, availability, trends, or discounts.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginTop: '1rem' }}>
                  {suggestions.map(s => (
                    <button key={s} className="btn btn-secondary btn-sm" style={{ fontSize: '.75rem', textAlign: 'left', justifyContent: 'flex-start' }}
                      onClick={() => { setInput(s); }}>
                      💬 {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="chat-bubble chat-assistant">
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className="chat-popup-input-area" onSubmit={send}>
            <input
              className="chat-popup-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={sending}
              autoFocus
            />
            <button className="chat-send-btn" type="submit" disabled={sending || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}

      <button className="chat-fab" onClick={() => setOpen(o => !o)} title="RentPi Assistant">
        {open ? '✕' : '🤖'}
        {!open && messages.length > 0 && <span className="fab-badge">{messages.filter(m => m.role === 'assistant').length}</span>}
      </button>
    </>
  );
}
