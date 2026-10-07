import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUsers, FaCalendarCheck, FaArrowRight, FaBell, FaExclamationCircle } from 'react-icons/fa';
import { getSalesList, getAllAttendance, getAllTransactions } from '../services/dbService';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalSales: 0, todayAttendance: 0 });
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [overdueRetur, setOverdueRetur] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readNotifs, setReadNotifs] = useState(() => {
    const saved = localStorage.getItem('readNotifs');
    return saved ? JSON.parse(saved) : [];
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sales = await getSalesList();
        const attendance = await getAllAttendance();
        const transactions = await getAllTransactions();
        
        const today = new Date().toISOString().split('T')[0];
        const todayAtt = attendance.filter(a => a.date === today);
        
        setStats({
          totalSales: sales.length,
          todayAttendance: todayAtt.length
        });

        const recent = attendance.slice(0, 5).map(a => {
          const s = sales.find(x => x.id === a.salesId);
          return { ...a, salesName: s ? s.name : 'Unknown' };
        });
        setRecentAttendance(recent);

        const overdue = transactions.filter(t => 
          t.type === 'retur' && 
          t.status === 'pending' && 
          t.pickupDate && 
          t.pickupDate < today
        ).map(t => {
          const s = sales.find(x => x.id === t.salesId);
          return { ...t, salesName: s ? s.name : 'Unknown' };
        });
        setOverdueRetur(overdue);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <div className="sticky-page-header mb-4 md:mb-6 flex justify-between items-center gap-4" style={{ position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          <h1 className="mb-0 md:mb-1 text-xl md:text-3xl" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dashboard</h1>
          <p className="text-secondary text-xs md:text-sm m-0 hidden sm:block" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Selamat datang di sistem manajemen Sales & Absensi.</p>
        </div>
        
        {/* Hitung jumlah notifikasi yang belum dibaca */}
        {(() => {
          const unreadCount = overdueRetur.filter(trx => !readNotifs.includes(trx.id)).length;
          
          const handleNotifClick = (trx) => {
            if (!readNotifs.includes(trx.id)) {
              const newRead = [...readNotifs, trx.id];
              setReadNotifs(newRead);
              localStorage.setItem('readNotifs', JSON.stringify(newRead));
            }
            navigate(`/sales/${trx.salesId}/transactions`);
          };

          return (
            <div style={{ position: 'relative', zIndex: 50 }}>
              <button 
                className="flex items-center justify-center transition-transform"
                style={{ 
                  width: '44px', 
                  height: '44px', 
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '50%',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer'
                }}
                onClick={() => setShowNotif(!showNotif)}
              >
                <FaBell size={20} className={unreadCount > 0 ? 'text-yellow-500 animate-pulse' : 'text-muted'} />
                {unreadCount > 0 && (
                  <span style={{ 
                    position: 'absolute', 
                    top: '-4px', 
                    right: '-4px', 
                    background: '#ef4444', 
                    color: '#fff', 
                    fontSize: '10px', 
                    fontWeight: 'bold', 
                    width: '18px', 
                    height: '18px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
                    border: '2px solid var(--bg-primary)'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotif && (
                <div className="animate-dropdown" 
                     style={{ 
                       position: 'absolute',
                       right: '-4px',
                       top: 'calc(100% + 12px)',
                       width: 'calc(100vw - 32px)',
                       maxWidth: '360px',
                       background: 'var(--bg-secondary)',
                       border: '1px solid var(--border-light)',
                       borderRadius: '20px',
                       boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
                       overflow: 'hidden',
                       zIndex: 100
                     }}>
                  <div className="flex justify-between items-center" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.02)' }}>
                    <h3 className="m-0 text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      Notifikasi
                    </h3>
                    {unreadCount > 0 && (
                      <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '11px', padding: '4px 10px', borderRadius: '100px', fontWeight: 'bold' }}>
                        {unreadCount} Baru
                      </span>
                    )}
                  </div>
                  
                  <div style={{ maxHeight: '350px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                    {overdueRetur.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center">
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                          <FaBell className="text-muted opacity-30 text-2xl" />
                        </div>
                        <p className="text-muted text-sm m-0 font-medium">Belum ada notifikasi baru</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {overdueRetur.map((trx) => {
                          const isRead = readNotifs.includes(trx.id);
                          return (
                            <div 
                              key={trx.id} 
                              className="cursor-pointer transition-colors"
                              style={{ 
                                padding: '16px 20px',
                                borderBottom: '1px solid var(--border-light)',
                                background: isRead ? 'transparent' : 'rgba(239, 68, 68, 0.04)'
                              }}
                              onClick={() => handleNotifClick(trx)}
                              onMouseOver={(e) => e.currentTarget.style.background = isRead ? 'rgba(0,0,0,0.02)' : 'rgba(239, 68, 68, 0.08)'}
                              onMouseOut={(e) => e.currentTarget.style.background = isRead ? 'transparent' : 'rgba(239, 68, 68, 0.04)'}
                            >
                              <div className="flex items-start gap-3">
                                <div style={{ 
                                  width: '36px', height: '36px', borderRadius: '10px', 
                                  background: 'rgba(239, 68, 68, 0.1)', display: 'flex', 
                                  alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' 
                                }}>
                                  <FaExclamationCircle className="text-red-500 text-lg" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                      Retur Terlambat
                                    </div>
                                    {!isRead && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>}
                                  </div>
                                  <div className="text-xs text-muted mb-2 line-clamp-2">
                                    Sales <span style={{color:'var(--text-primary)', fontWeight: '600'}}>{trx.salesName}</span> belum mengambil barang retur.
                                  </div>
                                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#ef4444', display: 'inline-block', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                    Jatuh tempo: {new Date(trx.pickupDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div 
                    className="cursor-pointer transition-colors"
                    style={{ 
                      padding: '16px', 
                      textAlign: 'center', 
                      fontSize: '13px', 
                      fontWeight: 'bold', 
                      color: 'var(--accent-primary)', 
                      background: 'rgba(0,0,0,0.01)',
                      borderTop: '1px solid var(--border-light)' 
                    }}
                    onClick={() => navigate('/notifications')}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.01)'}
                  >
                    Lihat Semua Notifikasi
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="animate-fade-in pb-10">

      {loading ? (
        <div className="text-center mt-8">Loading data...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="card flex items-center justify-between">
              <div>
                <h3 className="text-muted mb-2" style={{ fontSize: '1rem' }}>Total Sales</h3>
                <h2 style={{ fontSize: '2.5rem' }}>{stats.totalSales}</h2>
              </div>
              <div className="avatar avatar-lg" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }}>
                <FaUsers />
              </div>
            </div>
            <div className="card flex items-center justify-between">
              <div>
                <h3 className="text-muted mb-2" style={{ fontSize: '1rem' }}>Absensi Hari Ini</h3>
                <h2 style={{ fontSize: '2.5rem' }}>{stats.todayAttendance}</h2>
              </div>
              <div className="avatar avatar-lg" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                <FaCalendarCheck />
              </div>
            </div>
          </div>

          <div className="card mb-6">
            <div className="flex items-center justify-between mb-6">
              <h3>Absensi Terakhir</h3>
              <Link to="/attendance" className="flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
                Lihat Semua <FaArrowRight />
              </Link>
            </div>
            
            {recentAttendance.length === 0 ? (
              <p className="text-muted text-center py-4">Belum ada data absensi.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentAttendance.map(att => (
                  <div key={att.id} className="flex items-center justify-between" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
                    <div className="flex items-center gap-4">
                      <div className="avatar">
                        {att.salesName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600' }}>{att.salesName}</div>
                        <div className="text-muted" style={{ fontSize: '0.875rem' }}>{new Date(att.timestamp).toLocaleString('id-ID')}</div>
                      </div>
                    </div>
                    <span className="badge badge-success">Hadir</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </>
  );
};

export default Dashboard;
