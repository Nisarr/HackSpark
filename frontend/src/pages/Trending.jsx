import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { TrendingUp, RefreshCw, Flame, Package, Zap, Car, Wrench, Gamepad2, Sofa, Shirt } from 'lucide-react';

const CATEGORY_ICONS = { Electronics: Zap, Vehicles: Car, Tools: Wrench, Sports: Gamepad2, Furniture: Sofa, Clothing: Shirt };

export default function Trending() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchTrending = () => {
    setLoading(true); setError('');
    const today = new Date().toISOString().split('T')[0];
    api(`/analytics/recommendations?date=${today}&limit=9`)
      .then(data => { setRecommendations(data.recommendations || []); setLastRefresh(new Date()); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTrending(); }, []);

  const getCategoryIcon = (cat) => {
    const Icon = CATEGORY_ICONS[cat] || Package;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500" />
            What's Trending
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Top rental picks based on seasonal demand · Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={fetchTrending}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"></div>
                <div className="w-20 h-6 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"></div>
              </div>
              <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-6"></div>
              <div className="h-10 w-1/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="glass rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
          <TrendingUp className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No trending products</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">There isn't enough data for trending picks today.</p>
          <button onClick={fetchTrending} className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors">
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((r, i) => {
            const isTop3 = i < 3;
            return (
              <div
                key={r.productId}
                className={`group relative glass rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 ${
                  i === 0
                    ? 'border-orange-500/50 shadow-lg shadow-orange-500/10 dark:bg-slate-800/80 bg-orange-50/50'
                    : 'border-slate-200 dark:border-slate-700 hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/10'
                }`}
              >
                {i === 0 && (
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shadow-lg animate-bounce">
                    👑
                  </div>
                )}
                <div className="flex justify-between items-center mb-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shadow-md ${
                    i === 0 ? 'bg-gradient-to-br from-amber-300 to-orange-500 text-white' :
                    i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                    i === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-800 text-white' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    #{i + 1}
                  </div>
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 border border-primary-200 dark:border-primary-800/30">
                    {getCategoryIcon(r.category)}
                    {r.category}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 line-clamp-2">{r.name}</h3>
                
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Seasonal Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-orange-500">
                        {typeof r.score === 'number' ? r.score.toFixed(1) : r.score}
                      </span>
                      <Flame className="w-5 h-5 text-orange-500" />
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors">
                    View Product
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
