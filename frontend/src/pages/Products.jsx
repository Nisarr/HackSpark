import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Package, Zap, Car, Wrench, Gamepad2, Sofa, Shirt, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api('/rentals/products?category=INVALID_CAT_FOR_LIST').then().catch(err => {
      if (err.data?.validCategories) setCategories(err.data.validCategories);
    });
  }, []);

  useEffect(() => {
    setLoading(true); setError('');
    const params = `?page=${page}&limit=20${category ? `&category=${category}` : ''}`;
    api(`/rentals/products${params}`)
      .then(data => {
        setProducts(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, category]);

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Electronics': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'Vehicles': return <Car className="w-4 h-4 text-blue-500" />;
      case 'Tools': return <Wrench className="w-4 h-4 text-slate-500" />;
      case 'Sports': return <Gamepad2 className="w-4 h-4 text-orange-500" />;
      case 'Furniture': return <Sofa className="w-4 h-4 text-emerald-500" />;
      case 'Clothing': return <Shirt className="w-4 h-4 text-pink-500" />;
      default: return <Package className="w-4 h-4 text-primary-500" />;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Products Marketplace</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Browse and discover rental products from our catalog.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Products</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{total.toLocaleString()}</div>
          </div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categories</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{categories.length}</div>
          </div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Page</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{page} / {totalPages}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative">
          <select
            className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 pr-8 shadow-sm transition-colors"
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
        {category && (
          <button
            onClick={() => { setCategory(''); setPage(1); }}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" /> Clear filter
          </button>
        )}
        <div className="ml-auto text-sm text-slate-500 dark:text-slate-400">
          Showing <span className="font-medium text-slate-900 dark:text-white">{products.length}</span> of {total} products
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/30">
          ⚠️ {error}
        </div>
      )}

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3"></div>
              <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-6"></div>
              <div className="flex justify-between items-end">
                <div className="h-8 w-1/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                <div className="h-6 w-1/4 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map(p => (
            <div key={p.id} className="group glass rounded-2xl p-5 border border-slate-200 dark:border-slate-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">{p.name}</h3>
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                  {getCategoryIcon(p.category)}
                  <span className="hidden sm:inline">{p.category}</span>
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 flex-grow">
                Owner ID: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">#{p.ownerId}</span>
              </p>
              <div className="flex items-end justify-between mt-auto">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Price</div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    ${p.pricePerDay}<span className="text-sm font-medium text-slate-500 dark:text-slate-500">/day</span>
                  </div>
                </div>
                <button className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 shadow-md">
                  Rent Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center mt-10">
        <nav className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl shadow-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 dark:hover:text-primary-400 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            const p = Math.max(1, page - 2) + i;
            if (p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            );
          })}

          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 dark:hover:text-primary-400 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </nav>
      </div>
    </div>
  );
}
