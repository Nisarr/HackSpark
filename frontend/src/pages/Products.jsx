import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api('/rentals/products?limit=20&page=1').then(data => {
      // Try to extract categories from a failed category request for dropdown
    }).catch(() => {});
    // Fetch categories for the dropdown (invalid request returns valid list)
    api('/rentals/products?category=INVALID_CAT_FOR_LIST').then().catch(err => {
      if (err.data?.validCategories) setCategories(err.data.validCategories);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = `?page=${page}&limit=20${category ? `&category=${category}` : ''}`;
    api(`/rentals/products${params}`)
      .then(data => {
        setProducts(data.data || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, category]);

  return (
    <div>
      <h1 className="page-title">Products</h1>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <select id="category-filter" className="form-select" style={{ maxWidth: 220 }} value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Page {page} of {totalPages}</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="grid grid-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }}></div>
              <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }}></div>
              <div className="skeleton" style={{ height: 16, width: '30%' }}></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-3">
          {products.map(p => (
            <div key={p.id} className="card" id={`product-${p.id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{p.name}</h3>
                <span className="badge badge-accent">{p.category}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Owner: #{p.ownerId}</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)', marginTop: '.5rem' }}>
                ${p.pricePerDay}<span style={{ fontSize: '.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/day</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="pagination">
        <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{page} / {totalPages}</span>
        <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
