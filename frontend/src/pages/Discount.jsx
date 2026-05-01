import React, { useState } from 'react';
import { api } from '../api';
import { Tag, Search, Shield, Gem, Medal, Award, Trophy, Star, XCircle } from 'lucide-react';

const TIERS = [
  { min: 20, label: 'Platinum', color: 'from-fuchsia-500 to-purple-600', text: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20', icon: Gem, desc: 'Maximum loyalty rewards & priority support' },
  { min: 15, label: 'Gold',     color: 'from-amber-400 to-yellow-600', text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Trophy, desc: 'Premium member benefits & early access' },
  { min: 10, label: 'Silver',   color: 'from-slate-300 to-slate-500', text: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: Medal, desc: 'Regular member rewards & free shipping' },
  { min: 5,  label: 'Bronze',   color: 'from-orange-400 to-orange-700', text: 'text-orange-600', bg: 'bg-orange-600/10', border: 'border-orange-600/20', icon: Award, desc: 'Entry level benefits & monthly coupons' },
  { min: 0,  label: 'Standard', color: 'from-slate-400 to-slate-600', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', icon: Star, desc: 'Standard member with basic access' },
];

function getTier(pct) {
  return TIERS.find(t => pct >= t.min) || TIERS[TIERS.length - 1];
}

export default function Discount() {
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    setError(''); setResult(null); setLoading(true);
    try {
      const data = await api(`/users/${userId}/discount`);
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const tier = result ? getTier(result.discountPercent) : null;
  const TierIcon = tier?.icon || Star;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Tag className="w-8 h-8 text-primary-500" />
          Loyalty Discounts
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Check a user's loyalty tier, discount percentage, and security score.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Form & Guide */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          <div className="glass rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-primary-500" /> Lookup User
            </h2>
            <form onSubmit={handleCheck}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">User ID</label>
                <input
                  type="number"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder="e.g. 42"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md shadow-primary-500/20 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {loading ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Checking...</>
                ) : (
                  'Check Discount'
                )}
              </button>
            </form>
          </div>

          <div className="glass rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Tier Guide</h2>
            <div className="flex flex-col gap-4">
              {TIERS.map(t => {
                const Icon = t.icon;
                return (
                  <div key={t.label} className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold ${t.text}`}>{t.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.desc}</div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-md text-xs font-bold border ${t.bg} ${t.border} ${t.text} shrink-0`}>
                      {t.min}%+
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-7">
          {error && (
            <div className="p-4 mb-6 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-3">
              <XCircle className="w-6 h-6 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {result && tier ? (
            <div className="glass rounded-2xl p-8 md:p-12 border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col items-center text-center relative overflow-hidden animate-in zoom-in-95 duration-500">
              {/* Background accent */}
              <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${tier.color}`}></div>
              <div className={`absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br ${tier.color} opacity-10 blur-3xl rounded-full`}></div>
              
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${tier.color} flex items-center justify-center text-white shadow-xl mb-6 relative z-10`}>
                <TierIcon className="w-12 h-12" />
              </div>
              
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                User #{result.userId}
              </div>
              
              <div className={`text-7xl font-black bg-gradient-to-br ${tier.color} bg-clip-text text-transparent mb-2`}>
                {result.discountPercent}%
              </div>
              <div className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-6">
                discount applied
              </div>
              
              <div className={`px-6 py-2 rounded-full text-sm font-bold border ${tier.bg} ${tier.border} ${tier.text} mb-12`}>
                {tier.label} Member
              </div>

              <div className="w-full max-w-md bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 text-left">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Security Score
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{result.securityScore}/100</span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${result.securityScore}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : !error ? (
            <div className="glass rounded-2xl p-12 border border-slate-200 dark:border-slate-700 h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 min-h-[400px]">
              <Tag className="w-20 h-20 mb-6 text-slate-300 dark:text-slate-600" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No data to display</h3>
              <p>Enter a User ID and click "Check Discount" to view their loyalty tier and applied discounts.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
