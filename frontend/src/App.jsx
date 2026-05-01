import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Products from './pages/Products';
import Availability from './pages/Availability';
import Chat from './pages/Chat';
import Trending from './pages/Trending';
import Discount from './pages/Discount';
import Analytics from './pages/Analytics';

function Sidebar() {
  const isLoggedIn = !!localStorage.getItem('token');

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">🏠 RentPi</div>
      <NavLink to="/products" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <span>📦 Products</span>
      </NavLink>
      <NavLink to="/availability" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <span>📅 Availability</span>
      </NavLink>
      <NavLink to="/trending" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <span>🔥 Trending</span>
      </NavLink>
      <NavLink to="/chat" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <span>💬 Chat</span>
      </NavLink>
      <NavLink to="/discount" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <span>🎫 Discount</span>
      </NavLink>
      <NavLink to="/analytics" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <span>📊 Analytics</span>
      </NavLink>
      <div className="sidebar-bottom">
        {isLoggedIn ? (
          <button className="sidebar-link" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}>
            <span>🚪 Logout</span>
          </button>
        ) : (
          <NavLink to="/login" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span>🔑 Login</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/products" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/products" element={<Products />} />
            <Route path="/availability" element={<Availability />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/discount" element={<Discount />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
