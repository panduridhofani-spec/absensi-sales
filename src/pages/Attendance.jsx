import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuCalendarDays, LuDownload, LuTrendingUp, LuCircleCheck, LuSearchX, LuPencil, LuTrash2, LuTrophy, LuX, LuSearch, LuFilter, LuRefreshCw, LuUserX, LuChevronRight, LuTriangleAlert, LuClipboardList } from 'react-icons/lu';
import { getAttendanceRange, getSalesList, deleteAttendance, updateAttendance } from '../services/dbService';
import { PageHeader, StatCard, EmptyState, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import SelectField from '../components/SelectField';
import { salesOptions, stringOptions } from '../utils/options';
import { ATT_PERIODS, MONTHS, attendanceRange, summarizeBySales, fmtDate, fmtTime } from '../utils/attendance';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }
  render() {
    if (this.state.hasError) return <div className="p-4 text-danger text-center">Terjadi kesalahan saat memuat halaman ini.</div>;
    return this.props.children;
  }
}

const PAGE = 25;

const AttendanceInner = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { confirm, toast } = useFeedback();

  const now = new Date();
  const [view, setView] = useState('rekap'); // rekap | log

  // Periode (menentukan data apa yang diambil dari server)
  const [period, setPeriod] = useState('bulan_ini');
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Filter (diterapkan di layar, tidak memuat ulang data)
  const [search, setSearch] = useState('');
  const [filterSales, setFilterSales] = useState('all');
  const [filterDist, setFilterDist] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // rekap: all | aktif | belum
  const [onlyNotes, setOnlyNotes] = useState('all'); // log: all | notes
  const [sortRekap, setSortRekap] = useState('terbanyak');
  const [sortLog, setSortLog] = useState('terbaru');
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const [sales, setSales] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [editAttModal, setEditAttModal] = useState(null);

  const cache = useRef(new Map());
  const reqId = useRef(0);

  const range = useMemo(
    () => attendanceRange({ period, month, year, from, to }),
    [period, month, year, from, to]
  );
  const rangeKey = `${range.start.getTime()}-${range.end.getTime()}`;

  useEffect(() => {
    getSalesList().then(setSales).catch(console.error);
  }, []);

  // Hanya mengambil absensi pada periode terpilih. Hasil disimpan sementara agar berpindah periode bolak-balik cepat.
  useEffect(() => {
    if (!range.valid) {
      setAttendance([]);
      setLoading(false);
      return undefined;
    }
    const cached = cache.current.get(rangeKey);
    if (cached) {
      setAttendance(cached);
      setError('');
      setLoading(false);
      return undefined;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    getAttendanceRange(range.start.toISOString(), range.end.toISOString())
      .then((data) => {
        if (id !== reqId.current) return;
        cache.current.set(rangeKey, data);
        setAttendance(data);
      })
      .catch((e) => {
        if (id !== reqId.current) return;
        console.error(e);
        setError('Gagal memuat data absensi. Periksa koneksi internet lalu coba lagi.');
        setAttendance([]);
      })
      .finally(() => { if (id === reqId.current) setLoading(false); });
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, range.valid, reloadKey]);

  useEffect(() => {
    setLimit(PAGE);
  }, [view, rangeKey, search, filterSales, filterDist, statusFilter, onlyNotes, sortRekap, sortLog]);

  const refresh = () => {
    cache.current.delete(rangeKey);
    setReloadKey(k => k + 1);
  };

  const salesById = useMemo(() => Object.fromEntries(sales.map(s => [s.id, s])), [sales]);
  const distributors = useMemo(() => [...new Set(sales.map(s => (s.distributor || '').trim()).filter(Boolean))].sort(), [sales]);

  const q = search.trim().toLowerCase();

  // --- Log kunjungan ---
  const logRows = useMemo(() => {
    const rows = attendance
      .map(a => ({ ...a, salesName: salesById[a.salesId]?.name || 'Sales Dihapus', distributor: salesById[a.salesId]?.distributor || '-' }))
      .filter(a => {
        if (filterSales !== 'all' && a.salesId !== filterSales) return false;
        if (filterDist !== 'all' && (a.distributor || '').trim() !== filterDist) return false;
        if (onlyNotes === 'notes' && !String(a.notes || '').trim()) return false;
        if (q && ![a.salesName, a.distributor, a.notes].some(v => String(v || '').toLowerCase().includes(q))) return false;
        return true;
      });
    rows.sort((a, b) => (sortLog === 'terlama'
      ? new Date(a.timestamp) - new Date(b.timestamp)
      : sortLog === 'nama'
        ? a.salesName.localeCompare(b.salesName) || new Date(b.timestamp) - new Date(a.timestamp)
        : new Date(b.timestamp) - new Date(a.timestamp)));
    return rows;
  }, [attendance, salesById, filterSales, filterDist, onlyNotes, q, sortLog]);

  // --- Rekap per sales ---
  const rekapRows = useMemo(() => {
    const all = summarizeBySales(sales, attendance);
    const rows = all.filter(r => {
      if (filterSales !== 'all' && r.id !== filterSales) return false;
      if (filterDist !== 'all' && (r.distributor || '').trim() !== filterDist) return false;
      if (statusFilter === 'aktif' && r.visits === 0) return false;
      if (statusFilter === 'belum' && r.visits > 0) return false;
      if (q && ![r.name, r.distributor].some(v => String(v || '').toLowerCase().includes(q))) return false;
      return true;
    });
    rows.sort((a, b) => {
      if (sortRekap === 'tersedikit') return a.visits - b.visits || a.name.localeCompare(b.name);
      if (sortRekap === 'nama') return a.name.localeCompare(b.name);
      if (sortRekap === 'terakhir') return new Date(b.last || 0) - new Date(a.last || 0);
      return b.visits - a.visits || a.name.localeCompare(b.name);
    });
    return rows;
  }, [sales, attendance, filterSales, filterDist, statusFilter, q, sortRekap]);

  const activeRows = rekapRows.filter(r => r.visits > 0);
  const idleRows = rekapRows.filter(r => r.visits === 0);
  const totalVisits = rekapRows.reduce((n, r) => n + r.visits, 0);
  const topSales = [...activeRows].sort((a, b) => b.visits - a.visits)[0];
  const maxVisits = Math.max(1, ...rekapRows.map(r => r.visits));

  const list = view === 'rekap' ? rekapRows : logRows;
  const displayed = list.slice(0, limit);

  const activeFilterCount = [
    filterSales !== 'all',
    filterDist !== 'all',
    view === 'rekap' && statusFilter !== 'all',
    view === 'log' && onlyNotes !== 'all',
    view === 'rekap' ? sortRekap !== 'terbanyak' : sortLog !== 'terbaru',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilterSales('all');
    setFilterDist('all');
    setStatusFilter('all');
    setOnlyNotes('all');
    setSortRekap('terbanyak');
    setSortLog('terbaru');
  };

  // --- Aksi ---
  const handleDeleteAttendance = async (att) => {
    const ok = await confirm({
      tone: 'danger',
      title: 'Hapus catatan absensi?',
      message: `Kunjungan ${att.salesName} pada ${fmtDate(att.timestamp)} pukul ${fmtTime(att.timestamp)} akan dihapus permanen.`,
      confirmText: 'Ya, hapus',
    });
    if (!ok) return;
    try {
      await deleteAttendance(att.id);
      cache.current.clear();
      setAttendance(prev => prev.filter(a => a.id !== att.id));
      toast.success('Catatan absensi dihapus');
    } catch (err) {
      console.error('Gagal menghapus absensi:', err);
      toast.error('Gagal menghapus absensi');
    }
  };

  const handleEditAttendance = (att) => {
    const d = new Date(att.timestamp);
    const valid = !isNaN(d.getTime());
    const p = (n) => String(n).padStart(2, '0');
    setEditAttModal({
      ...att,
      editDate: valid ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` : '',
      editTime: valid ? `${p(d.getHours())}:${p(d.getMinutes())}` : '',
      editNotes: att.notes || '',
    });
  };

  const handleSaveEditAttendance = async (e) => {
    e.preventDefault();
    if (!editAttModal.editDate || !editAttModal.editTime) {
      toast.error('Tanggal dan jam wajib diisi');
      return;
    }
    try {
      const newTimestamp = new Date(`${editAttModal.editDate}T${editAttModal.editTime}:00`).toISOString();
      const updates = { timestamp: newTimestamp, date: editAttModal.editDate, notes: editAttModal.editNotes };
      await updateAttendance(editAttModal.id, updates);
      cache.current.clear();
      const inRange = (ts) => new Date(ts) >= range.start && new Date(ts) < range.end;
      setAttendance(prev => prev
        .map(a => a.id === editAttModal.id ? { ...a, ...updates } : a)
        .filter(a => inRange(a.timestamp))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      setEditAttModal(null);
      toast.success(inRange(newTimestamp) ? 'Perubahan disimpan' : 'Disimpan. Catatan dipindah ke luar periode yang sedang dilihat.');
    } catch (err) {
      console.error('Gagal menyimpan perubahan absensi:', err);
      toast.error('Gagal menyimpan perubahan absensi');
    }
  };

  const exportExcel = async () => {
    if (!range.valid) return toast.info(range.error || 'Periode belum valid');
    if (rekapRows.length === 0 && logRows.length === 0) return toast.info('Tidak ada data untuk diekspor');
    const filters = [];
    if (search.trim()) filters.push(['Kata kunci', search.trim()]);
    if (filterSales !== 'all') filters.push(['Sales', salesById[filterSales]?.name || '-']);
    if (filterDist !== 'all') filters.push(['Distributor', filterDist]);
    if (statusFilter !== 'all') filters.push(['Status kunjungan', statusFilter === 'aktif' ? 'Sudah berkunjung' : 'Belum berkunjung']);
    if (onlyNotes === 'notes') filters.push(['Catatan', 'Hanya yang memiliki catatan']);
    if (!filters.length) filters.push(['Filter lain', 'Tidak ada']);

    setExporting(true);
    try {
      const { exportAttendanceXlsx } = await import('../utils/exportAttendance');
      await exportAttendanceXlsx({
        summary: rekapRows,
        log: logRows,
        meta: {
          periodLabel: range.label,
          filters,
          exportedBy: profile?.name || user?.email || '-',
          fileTag: period,
        },
      });
      toast.success('File Excel diunduh');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat file Excel');
    } finally {
      setExporting(false);
    }
  };

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2, now.getFullYear() - 3];
  const loadMore = list.length > displayed.length && (
    <div className="text-center" style={{ padding: '0.9rem' }}>
      <button className="btn btn-secondary" onClick={() => setLimit(l => l + PAGE)}>
        Muat {Math.min(PAGE, list.length - displayed.length)} lagi <span className="text-muted">({displayed.length} dari {list.length})</span>
      </button>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Monitoring"
        title="Kehadiran Global"
        subtitle={<>{range.label} · {loading ? 'memuat…' : `${attendance.length} kunjungan`}</>}
        actions={
          <>
            <div className="segmented">
              <button className={view === 'rekap' ? 'active' : ''} onClick={() => setView('rekap')}>Rekap per Sales</button>
              <button className={view === 'log' ? 'active' : ''} onClick={() => setView('log')}>Log Kunjungan</button>
            </div>
            <button className="btn btn-secondary btn-icon" onClick={refresh} disabled={loading} title="Muat ulang data" aria-label="Muat ulang"><LuRefreshCw className={loading ? 'spin' : ''} /></button>
            <button className="btn btn-success" onClick={exportExcel} disabled={exporting || loading}><LuDownload /> {exporting ? 'Menyiapkan…' : 'Export Excel'}</button>
          </>
        }
      />

      {/* Periode */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs text-muted font-semibold uppercase tracking-wider"><LuCalendarDays /> Periode</div>
          <div className="segmented chip-scroll">
            {ATT_PERIODS.map(p => (
              <button key={p.id} className={period === p.id ? 'active' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>
            ))}
          </div>

          {period === 'per_bulan' && (
            <div className="flex gap-2 animate-fade-in">
              <div style={{ flex: '1 1 150px', maxWidth: 220 }}>
                <SelectField value={String(month)} onChange={(v) => setMonth(parseInt(v))} title="Bulan" options={MONTHS.map((m, i) => ({ value: String(i), label: m }))} />
              </div>
              <div style={{ flex: '0 0 110px' }}>
                <SelectField value={String(year)} onChange={(v) => setYear(parseInt(v))} title="Tahun" options={years.map(y => ({ value: String(y), label: String(y) }))} />
              </div>
            </div>
          )}

          {period === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap animate-fade-in">
              <input type="date" className="form-control" style={{ width: 'auto' }} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
              <span className="text-muted">sampai</span>
              <input type="date" className="form-control" style={{ width: 'auto' }} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
            </div>
          )}

          {!range.valid && (
            <div className="callout callout-warning"><LuTriangleAlert /><div className="callout-body">{range.error}</div></div>
          )}
        </div>
      </div>

      {/* Pencarian & filter */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="input-icon flex-1">
              <LuSearch />
              <input type="text" className="form-control" placeholder={view === 'rekap' ? 'Cari nama sales atau distributor...' : 'Cari sales, distributor, atau catatan...'} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className={`btn ${showFilters || activeFilterCount ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters}>
              <LuFilter /> Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </button>
          </div>

          {showFilters && (
            <div className="animate-fade-in" style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', padding: '0.9rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <label className="form-label">Sales</label>
                <SelectField value={filterSales} onChange={setFilterSales} title="Pilih sales" searchable options={salesOptions(sales, { value: 'all', label: 'Semua sales' })} />
              </div>
              <div>
                <label className="form-label">Distributor</label>
                <SelectField value={filterDist} onChange={setFilterDist} title="Distributor" options={stringOptions(distributors, 'Semua distributor')} />
              </div>
              {view === 'rekap' ? (
                <>
                  <div>
                    <label className="form-label">Status kunjungan</label>
                    <SelectField value={statusFilter} onChange={setStatusFilter} title="Status kunjungan" options={[
                      { value: 'all', label: 'Semua sales' },
                      { value: 'aktif', label: 'Sudah berkunjung' },
                      { value: 'belum', label: 'Belum berkunjung' },
                    ]} />
                  </div>
                  <div>
                    <label className="form-label">Urutkan</label>
                    <SelectField value={sortRekap} onChange={setSortRekap} title="Urutkan" options={[
                      { value: 'terbanyak', label: 'Kunjungan terbanyak' },
                      { value: 'tersedikit', label: 'Kunjungan tersedikit' },
                      { value: 'terakhir', label: 'Terakhir datang' },
                      { value: 'nama', label: 'Nama A–Z' },
                    ]} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="form-label">Catatan</label>
                    <SelectField value={onlyNotes} onChange={setOnlyNotes} title="Catatan" options={[
                      { value: 'all', label: 'Semua kunjungan' },
                      { value: 'notes', label: 'Hanya yang ada catatan' },
                    ]} />
                  </div>
                  <div>
                    <label className="form-label">Urutkan</label>
                    <SelectField value={sortLog} onChange={setSortLog} title="Urutkan" options={[
                      { value: 'terbaru', label: 'Terbaru dulu' },
                      { value: 'terlama', label: 'Terlama dulu' },
                      { value: 'nama', label: 'Nama sales A–Z' },
                    ]} />
                  </div>
                </>
              )}
              {activeFilterCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn btn-ghost w-full" onClick={resetFilters}><LuX /> Reset filter</button>
                </div>
              )}
            </div>
          )}

          {!loading && range.valid && (
            <div className="text-sm text-secondary">
              Menampilkan <b>{displayed.length}</b> dari <b>{list.length}</b> {view === 'rekap' ? 'sales' : 'kunjungan'}
              {activeFilterCount > 0 && <span className="text-muted"> (filter aktif)</span>}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="callout callout-warning" style={{ marginBottom: '1rem' }}>
          <LuTriangleAlert />
          <div className="callout-body"><b>{error}</b></div>
          <button className="btn btn-secondary btn-sm" onClick={refresh}>Coba lagi</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="stat-grid"><Skeleton height={100} /><Skeleton height={100} /><Skeleton height={100} /></div>
          <Skeleton height={300} />
        </div>
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="stat-grid">
            <StatCard label="Total kunjungan" value={totalVisits} icon={<LuClipboardList />} tone="primary" />
            <StatCard label={`Sales berkunjung · dari ${rekapRows.length}`} value={activeRows.length} icon={<LuTrendingUp />} tone="success" />
            <StatCard label="Belum berkunjung" value={idleRows.length} icon={<LuUserX />} tone={idleRows.length > 0 ? 'warning' : 'success'} />
            <StatCard
              label={topSales ? `Teraktif · ${topSales.visits}x kunjungan` : 'Sales teraktif'}
              value={<span style={{ fontSize: '1.2rem', overflowWrap: 'anywhere' }}>{topSales ? topSales.name : '-'}</span>}
              icon={<LuTrophy />}
              tone="warning"
            />
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {list.length === 0 ? (
              <EmptyState
                icon={<LuSearchX />}
                title={view === 'rekap' ? 'Tidak ada sales yang sesuai' : 'Tidak ada kunjungan'}
                text={attendance.length === 0 && range.valid ? `Belum ada kunjungan tercatat pada periode ${range.label}.` : 'Coba ubah kata kunci atau filter Anda.'}
              />
            ) : view === 'rekap' ? (
              <>
                <div className="table-wrap show-desktop">
                  <table className="table" style={{ minWidth: 760 }}>
                    <thead>
                      <tr>
                        <th>Nama Sales</th>
                        <th>Distributor</th>
                        <th style={{ width: 190 }}>Total kunjungan</th>
                        <th style={{ textAlign: 'center' }}>Hari aktif</th>
                        <th>Terakhir datang</th>
                        <th style={{ textAlign: 'right' }}>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="avatar avatar-sm">{(s.name || '?').charAt(0).toUpperCase()}</div>
                              <span className="font-semibold">{s.name}</span>
                            </div>
                          </td>
                          <td className="text-secondary">{s.distributor}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className={`badge ${s.visits > 0 ? 'badge-primary' : 'badge-danger'}`} style={{ minWidth: 38, justifyContent: 'center' }}>{s.visits}x</span>
                              <div className="meter" aria-hidden="true"><div className="meter-fill" style={{ width: `${(s.visits / maxVisits) * 100}%` }} /></div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>{s.days}</td>
                          <td>
                            {s.last ? (
                              <>
                                <div>{fmtDate(s.last, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                <div className="text-muted text-xs">Pukul {fmtTime(s.last)}</div>
                              </>
                            ) : <span className="text-muted">Belum berkunjung</span>}
                          </td>
                          <td>
                            <div className="flex justify-end">
                              {!s.deleted && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(`/sales/${s.id}/attendance`)} title="Riwayat kehadiran" aria-label={`Riwayat ${s.name}`}><LuChevronRight /></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="list show-mobile" style={{ padding: '0.75rem' }}>
                  {displayed.map((s) => (
                    <div key={s.id} className={`list-item ${s.deleted ? '' : 'clickable'}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }} onClick={() => { if (!s.deleted) navigate(`/sales/${s.id}/attendance`); }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="list-item-main">
                          <div className="avatar avatar-sm">{(s.name || '?').charAt(0).toUpperCase()}</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="list-item-title" style={{ whiteSpace: 'normal' }}>{s.name}</div>
                            <div className="list-item-sub" style={{ whiteSpace: 'normal' }}>{s.distributor}</div>
                          </div>
                        </div>
                        <span className={`badge ${s.visits > 0 ? 'badge-primary' : 'badge-danger'}`}>{s.visits}x</span>
                      </div>
                      <div className="meter" aria-hidden="true"><div className="meter-fill" style={{ width: `${(s.visits / maxVisits) * 100}%` }} /></div>
                      <div className="flex justify-between text-xs text-muted">
                        <span>{s.days} hari aktif</span>
                        <span>{s.last ? `Terakhir ${fmtDate(s.last)} ${fmtTime(s.last)}` : 'Belum berkunjung'}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {loadMore}
              </>
            ) : (
              <>
                <div className="table-wrap show-desktop">
                  <table className="table" style={{ minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th>Tanggal & jam</th>
                        <th>Nama sales</th>
                        <th>Status</th>
                        <th>Catatan</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((a) => (
                        <tr key={a.id}>
                          <td className="whitespace-nowrap">
                            <div className="font-semibold">{fmtDate(a.timestamp, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
                            <div className="text-xs text-muted">{fmtTime(a.timestamp)} WIB</div>
                          </td>
                          <td>
                            <div className="font-semibold">{a.salesName}</div>
                            <div className="text-xs text-muted">{a.distributor}</div>
                          </td>
                          <td><span className="badge badge-success badge-dot"><LuCircleCheck /> Hadir</span></td>
                          <td>{a.notes ? <span className="text-secondary text-sm">“{a.notes}”</span> : <span className="text-muted">-</span>}</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleEditAttendance(a)} title="Edit" aria-label="Edit"><LuPencil /></button>
                              <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteAttendance(a)} title="Hapus" aria-label="Hapus"><LuTrash2 /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="list show-mobile" style={{ padding: '0.75rem' }}>
                  {displayed.map((a) => (
                    <div key={a.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div style={{ minWidth: 0 }}>
                          <div className="font-semibold">{a.salesName}</div>
                          <div className="text-xs text-muted">{a.distributor}</div>
                        </div>
                        <div className="text-right" style={{ flexShrink: 0 }}>
                          <div className="text-sm font-semibold">{fmtDate(a.timestamp)}</div>
                          <div className="text-xs text-muted">{fmtTime(a.timestamp)} WIB</div>
                        </div>
                      </div>
                      {a.notes && <div className="text-sm text-secondary">“{a.notes}”</div>}
                      <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 6 }}>
                        <span className="badge badge-success badge-dot">Hadir</span>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleEditAttendance(a)} aria-label="Edit"><LuPencil /></button>
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteAttendance(a)} aria-label="Hapus"><LuTrash2 /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {loadMore}
              </>
            )}
          </div>
        </div>
      )}

      {editAttModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditAttModal(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Edit absensi">
            <div className="card-header">
              <h3>Edit Absensi</h3>
              <button type="button" className="icon-btn" onClick={() => setEditAttModal(null)} aria-label="Tutup"><LuX /></button>
            </div>
            <p className="text-secondary text-sm mb-4">{editAttModal.salesName} — ubah tanggal, jam, atau catatan kehadiran.</p>

            <form onSubmit={handleSaveEditAttendance}>
              <div className="form-group">
                <label className="form-label">Tanggal kehadiran</label>
                <input type="date" className="form-control" required value={editAttModal.editDate} onChange={(e) => setEditAttModal({ ...editAttModal, editDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Jam kehadiran</label>
                <input type="time" className="form-control" required value={editAttModal.editTime} onChange={(e) => setEditAttModal({ ...editAttModal, editTime: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Catatan (opsional)</label>
                <textarea className="form-control" rows="3" value={editAttModal.editNotes} onChange={(e) => setEditAttModal({ ...editAttModal, editNotes: e.target.value })} style={{ resize: 'none' }} />
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditAttModal(null)}>Batal</button>
                <button type="submit" className="btn btn-primary flex-1">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default function Attendance() {
  return (
    <ErrorBoundary>
      <AttendanceInner />
    </ErrorBoundary>
  );
}
