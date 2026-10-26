import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuMessageCircle, LuCheck, LuCalendarDays, LuTrash2, LuPencil, LuX, LuPackage, LuSearch, LuUndo2, LuPhone, LuBuilding2, LuChevronRight, LuPackageCheck, LuFlame, LuCalendarClock, LuHandshake, LuWarehouse, LuAlarmClockOff } from 'react-icons/lu';
import { getSalesById, getSalesList, recordAttendance, getAttendanceForSales, deleteSales, updateSales, getReturnsForSales, subscribeWaitingReturns, markReturnsTaken, updateReturn } from '../services/dbService';
import { PageHeader, EmptyState, Skeleton } from '../components/ui';
import ScheduleModal from '../components/returns/ScheduleModal';
import { conditionOf, formatDate, formatDateTime, daysSince, ownerIds, isLate, lateDays, isScheduled } from '../utils/returns';
import { useFeedback } from '../context/FeedbackContext';

const normalizeItems = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') return items.split(',').map(i => i.trim()).filter(i => i);
  return [];
};

const Modal = ({ title, onClose, children, size }) => (
  <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal" style={size ? { maxWidth: size } : undefined} role="dialog" aria-modal="true" aria-label={title}>
      <div className="card-header">
        <h3>{title}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><LuX /></button>
      </div>
      {children}
    </div>
  </div>
);

// Jumlah hari berturut-turut (sampai hari ini / kemarin) sales hadir.
const visitsLast30 = (attendance) => {
  const cutoff = Date.now() - 30 * 86400000;
  return attendance.filter(a => new Date(a.timestamp).getTime() >= cutoff).length;
};

const SalesProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const [sales, setSales] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [returnsTaken, setReturnsTaken] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [waitingAll, setWaitingAll] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [scheduling, setScheduling] = useState(null);
  const [handing, setHanding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  const [formData, setFormData] = useState(null);
  const [newItem, setNewItem] = useState('');

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceNote, setAttendanceNote] = useState('');

  const fetchData = async () => {
    try {
      const s = await getSalesById(id);
      if (s) {
        const normalizedSales = { ...s, items: normalizeItems(s.items) };
        setSales(normalizedSales);
        setFormData(normalizedSales);
        setAttendance(await getAttendanceForSales(id));
        setReturnsTaken(await getReturnsForSales(id));
      } else {
        navigate('/sales');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  // Daftar barang retur yang menunggu (tersinkron langsung) dan seluruh sales untuk pencocokan penerima.
  useEffect(() => {
    getSalesList()
      .then(list => setAllSales(list.map(s => ({ ...s, items: normalizeItems(s.items) }))))
      .catch(console.error);
    const unsub = subscribeWaitingReturns(setWaitingAll, console.error);
    return () => unsub();
  }, []);

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    setIsMarking(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await recordAttendance(id, today, attendanceNote);
      setShowAttendanceModal(false);
      setAttendanceNote('');
      await fetchData();
      toast.success('Kunjungan dicatat');
    } catch (error) {
      console.error(error);
      toast.error('Gagal mencatat kunjungan');
    } finally {
      setIsMarking(false);
    }
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (newItem.trim()) {
      setFormData({ ...formData, items: [...formData.items, newItem.trim()] });
      setNewItem('');
    }
  };

  const handleRemoveItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateSales(id, formData);
      setShowEdit(false);
      setNewItem('');
      fetchData();
      toast.success('Data sales diperbarui');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan perubahan');
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      tone: 'danger',
      title: `Hapus ${sales.name}?`,
      message: 'Data sales ini akan dihapus permanen. Riwayat absensinya tidak ikut terhapus otomatis.',
      confirmText: 'Ya, hapus sales',
    });
    if (!ok) return;
    try {
      await deleteSales(id);
      toast.success('Sales dihapus');
      navigate('/sales');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus sales');
    }
  };

  const openWhatsApp = () => {
    if (!sales) return;
    let number = sales.whatsapp.replace(/\D/g, '');
    if (number.startsWith('0')) number = '62' + number.substring(1);
    window.open(`https://wa.me/${number}`, '_blank');
  };

  if (loading) {
    return (
      <div className="stagger">
        <Skeleton height={56} style={{ marginBottom: 16, maxWidth: 360 }} />
        <div className="grid gap-4 lg:grid-cols-3 grid-cols-1"><Skeleton height={320} /><Skeleton height={320} style={{ gridColumn: 'span 2' }} /></div>
      </div>
    );
  }
  if (!sales) return null;

  // Barang retur yang otomatis masuk ke data sales ini (dari barang yang dibawa), diurutkan yang paling mendesak.
  const myWaiting = waitingAll
    .filter(r => ownerIds(r, allSales).includes(id))
    .sort((a, b) => lateDays(b) - lateDays(a) || new Date(a.createdAt) - new Date(b.createdAt));
  const lateMine = myWaiting.filter(isLate).length;
  const selectedItems = myWaiting.filter(r => selected.has(r.id));
  const allMineSelected = myWaiting.length > 0 && myWaiting.every(r => selected.has(r.id));

  const toggleSelect = (rid) => {
    const next = new Set(selected);
    if (next.has(rid)) next.delete(rid); else next.add(rid);
    setSelected(next);
  };

  const handover = async () => {
    const items = selectedItems;
    if (items.length === 0) return;
    const ok = await confirm({
      tone: 'primary',
      title: `Serahkan ${items.length} barang ke ${sales.name}?`,
      message: 'Setelah dikonfirmasi, status berubah menjadi Diambil dan barang keluar dari daftar gudang.',
      details: (
        <ul style={{ listStyle: 'none', display: 'grid', gap: 4 }}>
          {items.map(i => <li key={i.id}><b>{i.quantity}×</b> {i.itemName}</li>)}
        </ul>
      ),
      confirmText: 'Ya, serahkan',
    });
    if (!ok) return;
    setHanding(true);
    try {
      await markReturnsTaken(items.map(i => i.id), sales);
      toast.success(`${items.length} barang diserahkan ke ${sales.name}`);
      setSelected(new Set());
      setReturnsTaken(await getReturnsForSales(id));
    } catch (error) {
      if (error.code === 'already-taken') {
        const c = error.conflicts[0];
        toast.error(`${c.itemName} ${c.salesName ? `sudah diambil ${c.salesName}` : 'sudah tidak tersedia'}. Daftar diperbarui.`, { duration: 6000 });
        setSelected(new Set());
      } else {
        console.error(error);
        toast.error('Gagal menyimpan. Periksa koneksi internet lalu coba lagi.');
      }
    } finally {
      setHanding(false);
    }
  };

  const saveSchedule = async (patch) => {
    try {
      await Promise.all(scheduling.map(r => updateReturn(r.id, patch)));
      toast.success(patch.pickupDate ? `Jadwal ambil ${formatDate(patch.pickupDate)} disimpan` : 'Jadwal dihapus');
      setScheduling(null);
      setSelected(new Set());
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan jadwal');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const hasAttendedToday = attendance.some(a => a.date === today);
  const filteredItems = sales.items.filter(item => item.toLowerCase().includes(itemSearch.toLowerCase()));
  const visits30 = visitsLast30(attendance);

  return (
    <>
      <PageHeader backTo="/sales" backLabel="Data Sales" eyebrow="Profil sales" title={sales.name} subtitle={sales.distributor} />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3" style={{ alignItems: 'start' }}>
        <div className="card text-center" style={{ gridColumn: 'span 1' }}>
          <div className="flex gap-2" style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowEdit(true)} title="Edit" aria-label="Edit"><LuPencil /></button>
            <button className="btn btn-danger btn-sm btn-icon" onClick={handleDelete} title="Hapus" aria-label="Hapus"><LuTrash2 /></button>
          </div>

          <div className="avatar avatar-lg" style={{ margin: '0.5rem auto 1rem' }}>{sales.name.charAt(0).toUpperCase()}</div>
          <h2>{sales.name}</h2>
          <span className="badge badge-primary" style={{ marginTop: 6 }}>{sales.distributor}</span>

          <div className="flex flex-col gap-2" style={{ marginTop: '1.5rem' }}>
            <button className="btn w-full" style={{ background: '#25D366', color: '#fff' }} onClick={openWhatsApp}>
              <LuMessageCircle /> Hubungi via WhatsApp
            </button>
            <button className={`btn w-full ${hasAttendedToday ? 'btn-secondary' : 'btn-success'}`} onClick={() => setShowAttendanceModal(true)} disabled={hasAttendedToday}>
              <LuCheck /> {hasAttendedToday ? 'Sudah absen hari ini' : 'Tandai kunjungan'}
            </button>
            <button className="btn btn-secondary w-full" onClick={() => navigate('/returns')}>
              <LuUndo2 /> Buka halaman retur
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 stagger" style={{ gridColumn: 'span 2', minWidth: 0 }}>
          {/* Keaktifan */}
          <div className="stat-grid">
            <div className="card stat-card stat-primary">
              <div><div className="stat-label">Kunjungan 30 hari</div><div className="stat-value">{visits30}</div></div>
              <div className="stat-icon"><LuFlame /></div>
            </div>
            <div className={`card stat-card ${lateMine > 0 ? 'stat-danger' : 'stat-warning'}`}>
              <div><div className="stat-label">{lateMine > 0 ? `Retur menunggu · ${lateMine} terlambat` : 'Retur menunggu'}</div><div className="stat-value">{myWaiting.length}</div></div>
              <div className="stat-icon">{lateMine > 0 ? <LuAlarmClockOff /> : <LuWarehouse />}</div>
            </div>
            <div className="card stat-card stat-success">
              <div><div className="stat-label">Retur diambil</div><div className="stat-value">{returnsTaken.length}</div></div>
              <div className="stat-icon"><LuPackageCheck /></div>
            </div>
          </div>

          {/* Retur menunggu: otomatis masuk dari barang yang dibawa sales ini */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title flex items-center gap-2"><LuWarehouse className="text-accent-primary" /> Retur menunggu diambil</h3>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>Otomatis masuk dari barang yang dibawa sales ini</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/returns')}>Halaman Retur <LuChevronRight /></button>
            </div>

            {myWaiting.length === 0 ? (
              <EmptyState icon={<LuPackageCheck />} title="Tidak ada retur menunggu" text="Barang retur yang cocok dengan barang yang dibawa sales ini akan muncul di sini setelah dicatat." />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginBottom: '0.75rem' }}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={allMineSelected} onChange={() => setSelected(allMineSelected ? new Set() : new Set(myWaiting.map(r => r.id)))} />
                    Pilih semua ({myWaiting.length})
                  </label>
                  {selectedItems.length > 0 && (
                    <div className="flex gap-2 flex-wrap animate-fade-in">
                      <button className="btn btn-secondary btn-sm" onClick={() => setScheduling(selectedItems)}><LuCalendarClock /> Jadwalkan ({selectedItems.length})</button>
                      <button className="btn btn-primary btn-sm" disabled={handing} onClick={handover}><LuHandshake /> Serahkan ({selectedItems.length})</button>
                    </div>
                  )}
                </div>

                <div className="list">
                  {myWaiting.map(r => {
                    const others = ownerIds(r, allSales).filter(oid => oid !== id).map(oid => allSales.find(s => s.id === oid)?.name).filter(Boolean);
                    return (
                      <label key={r.id} className="list-item" style={{ cursor: 'pointer', alignItems: 'flex-start', borderColor: selected.has(r.id) ? 'var(--accent-primary)' : undefined, background: isLate(r) ? 'var(--danger-bg)' : undefined }}>
                        <div className="list-item-main" style={{ alignItems: 'flex-start' }}>
                          <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} style={{ width: 20, height: 20, marginTop: 2 }} />
                          <div style={{ minWidth: 0 }}>
                            <div className="list-item-title" style={{ whiteSpace: 'normal' }}><b className="text-accent-primary">{r.quantity}×</b> {r.itemName}</div>
                            <div className="flex flex-wrap gap-1" style={{ marginTop: 4 }}>
                              <span className={`badge badge-${conditionOf(r.condition).tone}`}>{conditionOf(r.condition).label}</span>
                              {r.expiredDate && <span className="badge">ED {formatDate(r.expiredDate)}</span>}
                              <span className="badge">{daysSince(r.createdAt) === 0 ? 'Dicatat hari ini' : `${daysSince(r.createdAt)} hari di gudang`}</span>
                            </div>
                            {others.length > 0 && <div className="text-xs text-muted" style={{ marginTop: 4 }}>Juga dibawa: {others.slice(0, 2).join(', ')}{others.length > 2 ? ` +${others.length - 2}` : ''}</div>}
                            {r.notes && <div className="text-xs text-muted" style={{ marginTop: 2 }}>“{r.notes}”</div>}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          {isLate(r) ? (
                            <>
                              <span className="badge badge-danger badge-dot animate-pulse">Terlambat {lateDays(r)} hari</span>
                              <div className="text-xs" style={{ color: 'var(--danger)', marginTop: 4 }}>Janji {formatDate(r.pickupDate)}</div>
                            </>
                          ) : isScheduled(r) ? (
                            <>
                              <span className="badge badge-info badge-dot">Dijadwalkan</span>
                              <div className="text-xs text-secondary" style={{ marginTop: 4 }}>Ambil {formatDate(r.pickupDate)}</div>
                            </>
                          ) : (
                            <span className="badge badge-warning badge-dot">Menunggu</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Detail info */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Informasi detail</h3></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <span className="icon-tile"><LuPhone /></span>
                <div><div className="text-xs text-muted">Nomor WhatsApp</div><div className="font-semibold">{sales.whatsapp}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="icon-tile"><LuBuilding2 /></span>
                <div><div className="text-xs text-muted">Distributor</div><div className="font-semibold">{sales.distributor}</div></div>
              </div>
            </div>

            <hr className="divider" />
            <div className="text-xs text-muted font-semibold uppercase tracking-wider" style={{ marginBottom: 8 }}>Barang yang dibawa ({sales.items.length})</div>
            {sales.items.length === 0 ? (
              <span className="text-muted">Tidak ada data barang.</span>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {sales.items.slice(0, 10).map((item, idx) => (
                    <span key={idx} className="badge badge-primary" style={{ padding: '0.4rem 0.8rem', whiteSpace: 'normal', textAlign: 'left', fontSize: '0.8rem' }}>
                      <LuPackage style={{ flexShrink: 0 }} /> {item}
                    </span>
                  ))}
                </div>
                {sales.items.length > 10 && (
                  <button className="btn btn-secondary w-full mt-3" onClick={() => setShowItemsModal(true)}>Lihat semua {sales.items.length} barang</button>
                )}
              </>
            )}
          </div>

          {/* Attendance history */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2"><LuCalendarDays className="text-accent-primary" /> Riwayat kehadiran</h3>
              {attendance.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/sales/${id}/attendance`)}>Lihat semua <LuChevronRight /></button>
              )}
            </div>

            {attendance.length === 0 ? (
              <EmptyState icon={<LuCalendarDays />} title="Belum ada kehadiran" text="Tandai kunjungan pertama sales ini." />
            ) : (
              <div className="list">
                {attendance.slice(0, 5).map(att => (
                  <div key={att.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-semibold">{new Date(att.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        <div className="text-sm text-secondary">Jam datang: {new Date(att.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <span className="badge badge-success badge-dot">Hadir</span>
                    </div>
                    {att.notes && <div className="text-sm text-secondary" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 8 }}><b>Catatan:</b> {att.notes}</div>}
                  </div>
                ))}
                {attendance.length > 5 && (
                  <button className="btn btn-secondary w-full" onClick={() => navigate(`/sales/${id}/attendance`)}>Lihat semua {attendance.length} riwayat</button>
                )}
              </div>
            )}
          </div>

          {/* Returns taken by this sales (read-only) */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2"><LuUndo2 className="text-accent-primary" /> Retur yang diambil</h3>
            </div>
            {returnsTaken.length === 0 ? (
              <EmptyState icon={<LuPackageCheck />} title="Belum ada retur diambil" text="Barang retur yang diambil sales ini akan tampil di sini." />
            ) : (
              <div className="list">
                {returnsTaken.slice(0, 6).map(r => (
                  <div key={r.id} className="list-item">
                    <div className="list-item-main">
                      <span className="icon-tile" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><LuPackageCheck /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="list-item-title"><b className="text-accent-primary">{r.quantity}×</b> {r.itemName}</div>
                        <div className="list-item-sub">{formatDateTime(r.takenAt)}</div>
                      </div>
                    </div>
                    <span className={`badge badge-${conditionOf(r.condition).tone}`}>{conditionOf(r.condition).label}</span>
                  </div>
                ))}
                {returnsTaken.length > 6 && <div className="text-xs text-muted text-center">+{returnsTaken.length - 6} lainnya di halaman Retur</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {scheduling && (
        <ScheduleModal items={scheduling} sales={allSales} fixedSales={sales} onClose={() => setScheduling(null)} onSave={saveSchedule} />
      )}

      {showEdit && (
        <Modal title="Edit Data Sales" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEditSubmit}>
            <div className="form-group">
              <label className="form-label">Nama Sales</label>
              <input required type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} maxLength={50} />
            </div>
            <div className="form-group">
              <label className="form-label">No WhatsApp</label>
              <input required type="tel" className="form-control" value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} maxLength={20} />
            </div>
            <div className="form-group">
              <label className="form-label">Nama Distributor</label>
              <input required type="text" className="form-control" value={formData.distributor} onChange={e => setFormData({ ...formData, distributor: e.target.value })} maxLength={50} />
            </div>

            <div className="form-group">
              <label className="form-label">Barang yang Dibawa</label>
              <div className="flex gap-2 mb-3">
                <input type="text" className="form-control" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(e); }} placeholder="Ketik nama barang (maks 40 karakter)" maxLength={40} />
                <button type="button" className="btn btn-secondary" onClick={handleAddItem}>Tambah</button>
              </div>
              {formData.items.length > 0 ? (
                <div className="flex flex-wrap gap-2" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {formData.items.map((item, idx) => (
                    <span key={idx} className="badge badge-primary" style={{ padding: '0.35rem 0.4rem 0.35rem 0.75rem', whiteSpace: 'normal', textAlign: 'left' }}>
                      {item}
                      <button type="button" className="icon-btn" style={{ width: 22, height: 22, fontSize: '0.8rem' }} onClick={() => handleRemoveItem(idx)} aria-label={`Hapus ${item}`}><LuX /></button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">Belum ada barang yang ditambahkan.</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowEdit(false)}>Batal</button>
              <button type="submit" className="btn btn-primary flex-1" disabled={formData.items.length === 0 && !newItem}>Simpan</button>
            </div>
          </form>
        </Modal>
      )}

      {showItemsModal && (
        <Modal title="Daftar Semua Barang" onClose={() => { setShowItemsModal(false); setItemSearch(''); }}>
          <div className="input-icon mb-4">
            <LuSearch />
            <input type="text" className="form-control" placeholder="Cari nama barang..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            {filteredItems.map((item, idx) => (
              <span key={idx} className="badge badge-primary" style={{ padding: '0.4rem 0.8rem', whiteSpace: 'normal', textAlign: 'left' }}>
                <LuPackage style={{ flexShrink: 0 }} /> {item}
              </span>
            ))}
            {filteredItems.length === 0 && <div className="text-center w-full text-muted py-4">Barang “{itemSearch}” tidak ditemukan.</div>}
          </div>
          <button className="btn btn-secondary w-full mt-4" onClick={() => { setShowItemsModal(false); setItemSearch(''); }}>Tutup</button>
        </Modal>
      )}

      {showAttendanceModal && (
        <Modal title="Tandai Kunjungan" onClose={() => setShowAttendanceModal(false)} size="420px">
          <p className="text-secondary text-sm mb-4">Konfirmasi kehadiran untuk <b>{sales.name}</b> hari ini.</p>
          <form onSubmit={handleMarkAttendance}>
            <div className="form-group">
              <label className="form-label">Catatan (opsional)</label>
              <textarea className="form-control" rows="3" placeholder="Contoh: kunjungan rutin, ambil barang retur..." value={attendanceNote} onChange={(e) => setAttendanceNote(e.target.value)} style={{ resize: 'none' }} />
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowAttendanceModal(false)}>Batal</button>
              <button type="submit" className="btn btn-primary flex-1" disabled={isMarking}>Simpan</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default SalesProfile;
