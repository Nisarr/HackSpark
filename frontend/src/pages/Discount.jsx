import React, { useState } from 'react';
import { api } from '../api';

export default function Discount() {
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api(`/users/${userId}/discount`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTierLabel = (pct) => {
    if (pct >= 20) return { label: 'Platinum', color: 'var(--accent)' };
    if (pct >= 15) return { label: 'Gold', color: 'var(--warning)' };
    if (pct >= 10) return { label: 'Silver', color: 'var(--text-secondary)' };
    if (pct >= 5) return { label: 'Bronze', color: '#cd7f32' };
    return { label: 'Standard', color: 'var(--text-secondary)' };
  };

  return (
    <div>
      <h1 className="page-title">🎫 Loyalty Discount Checker</h1>
      <div className="card" style={{ maxWidth: 500, marginBottom: '1.5rem' }}>
        <form onSubmit={handleCheck} style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">User ID</label>
            <input id="discount-user-id" className="form-input" type="number" value={userId}
              onChange={e => setUserId(e.target.value)} placeholder="e.g. 42" required />
          </div>
          <button id="discount-check" className="btn btn-primary" disabled={loading}>
            {loading ? 'Checking...' : 'Check Discount'}
          </button>
        </form>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>🏆</div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '.25rem' }}>
              User #{result.userId}
            </h2>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: getTierLabel(result.discountPercent).color }}>
              {result.discountPercent}% OFF
            </div>
            <span className="badge badge-accent" style={{ marginTop: '.5rem' }}>
              {getTierLabel(result.discountPercent).label} Tier
            </span>
            <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '.9rem' }}>
              Security Score: <strong style={{ color: 'var(--text-primary)' }}>{result.securityScore}/100</strong>
            </div>
            <div style={{ marginTop: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '.5rem', overflow: 'hidden' }}>
              <div style={{
                height: 8, borderRadius: 99, background: `linear-gradient(90deg, var(--accent), var(--success))`,
                width: `${result.securityScore}%`, transition: 'width 1s ease',
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
