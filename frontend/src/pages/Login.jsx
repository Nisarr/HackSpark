import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api('/users/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('token', data.token);
      window.dispatchEvent(new Event('storage'));
      navigate('/products');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-logo">🏠 RentPi</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your account to continue</p>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input id="login-email" className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="login-password" className="form-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button id="login-submit" className="btn btn-primary" style={{ width: '100%', marginTop: '.5rem', padding: '.8rem' }} disabled={loading}>
            {loading ? '⏳ Signing in...' : 'Sign In →'}
          </button>
        </form>
        <div className="divider">or</div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.88rem' }}>
          New to RentPi? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create account</Link>
        </p>
      </div>
    </div>
  );
}
