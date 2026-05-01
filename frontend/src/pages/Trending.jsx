import React, { useState, useEffect } from 'react';
import { api } from '../api';

const CATEGORY_ICONS = { Electronics: '⚡', Vehicles: '🚗', Tools: '🔧', Sports: '⚽', Furniture: '🪑', Clothing: '👕' };

export default function Trending() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchTrending = () => {
    setLoading(true); setError('');
    const today = new Date().toISOString().split('T')[0];
    api(`/analytics/recommendations?date=${today}&limit=9`)
      .then(data => { setRecommendations(data.recommendations || []); setLastRefresh(new Date()); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTrending(); }, []);

  const getRankClass = (i) => i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">🔥 What's Trending</h1>
          <p className="page-subtitle">Top rental picks based on seasonal demand · Updated {lastRefresh.toLocaleTimeString()}</p>
        </div>
        <button id="trending-refresh" className="btn btn-secondary" onClick={fetchTrending} disabled={loading}>
          {loading ? '⏳ Loading...' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {loading ? (
        <div className="grid grid-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="product-card">
              <div className="skeleton" style={{ height: 32, width: 32, borderRadius: '50%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 22, width: '30%' }} />
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>No trending products for today yet.</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={fetchTrending}>Try Again</button>
        </div>
      ) : (
        <div className="grid grid-3 fade-in fade-in-1">
          {recommendations.map((r, i) => (
            <div key={r.productId} className="product-card" id={`trending-${r.productId}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                <div className={`rank-badge ${getRankClass(i)}`}>{i + 1}</div>
                <span className="badge badge-accent">{CATEGORY_ICONS[r.category] || '📦'} {r.category}</span>
              </div>
              <h3 className="product-name" style={{ marginBottom: '.65rem' }}>{r.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '.73rem', color: 'var(--text-secondary)', marginBottom: '.2rem' }}>Seasonal Score</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--warning)' }}>
                    {typeof r.score === 'number' ? r.score.toFixed(1) : r.score} 🔥
                  </div>
                </div>
                {i < 3 && (
                  <span className="badge badge-warning">Top Pick</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
