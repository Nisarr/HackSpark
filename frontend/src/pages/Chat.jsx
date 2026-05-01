import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { MessageSquare, Plus, Trash2, Send, Bot, Sparkles } from 'lucide-react';

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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-primary-500" />
          AI Assistant
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Chat with our AI to explore products, availability, and more.</p>
      </div>

      <div className="flex-1 glass rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-72 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col shrink-0 overflow-hidden hidden md:flex">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={newChat}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />)}
              </div>
            )}
            {!loading && sessions.length === 0 && (
              <div className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6 px-4">
                No previous conversations. Start a new chat!
              </div>
            )}
            {sessions.map(s => (
              <button
                key={s.sessionId}
                onClick={() => loadSession(s.sessionId)}
                className={`w-full group flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all ${
                  activeSession === s.sessionId
                    ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex w-full justify-between items-center gap-2">
                  <div className={`font-semibold text-sm truncate ${activeSession === s.sessionId ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {s.name || 'Chat Session'}
                  </div>
                  <div
                    onClick={e => deleteSession(e, s.sessionId)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500">
                  {new Date(s.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/50 dark:bg-slate-900/20 relative">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6 custom-scrollbar">
            {messages.length === 0 && !sending && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/40 dark:to-purple-900/40 flex items-center justify-center mb-6 shadow-inner">
                  <Sparkles className="w-10 h-10 text-primary-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">How can I help you today?</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
                  I can analyze rental availability, find trending items, calculate loyalty discounts, and suggest products.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                  {['What electronics are available?', 'Show me the peak rental window', 'Check discount for User 42', 'What is currently trending?'].map(q => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-primary-500 hover:shadow-md transition-all text-left flex items-center justify-between group"
                    >
                      {q}
                      <ArrowRightIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-4 max-w-3xl ${m.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  m.role === 'user' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-gradient-to-br from-primary-500 to-purple-600 text-white'
                }`}>
                  {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-5 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-tr-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm'
                  }`}>
                    {m.content}
                  </div>
                  {m.timestamp && (
                    <span className="text-[11px] text-slate-400 font-medium px-1">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {sending && (
              <div className="flex gap-4 max-w-3xl self-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5 h-[52px]">
                  <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
            <form onSubmit={sendMessage} className="max-w-4xl mx-auto relative flex items-center">
              <input
                className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-slate-900 rounded-full pl-6 pr-14 py-3.5 text-[15px] text-slate-900 dark:text-white placeholder-slate-500 shadow-sm transition-all outline-none"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask RentPi Assistant..."
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="absolute right-2 w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:hover:bg-primary-600 shadow-md"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
            <div className="text-center mt-2 text-[11px] text-slate-400">
              AI can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowRightIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;
}

function UserIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
