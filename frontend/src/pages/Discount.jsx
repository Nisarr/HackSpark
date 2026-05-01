import React, { useState } from 'react';
import { api } from '../api';

const TIERS = [
  { min: 20, label: 'Platinum', color: '#818cf8', icon: '💎', desc: 'Maximum loyalty rewards' },
  { min: 15, label: 'Gold',     color: '#fbbf24', icon: '🥇', desc: 'Premium member benefits' },
  { min: 10, label: 'Silver',   color: '#9ca3af', icon: '🥈', desc: 'Regular member rewards' },
  { min: 5,  label: 'Bronze',   color: '#d97706', icon: '🥉', desc: 'Entry level benefits' },
  { min: 0,  label: 'Standard', color: '#7b82a0', icon: '⭐', desc: 'Standard member' },
];

function getTier(pct) {
  return TIERS.find(t => pct >= t.min) || TIERS[TIERS.length - 1];
}

export default function Discount() {
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    setError(''); setResult(null); setLoading(true);
    try {
      const data = await api(`/users/${userId}/discount`);
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const tier = result ? getTier(result.discountPercent) : null;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🎫 Loyalty Discounts</h1>
        <p className="page-subtitle">Check a user's loyalty tier and discount percentage</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)', gap: '1.5rem', alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-title">🔍 Lookup User</div>
            <form onSubmit={handleCheck}>
              <div className="form-group">
                <label className="form-label">User ID</label>
                <input id="discount-user-id" className="form-input" type="number" value={userId}
                  onChange={e => setUserId(e.target.value)} placeholder="e.g. 42" required />
              </div>
              <button id="discount-check" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                {loading ? '⏳ Checking...' : '🔍 Check Discount'}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">🏆 Tier Guide</div>
            {TIERS.map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.1rem' }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: t.color, fontSize: '.88rem' }}>{t.label}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{t.desc}</div>
                </div>
                <span className="badge" style={{ background: `${t.color}18`, color: t.color, borderColor: `${t.color}30` }}>
                  {t.min}%+
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          {result && tier && (
            <div className="card fade-in" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '.75rem' }}>{tier.icon}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }}>User #{result.userId}</div>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: tier.color, lineHeight: 1.1 }}>
                {result.discountPercent}%
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '.9rem', marginBottom: '1rem' }}>discount applied</div>
              <span className="badge" style={{ background: `${tier.color}18`, color: tier.color, borderColor: `${tier.color}30`, fontSize: '.85rem', padding: '.3rem 1rem' }}>
                {tier.label} Member
              </span>

              <div style={{ marginTop: '1.75rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                  <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Security Score</span>
                  <span style={{ fontSize: '.8rem', fontWeight: 700 }}>{result.securityScore}/100</span>
                </div>
                <div style={{ background: 'var(--bg-input)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: `linear-gradient(90deg, var(--accent), var(--success))`,
                    width: `${result.securityScore}%`,
                    transition: 'width 1.2s ease',
                  }} />
                </div>
              </div>
            </div>
          )}
          {!result && !error && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎫</div>
              <p>Enter a User ID to check their loyalty discount tier</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
