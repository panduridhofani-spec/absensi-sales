import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LuTrendingUp, LuMail, LuLock, LuEye, LuEyeOff, LuShieldCheck, LuCalendarCheck, LuReceiptText } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const ERRORS = {
  'auth/invalid-credential': 'Email atau password salah.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
  'auth/network-request-failed': 'Koneksi bermasalah. Periksa internet Anda.',
};

const Login = () => {
  const { user, loading, login, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/';

  if (!loading && user) return <Navigate to={from} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(ERRORS[err.code] || 'Gagal masuk. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const message = error || authError;

  return (
    <div className="login-page">
      <aside className="login-hero">
        <div className="login-orb orb-a" />
        <div className="login-orb orb-b" />
        <div className="brand login-brand">
          <span className="brand-mark"><LuTrendingUp /></span>
          <span className="brand-name">Sales<span>Track</span></span>
        </div>
        <div className="login-hero-copy">
          <h1>Kelola tim sales Anda dengan lebih cerdas.</h1>
          <p>Pantau absensi, transaksi, dan retur dalam satu dashboard yang rapi dan real-time.</p>
          <ul className="login-features stagger">
            <li><span className="icon-tile"><LuCalendarCheck /></span> Absensi harian tim sales</li>
            <li><span className="icon-tile"><LuReceiptText /></span> Laporan transaksi & retur</li>
            <li><span className="icon-tile"><LuShieldCheck /></span> Akses aman berbasis peran</li>
          </ul>
        </div>
      </aside>

      <main className="login-panel">
        <form onSubmit={handleSubmit} className="login-card animate-fade-in">
          <div className="brand login-brand-mobile">
            <span className="brand-mark"><LuTrendingUp /></span>
            <span className="brand-name">Sales<span>Track</span></span>
          </div>
          <h2>Selamat datang kembali</h2>
          <p className="login-sub">Masuk dengan akun admin Anda untuk melanjutkan.</p>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <div className="input-icon">
              <LuMail />
              <input id="email" className="form-control" type="email" placeholder="nama@perusahaan.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="input-icon">
              <LuLock />
              <input id="password" className="form-control" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" style={{ paddingRight: '2.75rem' }} />
              <button type="button" className="icon-btn login-eye" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}>
                {showPass ? <LuEyeOff /> : <LuEye />}
              </button>
            </div>
          </div>

          {message && <div role="alert" className="login-error animate-dropdown">{message}</div>}

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
            {submitting ? <><span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.35)' }} /> Memproses...</> : 'Masuk'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default Login;
