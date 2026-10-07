import React, { useEffect, useState } from 'react';
import { FaCalendarAlt, FaFileDownload, FaUsers, FaChartLine, FaCheckCircle, FaSearch, FaTrash, FaEdit } from 'react-icons/fa';
import { getAllAttendance, getSalesList, deleteAttendance, updateAttendance } from '../services/dbService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) return <div className="p-4 text-danger text-center">Terjadi kesalahan saat memuat halaman ini.</div>;
    return this.props.children;
  }
}

const AttendanceInner = () => {
  const [attendance, setAttendance] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth()); // 0-11
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [activeTab, setActiveTab] = useState('bulanan'); // 'bulanan' or 'harian'
  const [displayLimit, setDisplayLimit] = useState(20);
  const [editAttModal, setEditAttModal] = useState(null);

  // Safe date formatter
  const safeFormatDate = (timestamp, options) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', options);
  };
  const safeFormatTime = (timestamp, options) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('id-ID', options);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const attData = await getAllAttendance(null);
        const salesData = await getSalesList();
        
        // Sort attendance by newest first
        attData.sort((a, b) => {
          const tA = new Date(a.timestamp).getTime();
          const tB = new Date(b.timestamp).getTime();
          return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
        });
        
        setAttendance(attData);
        setSales(salesData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDeleteAttendance = async (attId) => {
    if (window.confirm('Yakin ingin menghapus rekam absensi ini secara global?')) {
      try {
        await deleteAttendance(attId);
        setAttendance(prev => prev.filter(a => a.id !== attId));
      } catch (error) {
        console.error("Gagal menghapus absensi:", error);
        alert("Gagal menghapus absensi");
      }
    }
  };

  const handleEditAttendance = (att) => {
    // When editing, parse the ISO timestamp into date and time
    const d = new Date(att.timestamp);
    const dateStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
    const timeStr = !isNaN(d.getTime()) ? d.toTimeString().substring(0, 5) : '';

    setEditAttModal({
      ...att,
      editDate: dateStr,
      editTime: timeStr,
      editNotes: att.notes || ''
    });
  };

  const handleSaveEditAttendance = async (e) => {
    e.preventDefault();
    if (!editAttModal.editDate || !editAttModal.editTime) {
      alert("Tanggal dan Jam wajib diisi!");
      return;
    }

    try {
      // Combine editDate and editTime back into ISO timestamp
      const newTimestamp = new Date(`${editAttModal.editDate}T${editAttModal.editTime}:00`).toISOString();
      const updates = { 
        timestamp: newTimestamp, 
        date: editAttModal.editDate, 
        notes: editAttModal.editNotes 
      };
      
      await updateAttendance(editAttModal.id, updates);
      
      // Update local state
      setAttendance(prev => {
        const updated = prev.map(a => a.id === editAttModal.id ? { ...a, ...updates } : a);
        // Resort
        return updated.sort((a, b) => {
          const tA = new Date(a.timestamp).getTime();
          const tB = new Date(b.timestamp).getTime();
          return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
        });
      });
      
      setEditAttModal(null);
    } catch (error) {
      console.error("Gagal menyimpan perubahan absensi:", error);
      alert("Gagal menyimpan perubahan absensi");
    }
  };

  // Reset infinite scroll on tab or filter change
  useEffect(() => {
    setDisplayLimit(20);
  }, [activeTab, filterMonth, filterYear, filterDate]);

  const getSalesObj = (id) => sales.find(x => x.id === id) || { name: 'Sales Dihapus', distributor: '-' };

  // --- BULANAN LOGIC ---
  const filteredMonthly = attendance.filter(a => {
    if (!a.timestamp) return false;
    const d = new Date(a.timestamp);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  const monthlyStats = {};
  sales.forEach(s => {
    monthlyStats[s.id] = { ...s, totalVisits: 0, lastVisit: null };
  });

  filteredMonthly.forEach(a => {
    if (!monthlyStats[a.salesId]) {
      monthlyStats[a.salesId] = { id: a.salesId, name: 'Sales Dihapus', distributor: '-', totalVisits: 0, lastVisit: null };
    }
    monthlyStats[a.salesId].totalVisits += 1;
    
    const attDate = new Date(a.timestamp);
    if (!isNaN(attDate.getTime())) {
      if (!monthlyStats[a.salesId].lastVisit || attDate > monthlyStats[a.salesId].lastVisit) {
        monthlyStats[a.salesId].lastVisit = attDate;
      }
    }
  });

  const activeSalesCount = Object.values(monthlyStats).filter(s => s.totalVisits > 0).length;
  const topSales = Object.values(monthlyStats).reduce((prev, current) => (prev.totalVisits > current.totalVisits) ? prev : current, { totalVisits: 0 });

  const monthlySortedList = Object.values(monthlyStats).sort((a,b) => b.totalVisits - a.totalVisits);
  const displayedMonthly = monthlySortedList.slice(0, displayLimit);

  const exportMonthlyCSV = () => {
    let csvContent = `Laporan Kunjungan Sales - Bulan ${filterMonth + 1} Tahun ${filterYear}\n\n`;
    csvContent += "ID Sales,Nama Sales,Distributor,Total Kunjungan (Bulan Ini),Terakhir Datang\n";

    monthlySortedList.forEach(s => {
      const lastVisitStr = s.lastVisit ? s.lastVisit.toLocaleDateString('id-ID') : 'Belum Berkunjung';
      const name = (s.name || 'Sales Dihapus').replace(/,/g, ' ');
      const dist = (s.distributor || '-').replace(/,/g, ' ');
      csvContent += `${s.id},${name},${dist},${s.totalVisits},${lastVisitStr}\n`;
    });

    downloadCSV(csvContent, `Laporan_Kunjungan_Bulan_${filterMonth + 1}_${filterYear}.csv`);
  };

  // --- HARIAN LOGIC ---
  const filteredDaily = attendance.filter(a => a.date === filterDate);
  const displayedDaily = filteredDaily.slice(0, displayLimit);
  
  const exportDailyCSV = () => {
    if (filteredDaily.length === 0) return alert('Tidak ada data kunjungan untuk diekspor');
    let csvContent = `Log Kunjungan Harian - Tanggal ${filterDate}\n\n`;
    csvContent += "Jam,Nama Sales,Distributor,Catatan\n";

    filteredDaily.forEach(a => {
      const s = getSalesObj(a.salesId);
      const timeStr = safeFormatTime(a.timestamp, { hour: '2-digit', minute: '2-digit' });
      const notes = (a.notes || '').replace(/,/g, ' ');
      const name = (s.name || 'Sales Dihapus').replace(/,/g, ' ');
      const dist = (s.distributor || '-').replace(/,/g, ' ');
      csvContent += `${timeStr},${name},${dist},${notes}\n`;
    });

    downloadCSV(csvContent, `Log_Harian_${filterDate}.csv`);
  };

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentListLength = activeTab === 'bulanan' ? monthlySortedList.length : filteredDaily.length;

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        if (displayLimit < currentListLength) {
          setDisplayLimit(prev => prev + 20);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayLimit, currentListLength]);

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  if (loading) return <div className="text-center mt-8">Loading...</div>;

  return (
    <>
      <div className="sticky-page-header mb-3 md:mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 mb-3 md:mb-4">
          <div>
            <h1 className="m-0 flex items-center gap-2 text-lg md:text-2xl">
              <FaCalendarAlt className="text-primary" /> Kehadiran Global
            </h1>
            <p className="text-muted mt-0.5 text-xs md:text-sm hidden sm:block">Pantau aktivitas kunjungan dari seluruh sales Anda.</p>
          </div>
        </div>

        <div className="card p-1 mb-2" style={{ background: 'rgba(30, 41, 59, 0.7)' }}>
          <div className="flex text-center">
            <button 
              className={`flex-1 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'bulanan' ? 'bg-primary text-white shadow-md' : 'text-muted hover:bg-slate-800'}`}
              onClick={() => setActiveTab('bulanan')}
            >
              Rekap Bulanan
            </button>
            <button 
              className={`flex-1 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'harian' ? 'bg-primary text-white shadow-md' : 'text-muted hover:bg-slate-800'}`}
              onClick={() => setActiveTab('harian')}
            >
              Log Harian
            </button>
          </div>
        </div>
      </div>

      <div className="animate-fade-in pb-10">
      {activeTab === 'bulanan' ? (
        // --- TAB REKAP BULANAN ---
        <div className="animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card flex items-center gap-4 p-4">
              <div className="bg-primary bg-opacity-20 p-4 rounded-full text-primary">
                <FaUsers size={24} />
              </div>
              <div>
                <p className="text-muted text-sm m-0">Total Sales (Terdaftar)</p>
                <h2 className="m-0 text-2xl">{sales.length} <span className="text-sm font-normal text-muted">Orang</span></h2>
              </div>
            </div>
            <div className="card flex items-center gap-4 p-4">
              <div className="bg-success bg-opacity-20 p-4 rounded-full text-success">
                <FaChartLine size={24} />
              </div>
              <div>
                <p className="text-muted text-sm m-0">Sales Aktif Berkunjung</p>
                <h2 className="m-0 text-2xl">{activeSalesCount} <span className="text-sm font-normal text-muted">Orang</span></h2>
              </div>
            </div>
            <div className="card flex items-center gap-4 p-4">
              <div className="bg-accent bg-opacity-20 p-4 rounded-full text-accent-primary">
                <FaCheckCircle size={24} />
              </div>
              <div>
                <p className="text-muted text-sm m-0">Sales Teraktif</p>
                <h2 className="m-0 text-xl truncate w-32">{topSales.totalVisits > 0 ? topSales.name : '-'}</h2>
                {topSales.totalVisits > 0 && <p className="text-xs text-muted m-0">{topSales.totalVisits} Kunjungan</p>}
              </div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.7)' }}>
            <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="flex gap-2 w-full md:w-auto">
                <select className="form-control flex-1 md:flex-none" value={filterMonth} onChange={(e) => setFilterMonth(parseInt(e.target.value))}>
                  {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select className="form-control flex-1 md:flex-none" value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button className="btn btn-primary flex justify-center items-center gap-2 text-sm shadow-lg w-full md:w-auto" onClick={exportMonthlyCSV} style={{ background: '#059669', borderColor: '#059669' }}>
                <FaFileDownload /> Download Rekap (Excel)
              </button>
            </div>
            
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-light)' }}>
                    <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Nama Sales</th>
                    <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Distributor</th>
                    <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider text-center whitespace-nowrap">Total Kunjungan</th>
                    <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Terakhir Datang</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMonthly.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-slate-800 hover:bg-opacity-50 transition-colors">
                      <td className="p-4 font-medium flex items-center gap-3 whitespace-nowrap">
                        <div className="avatar flex-shrink-0" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                          {(s.name || '?').charAt(0).toUpperCase()}
                        </div>
                        {s.name}
                      </td>
                      <td className="p-4 text-sm whitespace-nowrap">{s.distributor}</td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={`badge ${s.totalVisits > 0 ? 'badge-primary' : 'badge-secondary'}`}>
                          {s.totalVisits}x
                        </span>
                      </td>
                      <td className="p-4 text-sm whitespace-nowrap">
                        {s.lastVisit ? (
                          <>
                            <div className="text-white">{safeFormatDate(s.lastVisit, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            <div className="text-muted text-xs">Pukul {safeFormatTime(s.lastVisit, { hour: '2-digit', minute: '2-digit' })}</div>
                          </>
                        ) : (
                          <span className="text-muted italic">Belum berkunjung</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // --- TAB LOG HARIAN ---
        <div className="animate-slide-up">
          <div className="card p-0 overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.7)' }}>
            <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <label className="text-muted text-sm font-medium whitespace-nowrap">Pilih Tanggal:</label>
                <input 
                  type="date" 
                  className="form-control flex-1 md:flex-none" 
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
              <button className="btn btn-primary flex justify-center items-center gap-2 text-sm shadow-lg w-full md:w-auto" onClick={exportDailyCSV} style={{ background: '#059669', borderColor: '#059669' }}>
                <FaFileDownload /> Download Log (Excel)
              </button>
            </div>
            
            {filteredDaily.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <FaSearch size={32} className="text-muted mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-white mb-2">Tidak Ada Kunjungan</h3>
                <p className="text-muted max-w-md mx-auto">Belum ada data kunjungan sales yang tercatat pada tanggal ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-light)' }}>
                      <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Jam Datang</th>
                      <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Nama Sales</th>
                      <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Status</th>
                      <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Catatan</th>
                      <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedDaily.map((a) => {
                      const s = getSalesObj(a.salesId);
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-slate-800 hover:bg-opacity-50 transition-colors">
                          <td className="p-4 whitespace-nowrap text-white font-medium">
                            {safeFormatTime(a.timestamp, { hour: '2-digit', minute: '2-digit' })} WIB
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted mt-1">{s.distributor}</div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-success font-medium">
                              <FaCheckCircle /> HADIR
                            </div>
                          </td>
                          <td className="p-4">
                            {a.notes ? (
                              <span className="italic text-muted text-sm">"{a.notes}"</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '0.4rem', color: 'var(--accent-primary)', background: 'transparent', border: 'none' }}
                                onClick={() => handleEditAttendance(a)}
                                title="Edit Catatan"
                              >
                                <FaEdit />
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '0.4rem', color: 'var(--danger)', background: 'transparent', border: 'none' }}
                                onClick={() => handleDeleteAttendance(a.id)}
                                title="Hapus Absensi"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading More Indicator */}
      {!loading && displayLimit < currentListLength && (
        <div className="text-center mt-6 mb-2">
          <div className="inline-block p-3 rounded-full bg-slate-800 text-muted" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            Memuat lebih banyak data...
          </div>
        </div>
      )}
      </div>

      {/* Edit Attendance Modal */}
      {editAttModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card w-full animate-fade-in" style={{ maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="mb-4">Edit Absensi</h3>
            <p className="text-muted text-sm mb-4">
              Silakan ubah tanggal, jam, atau catatan kehadiran.
            </p>
            
            <form onSubmit={handleSaveEditAttendance}>
              <div className="form-group mb-4">
                <label className="form-label">Tanggal Kehadiran</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required
                  value={editAttModal.editDate}
                  onChange={(e) => setEditAttModal({...editAttModal, editDate: e.target.value})}
                />
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Jam Kehadiran</label>
                <input 
                  type="time" 
                  className="form-control" 
                  required
                  value={editAttModal.editTime}
                  onChange={(e) => setEditAttModal({...editAttModal, editTime: e.target.value})}
                />
              </div>

              <div className="form-group mb-6">
                <label className="form-label">Catatan (Opsional)</label>
                <textarea 
                  className="form-control" 
                  rows="3" 
                  value={editAttModal.editNotes}
                  onChange={(e) => setEditAttModal({...editAttModal, editNotes: e.target.value})}
                  style={{ resize: 'none' }}
                ></textarea>
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="button" 
                  className="btn btn-secondary flex-1" 
                  onClick={() => setEditAttModal(null)}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1"
                >
                  Simpan Perubahan
                </button>
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
