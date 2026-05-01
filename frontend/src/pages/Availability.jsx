import React, { useState } from 'react';
import { api } from '../api';

export default function Availability() {
  const [productId, setProductId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api(`/rentals/products/${productId}/availability?from=${from}&to=${to}`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Check Availability</h1>
      <div className="card" style={{ maxWidth: 600, marginBottom: '1.5rem' }}>
        <form onSubmit={handleCheck} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
            <label className="form-label">Product ID</label>
            <input id="avail-product-id" className="form-input" type="number" value={productId} onChange={e => setProductId(e.target.value)} placeholder="42" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label className="form-label">From</label>
            <input id="avail-from" className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label className="form-label">To</label>
            <input id="avail-to" className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} required />
          </div>
          <button id="avail-check" className="btn btn-primary" disabled={loading}>{loading ? 'Checking...' : 'Check'}</button>
        </form>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Product #{result.productId}</h2>
            <span className={`badge ${result.available ? 'badge-success' : 'badge-danger'}`}>
              {result.available ? '✓ Available' : '✗ Not Available'}
            </span>
          </div>

          {result.busyPeriods.length > 0 && (
            <>
              <h3 style={{ fontSize: '.95rem', color: 'var(--text-secondary)', marginBottom: '.5rem' }}>🔴 Busy Periods</h3>
              <div className="period-list">
                {result.busyPeriods.map((b, i) => (
                  <div key={i} className="period-item">
                    <span className="badge badge-danger">Busy</span>
                    <span>{b.start} → {b.end}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {result.freeWindows.length > 0 && (
            <>
              <h3 style={{ fontSize: '.95rem', color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '.5rem' }}>🟢 Free Windows</h3>
              <div className="period-list">
                {result.freeWindows.map((f, i) => (
                  <div key={i} className="period-item">
                    <span className="badge badge-success">Free</span>
                    <span>{f.start} → {f.end}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
