import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LuLayoutDashboard, LuUndo2, LuUsers, LuCalendarCheck, LuShieldCheck, LuSun, LuMoon, LuLogOut, LuTrendingUp } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = () => {
  const location = useLocation();
  const { logout, isOwner, profile, user } = useAuth();
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const navItems = [
    { path: '/', name: 'Dashboard', icon: <LuLayoutDashboard />, end: true },
    { path: '/returns', name: 'Retur', icon: <LuUndo2 /> },
    { path: '/sales', name: 'Data Sales', icon: <LuUsers /> },
    { path: '/attendance', name: 'Absensi', icon: <LuCalendarCheck /> },
    ...(isOwner ? [{ path: '/users', name: 'Kelola User', icon: <LuShieldCheck /> }] : []),
  ];

  const displayName = profile?.name || user?.email || 'Pengguna';
  const initial = displayName.charAt(0).toUpperCase();
  const navClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;
  const mobileNavClass = ({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`;

  const ThemeIcon = theme === 'light' ? LuMoon : LuSun;

  return (
    <div className="app-container">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><LuTrendingUp /></span>
          <span className="brand-name">Sales<span>Track</span></span>
        </div>

        <div className="nav-section-label">Menu</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end} className={navClass}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar avatar-sm">{initial}</div>
            <div className="user-chip-text">
              <div className="user-chip-name">{displayName}</div>
              <div className="user-chip-role">{isOwner ? 'Owner' : 'Admin'}</div>
            </div>
          </div>
          <div className="sidebar-actions">
            <button onClick={toggleTheme} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Ganti tema">
              <ThemeIcon /> {theme === 'light' ? 'Gelap' : 'Terang'}
            </button>
            <button onClick={logout} className="btn btn-danger btn-sm btn-icon" title="Keluar" aria-label="Keluar">
              <LuLogOut />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="mobile-header">
        <div className="brand">
          <span className="brand-mark"><LuTrendingUp /></span>
          <span className="brand-name">Sales<span>Track</span></span>
        </div>
        <div className="mobile-header-actions">
          <button onClick={toggleTheme} className="icon-btn" title="Ganti tema" aria-label="Ganti tema"><ThemeIcon /></button>
          <button onClick={logout} className="icon-btn danger" title="Keluar" aria-label="Keluar"><LuLogOut /></button>
        </div>
      </header>

      {/* Mobile floating tab bar */}
      <nav className="mobile-bottom-nav" aria-label="Navigasi utama">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.end} className={mobileNavClass}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-text">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <main className="main-content">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
