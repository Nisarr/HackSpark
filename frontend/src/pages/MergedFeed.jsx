import React, { useState } from 'react';
import { api } from '../api';
import { Layers, XCircle, ArrowRight, List, Plus, Trash2 } from 'lucide-react';

export default function MergedFeed() {
  const [productIds, setProductIds] = useState('12,47,88');
  const [limit, setLimit] = useState(30);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchFeed = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await api(`/rentals/merged-feed?productIds=${productIds}&limit=${limit}`);
      setResult(data);
    } catch (err) {
      setError(err.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Color map for product IDs
  const colorPalette = [
    'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-800/50',
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50',
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50',
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50',
    'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50',
    'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800/50',
    'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800/50',
    'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50',
    'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800/50',
    'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50',
  ];

  const productColorMap = {};
  if (result?.productIds) {
    result.productIds.forEach((pid, i) => {
      productColorMap[pid] = colorPalette[i % colorPalette.length];
    });
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary-500" />
          Unified Feed
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Merge rental histories of multiple products into a single chronological feed using K-way merge.
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
          <div className="p-2 bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg">
            <List className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Search Parameters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Product IDs (comma-separated)</label>
            <input type="text" value={productIds} onChange={e => setProductIds(e.target.value)} placeholder="12,47,88,203" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Limit (max 100)</label>
            <input type="number" min="1" max="100" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 30)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
        </div>

        <button onClick={fetchFeed} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Merging Feeds...</> : <><Layers className="w-4 h-4" /> Merge & View Feed</>}
        </button>
      </div>

      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="glass rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Merged Feed
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {result.feed.length} records
              </span>
            </div>

            {/* Product ID legend */}
            <div className="flex flex-wrap gap-2 mb-6">
              {result.productIds.map((pid, i) => (
                <span key={pid} className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${colorPalette[i % colorPalette.length]}`}>
                  Product #{pid}
                </span>
              ))}
            </div>

            {result.feed.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
                <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No rental records found for these products.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg font-bold">#</th>
                      <th className="px-4 py-3 font-bold">Rental ID</th>
                      <th className="px-4 py-3 font-bold">Product</th>
                      <th className="px-4 py-3 font-bold">Start</th>
                      <th className="px-4 py-3 font-bold">End</th>
                      <th className="px-4 py-3 rounded-r-lg font-bold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {result.feed.map((item, i) => {
                      const start = new Date(item.rentalStart);
                      const end = new Date(item.rentalEnd);
                      const days = Math.max(1, Math.ceil((end - start) / 86400000));
                      return (
                        <tr key={`${item.rentalId}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">#{item.rentalId}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${productColorMap[item.productId] || colorPalette[0]}`}>
                              #{item.productId}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{item.rentalStart?.split('T')[0]}</td>
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{item.rentalEnd?.split('T')[0]}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {days}d
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
