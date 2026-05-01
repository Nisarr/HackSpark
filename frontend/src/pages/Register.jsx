import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { User, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api('/users/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      localStorage.setItem('token', data.token);
      window.dispatchEvent(new Event('storage'));
      navigate('/products');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 animate-in fade-in duration-700">
      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8 md:p-10 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-40 h-40 bg-primary-500 rounded-full opacity-10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-40 h-40 bg-emerald-500 rounded-full opacity-10 blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Create an account</h1>
              <p className="text-slate-500 dark:text-slate-400">Join RentPi and start renting today</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50 flex items-center gap-3 text-sm font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none"
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg shadow-slate-900/20 dark:shadow-primary-500/20 transition-all disabled:opacity-70 mt-4 group"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Creating account...</>
                ) : (
                  <>Create Account <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-4 text-slate-400">
              <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
              <span className="text-xs font-medium uppercase tracking-wider">Already a member?</span>
              <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
            </div>

            <p className="text-center mt-6 text-sm text-slate-600 dark:text-slate-400">
              <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
