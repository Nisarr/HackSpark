import React, { useState } from 'react';
import { api } from '../api';
import { Heart, XCircle, ShoppingBag, Award, Hash } from 'lucide-react';

const MEDAL_COLORS = [
  'from-yellow-400 to-amber-500',
  'from-slate-300 to-slate-400',
  'from-amber-600 to-amber-700',
];

export default function TopCategories() {
  const [userId, setUserId] = useState(1);
  const [k, setK] = useState(5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCategories = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await api(`/rentals/users/${userId}/top-categories?k=${k}`);
      setResult(data);
    } catch (err) {
      setError(err.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const maxCount = result?.topCategories?.length > 0
    ? Math.max(...result.topCategories.map(c => c.rentalCount), 1)
    : 1;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Heart className="w-8 h-8 text-primary-500" />
          Top Categories
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Discover a renter's favorite product categories based on their rental history.
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
          <div className="p-2 bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 rounded-lg">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Search Parameters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">User ID</label>
            <input type="number" min="1" value={userId} onChange={e => setUserId(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Top K</label>
            <input type="number" min="1" max="20" value={k} onChange={e => setK(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
        </div>

        <button onClick={fetchCategories} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Analyzing...</> : <><Heart className="w-4 h-4" /> Find Favorites</>}
        </button>
      </div>

      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {result.topCategories.length === 0 ? (
            <div className="glass rounded-2xl p-12 border border-slate-200 dark:border-slate-700 text-center">
              <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No rental history found for User #{result.userId}</p>
            </div>
          ) : (
            <div className="glass rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg">
                  <Award className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Top {result.topCategories.length} Categories — User #{result.userId}
                </h2>
              </div>

              <div className="space-y-4">
                {result.topCategories.map((cat, i) => {
                  const pct = (cat.rentalCount / maxCount) * 100;
                  return (
                    <div key={cat.category} className="group" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                          {i < 3 ? (
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${MEDAL_COLORS[i]} flex items-center justify-center text-white font-black text-xs shadow-md`}>
                              {i + 1}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700">
                              {i + 1}
                            </div>
                          )}
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{cat.category}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-black text-primary-600 dark:text-primary-400 text-sm">{cat.rentalCount}</span>
                          <span className="text-xs text-slate-400">rentals</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            i === 0 ? 'bg-gradient-to-r from-primary-500 to-purple-500' :
                            i === 1 ? 'bg-gradient-to-r from-primary-400 to-purple-400' :
                            'bg-gradient-to-r from-primary-300 to-purple-300 dark:from-primary-600 dark:to-purple-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
