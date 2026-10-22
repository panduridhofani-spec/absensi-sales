import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuBell, LuTriangleAlert, LuAlarmClockOff, LuSearch, LuArrowRight } from 'react-icons/lu';
import { getReturns } from '../services/dbService';
import { PageHeader, EmptyState, Skeleton } from '../components/ui';
import { getAlerts, daysSince, lateDays, conditionOf, formatDate, WAREHOUSE_ALERT_DAYS } from '../utils/returns';

const READ_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'unread', label: 'Belum dibaca' },
  { id: 'read', label: 'Sudah dibaca' },
];

const KIND_FILTERS = [
  { id: 'all', label: 'Semua jenis' },
  { id: 'late', label: 'Terlambat diambil' },
  { id: 'aged', label: 'Lama di gudang' },
];

const Notifications = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterKind, setFilterKind] = useState('all');
  const [readNotifs, setReadNotifs] = useState(() => {
    try {
      const saved = localStorage.getItem('readNotifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setAlerts(getAlerts(await getReturns()));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const markRead = (id) => {
    if (readNotifs.includes(id)) return;
    const newRead = [...readNotifs, id];
    setReadNotifs(newRead);
    try { localStorage.setItem('readNotifs', JSON.stringify(newRead)); } catch { /* ignore */ }
  };

  const lateTotal = alerts.filter(a => a.alertKind === 'late').length;

  const filtered = alerts.filter(r => {
    const isRead = readNotifs.includes(r.id);
    if (filterType === 'unread' && isRead) return false;
    if (filterType === 'read' && !isRead) return false;
    if (filterKind !== 'all' && r.alertKind !== filterKind) return false;
    const term = searchTerm.trim().toLowerCase();
    return !term || [r.itemName, r.notes, r.pickupSalesName].some(v => String(v || '').toLowerCase().includes(term));
  });

  return (
    <>
      <PageHeader
        eyebrow="Pusat informasi"
        title="Notifikasi"
        subtitle={`${lateTotal} janji ambil terlewat · barang yang belum diambil lebih dari ${WAREHOUSE_ALERT_DAYS} hari di gudang.`}
        backTo="/"
        backLabel="Dashboard"
      />

      <div className="card mb-4" style={{ padding: '0.875rem' }}>
        <div className="flex flex-col gap-3">
          <div className="input-icon">
            <LuSearch />
            <input type="text" placeholder="Cari nama barang, catatan, atau sales..." className="form-control" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="segmented chip-scroll">
              {KIND_FILTERS.map(f => (
                <button key={f.id} className={filterKind === f.id ? 'active' : ''} onClick={() => setFilterKind(f.id)}>{f.label}</button>
              ))}
            </div>
            <div className="segmented chip-scroll">
              {READ_FILTERS.map(f => (
                <button key={f.id} className={filterType === f.id ? 'active' : ''} onClick={() => setFilterType(f.id)}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="list" style={{ padding: '1rem' }}><Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<LuBell />} title="Tidak ada notifikasi" text="Tidak ada janji yang terlewat atau barang yang menumpuk, atau tidak sesuai filter Anda." />
        ) : (
          <div className="stagger">
            {filtered.map((r) => {
              const isRead = readNotifs.includes(r.id);
              const late = r.alertKind === 'late';
              return (
                <div key={r.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b" style={{ padding: '1.1rem 1.25rem', background: isRead ? 'transparent' : 'var(--danger-bg)' }}>
                  <div className="flex gap-4 items-start flex-1 cursor-pointer" onClick={() => markRead(r.id)}>
                    <div className="icon-tile" style={{ width: 46, height: 46, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '1.3rem' }}>
                      {late ? <LuAlarmClockOff /> : <LuTriangleAlert />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold" style={{ fontSize: '0.95rem' }}>
                        {r.quantity}× {r.itemName} {!isRead && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Baru</span>}
                      </div>
                      <div className="text-sm text-secondary" style={{ margin: '0.25rem 0 0.5rem' }}>
                        {late
                          ? `Dijanjikan diambil ${r.pickupSalesName ? `oleh ${r.pickupSalesName} ` : ''}pada ${formatDate(r.pickupDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, tetapi belum diambil.`
                          : `Dicatat ${formatDate(r.createdAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} dan belum diambil sales.`}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {late
                          ? <span className="badge badge-danger">Terlambat {lateDays(r)} hari</span>
                          : <span className="badge badge-danger">{daysSince(r.createdAt)} hari di gudang</span>}
                        <span className={`badge badge-${conditionOf(r.condition).tone}`}>{conditionOf(r.condition).label}</span>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-secondary w-full sm:w-auto" onClick={() => { markRead(r.id); navigate('/returns'); }}>
                    Buka retur <LuArrowRight />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Notifications;
