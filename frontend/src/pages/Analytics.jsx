import React, { useState } from 'react';
import { api } from '../api';

export default function Analytics() {
  const [month, setMonth] = useState('2024-03');
  const [surgeData, setSurgeData] = useState(null);
  const [peakData, setPeakData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fromMonth, setFromMonth] = useState('2024-01');
  const [toMonth, setToMonth] = useState('2024-06');

  const fetchSurge = async () => {
    setLoading(true); setError('');
    try {
      const data = await api(`/analytics/surge-days?month=${month}`);
      setSurgeData(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const fetchPeak = async () => {
    setLoading(true); setError('');
    try {
      const data = await api(`/analytics/peak-window?from=${fromMonth}&to=${toMonth}`);
      setPeakData(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h1 className="page-title">📊 Analytics Dashboard</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Peak Window */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🏔️ Peak 7-Day Window</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From (YYYY-MM)</label>
            <input className="form-input" value={fromMonth} onChange={e => setFromMonth(e.target.value)} placeholder="2024-01" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To (YYYY-MM)</label>
            <input className="form-input" value={toMonth} onChange={e => setToMonth(e.target.value)} placeholder="2024-06" />
          </div>
          <button className="btn btn-primary" onClick={fetchPeak} disabled={loading}>Find Peak</button>
        </div>
        {peakData?.peakWindow && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>Peak Period</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{peakData.peakWindow.from} → {peakData.peakWindow.to}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{peakData.peakWindow.totalRentals.toLocaleString()} rentals</div>
          </div>
        )}
      </div>

      {/* Surge Days */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>⚡ Surge Day Calendar</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Month (YYYY-MM)</label>
            <input className="form-input" value={month} onChange={e => setMonth(e.target.value)} placeholder="2024-03" />
          </div>
          <button className="btn btn-primary" onClick={fetchSurge} disabled={loading}>Analyze</button>
        </div>

        {surgeData?.data && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Rentals</th>
                  <th>Next Surge</th>
                  <th>Days Until</th>
                </tr>
              </thead>
              <tbody>
                {surgeData.data.map(d => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td style={{ fontWeight: 600 }}>{d.count}</td>
                    <td>{d.nextSurgeDate || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                    <td>{d.daysUntil != null ? <span className="badge badge-warning">{d.daysUntil}d</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
