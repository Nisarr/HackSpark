import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { Sun, Moon, Package, Calendar, TrendingUp, Tag, BarChart2, MessageSquare, LogOut, LogIn } from 'lucide-react';
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
  { to: '/products',     icon: Package, label: 'Products' },
  { to: '/availability', icon: Calendar, label: 'Availability' },
  { to: '/trending',     icon: TrendingUp, label: 'Trending' },
  { to: '/discount',     icon: Tag, label: 'Discounts' },
  { to: '/analytics',   icon: BarChart2, label: 'Analytics' },
  { to: '/chat',         icon: MessageSquare, label: 'AI Chat' },
];

function TopNav({ darkMode, toggleDarkMode }) {
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
    <nav className="fixed top-0 left-0 right-0 h-16 glass z-50 flex items-center justify-between px-6 transition-colors duration-300">
      <div className="flex items-center gap-8">
        <div className="text-2xl font-black bg-gradient-to-r from-primary-500 to-purple-600 bg-clip-text text-transparent">
          RentPi
        </div>
        <div className="hidden md:flex items-center gap-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Dark Mode"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live
        </div>

        {loggedIn ? (
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        ) : (
          <NavLink
            to="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-md shadow-primary-500/20 transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Sign In</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  return (
    <BrowserRouter>
      <TopNav darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      <div className="pt-20 min-h-screen pb-10">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
