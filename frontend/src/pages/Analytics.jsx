import React, { useState } from 'react';
import { api } from '../api';
import { BarChart3, TrendingUp, Zap, Calendar, ArrowRight, Activity, XCircle } from 'lucide-react';

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
  const totalSurgeDays = surgeData?.data ? surgeData.data.filter(d => d.nextSurgeDate).length : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary-500" />
          Analytics Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Analyze surge patterns and identify peak rental windows.</p>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-3">
          <XCircle className="w-6 h-6 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Peak Window Card */}
        <div className="glass rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Peak 7-Day Window</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">From Month</label>
              <input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">To Month</label>
              <input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
          
          <button onClick={fetchPeak} disabled={loading.peak} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-6">
            {loading.peak ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Analyzing...</> : <><SearchIcon className="w-4 h-4" /> Find Peak Window</>}
          </button>

          {peakData?.peakWindow && (
            <div className="mt-auto bg-gradient-to-br from-purple-500 to-primary-600 rounded-xl p-6 text-white text-center shadow-lg relative overflow-hidden animate-in fade-in zoom-in-95">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-5 -mb-5"></div>
              
              <div className="text-xs font-bold text-purple-100 uppercase tracking-widest mb-3 relative z-10">Peak Rental Period</div>
              <div className="flex items-center justify-center gap-3 font-bold text-lg mb-4 relative z-10">
                <span className="bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">{peakData.peakWindow.from}</span>
                <ArrowRight className="w-4 h-4 text-purple-200" />
                <span className="bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">{peakData.peakWindow.to}</span>
              </div>
              <div className="text-5xl font-black mb-1 relative z-10">{peakData.peakWindow.totalRentals?.toLocaleString()}</div>
              <div className="text-sm font-medium text-purple-100 relative z-10">Total Rentals in Window</div>
            </div>
          )}
        </div>

        {/* Surge Analyzer Card */}
        <div className="glass rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Surge Day Analyzer</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Target Month</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <button onClick={fetchSurge} disabled={loading.surge} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading.surge ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div></> : <><Activity className="w-4 h-4" /> Analyze</>}
            </button>
          </div>

          {surgeData?.data && surgeData.data.length > 0 ? (
            <div className="mt-auto grid grid-cols-2 gap-4 animate-in fade-in">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-center text-center">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Surge Days</div>
                <div className="text-3xl font-black text-amber-500">{totalSurgeDays}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-center text-center">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Max Daily Rentals</div>
                <div className="text-3xl font-black text-primary-600 dark:text-primary-400">{maxCount}</div>
              </div>
            </div>
          ) : (
             <div className="mt-auto h-[104px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 text-sm font-medium">
               Select a month to analyze
             </div>
          )}
        </div>
      </div>

      {surgeData?.data && surgeData.data.length > 0 && (
        <div className="glass rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Surge Calendar — {month}</h2>
          </div>
          
          {/* Mini Bar Chart */}
          <div className="flex items-end gap-1 h-24 mb-8 pb-2 border-b border-slate-200 dark:border-slate-700">
            {surgeData.data.map((d, i) => {
              const heightPct = Math.max(5, (d.count / maxCount) * 100);
              const isSurge = !!d.nextSurgeDate;
              return (
                <div 
                  key={d.date} 
                  title={`${d.date}: ${d.count} rentals`}
                  className={`flex-1 rounded-t-sm transition-all duration-500 hover:opacity-80 cursor-default ${
                    isSurge 
                      ? 'bg-gradient-to-t from-amber-400 to-orange-500' 
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                  style={{ height: `${heightPct}%`, animationDelay: `${i * 10}ms` }}
                ></div>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Rentals</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Next Surge</th>
                  <th className="px-4 py-3 rounded-r-lg font-bold">Days Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {surgeData.data.map((d, i) => (
                  <tr key={d.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{d.date}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${d.count === maxCount ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {d.count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.nextSurgeDate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                          <Zap className="w-3 h-3" /> Surge
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {d.nextSurgeDate || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {d.daysUntil != null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 border border-primary-200 dark:border-primary-800/50">
                          {d.daysUntil} days
                        </span>
                      ) : '—'}
                    </td>
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

// Simple fallback component for missing icons
function SearchIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}
