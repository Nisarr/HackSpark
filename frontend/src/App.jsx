import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Products from './pages/Products';
import Availability from './pages/Availability';
import Trending from './pages/Trending';
import Discount from './pages/Discount';
import Analytics from './pages/Analytics';
import ChatPage from './pages/Chat';
import ChatWidget from './components/ChatWidget';

const NAV_ITEMS = [
  { to: '/products',     icon: '📦', label: 'Products' },
  { to: '/availability', icon: '📅', label: 'Availability' },
  { to: '/trending',     icon: '🔥', label: 'Trending' },
  { to: '/discount',     icon: '🎫', label: 'Discounts' },
  { to: '/analytics',   icon: '📊', label: 'Analytics' },
  { to: '/chat',         icon: '💬', label: 'AI Chat' },
];

function TopNav() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  const navigate = useNavigate();

  useEffect(() => {
    const check = () => setLoggedIn(!!localStorage.getItem('token'));
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setLoggedIn(false);
    navigate('/login');
  };

  return (
    <nav className="topnav">
      <div className="nav-logo">🏠 RentPi</div>
      <div className="nav-links">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span>{icon}</span><span>{label}</span>
          </NavLink>
        ))}
      </div>
      <div className="nav-right">
        <span className="nav-badge">Live</span>
        {loggedIn ? (
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign Out</button>
        ) : (
          <NavLink to="/login" className="btn btn-primary btn-sm">Sign In</NavLink>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <div className="app-layout">
        <main className="main-content">
          <Routes>
            <Route path="/"             element={<Navigate to="/products" />} />
            <Route path="/login"        element={<Login />} />
            <Route path="/register"     element={<Register />} />
            <Route path="/products"     element={<Products />} />
            <Route path="/availability" element={<Availability />} />
            <Route path="/chat"         element={<ChatPage />} />
            <Route path="/trending"     element={<Trending />} />
            <Route path="/discount"     element={<Discount />} />
            <Route path="/analytics"    element={<Analytics />} />
          </Routes>
        </main>
      </div>
      <ChatWidget />
    </BrowserRouter>
  );
}
