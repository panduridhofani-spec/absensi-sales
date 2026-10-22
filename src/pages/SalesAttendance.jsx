import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuDownload, LuSearch, LuCircleCheck, LuPencil, LuTrash2, LuCalendarX, LuInfo, LuX } from 'react-icons/lu';
import { getSalesById, getAttendanceForSales, deleteAttendance, updateAttendance } from '../services/dbService';
import { PageHeader, EmptyState, Skeleton } from '../components/ui';
import { useFeedback } from '../context/FeedbackContext';

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

const SalesAttendanceInner = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const [sales, setSales] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(20);
  const [editAttModal, setEditAttModal] = useState(null);
  const [limitDays, setLimitDays] = useState(30);

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
          setAttendance(await getAttendanceForSales(id, limitDays));
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
    const ok = await confirm({
      tone: 'danger',
      title: 'Hapus catatan absensi?',
      message: 'Catatan kunjungan ini akan dihapus permanen.',
      confirmText: 'Ya, hapus',
    });
    if (!ok) return;
    try {
      await deleteAttendance(attId);
      setAttendance(prev => prev.filter(a => a.id !== attId));
      toast.success('Catatan absensi dihapus');
    } catch (error) {
      console.error('Gagal menghapus absensi:', error);
      toast.error('Gagal menghapus absensi');
    }
  };

  const handleEditAttendance = (att) => {
    const d = new Date(att.timestamp);
    const valid = !isNaN(d.getTime());
    setEditAttModal({
      ...att,
      editDate: valid ? d.toISOString().split('T')[0] : '',
      editTime: valid ? d.toTimeString().substring(0, 5) : '',
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
      setAttendance(prev => prev.map(a => a.id === editAttModal.id ? { ...a, ...updates } : a).sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      }));
      setEditAttModal(null);
      toast.success('Perubahan disimpan');
    } catch (error) {
      console.error('Gagal menyimpan perubahan absensi:', error);
      toast.error('Gagal menyimpan perubahan absensi');
    }
  };

  const filteredAttendance = attendance.filter(att => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    if (att.notes && String(att.notes).toLowerCase().includes(term)) return true;
    const dateStr = safeFormatDate(att.timestamp, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return dateStr.toLowerCase().includes(term);
  });

  const displayedAttendance = filteredAttendance.slice(0, displayLimit);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        if (displayLimit < filteredAttendance.length) setDisplayLimit(prev => prev + 20);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayLimit, filteredAttendance.length]);

  const exportToCSV = () => {
    if (filteredAttendance.length === 0) return toast.info('Tidak ada data absen untuk diekspor');
    let csvContent = 'Tanggal,Hari,Jam Kehadiran,Status,Catatan\n';
    filteredAttendance.forEach(att => {
      const dateObj = new Date(att.timestamp);
      const bad = isNaN(dateObj.getTime());
      const dateStr = bad ? '-' : dateObj.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const dayStr = bad ? '-' : dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
      const timeStr = bad ? '-' : dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const notes = (att.notes || '').replace(/,/g, ' ');
      csvContent += `${dateStr},${dayStr},${timeStr},Hadir,${notes}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Riwayat_Absen_${sales.name.replace(/\s+/g, '_')}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="stagger"><Skeleton height={60} style={{ marginBottom: 16 }} /><Skeleton height={320} /></div>;
  if (!sales) return null;

  return (
    <>
      <PageHeader
        backTo={`/sales/${id}`}
        backLabel="Profil sales"
        eyebrow={sales.distributor}
        title={`Kehadiran ${sales.name}`}
        subtitle={`${filteredAttendance.length} catatan kehadiran`}
        actions={<button className="btn btn-success" onClick={exportToCSV}><LuDownload /> Export Excel</button>}
      />

      <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
        <div className="input-icon">
          <LuSearch />
          <input
            type="text"
            placeholder="Cari berdasarkan hari, tanggal, atau catatan..."
            className="form-control"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {limitDays && filteredAttendance.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b" style={{ padding: '0.75rem 1rem', background: 'var(--info-bg)', color: 'var(--info)', fontSize: '0.85rem' }}>
            <span className="flex items-center gap-2"><LuInfo /> Hanya menampilkan absensi {limitDays} hari terakhir untuk menjaga performa.</span>
            <button onClick={() => setLimitDays(null)} className="btn btn-secondary btn-sm">Muat semua data lama</button>
          </div>
        )}

        {filteredAttendance.length === 0 ? (
          <EmptyState icon={<LuCalendarX />} title="Tidak ada kehadiran" text="Riwayat absensi tidak ditemukan untuk sales ini." />
        ) : (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Tanggal</th>
                  <th>Jam</th>
                  <th>Catatan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayedAttendance.map(att => (
                  <tr key={att.id}>
                    <td><span className="badge badge-success badge-dot"><LuCircleCheck /> Hadir</span></td>
                    <td>{safeFormatDate(att.timestamp, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                    <td className="text-secondary whitespace-nowrap">{safeFormatTime(att.timestamp, { hour: '2-digit', minute: '2-digit' })} WIB</td>
                    <td>{att.notes ? <span className="text-secondary text-sm">“{att.notes}”</span> : <span className="text-muted">-</span>}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleEditAttendance(att)} title="Edit" aria-label="Edit"><LuPencil /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteAttendance(att.id)} title="Hapus" aria-label="Hapus"><LuTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {displayLimit < filteredAttendance.length && (
        <div className="text-center mt-6"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      )}

      {editAttModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditAttModal(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Edit absensi">
            <div className="card-header">
              <h3>Edit Absensi</h3>
              <button type="button" className="icon-btn" onClick={() => setEditAttModal(null)} aria-label="Tutup"><LuX /></button>
            </div>
            <p className="text-secondary text-sm mb-4">Ubah tanggal, jam, atau catatan kehadiran.</p>

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

export default function SalesAttendance() {
  return (
    <ErrorBoundary>
      <SalesAttendanceInner />
    </ErrorBoundary>
  );
}
