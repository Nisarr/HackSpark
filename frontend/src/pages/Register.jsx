import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

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
    <div className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-logo">🏠 RentPi</div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Join RentPi and start renting today</p>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input id="register-name" className="form-input" value={name}
              onChange={e => setName(e.target.value)} placeholder="Your name" required />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input id="register-email" className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="register-password" className="form-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button id="register-submit" className="btn btn-primary" style={{ width: '100%', marginTop: '.5rem', padding: '.8rem' }} disabled={loading}>
            {loading ? '⏳ Creating account...' : 'Create Account →'}
          </button>
        </form>
        <div className="divider">or</div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.88rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
