import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LuTriangleAlert, LuCircleCheck, LuInfo, LuCircleX, LuCircleHelp } from 'react-icons/lu';

const FeedbackContext = createContext(null);

const TONE_ICON = {
  danger: <LuTriangleAlert />,
  warning: <LuTriangleAlert />,
  primary: <LuCircleHelp />,
  success: <LuCircleCheck />,
};

export function FeedbackProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  // confirm({ title, message, confirmText, cancelText, tone }) -> Promise<boolean>
  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({ tone: 'primary', confirmText: 'Ya, lanjutkan', cancelText: 'Batal', ...opts, resolve });
  }), []);

  const closeDialog = useCallback((value) => {
    setDialog((d) => {
      if (d) d.resolve(value);
      return null;
    });
  }, []);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((type, message, opts = {}) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-2), { id, type, message, action: opts.action }]);
    setTimeout(() => dismiss(id), opts.duration || (opts.action ? 6000 : 3500));
    return id;
  }, [dismiss]);

  const toast = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
  }), [push]);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeDialog(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, closeDialog]);

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {dialog && (
        <div className="modal-overlay" style={{ zIndex: 500 }} onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(false); }}>
          <div className="modal confirm-dialog" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
            <div className={`confirm-icon tone-${dialog.tone}`}>{TONE_ICON[dialog.tone] || TONE_ICON.primary}</div>
            <h3>{dialog.title}</h3>
            {dialog.message && <p className="confirm-message">{dialog.message}</p>}
            {dialog.details && <div className="confirm-details">{dialog.details}</div>}
            <div className="confirm-actions">
              <button className="btn btn-secondary flex-1" onClick={() => closeDialog(false)} autoFocus={dialog.tone === 'danger'}>{dialog.cancelText}</button>
              <button className={`btn flex-1 ${dialog.tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`} onClick={() => closeDialog(true)} autoFocus={dialog.tone !== 'danger'}>{dialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            <span className="toast-icon">
              {t.type === 'success' ? <LuCircleCheck /> : t.type === 'error' ? <LuCircleX /> : <LuInfo />}
            </span>
            <span className="toast-text">{t.message}</span>
            {t.action && (
              <button className="toast-action" onClick={() => { t.action.onClick(); dismiss(t.id); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFeedback = () => useContext(FeedbackContext);
