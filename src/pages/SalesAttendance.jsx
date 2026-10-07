import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCalendarAlt, FaCheckCircle, FaFileDownload, FaSearch, FaFilter, FaTrash, FaEdit } from 'react-icons/fa';
import { getSalesById, getAttendanceForSales, deleteAttendance, updateAttendance } from '../services/dbService';

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

const SalesAttendanceInner = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sales, setSales] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(20);
  const [editAttModal, setEditAttModal] = useState(null);
  const [limitDays, setLimitDays] = useState(30);

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
      try {
        const s = await getSalesById(id);
        if (s) {
          setSales(s);
          const a = await getAttendanceForSales(id, limitDays);
          setAttendance(a);
        } else {
          navigate('/sales');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate, limitDays]);

  const handleDeleteAttendance = async (attId) => {
    if (window.confirm('Yakin ingin menghapus rekam absensi ini?')) {
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
      const newTimestamp = new Date(`${editAttModal.editDate}T${editAttModal.editTime}:00`).toISOString();
      const updates = { 
        timestamp: newTimestamp, 
        date: editAttModal.editDate, 
        notes: editAttModal.editNotes 
      };
      
      await updateAttendance(editAttModal.id, updates);
      
      setAttendance(prev => {
        const updated = prev.map(a => a.id === editAttModal.id ? { ...a, ...updates } : a);
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

  const filteredAttendance = attendance.filter(att => {
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      if (att.notes && String(att.notes).toLowerCase().includes(term)) return true;
      const dateStr = safeFormatDate(att.timestamp, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (dateStr.toLowerCase().includes(term)) return true;
      return false;
    }
    return true;
  });

  const displayedAttendance = filteredAttendance.slice(0, displayLimit);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        if (displayLimit < filteredAttendance.length) {
          setDisplayLimit(prev => prev + 20);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayLimit, filteredAttendance.length]);

  const exportToCSV = () => {
    if (filteredAttendance.length === 0) return alert('Tidak ada data absen untuk diekspor');
    let csvContent = "Tanggal,Hari,Jam Kehadiran,Status,Catatan\n";

    filteredAttendance.forEach(att => {
      const dateObj = new Date(att.timestamp);
      const dateStr = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const dayStr = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
      const timeStr = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const notes = (att.notes || '').replace(/,/g, ' '); 

      csvContent += `${dateStr},${dayStr},${timeStr},Hadir,${notes}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Riwayat_Absen_${sales.name.replace(/\s+/g, '_')}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (!sales) return null;

  return (
    <>
      <div className="sticky-page-header mb-3 md:mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 mb-3 md:mb-4">
          <div>
            <button className="btn btn-secondary btn-sm mb-1 md:mb-2" onClick={() => navigate(`/sales/${id}`)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
              <FaArrowLeft /> Profil
            </button>
            <h1 className="m-0 flex items-center gap-2 text-lg md:text-2xl">
              <FaCalendarAlt className="text-primary" /> Kehadiran: {sales.name}
            </h1>
            <p className="text-muted mt-0.5 text-xs md:text-sm hidden sm:block">{sales.distributor}</p>
          </div>
          <button className="btn btn-primary flex items-center gap-2 shadow-lg w-full md:w-auto text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2" onClick={exportToCSV} style={{ background: '#059669', borderColor: '#059669' }}>
            <FaFileDownload /> <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>

        <div className="card" style={{ padding: '0.5rem 0.75rem', background: 'rgba(30, 41, 59, 0.7)' }}>
          <div className="relative w-full">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Cari berdasarkan hari, tanggal, atau catatan..."
              className="input pl-10 w-full bg-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="animate-fade-in pb-10">
        <div className="card p-0 overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.7)' }}>
        {filteredAttendance.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <FaFilter size={32} className="text-muted mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">Tidak ada kehadiran ditemukan</h3>
            <p className="text-muted max-w-md mx-auto">Riwayat absensi tidak ditemukan untuk Sales ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            {limitDays && filteredAttendance.length > 0 && (
              <div className="p-3 bg-indigo-900 bg-opacity-20 border-b border-indigo-500/20 text-indigo-200 text-sm flex justify-between items-center">
                <span><span className="font-bold">Info:</span> Hanya menampilkan absensi {limitDays} hari terakhir untuk menjaga performa.</span>
                <button 
                  onClick={() => setLimitDays(null)}
                  className="btn btn-primary btn-sm py-1 px-3"
                  style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', borderColor: '#4f46e5' }}
                >
                  Muat Semua Data (Lama)
                </button>
              </div>
            )}
            <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-light)' }}>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Tanggal Kehadiran</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Jam Kedatangan</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Catatan</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayedAttendance.map(att => (
                  <tr key={att.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-slate-800 hover:bg-opacity-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-success font-medium">
                        <FaCheckCircle /> HADIR
                      </div>
                    </td>
                    <td className="p-4">
                      <div>{safeFormatDate(att.timestamp, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </td>
                    <td className="p-4 text-muted">
                      {safeFormatTime(att.timestamp, { hour: '2-digit', minute: '2-digit' })} WIB
                    </td>
                    <td className="p-4">
                      {att.notes ? (
                        <span className="italic text-muted">"{att.notes}"</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '0.4rem', color: 'var(--accent-primary)', background: 'transparent', border: 'none' }}
                          onClick={() => handleEditAttendance(att)}
                          title="Edit Absensi"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '0.4rem', color: 'var(--danger)', background: 'transparent', border: 'none' }}
                          onClick={() => handleDeleteAttendance(att.id)}
                          title="Hapus Absensi"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && displayLimit < filteredAttendance.length && (
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

export default function SalesAttendance() {
  return (
    <ErrorBoundary>
      <SalesAttendanceInner />
    </ErrorBoundary>
  );
}
