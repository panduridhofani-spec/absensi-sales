import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuUsers, LuCalendarCheck, LuArrowRight, LuBell, LuTriangleAlert, LuUndo2, LuClock } from 'react-icons/lu';
import { getSalesList, getAllAttendance, getReturns } from '../services/dbService';
import { PageHeader, StatCard, EmptyState, Skeleton } from '../components/ui';
import { getAlerts, daysSince, lateDays, formatDate } from '../utils/returns';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalSales: 0, todayAttendance: 0, pendingRetur: 0 });
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [overdueRetur, setOverdueRetur] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readNotifs, setReadNotifs] = useState(() => {
    try {
      const saved = localStorage.getItem('readNotifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const navigate = useNavigate();
  const notifRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sales = await getSalesList();
        const attendance = await getAllAttendance();
        const returns = await getReturns();

        const today = new Date().toISOString().split('T')[0];
        const todayAtt = attendance.filter(a => a.date === today);

        setStats({
          totalSales: sales.length,
          todayAttendance: todayAtt.length,
          pendingRetur: returns.filter(r => r.status === 'menunggu').length,
        });

        setRecentAttendance(attendance.slice(0, 6).map(a => {
          const s = sales.find(x => x.id === a.salesId);
          return { ...a, salesName: s ? s.name : 'Unknown' };
        }));

        setOverdueRetur(getAlerts(returns));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!showNotif) return;
    const onDown = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showNotif]);

  const unreadCount = overdueRetur.filter(trx => !readNotifs.includes(trx.id)).length;

  const handleNotifClick = (trx) => {
    if (!readNotifs.includes(trx.id)) {
      const newRead = [...readNotifs, trx.id];
      setReadNotifs(newRead);
      try { localStorage.setItem('readNotifs', JSON.stringify(newRead)); } catch { /* ignore */ }
    }
    navigate('/returns');
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  })();

  const bell = (
    <div className="notif-wrap" ref={notifRef}>
      <button className="notif-btn" onClick={() => setShowNotif(s => !s)} aria-label="Notifikasi" aria-expanded={showNotif}>
        <LuBell />
        {unreadCount > 0 && <span className="notif-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {showNotif && (
        <div className="dropdown-panel notif-panel animate-dropdown">
          <div className="notif-head">
            <strong>Notifikasi</strong>
            {unreadCount > 0 && <span className="badge badge-danger">{unreadCount} baru</span>}
          </div>

          <div className="notif-body">
            {overdueRetur.length === 0 ? (
              <EmptyState icon={<LuBell />} title="Tidak ada notifikasi" text="Tidak ada janji ambil yang terlewat atau barang yang menumpuk di gudang." />
            ) : (
              overdueRetur.map((trx) => {
                const isRead = readNotifs.includes(trx.id);
                return (
                  <button key={trx.id} className={`notif-item ${isRead ? '' : 'unread'}`} onClick={() => handleNotifClick(trx)}>
                    <span className="notif-icon"><LuTriangleAlert /></span>
                    <span className="notif-text">
                      <span className="notif-title">{trx.alertKind === 'late' ? 'Janji ambil terlewat' : 'Barang retur lama di gudang'} {!isRead && <i className="notif-dot" />}</span>
                      <span className="notif-desc">
                        <b>{trx.quantity}× {trx.itemName}</b>{' '}
                        {trx.alertKind === 'late'
                          ? `belum diambil${trx.pickupSalesName ? ` ${trx.pickupSalesName}` : ''}, janji ${formatDate(trx.pickupDate)}.`
                          : 'belum diambil sales.'}
                      </span>
                      <span className="badge badge-danger">{trx.alertKind === 'late' ? `Terlambat ${lateDays(trx)} hari` : `${daysSince(trx.createdAt)} hari di gudang`}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button className="notif-foot" onClick={() => navigate('/notifications')}>
            Lihat semua notifikasi <LuArrowRight />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting} 👋`}
        subtitle="Ringkasan aktivitas tim sales hari ini."
        actions={bell}
      />

      {loading ? (
        <div className="stat-grid">
          <Skeleton height={104} /><Skeleton height={104} /><Skeleton height={104} />
        </div>
      ) : (
        <div className="dashboard-stack stagger">
          <div className="stat-grid">
            <StatCard label="Total Sales" value={stats.totalSales} icon={<LuUsers />} tone="primary" />
            <StatCard label="Absensi Hari Ini" value={stats.todayAttendance} icon={<LuCalendarCheck />} tone="success" />
            <StatCard label="Retur Menunggu" value={stats.pendingRetur} icon={<LuUndo2 />} tone="warning" />
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Absensi Terakhir</h3>
              <Link to="/attendance" className="btn btn-ghost btn-sm">Lihat semua <LuArrowRight /></Link>
            </div>

            {recentAttendance.length === 0 ? (
              <EmptyState icon={<LuCalendarCheck />} title="Belum ada absensi" text="Absensi yang tercatat akan tampil di sini." />
            ) : (
              <div className="list stagger">
                {recentAttendance.map(att => (
                  <div key={att.id} className="list-item">
                    <div className="list-item-main">
                      <div className="avatar">{att.salesName.charAt(0).toUpperCase()}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="list-item-title">{att.salesName}</div>
                        <div className="list-item-sub"><LuClock style={{ verticalAlign: '-2px' }} /> {new Date(att.timestamp).toLocaleString('id-ID')}</div>
                      </div>
                    </div>
                    <span className="badge badge-success badge-dot">Hadir</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
