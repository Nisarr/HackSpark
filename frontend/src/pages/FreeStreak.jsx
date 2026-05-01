import React, { useState } from 'react';
import { api } from '../api';
import { Pause, XCircle, Calendar, Sun, ArrowRight } from 'lucide-react';

export default function FreeStreak() {
  const [productId, setProductId] = useState(1);
  const [year, setYear] = useState(2024);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStreak = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await api(`/rentals/products/${productId}/free-streak?year=${year}`);
      setResult(data);
    } catch (err) {
      setError(err.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const streak = result?.longestFreeStreak;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Pause className="w-8 h-8 text-primary-500" />
          Longest Free Streak
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Find the longest continuous period a product sat idle — perfect for scheduling maintenance or re-listing.
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
          <div className="p-2 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Search Parameters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Product ID</label>
            <input type="number" min="1" value={productId} onChange={e => setProductId(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Year</label>
            <input type="number" min="2000" max="2030" value={year} onChange={e => setYear(parseInt(e.target.value) || 2024)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
        </div>

        <button onClick={fetchStreak} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Scanning...</> : <><Sun className="w-4 h-4" /> Find Longest Vacation</>}
        </button>
      </div>

      {result && streak && (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          {streak.days === 0 ? (
            <div className="glass rounded-2xl p-12 border border-slate-200 dark:border-slate-700 text-center">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">No Free Days</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {streak.message || `Product #${result.productId} was rented for the entire year ${result.year}.`}
              </p>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-8 -mb-8"></div>

              <div className="relative z-10 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Sun className="w-8 h-8" />
                  </div>
                </div>

                <div className="text-xs font-bold text-emerald-100 uppercase tracking-widest mb-1">
                  Longest Free Streak
                </div>
                <div className="text-sm text-emerald-100 mb-5">
                  Product #{result.productId} · Year {result.year}
                </div>

                <div className="text-7xl font-black mb-2">{streak.days}</div>
                <div className="text-lg font-medium text-emerald-100 mb-6">consecutive free days</div>

                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-5 inline-flex items-center gap-4">
                  <div className="text-left">
                    <div className="text-xs font-bold text-emerald-100 uppercase tracking-wider">From</div>
                    <div className="text-lg font-black">{streak.from}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-200" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-emerald-100 uppercase tracking-wider">To</div>
                    <div className="text-lg font-black">{streak.to}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
