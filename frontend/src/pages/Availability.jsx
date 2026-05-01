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
    setError(''); setResult(null); setLoading(true);
    try {
      const data = await api(`/rentals/products/${productId}/availability?from=${from}&to=${to}`);
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const daysDiff = from && to ? Math.ceil((new Date(to) - new Date(from)) / 86400000) : null;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">📅 Check Availability</h1>
        <p className="page-subtitle">Check if a product is free for your desired rental period</p>
      </div>

      <div className="card" style={{ maxWidth: 640, marginBottom: '1.5rem' }}>
        <div className="card-title">🔍 Availability Lookup</div>
        <form onSubmit={handleCheck}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Product ID</label>
              <input id="avail-product-id" className="form-input" type="number"
                value={productId} onChange={e => setProductId(e.target.value)} placeholder="e.g. 42" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From Date</label>
              <input id="avail-from" className="form-input" type="date" value={from}
                onChange={e => setFrom(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To Date</label>
              <input id="avail-to" className="form-input" type="date" value={to}
                onChange={e => setTo(e.target.value)} required />
            </div>
          </div>
          {daysDiff !== null && daysDiff > 0 && (
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              📆 Checking for <strong>{daysDiff} day{daysDiff !== 1 ? 's' : ''}</strong> rental period
            </div>
          )}
          <button id="avail-check" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? '⏳ Checking...' : '🔍 Check Availability'}
          </button>
        </form>
      </div>

      {error && <div className="alert alert-error" style={{ maxWidth: 640 }}>⚠️ {error}</div>}

      {result && (
        <div className="card fade-in" style={{ maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem' }}>{result.available ? '✅' : '❌'}</div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Product #{result.productId}</h2>
              <span className={`badge ${result.available ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '.85rem' }}>
                {result.available ? '✓ Available for your dates' : '✗ Not Available'}
              </span>
            </div>
          </div>

          {result.busyPeriods?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '.9rem', color: 'var(--danger)', marginBottom: '.5rem', fontWeight: 600 }}>🔴 Busy Periods</h3>
              <div className="period-list">
                {result.busyPeriods.map((b, i) => (
                  <div key={i} className="period-item">
                    <span className="badge badge-danger">Busy</span>
                    <span style={{ fontWeight: 500 }}>{b.start}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>→</span>
                    <span style={{ fontWeight: 500 }}>{b.end}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.freeWindows?.length > 0 && (
            <div>
              <h3 style={{ fontSize: '.9rem', color: 'var(--success)', marginBottom: '.5rem', fontWeight: 600 }}>🟢 Free Windows</h3>
              <div className="period-list">
                {result.freeWindows.map((f, i) => (
                  <div key={i} className="period-item">
                    <span className="badge badge-success">Free</span>
                    <span style={{ fontWeight: 500 }}>{f.start}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>→</span>
                    <span style={{ fontWeight: 500 }}>{f.end}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
