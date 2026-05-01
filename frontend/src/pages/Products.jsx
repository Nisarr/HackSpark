import React, { useState, useEffect } from 'react';
import { api } from '../api';

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

  const CATEGORY_ICONS = { Electronics: '⚡', Vehicles: '🚗', Tools: '🔧', Sports: '⚽', Furniture: '🪑', Clothing: '👕' };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Products Marketplace</h1>
        <p className="page-subtitle">Browse and discover rental products from our catalog</p>
      </div>

      <div className="stats-row fade-in fade-in-1">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-label">Total Products</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>{total.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-label">Categories</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>{categories.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-label">Current Page</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>{page} / {totalPages}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }} className="fade-in fade-in-2">
        <select id="category-filter" className="form-select" style={{ maxWidth: 220 }}
          value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] || '📦'} {c}</option>)}
        </select>
        {category && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setCategory(''); setPage(1); }}>✕ Clear filter</button>
        )}
        <span style={{ color: 'var(--text-secondary)', fontSize: '.82rem', marginLeft: 'auto' }}>
          Showing {products.length} of {total} products
        </span>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {loading ? (
        <div className="grid grid-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="product-card">
              <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 14, width: '35%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 22, width: '45%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-3 fade-in fade-in-3">
          {products.map(p => (
            <div key={p.id} className="product-card" id={`product-${p.id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '.6rem' }}>
                <h3 className="product-name">{p.name}</h3>
                <span className="badge badge-accent">{CATEGORY_ICONS[p.category] || '📦'} {p.category}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.8rem', marginBottom: '.75rem' }}>
                Owner ID: #{p.ownerId}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="product-price">
                  ${p.pricePerDay}<span>/day</span>
                </div>
                <span className="badge badge-success">Available</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pagination" style={{ marginTop: '2rem' }}>
        <button className="page-btn" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
        <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
        {[...Array(Math.min(5, totalPages))].map((_, i) => {
          const p = Math.max(1, page - 2) + i;
          if (p > totalPages) return null;
          return (
            <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          );
        })}
        <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
      </div>
    </div>
  );
}
