import React, { useState } from 'react';
import { api } from '../api';
import { Trophy, Calendar, ArrowRight, XCircle, Crown, Flame } from 'lucide-react';

export default function KthBusiest() {
  const [from, setFrom] = useState('2024-01');
  const [to, setTo] = useState('2024-06');
  const [k, setK] = useState(3);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchBusiest = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await api(`/rentals/kth-busiest-date?from=${from}&to=${to}&k=${k}`);
      setResult(data);
    } catch (err) {
      setError(err.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary-500" />
          Kth Busiest Date
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Find the Kth busiest rental day across any date range. Powered by a min-heap for O(n log k) performance.
        </p>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-3">
          <XCircle className="w-6 h-6 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="glass rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Search Parameters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">From Month</label>
            <input type="month" value={from} onChange={e => setFrom(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">To Month</label>
            <input type="month" value={to} onChange={e => setTo(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">K (rank)</label>
            <input type="number" min="1" value={k} onChange={e => setK(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
        </div>

        <button onClick={fetchBusiest} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Searching...</> : <><Trophy className="w-4 h-4" /> Find Record Day</>}
        </button>
      </div>

      {result && (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-8 -mb-8"></div>

            <div className="relative z-10 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <Crown className="w-8 h-8" />
                </div>
              </div>

              <div className="text-xs font-bold text-amber-100 uppercase tracking-widest mb-1">
                #{result.k} Busiest Day
              </div>
              <div className="text-sm text-amber-100 mb-4">
                {result.from} <ArrowRight className="w-4 h-4 inline mx-1" /> {result.to}
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4 inline-block">
                <div className="text-4xl font-black mb-1">{result.date}</div>
              </div>

              <div className="flex items-center justify-center gap-2 mt-2">
                <Flame className="w-5 h-5 text-amber-200" />
                <span className="text-3xl font-black">{result.rentalCount?.toLocaleString()}</span>
                <span className="text-amber-100 font-medium">rentals</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
