import React, { useState } from 'react';
import { api } from '../api';

export default function Analytics() {
  const [month, setMonth] = useState('2024-03');
  const [fromMonth, setFromMonth] = useState('2024-01');
  const [toMonth, setToMonth] = useState('2024-06');
  const [surgeData, setSurgeData] = useState(null);
  const [peakData, setPeakData] = useState(null);
  const [loading, setLoading] = useState({ surge: false, peak: false });
  const [error, setError] = useState('');

  const fetchSurge = async () => {
    setLoading(l => ({ ...l, surge: true })); setError('');
    try { setSurgeData(await api(`/analytics/surge-days?month=${month}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(l => ({ ...l, surge: false })); }
  };

  const fetchPeak = async () => {
    setLoading(l => ({ ...l, peak: true })); setError('');
    try { setPeakData(await api(`/analytics/peak-window?from=${fromMonth}&to=${toMonth}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(l => ({ ...l, peak: false })); }
  };

  const maxCount = surgeData?.data ? Math.max(...surgeData.data.map(d => d.count), 1) : 1;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">📊 Analytics Dashboard</h1>
        <p className="page-subtitle">Surge detection and peak rental window analysis</p>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Peak Window Card */}
        <div className="card fade-in fade-in-1">
          <div className="card-title">🏔️ Peak 7-Day Window</div>
          <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">From (YYYY-MM)</label>
              <input className="form-input" value={fromMonth} onChange={e => setFromMonth(e.target.value)} placeholder="2024-01" />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">To (YYYY-MM)</label>
              <input className="form-input" value={toMonth} onChange={e => setToMonth(e.target.value)} placeholder="2024-06" />
            </div>
          </div>
          <button className="btn btn-primary" onClick={fetchPeak} disabled={loading.peak} style={{ width: '100%' }}>
            {loading.peak ? '⏳ Analyzing...' : '🔍 Find Peak Window'}
          </button>
          {peakData?.peakWindow && (
            <div className="fade-in" style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: '.25rem', textTransform: 'uppercase', letterSpacing: '.4px' }}>Peak Rental Period</div>
              <div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '.5rem' }}>
                {peakData.peakWindow.from} <span style={{ color: 'var(--accent)' }}>→</span> {peakData.peakWindow.to}
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--accent)' }}>
                {peakData.peakWindow.totalRentals?.toLocaleString()}
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>total rentals in window</div>
            </div>
          )}
        </div>

        {/* Surge Days Card */}
        <div className="card fade-in fade-in-2">
          <div className="card-title">⚡ Surge Day Analyzer</div>
          <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">Month (YYYY-MM)</label>
              <input className="form-input" value={month} onChange={e => setMonth(e.target.value)} placeholder="2024-03" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-primary" onClick={fetchSurge} disabled={loading.surge}>
                {loading.surge ? '⏳' : '⚡ Analyze'}
              </button>
            </div>
          </div>
          {surgeData?.data && surgeData.data.length > 0 && (
            <div className="fade-in" style={{ fontSize: '.82rem' }}>
              <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.5rem', color: 'var(--text-secondary)', justifyContent: 'space-between' }}>
                <span>Total surge days: <strong style={{ color: 'var(--warning)' }}>{surgeData.data.filter(d => d.nextSurgeDate).length}</strong></span>
                <span>Max rentals: <strong style={{ color: 'var(--accent)' }}>{maxCount}</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {surgeData?.data && surgeData.data.length > 0 && (
        <div className="card fade-in fade-in-3">
          <div className="card-title">📅 Surge Calendar — {month}</div>
          {/* Mini bar chart */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: 60, marginBottom: '1.25rem', padding: '.5rem 0' }}>
            {surgeData.data.map(d => (
              <div key={d.date} title={`${d.date}: ${d.count} rentals`}
                style={{
                  flex: 1, borderRadius: '3px 3px 0 0',
                  background: d.nextSurgeDate ? 'linear-gradient(to top, var(--accent), var(--accent2))' : 'var(--bg-input)',
                  height: `${Math.max(4, (d.count / maxCount) * 100)}%`,
                  transition: 'height .3s ease', cursor: 'default',
                  minWidth: 4,
                }} />
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th><th>Rentals</th><th>Surge?</th><th>Next Surge</th><th>Days Until</th>
                </tr>
              </thead>
              <tbody>
                {surgeData.data.map(d => (
                  <tr key={d.date}>
                    <td style={{ fontWeight: 500 }}>{d.date}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: d.count === maxCount ? 'var(--warning)' : 'inherit' }}>{d.count}</span>
                    </td>
                    <td>
                      {d.nextSurgeDate ? <span className="badge badge-warning">⚡ Surge</span> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td>{d.nextSurgeDate || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                    <td>{d.daysUntil != null ? <span className="badge badge-accent">{d.daysUntil}d</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
