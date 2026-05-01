import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Activity, Package, TrendingUp, Users, AlertCircle, BarChart, PieChart } from 'lucide-react';

export default function Pulse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api('/rentals/kpi')
      .then(res => setData(res))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary-500" />
          Platform Pulse
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Real-time Key Performance Indicators (KPIs) and platform metrics.</p>
      </div>

      {error && (
        <div className="p-4 mb-6 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/30 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass rounded-2xl p-6 h-32 animate-pulse bg-slate-100 dark:bg-slate-800"></div>
            ))}
          </div>
          <div className="glass rounded-2xl p-6 h-96 animate-pulse bg-slate-100 dark:bg-slate-800"></div>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Top Level KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 text-primary-500/10 group-hover:text-primary-500/20 transition-colors duration-300">
                <Package className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400 rounded-lg">
                    <Package className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Products</h3>
                </div>
                <div className="text-4xl font-black text-slate-900 dark:text-white">
                  {data.totalProducts?.toLocaleString() || 0}
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors duration-300">
                <TrendingUp className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Rentals</h3>
                </div>
                <div className="text-4xl font-black text-slate-900 dark:text-white">
                  {data.totalRentals?.toLocaleString() || 0}
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 text-purple-500/10 group-hover:text-purple-500/20 transition-colors duration-300">
                <Users className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Users</h3>
                </div>
                <div className="text-4xl font-black text-slate-900 dark:text-white">
                  100K+
                </div>
                <p className="text-xs text-slate-400 mt-1">Platform milestone</p>
              </div>
            </div>
          </div>

          {/* Category Performance */}
          <div className="glass rounded-3xl p-8 border border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-xl">
                <BarChart className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Category Performance</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Rental distribution across product categories</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                {data.categoryStats && data.categoryStats.length > 0 ? (
                  data.categoryStats
                    .sort((a, b) => b.rental_count - a.rental_count)
                    .map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{cat.category}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Avg. Discount: {cat.avg_discount}%</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-emerald-600 dark:text-emerald-400">{cat.rental_count.toLocaleString()}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Rentals</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center py-8">No category data available</div>
                )}
              </div>

              {/* Visual representation (Simple CSS bars) */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 flex flex-col justify-center gap-4">
                {data.categoryStats && data.categoryStats.length > 0 && data.categoryStats.slice(0, 5).map((cat, idx) => {
                  const maxCount = Math.max(...data.categoryStats.map(c => c.rental_count));
                  const percentage = Math.max(5, (cat.rental_count / maxCount) * 100);
                  return (
                    <div key={idx} className="w-full">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{cat.category}</span>
                        <span className="text-slate-500">{cat.rental_count.toLocaleString()}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
