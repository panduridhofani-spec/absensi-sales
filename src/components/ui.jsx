import { Link } from 'react-router-dom';
import { LuArrowLeft, LuInbox } from 'react-icons/lu';

export const PageHeader = ({ eyebrow, title, subtitle, actions, backTo, backLabel = 'Kembali' }) => (
  <>
    {backTo && (
      <Link to={backTo} className="back-link">
        <LuArrowLeft /> {backLabel}
      </Link>
    )}
    <div className="page-header">
      <div className="page-header-text">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  </>
);

export const StatCard = ({ label, value, icon, tone = 'primary' }) => (
  <div className={`card stat-card stat-${tone}`}>
    <div style={{ zIndex: 1, minWidth: 0 }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
    <div className="stat-icon">{icon}</div>
  </div>
);

export const EmptyState = ({ icon, title, text, action }) => (
  <div className="empty-state">
    <div className="empty-state-icon">{icon || <LuInbox />}</div>
    {title && <h3>{title}</h3>}
    {text && <p style={{ maxWidth: 360 }}>{text}</p>}
    {action}
  </div>
);

export const Loader = ({ label = 'Memuat data...' }) => (
  <div className="page-loader">
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
      <div className="spinner" />
      <span style={{ fontSize: '0.85rem' }}>{label}</span>
    </div>
  </div>
);

export const Stepper = ({ value, onChange, min = 1, max = 9999, size }) => {
  const num = parseInt(value) || 0;
  const set = (n) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <div className={`stepper ${size === 'sm' ? 'stepper-sm' : ''}`}>
      <button type="button" onClick={() => set(num - 1)} disabled={num <= min} aria-label="Kurangi">−</button>
      <input
        type="number"
        inputMode="numeric"
        className="form-control"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value === '' ? '' : Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))}
        onBlur={() => { if (!(parseInt(value) >= min)) onChange(min); }}
        aria-label="Jumlah"
      />
      <button type="button" onClick={() => set(num + 1)} disabled={num >= max} aria-label="Tambah">+</button>
    </div>
  );
};

export const Skeleton =({ height = 72, style }) => (
  <div className="skeleton" style={{ height, ...style }} />
);
