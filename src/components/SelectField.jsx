import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuChevronDown, LuCheck, LuSearch, LuX } from 'react-icons/lu';

const MOBILE_QUERY = '(max-width: 767px)';

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
};

/**
 * Pengganti <select> bawaan browser.
 * - Di HP: panel yang naik dari bawah (bottom sheet) dengan pencarian, tidak melebar keluar layar.
 * - Di desktop: popover tepat di bawah tombol.
 * options: [{ value, label, hint? }]  — value selalu string.
 */
const SelectField = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  title,
  icon,
  searchable,
  disabled = false,
  size = 'md',
  style,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const isMobile = useIsMobile();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const showSearch = searchable ?? options.length > 7;
  const selected = options.find(o => String(o.value) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => `${o.label} ${o.hint || ''}`.toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const openPanel = () => {
    if (disabled) return;
    const idx = Math.max(0, options.findIndex(o => String(o.value) === String(value)));
    setActive(idx);
    setOpen(true);
  };

  const choose = (opt) => {
    onChange(opt.value);
    close();
    triggerRef.current?.focus();
  };

  // Posisi popover (desktop): tepat di bawah tombol, atau di atas jika ruang bawah sempit.
  useLayoutEffect(() => {
    if (!open || isMobile) return undefined;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 240);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 260 && above > below;
      const maxHeight = Math.min(360, up ? above : below);
      setPos({ left, width, maxHeight, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) });
    };
    place();
    const onScroll = (e) => { if (!panelRef.current?.contains(e.target)) close(); };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, isMobile]);

  // Tutup saat klik di luar (desktop) dan kunci scroll halaman saat sheet HP terbuka.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (isMobile) return;
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) close();
    };
    document.addEventListener('pointerdown', onDown);
    const prev = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  // Gulirkan pilihan aktif ke tengah daftar.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, active, filtered.length]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); triggerRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(filtered.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active]); }
  };

  const list = (
    <div className="select-list" role="listbox" ref={listRef} aria-label={ariaLabel || title}>
      {filtered.length === 0 ? (
        <div className="select-empty">Tidak ditemukan</div>
      ) : filtered.map((o, i) => {
        const isSel = String(o.value) === String(value);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="option"
            aria-selected={isSel}
            data-active={i === active}
            className={`select-option ${isSel ? 'selected' : ''} ${i === active ? 'active' : ''}`}
            onClick={() => choose(o)}
            onMouseEnter={() => setActive(i)}
          >
            <span className="select-option-text">
              <span className="select-option-label">{o.label}</span>
              {o.hint && <span className="select-option-hint">{o.hint}</span>}
            </span>
            {isSel && <LuCheck />}
          </button>
        );
      })}
    </div>
  );

  const search = showSearch && (
    <div className="select-search">
      <LuSearch />
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={onKeyDown}
        placeholder="Cari..."
        autoFocus={!isMobile}
        autoComplete="off"
        aria-label="Cari pilihan"
      />
      {query && <button type="button" className="select-clear" onClick={() => { setQuery(''); setActive(0); }} aria-label="Hapus pencarian"><LuX /></button>}
    </div>
  );

  let panel = null;
  if (open) {
    panel = isMobile ? (
      <div className="select-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="select-sheet" ref={panelRef} role="dialog" aria-modal="true" aria-label={title || placeholder} onKeyDown={onKeyDown}>
          <div className="select-grabber" />
          <div className="select-sheet-head">
            <strong>{title || placeholder}</strong>
            <button type="button" className="icon-btn" onClick={close} aria-label="Tutup"><LuX /></button>
          </div>
          {search}
          {list}
        </div>
      </div>
    ) : (
      pos && (
        <div className="select-popover" ref={panelRef} style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }} onKeyDown={onKeyDown}>
          {search}
          {list}
        </div>
      )
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`select-trigger ${size === 'sm' ? 'sm' : ''} ${open ? 'open' : ''} ${className}`}
        style={style}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openPanel(); } }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {icon && <span className="select-trigger-icon">{icon}</span>}
        <span className={`select-trigger-text ${selected ? '' : 'placeholder'}`}>{selected ? selected.label : placeholder}</span>
        <LuChevronDown className="select-chevron" />
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  );
};

export default SelectField;
