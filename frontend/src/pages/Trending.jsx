import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Trending() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTrending = () => {
    setLoading(true);
    setError('');
    const today = new Date().toISOString().split('T')[0];
    api(`/analytics/recommendations?date=${today}&limit=6`)
      .then(data => setRecommendations(data.recommendations || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTrending(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>🔥 What's Trending Today</h1>
        <button id="trending-refresh" className="btn btn-secondary" onClick={fetchTrending} disabled={loading}>
          {loading ? '↻ Loading...' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="grid grid-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 24, width: '70%', marginBottom: 12 }}></div>
              <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }}></div>
              <div className="skeleton" style={{ height: 32, width: '30%' }}></div>
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No trending products available for today.</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {recommendations.map((r, i) => (
            <div key={r.productId} className="card" id={`trending-${r.productId}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '.75rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>#{i + 1}</span>
                <span className="badge badge-accent">{r.category}</span>
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '.5rem' }}>{r.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>Seasonal Score:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--warning)' }}>{r.score}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
