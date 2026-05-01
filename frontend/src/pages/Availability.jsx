import React, { useState } from 'react';
import { api } from '../api';
import { CalendarSearch, CheckCircle2, XCircle, Clock } from 'lucide-react';

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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Check Availability</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Verify product availability for your desired rental dates.</p>
      </div>

      <div className="max-w-3xl">
        <div className="glass rounded-2xl p-6 md:p-8 mb-8 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg">
              <CalendarSearch className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Availability Lookup</h2>
          </div>

          <form onSubmit={handleCheck}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Product ID</label>
                <input
                  type="number"
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  placeholder="e.g. 42"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">From Date</label>
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">To Date</label>
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
            </div>

            {daysDiff !== null && daysDiff > 0 && (
              <div className="mb-6 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                Checking availability for a <strong className="font-semibold">{daysDiff} day</strong> rental period.
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md shadow-primary-500/20 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Checking...</>
              ) : (
                'Check Availability'
              )}
            </button>
          </form>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {result && (
          <div className="glass rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-lg animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${result.available ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30' : 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30'}`}>
                  {result.available ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product #{result.productId}</h2>
                  <p className={`text-sm font-semibold mt-1 ${result.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {result.available ? '✓ Available for these dates' : '✗ Not Available'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Busy Periods */}
              {result.busyPeriods?.length > 0 ? (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Busy Periods
                  </h3>
                  <div className="space-y-3">
                    {result.busyPeriods.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-sm">
                        <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-semibold text-xs tracking-wide">BUSY</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{b.start}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{b.end}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400 italic">No busy periods recorded.</div>
              )}

              {/* Free Windows */}
              {result.freeWindows?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Free Windows
                  </h3>
                  <div className="space-y-3">
                    {result.freeWindows.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 text-sm">
                        <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs tracking-wide">FREE</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{f.start}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{f.end}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
