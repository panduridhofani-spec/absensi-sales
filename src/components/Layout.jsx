import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { FaHome, FaUsers, FaCalendarCheck, FaBars, FaFileInvoice, FaSun, FaMoon } from 'react-icons/fa';
import './Layout.css';

const Layout = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'dark');

  React.useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const navItems = [
    { path: '/', name: 'Dashboard', icon: <FaHome /> },
    { path: '/all-transactions', name: 'Laporan Global', icon: <FaFileInvoice /> },
    { path: '/sales', name: 'Data Sales', icon: <FaUsers /> },
    { path: '/attendance', name: 'Absensi', icon: <FaCalendarCheck /> },
  ];

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <h2>Sales<span style={{ color: 'var(--accent-primary)' }}>Track</span></h2>
          <button onClick={toggleTheme} className="theme-toggle-btn" title="Toggle Theme">
            {theme === 'light' ? <FaMoon /> : <FaSun />}
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.name}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile Header & Bottom Nav */}
      <div className="mobile-header">
        <h2>Sales<span style={{ color: 'var(--accent-primary)' }}>Track</span></h2>
        <button onClick={toggleTheme} className="theme-toggle-btn" title="Toggle Theme">
          {theme === 'light' ? <FaMoon /> : <FaSun />}
        </button>
      </div>

      <nav className="mobile-bottom-nav">
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-text">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
