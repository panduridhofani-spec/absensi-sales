import { useEffect, useMemo, useState } from 'react';
import { LuPlus, LuHandshake, LuSearch, LuDownload, LuTrash2, LuPencil, LuUndo2, LuClock, LuPackageCheck, LuWarehouse, LuTriangleAlert, LuInbox, LuX, LuFilter, LuNotebookPen, LuCalendarRange, LuCalendarX, LuPackageX, LuBan, LuCalendarClock, LuAlarmClockOff } from 'react-icons/lu';
import { getSalesList, subscribeReturns, subscribeDrafts, updateReturn, deleteReturn, markReturnsTaken, undoReturnTaken, commitDrafts } from '../services/dbService';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { PageHeader, StatCard, EmptyState, Skeleton, Stepper } from '../components/ui';
import RecordReturnModal from '../components/returns/RecordReturnModal';
import PickupModal from '../components/returns/PickupModal';
import ScheduleModal from '../components/returns/ScheduleModal';
import SelectField from '../components/SelectField';
import { stringOptions } from '../utils/options';
import { isLate, lateDays, isScheduled, isStaleDraft, CONDITIONS, PERIODS, periodRange, conditionOf, daysSince, isAged, formatDate, formatDateTime, timeAgo, whoLabel, WAREHOUSE_ALERT_DAYS } from '../utils/returns';

const COND_ICON = { kedaluwarsa: <LuCalendarX />, rusak: <LuPackageX />, tidak_layak: <LuBan /> };

const TABS = [
  { id: 'menunggu', label: 'Menunggu diambil' },
  { id: 'diambil', label: 'Sudah diambil' },
  { id: 'semua', label: 'Semua' },
];

const Returns = () => {
  const { profile, user } = useAuth();
  const { confirm, toast } = useFeedback();
  const by = { name: profile?.name || null, email: user?.email || null };

  const [returns, setReturns] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connError, setConnError] = useState(false);

  const [tab, setTab] = useState('menunggu');
  const [search, setSearch] = useState('');
  const [filterCondition, setFilterCondition] = useState('all');
  const [filterSales, setFilterSales] = useState('all');
  const [filterDistributor, setFilterDistributor] = useState('all');
  const [filterBy, setFilterBy] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [waitingFilter, setWaitingFilter] = useState('all'); // all | terlambat | dijadwalkan | tanpa_jadwal
  const [scheduling, setScheduling] = useState(null);
  const [sortBy, setSortBy] = useState('terbaru');
  const [showFilters, setShowFilters] = useState(false);
  const [period, setPeriod] = useState('semua');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [displayLimit, setDisplayLimit] = useState(30);

  const [showRecord, setShowRecord] = useState(false);
  const [pickup, setPickup] = useState(null);
  const [editing, setEditing] = useState(null);

  // Data realtime: perubahan oleh karyawan lain langsung tampil tanpa muat ulang.
  useEffect(() => {
    getSalesList()
      .then(s => setSales(s.map(x => ({ ...x, items: Array.isArray(x.items) ? x.items : [] }))))
      .catch(console.error);
    const onErr = (e) => { console.error(e); setConnError(true); setLoading(false); };
    const unsubR = subscribeReturns((r) => { setReturns(r); setConnError(false); setLoading(false); }, onErr);
    const unsubD = subscribeDrafts(setDrafts, onErr);
    return () => { unsubR(); unsubD(); };
  }, []);

  useEffect(() => {
    setDisplayLimit(30);
  }, [tab, search, filterCondition, filterSales, filterDistributor, filterBy, filterAge, waitingFilter, sortBy, period, dateFrom, dateTo]);

  const waiting = useMemo(() => returns.filter(r => r.status === 'menunggu'), [returns]);
  const taken = useMemo(() => returns.filter(r => r.status === 'diambil'), [returns]);
  const agedCount = waiting.filter(isAged).length;
  const lateCount = waiting.filter(isLate).length;
  const scheduledCount = waiting.filter(isScheduled).length;
  const unscheduledCount = waiting.length - lateCount - scheduledCount;

  const thisMonthTaken = taken.filter(r => {
    const d = new Date(r.takenAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const catalog = useMemo(() => {
    const names = new Set();
    sales.forEach(s => s.items.forEach(i => names.add(i)));
    returns.forEach(r => names.add(r.itemName));
    return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [sales, returns]);

  const frequent = useMemo(() => {
    const count = {};
    [...returns, ...drafts].forEach(r => { count[r.itemName] = (count[r.itemName] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
  }, [returns, drafts]);

  const salesNames = useMemo(() => [...new Set(taken.map(r => r.salesName).filter(Boolean))].sort(), [taken]);
  const distributorNames = useMemo(() => [...new Set(taken.map(r => r.distributor).filter(Boolean))].sort(), [taken]);
  const recorderNames = useMemo(() => [...new Set(returns.map(r => whoLabel(r)).filter(Boolean))].sort(), [returns]);

  const resetFilters = () => {
    setFilterCondition('all');
    setFilterSales('all');
    setFilterDistributor('all');
    setFilterBy('all');
    setFilterAge('all');
    setSortBy('terbaru');
  };

  // Filter waktu hanya untuk tab Sudah diambil (tanggal diambil) dan Semua (tanggal dicatat).
  const range = tab === 'menunggu' ? null : periodRange(period, dateFrom, dateTo);

  const changeTab = (id) => {
    setTab(id);
    setWaitingFilter('all');
    setPeriod(id === 'diambil' ? 'bulan_ini' : 'semua');
  };

  const list = returns.filter(r => {
    if (tab !== 'semua' && r.status !== tab) return false;
    if (range) {
      const t = new Date(tab === 'diambil' ? r.takenAt : r.createdAt).getTime();
      if (isNaN(t) || t < range[0] || t >= range[1]) return false;
    }
    if (filterCondition !== 'all' && r.condition !== filterCondition) return false;
    if (tab !== 'menunggu') {
      if (filterSales !== 'all' && r.salesName !== filterSales) return false;
      if (filterDistributor !== 'all' && r.distributor !== filterDistributor) return false;
    }
    if (filterBy !== 'all' && whoLabel(r) !== filterBy) return false;
    if (tab === 'menunggu' && filterAge !== 'all' && daysSince(r.createdAt) < Number(filterAge)) return false;
    if (tab === 'menunggu') {
      if (waitingFilter === 'terlambat' && !isLate(r)) return false;
      if (waitingFilter === 'dijadwalkan' && !isScheduled(r)) return false;
      if (waitingFilter === 'tanpa_jadwal' && r.pickupDate) return false;
    }
    const q = search.trim().toLowerCase();
    if (q) return [r.itemName, r.notes, r.salesName, r.distributor, r.createdByName].some(v => String(v || '').toLowerCase().includes(q));
    return true;
  }).sort((a, b) => {
    const time = (r) => new Date((tab === 'diambil' ? r.takenAt : r.createdAt) || 0).getTime();
    if (sortBy === 'terlama') return time(a) - time(b);
    if (sortBy === 'nama') return String(a.itemName).localeCompare(String(b.itemName));
    if (sortBy === 'jumlah') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
    // Pada tab Menunggu, yang paling lama terlewat dari janjinya ditaruh paling atas.
    if (tab === 'menunggu' && lateDays(b) !== lateDays(a)) return lateDays(b) - lateDays(a);
    return time(b) - time(a);
  });

  const listQty = list.reduce((n, r) => n + (Number(r.quantity) || 0), 0);
  const activeFilterCount = [
    filterCondition !== 'all',
    tab !== 'menunggu' && filterSales !== 'all',
    tab !== 'menunggu' && filterDistributor !== 'all',
    filterBy !== 'all',
    tab === 'menunggu' && filterAge !== 'all',
    sortBy !== 'terbaru',
  ].filter(Boolean).length;
  const displayed = list.slice(0, displayLimit);

  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        if (displayLimit < list.length) setDisplayLimit(p => p + 30);
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [displayLimit, list.length]);

  // Bersihkan pilihan yang sudah tidak berstatus menunggu (mis. diambil karyawan lain).
  useEffect(() => {
    setSelected(prev => {
      const valid = new Set(waiting.map(w => w.id));
      const next = new Set([...prev].filter(id => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [waiting]);

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectableIds = displayed.filter(r => r.status === 'menunggu').map(r => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds));

  const handlePickup = async (ids, salesObj, note) => {
    const items = returns.filter(r => ids.includes(r.id));
    const ok = await confirm({
      tone: 'primary',
      title: `Serahkan ${items.length} barang ke ${salesObj.name}?`,
      message: salesObj.distributor ? `Distributor: ${salesObj.distributor}. Setelah dikonfirmasi, status berubah menjadi Diambil.` : 'Setelah dikonfirmasi, status berubah menjadi Diambil.',
      details: (
        <ul style={{ listStyle: 'none', display: 'grid', gap: 4 }}>
          {items.map(i => <li key={i.id}><b>{i.quantity}×</b> {i.itemName}</li>)}
        </ul>
      ),
      confirmText: 'Ya, serahkan',
    });
    if (!ok) return;
    try {
      await markReturnsTaken(ids, salesObj, note);
      toast.success(`${items.length} barang diserahkan ke ${salesObj.name}`);
      setPickup(null);
      setSelected(new Set());
    } catch (error) {
      if (error.code === 'already-taken') {
        const c = error.conflicts[0];
        toast.error(`${c.itemName} ${c.salesName ? `sudah diambil ${c.salesName}` : 'sudah tidak tersedia'}. Daftar diperbarui, silakan periksa lagi.`, { duration: 6000 });
        setPickup(null);
      } else {
        console.error(error);
        toast.error('Gagal menyimpan. Periksa koneksi internet lalu coba lagi.');
      }
    }
  };

  const handleCommitFromBanner = async () => {
    const totalQty = drafts.reduce((n, d) => n + (Number(d.quantity) || 0), 0);
    const ok = await confirm({
      tone: 'primary',
      title: `Simpan ${drafts.length} barang ke gudang?`,
      message: `Total ${totalQty} pcs akan tercatat sebagai Menunggu diambil.`,
      details: (
        <ul style={{ listStyle: 'none', display: 'grid', gap: 4 }}>
          {drafts.map(d => <li key={d.id}><b>{d.quantity}×</b> {d.itemName} <span className="text-muted">· {conditionOf(d.condition).label}</span></li>)}
        </ul>
      ),
      confirmText: 'Ya, simpan',
    });
    if (!ok) return;
    try {
      await commitDrafts(drafts, by);
      toast.success(`${drafts.length} barang tersimpan di gudang`);
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan. Draf masih aman, coba lagi.');
    }
  };

  const handleDelete = async (r) => {
    const ok = await confirm({
      tone: 'danger',
      title: 'Hapus barang dari daftar retur?',
      message: `${r.quantity}× ${r.itemName} akan dihapus permanen.`,
      confirmText: 'Ya, hapus',
    });
    if (!ok) return;
    try {
      await deleteReturn(r.id);
      toast.success('Barang dihapus dari daftar');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus data');
    }
  };

  const handleUndo = async (r) => {
    const ok = await confirm({
      tone: 'warning',
      title: 'Batalkan penyerahan?',
      message: `${r.quantity}× ${r.itemName} yang diambil ${r.salesName} akan kembali ke daftar Menunggu diambil.`,
      confirmText: 'Ya, batalkan',
    });
    if (!ok) return;
    try {
      await undoReturnTaken(r.id);
      toast.info('Penyerahan dibatalkan');
    } catch (error) {
      console.error(error);
      toast.error('Gagal membatalkan');
    }
  };

  const handleSchedule = async (patch) => {
    const ids = scheduling.map(r => r.id);
    try {
      await Promise.all(ids.map(id => updateReturn(id, patch)));
      toast.success(patch.pickupDate ? `Jadwal ambil ${formatDate(patch.pickupDate)} disimpan untuk ${ids.length} barang` : 'Jadwal dihapus');
      setScheduling(null);
      setSelected(new Set());
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan jadwal');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await updateReturn(editing.id, {
        itemName: editing.itemName.trim(),
        quantity: parseInt(editing.quantity) || 1,
        expiredDate: editing.expiredDate || '',
        pickupDate: editing.pickupDate || '',
        condition: editing.condition,
        notes: editing.notes || '',
      });
      toast.success('Perubahan disimpan');
      setEditing(null);
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan perubahan');
    }
  };

  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    if (list.length === 0) return toast.info('Tidak ada data untuk diekspor');
    const periodLabel = tab === 'menunggu'
      ? 'Seluruh barang yang masih menunggu'
      : period === 'custom'
        ? `${dateFrom ? formatDate(dateFrom) : 'awal'} s/d ${dateTo ? formatDate(dateTo) : 'sekarang'}`
        : PERIODS.find(p => p.id === period)?.label || 'Semua';
    const filters = [];
    if (search.trim()) filters.push(['Kata kunci', search.trim()]);
    if (filterCondition !== 'all') filters.push(['Kondisi', conditionOf(filterCondition).label]);
    if (tab !== 'menunggu' && filterSales !== 'all') filters.push(['Sales', filterSales]);
    if (tab !== 'menunggu' && filterDistributor !== 'all') filters.push(['Distributor', filterDistributor]);
    if (filterBy !== 'all') filters.push(['Dicatat oleh', filterBy]);
    if (tab === 'menunggu' && filterAge !== 'all') filters.push(['Lama di gudang', `≥ ${filterAge} hari`]);
    if (tab === 'menunggu' && waitingFilter !== 'all') {
      filters.push(['Status pengambilan', { terlambat: 'Terlambat', dijadwalkan: 'Dijadwalkan', tanpa_jadwal: 'Tanpa jadwal' }[waitingFilter]]);
    }
    if (!filters.length) filters.push(['Filter lain', 'Tidak ada']);

    setExporting(true);
    try {
      const { exportReturnsXlsx } = await import('../utils/exportReturns');
      await exportReturnsXlsx({
        rows: list,
        meta: {
          tabLabel: TABS.find(t => t.id === tab)?.label || tab,
          periodLabel: tab === 'diambil' ? `${periodLabel} (tanggal diambil)` : tab === 'semua' ? `${periodLabel} (tanggal dicatat)` : periodLabel,
          filters,
          exportedBy: profile?.name || user?.email || '-',
          fileTag: tab,
        },
      });
      toast.success(`File Excel diunduh (${list.length} baris)`);
    } catch (error) {
      console.error(error);
      toast.error('Gagal membuat file Excel');
    } finally {
      setExporting(false);
    }
  };

  const StatusCell = ({ r }) => {
    if (r.status === 'diambil') {
      return (
        <div>
          <span className="badge badge-success badge-dot">Diambil</span>
          <div className="text-sm font-semibold" style={{ marginTop: 4 }}>{r.salesName}</div>
          <div className="text-xs text-muted">{r.distributor ? `${r.distributor} · ` : ''}{formatDateTime(r.takenAt)}</div>
        </div>
      );
    }
    const days = daysSince(r.createdAt);
    if (isLate(r)) {
      return (
        <div>
          <span className="badge badge-danger badge-dot animate-pulse">Terlambat {lateDays(r)} hari</span>
          <div className="text-xs font-semibold" style={{ marginTop: 4, color: 'var(--danger)' }}>
            Janji {formatDate(r.pickupDate)}{r.pickupSalesName ? ` · ${r.pickupSalesName}` : ''}
          </div>
          <div className="text-xs text-muted">{days === 0 ? 'Dicatat hari ini' : `${days} hari di gudang`}</div>
        </div>
      );
    }
    if (isScheduled(r)) {
      return (
        <div>
          <span className="badge badge-info badge-dot">Dijadwalkan</span>
          <div className="text-xs font-semibold" style={{ marginTop: 4 }}>
            Ambil {formatDate(r.pickupDate)}{r.pickupSalesName ? ` · ${r.pickupSalesName}` : ''}
          </div>
          <div className="text-xs text-muted">{days === 0 ? 'Dicatat hari ini' : `${days} hari di gudang`}</div>
        </div>
      );
    }
    return (
      <div>
        <span className={`badge badge-dot ${isAged(r) ? 'badge-danger' : 'badge-warning'}`}>{isAged(r) ? 'Lama di gudang' : 'Menunggu'}</span>
        <div className="text-xs text-muted" style={{ marginTop: 4 }}>{days === 0 ? 'Hari ini' : `${days} hari di gudang`}</div>
      </div>
    );
  };

  const rowActions = (r) => (
    <div className="flex justify-end gap-1">
      {r.status === 'menunggu' ? (
        <>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setScheduling([r])} title="Jadwalkan pengambilan" aria-label="Jadwalkan pengambilan"><LuCalendarClock /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing({ ...r })} title="Edit" aria-label="Edit"><LuPencil /></button>
          <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(r)} title="Hapus" aria-label="Hapus"><LuTrash2 /></button>
        </>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={() => handleUndo(r)} title="Batalkan penyerahan"><LuUndo2 /> Batalkan</button>
      )}
    </div>
  );

  const lastDraft = drafts.length ? [...drafts].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0] : null;

  return (
    <>
      <PageHeader
        eyebrow="Gudang retur"
        title="Retur Barang"
        subtitle={<span className="flex items-center gap-2"><span className="live-dot" /> Data tersinkron langsung antar karyawan</span>}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setPickup({ preselected: [] })} disabled={waiting.length === 0}><LuHandshake /> Sales ambil barang</button>
            <button className="btn btn-primary" onClick={() => setShowRecord(true)}><LuPlus /> Catat barang</button>
          </>
        }
      />

      {connError && (
        <div className="callout callout-warning" style={{ marginBottom: '1rem' }}>
          <LuTriangleAlert />
          <div className="callout-body"><b>Koneksi bermasalah</b><small>Data mungkin tidak terbaru. Periksa internet Anda.</small></div>
        </div>
      )}

      {loading ? (
        <div className="stat-grid"><Skeleton height={100} /><Skeleton height={100} /><Skeleton height={100} /></div>
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {drafts.length > 0 && (
            <div className="draft-banner">
              <div className="draft-banner-main">
                <span className="icon-tile" style={{ background: 'var(--bg-secondary)' }}><LuNotebookPen /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="font-bold">Draf belum disimpan: {drafts.length} barang</div>
                  <div className="text-sm text-secondary">Terakhir diubah {timeAgo(lastDraft.updatedAt || lastDraft.createdAt)} oleh {lastDraft.updatedByName || whoLabel(lastDraft)}</div>
                  {drafts.some(isStaleDraft) && (
                    <div className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--warning)', marginTop: 4 }}>
                      <LuTriangleAlert /> Ada draf dari hari sebelumnya — periksa lagi sebelum disimpan
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className="btn btn-secondary" onClick={() => setShowRecord(true)}>Lanjutkan mencatat</button>
                <button className="btn btn-success" onClick={handleCommitFromBanner}><LuWarehouse /> Simpan ke gudang</button>
              </div>
            </div>
          )}

          <div className="stat-grid">
            <StatCard label="Menunggu diambil" value={waiting.length} icon={<LuWarehouse />} tone="warning" />
            <StatCard label="Terlambat diambil" value={lateCount} icon={<LuAlarmClockOff />} tone={lateCount > 0 ? 'danger' : 'success'} />
            <StatCard label={`Lama di gudang (≥${WAREHOUSE_ALERT_DAYS} hari)`} value={agedCount} icon={<LuTriangleAlert />} tone={agedCount > 0 ? 'danger' : 'success'} />
            <StatCard label="Diambil bulan ini" value={thisMonthTaken} icon={<LuPackageCheck />} tone="success" />
          </div>

          <div className="card" style={{ padding: '0.75rem' }}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="input-icon flex-1">
                  <LuSearch />
                  <input type="text" className="form-control" placeholder="Cari barang, catatan, sales, atau karyawan..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <button className={`btn ${showFilters || activeFilterCount ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters}>
                  <LuFilter /> Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}
                </button>
              </div>

              {showFilters && (
                <div className="animate-fade-in" style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', padding: '0.9rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <label className="form-label">Kondisi</label>
                    <SelectField value={filterCondition} onChange={setFilterCondition} title="Kondisi" options={[{ value: 'all', label: 'Semua kondisi' }, ...CONDITIONS.map(c => ({ value: c.id, label: c.label }))]} />
                  </div>
                  {tab !== 'menunggu' && (
                    <>
                      <div>
                        <label className="form-label">Sales pengambil</label>
                        <SelectField value={filterSales} onChange={setFilterSales} title="Sales pengambil" options={stringOptions(salesNames, 'Semua sales')} />
                      </div>
                      <div>
                        <label className="form-label">Distributor</label>
                        <SelectField value={filterDistributor} onChange={setFilterDistributor} title="Distributor" options={stringOptions(distributorNames, 'Semua distributor')} />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="form-label">Dicatat oleh</label>
                    <SelectField value={filterBy} onChange={setFilterBy} title="Dicatat oleh" options={stringOptions(recorderNames, 'Semua karyawan')} />
                  </div>
                  {tab === 'menunggu' && (
                    <div>
                      <label className="form-label">Lama di gudang</label>
                      <SelectField value={filterAge} onChange={setFilterAge} title="Lama di gudang" options={[
                        { value: 'all', label: 'Semua' },
                        { value: '3', label: '≥ 3 hari' },
                        { value: '7', label: '≥ 7 hari' },
                        { value: '14', label: '≥ 14 hari (lama)' },
                      ]} />
                    </div>
                  )}
                  <div>
                    <label className="form-label">Urutkan</label>
                    <SelectField value={sortBy} onChange={setSortBy} title="Urutkan" options={[
                      { value: 'terbaru', label: 'Terbaru dulu' },
                      { value: 'terlama', label: 'Terlama dulu' },
                      { value: 'nama', label: 'Nama barang A–Z' },
                      { value: 'jumlah', label: 'Jumlah terbanyak' },
                    ]} />
                  </div>
                  {activeFilterCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button className="btn btn-ghost w-full" onClick={resetFilters}><LuX /> Reset filter</button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="segmented chip-scroll">
                  {TABS.map(t => (
                    <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => changeTab(t.id)}>
                      {t.label}{t.id === 'menunggu' && waiting.length > 0 ? ` (${waiting.length})` : ''}
                    </button>
                  ))}
                </div>
                <button className="btn btn-success btn-sm" onClick={exportExcel} disabled={exporting}><LuDownload /> {exporting ? 'Menyiapkan…' : 'Export Excel'}</button>
              </div>

              {tab === 'menunggu' && waiting.length > 0 && (
                <div className="segmented chip-scroll animate-fade-in" aria-label="Status pengambilan">
                  {[
                    { id: 'all', label: `Semua (${waiting.length})` },
                    { id: 'terlambat', label: `Terlambat (${lateCount})`, danger: lateCount > 0 },
                    { id: 'dijadwalkan', label: `Dijadwalkan (${scheduledCount})` },
                    { id: 'tanpa_jadwal', label: `Tanpa jadwal (${unscheduledCount})` },
                  ].map(c => (
                    <button key={c.id} className={waitingFilter === c.id ? 'active' : ''} style={c.danger && waitingFilter !== c.id ? { color: 'var(--danger)' } : undefined} onClick={() => setWaitingFilter(c.id)}>{c.label}</button>
                  ))}
                </div>
              )}

              {tab !== 'menunggu' && (
                <div className="flex flex-col gap-2 animate-fade-in" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                  <div className="flex items-center gap-2 text-xs text-muted font-semibold uppercase tracking-wider">
                    <LuCalendarRange /> {tab === 'diambil' ? 'Tanggal diambil' : 'Tanggal dicatat'}
                  </div>
                  <div className="segmented chip-scroll">
                    {PERIODS.map(p => (
                      <button key={p.id} className={period === p.id ? 'active' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>
                    ))}
                  </div>
                  {period === 'custom' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="date" className="form-control" style={{ width: 'auto' }} value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} aria-label="Dari tanggal" />
                      <span className="text-muted">sampai</span>
                      <input type="date" className="form-control" style={{ width: 'auto' }} value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} aria-label="Sampai tanggal" />
                    </div>
                  )}
                </div>
              )}

              <div className="text-sm text-secondary">
                Menampilkan <b>{list.length}</b> baris · <b>{listQty}</b> pcs
                {activeFilterCount > 0 && <span className="text-muted"> (filter aktif)</span>}
              </div>
            </div>
          </div>

          {tab === 'menunggu' && selected.size > 0 && (
            <div className="card selection-bar animate-dropdown">
              <span className="font-semibold">{selected.size} barang dipilih</span>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}><LuX /> Batal</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setScheduling(returns.filter(r => selected.has(r.id)))}><LuCalendarClock /> Jadwalkan</button>
                <button className="btn btn-primary btn-sm" onClick={() => setPickup({ preselected: [...selected] })}><LuHandshake /> Serahkan ke sales</button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {list.length === 0 ? (
              <EmptyState
                icon={<LuInbox />}
                title={tab === 'diambil' ? 'Belum ada barang yang diambil' : 'Tidak ada barang retur'}
                text={tab === 'menunggu' ? 'Catat barang yang dipisahkan ke gudang agar bisa diambil sales.' : 'Coba ubah kata kunci atau filter.'}
                action={tab === 'menunggu' ? <button className="btn btn-primary" onClick={() => setShowRecord(true)}><LuPlus /> Catat barang</button> : null}
              />
            ) : (
              <>
                <div className="table-wrap show-desktop">
                  <table className="table" style={{ minWidth: 820 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>{tab === 'menunggu' && <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Pilih semua" />}</th>
                        <th>Barang</th>
                        <th>Kondisi</th>
                        <th>Dicatat</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map(r => (
                        <tr key={r.id} style={{ background: (isAged(r) || isLate(r)) ? 'var(--danger-bg)' : undefined }}>
                          <td>{r.status === 'menunggu' && <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Pilih ${r.itemName}`} />}</td>
                          <td>
                            <div className="font-semibold"><span className="text-accent-primary">{r.quantity}×</span> {r.itemName}</div>
                            {r.expiredDate && <div className="text-xs text-muted">ED: {formatDate(r.expiredDate)}</div>}
                            {r.notes && <div className="text-xs text-muted">“{r.notes}”</div>}
                          </td>
                          <td><span className={`badge badge-${conditionOf(r.condition).tone}`}>{conditionOf(r.condition).label}</span></td>
                          <td>
                            <div className="text-sm">{formatDate(r.createdAt)}</div>
                            <div className="text-xs text-muted truncate" style={{ maxWidth: 160 }}>{whoLabel(r)}</div>
                          </td>
                          <td><StatusCell r={r} /></td>
                          <td>{rowActions(r)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="list show-mobile stagger" style={{ padding: '0.75rem' }}>
                  {displayed.map(r => (
                    <div key={r.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem', background: (isAged(r) || isLate(r)) ? 'var(--danger-bg)' : undefined }}>
                      <div className="flex items-start gap-3">
                        {r.status === 'menunggu' && <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} style={{ width: 22, height: 22, marginTop: 2 }} aria-label={`Pilih ${r.itemName}`} />}
                        <div className="flex-1">
                          <div className="font-semibold"><span className="text-accent-primary">{r.quantity}×</span> {r.itemName}</div>
                          <div className="flex flex-wrap gap-1" style={{ marginTop: 4 }}>
                            <span className={`badge badge-${conditionOf(r.condition).tone}`}>{conditionOf(r.condition).label}</span>
                            {r.expiredDate && <span className="badge">ED {formatDate(r.expiredDate)}</span>}
                          </div>
                          {r.notes && <div className="text-xs text-muted" style={{ marginTop: 4 }}>“{r.notes}”</div>}
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-2" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
                        <div>
                          <StatusCell r={r} />
                          <div className="text-xs text-muted" style={{ marginTop: 4 }}><LuClock style={{ verticalAlign: '-2px' }} /> {formatDate(r.createdAt)} · {whoLabel(r)}</div>
                        </div>
                        {rowActions(r)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {displayLimit < list.length && <div className="text-center"><div className="spinner" style={{ margin: '0 auto' }} /></div>}
        </div>
      )}

      {showRecord && (
        <RecordReturnModal
          catalog={catalog}
          frequent={frequent}
          drafts={drafts}
          waiting={waiting}
          onClose={() => setShowRecord(false)}
          onCommitted={() => { setShowRecord(false); setTab('menunggu'); }}
        />
      )}

      {scheduling && (
        <ScheduleModal items={scheduling} sales={sales} onClose={() => setScheduling(null)} onSave={handleSchedule} />
      )}

      {pickup && (
        <PickupModal sales={sales} waiting={waiting} preselected={pickup.preselected} onClose={() => setPickup(null)} onConfirm={handlePickup} />
      )}

      {editing && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal" style={{ maxWidth: 480 }} role="dialog" aria-modal="true" aria-label="Edit barang retur">
            <div className="card-header">
              <h3>Edit Barang Retur</h3>
              <button type="button" className="icon-btn" onClick={() => setEditing(null)} aria-label="Tutup"><LuX /></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">Nama barang</label>
                <input className="form-control field-big" value={editing.itemName} onChange={(e) => setEditing({ ...editing, itemName: e.target.value })} required maxLength={80} />
              </div>
              <div className="form-group">
                <label className="form-label">Jumlah</label>
                <Stepper value={editing.quantity} onChange={(v) => setEditing({ ...editing, quantity: v })} />
              </div>
              <div className="form-group">
                <label className="form-label">Kondisi</label>
                <div className="choice-grid">
                  {CONDITIONS.map(c => (
                    <button key={c.id} type="button" className={`choice tone-${c.tone} ${editing.condition === c.id ? 'selected' : ''}`} onClick={() => setEditing({ ...editing, condition: c.id })}>
                      {COND_ICON[c.id]}{c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="form-group flex-1" style={{ minWidth: 150 }}>
                  <label className="form-label">Tgl kedaluwarsa</label>
                  <input type="date" className="form-control" value={editing.expiredDate || ''} onChange={(e) => setEditing({ ...editing, expiredDate: e.target.value })} />
                </div>
                <div className="form-group flex-1" style={{ minWidth: 150 }}>
                  <label className="form-label">Janji diambil tanggal</label>
                  <input type="date" className="form-control" value={editing.pickupDate || ''} onChange={(e) => setEditing({ ...editing, pickupDate: e.target.value })} />
                </div>
                <div className="form-group flex-1" style={{ minWidth: 150 }}>
                  <label className="form-label">Catatan</label>
                  <input type="text" className="form-control" value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} maxLength={100} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditing(null)}>Batal</button>
                <button type="submit" className="btn btn-primary flex-1">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Returns;
