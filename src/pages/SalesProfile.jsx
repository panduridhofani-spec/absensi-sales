import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaWhatsapp, FaArrowLeft, FaCheck, FaCalendarAlt, FaTrash, FaEdit, FaTimes, FaBox, FaSearch, FaExchangeAlt, FaArrowDown, FaArrowUp, FaReceipt } from 'react-icons/fa';
import { getSalesById, recordAttendance, getAttendanceForSales, deleteSales, updateSales, addTransaction, getTransactionsForSales } from '../services/dbService';

const normalizeItems = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') return items.split(',').map(i => i.trim()).filter(i => i);
  return [];
};

const SalesProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sales, setSales] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  
  // Edit form state
  const [formData, setFormData] = useState(null);
  const [newItem, setNewItem] = useState('');

  // Attendance state
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceNote, setAttendanceNote] = useState('');

  // Transaction state
  const [transactions, setTransactions] = useState([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionForm, setTransactionForm] = useState({
    type: 'masuk',
    notes: '',
    items: [],
    status: 'selesai',
    pickupDate: ''
  });
  const [trxItemName, setTrxItemName] = useState('');
  const [trxQuantity, setTrxQuantity] = useState(1);
  const [trxExpiredDate, setTrxExpiredDate] = useState('');

  const fetchData = async () => {
    try {
      const s = await getSalesById(id);
      if (s) {
        const normalizedSales = { ...s, items: normalizeItems(s.items) };
        setSales(normalizedSales);
        setFormData(normalizedSales);
        const a = await getAttendanceForSales(id);
        setAttendance(a);
        const t = await getTransactionsForSales(id);
        setTransactions(t);
        
        // Auto-select first item for transaction form if available
        if (normalizedSales.items.length > 0 && !trxItemName) {
          setTrxItemName(normalizedSales.items[0]);
        }
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
  }, [id, navigate]);

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    setIsMarking(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await recordAttendance(id, today, attendanceNote);
      setShowAttendanceModal(false);
      setAttendanceNote('');
      await fetchData(); // refresh
    } catch (error) {
      console.error(error);
    } finally {
      setIsMarking(false);
    }
  };

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if (transactionForm.items.length === 0) {
      alert("Tambahkan minimal 1 barang ke dalam transaksi!");
      return;
    }
    setIsMarking(true);
    try {
      await addTransaction({
        salesId: id,
        type: transactionForm.type,
        notes: transactionForm.notes,
        items: transactionForm.items,
        status: transactionForm.type === 'retur' ? (transactionForm.status || 'selesai') : 'selesai',
        pickupDate: (transactionForm.type === 'retur' && transactionForm.status === 'pending') ? transactionForm.pickupDate : null
      });
      setShowTransactionModal(false);
      setTransactionForm({ type: 'masuk', notes: '', items: [], status: 'selesai', pickupDate: '' });
      await fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsMarking(false);
    }
  };

  const handleAddTrxItem = () => {
    if (trxItemName) {
      let finalItemName = trxItemName;
      let finalEd = trxExpiredDate;
      
      if (!finalEd) {
        finalEd = '-';
      }

      const existing = transactionForm.items.find(i => i.itemName === finalItemName && i.expiredDate === finalEd);
      if (existing) {
        setTransactionForm({
          ...transactionForm,
          items: transactionForm.items.map(i => (i.itemName === finalItemName && i.expiredDate === finalEd) ? { ...i, quantity: i.quantity + parseInt(trxQuantity) } : i)
        });
      } else {
        setTransactionForm({
          ...transactionForm,
          items: [...transactionForm.items, { itemName: finalItemName, quantity: parseInt(trxQuantity) || 1, expiredDate: finalEd }]
        });
      }
      setTrxQuantity(1);
    }
  };

  const handleOpenTransactionModal = () => {
    setTransactionForm({ type: 'masuk', notes: '', items: [] });
    if (sales && sales.items && sales.items.length > 0) {
      setTrxItemName(sales.items[0]);
    } else {
      setTrxItemName('');
    }
    setTrxQuantity(1);
    setTrxExpiredDate('');
    setShowTransactionModal(true);
  };

  const handleRemoveTrxItem = (index) => {
    const newItems = [...transactionForm.items];
    newItems.splice(index, 1);
    setTransactionForm({ ...transactionForm, items: newItems });
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
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Yakin ingin menghapus data sales ini?')) {
      try {
        await deleteSales(id);
        navigate('/sales');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openWhatsApp = () => {
    if (!sales) return;
    let number = sales.whatsapp.replace(/\D/g, '');
    if (number.startsWith('0')) {
      number = '62' + number.substring(1);
    }
    window.open(`https://wa.me/${number}`, '_blank');
  };

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (!sales) return null;

  const today = new Date().toISOString().split('T')[0];
  const hasAttendedToday = attendance.some(a => a.date === today);

  return (
    <>
      <div className="animate-fade-in">
        <button className="btn btn-secondary mb-6" onClick={() => navigate('/sales')} style={{ padding: '0.5rem 1rem' }}>
          <FaArrowLeft /> Kembali
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="card text-center relative">
              <div className="absolute top-4 right-4 flex gap-2">
                <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => setShowEdit(true)}>
                  <FaEdit />
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.5rem', color: 'var(--danger)' }} onClick={handleDelete}>
                  <FaTrash />
                </button>
              </div>

              <div className="avatar avatar-lg mx-auto mb-4" style={{ margin: '0 auto 1rem auto' }}>
                {sales.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="mb-2">{sales.name}</h2>
              <span className="badge badge-primary mb-6">{sales.distributor}</span>
              
              <div className="mt-4">
                <button className="btn w-full mb-4" style={{ backgroundColor: '#25D366', color: 'white', border: 'none' }} onClick={openWhatsApp}>
                  <FaWhatsapp /> Hubungi via WA
                </button>
                
                <button 
                  className={`btn w-full mb-4 ${hasAttendedToday ? 'btn-secondary' : 'btn-success'}`}
                  onClick={() => setShowAttendanceModal(true)}
                  disabled={hasAttendedToday}
                >
                  <FaCheck /> {hasAttendedToday ? 'Sudah Absen Hari Ini' : 'Tandai Kunjungan'}
                </button>
                
                <button 
                  className="btn btn-primary w-full"
                  onClick={() => setShowTransactionModal(true)}
                >
                  <FaExchangeAlt /> Catat Transaksi Barang
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card mb-6">
              <h3 className="mb-4 border-b pb-4" style={{ borderBottom: '1px solid var(--border-light)' }}>Informasi Detail</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-muted text-sm">Nomor WhatsApp</p>
                  <p className="font-medium">{sales.whatsapp}</p>
                </div>
                <div>
                  <p className="text-muted text-sm">Nama Distributor</p>
                  <p className="font-medium">{sales.distributor}</p>
                </div>
              </div>
              <div>
                <p className="text-muted text-sm mb-2">Barang yang Dibawa ({sales.items.length})</p>
                <div className="p-4 rounded-md mt-2 flex" style={{ background: 'rgba(0,0,0,0.2)', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {sales.items.length === 0 ? (
                    <span className="text-muted italic">Tidak ada data barang.</span>
                  ) : (
                    <>
                      {sales.items.slice(0, 10).map((item, idx) => (
                        <span key={idx} className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--text-primary)', padding: '0.5rem 1rem', fontSize: '0.9rem', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', display: 'inline-flex', textAlign: 'left' }}>
                          <FaBox className="text-accent-primary mr-2" style={{ marginRight: '0.5rem', flexShrink: 0 }} /> <span>{item}</span>
                        </span>
                      ))}
                      {sales.items.length > 10 && (
                        <button className="btn btn-secondary w-full mt-2" onClick={() => setShowItemsModal(true)}>
                          Lihat Semua {sales.items.length} Barang
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex justify-between items-center mb-4 border-b pb-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <FaCalendarAlt className="text-accent-primary" />
                  <h3 className="m-0">Riwayat Kehadiran</h3>
                </div>
                {attendance.length > 0 && (
                  <button className="text-accent-primary text-xs bg-transparent border-0 cursor-pointer underline flex items-center gap-1" onClick={() => navigate(`/sales/${id}/attendance`)}>
                    Lihat Semua
                  </button>
                )}
              </div>
              
              {attendance.length === 0 ? (
                <p className="text-muted text-center py-4">Belum ada riwayat kehadiran.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {attendance.slice(0, 5).map(att => (
                    <div key={att.id} className="p-3 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <strong>{new Date(att.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                          <div className="text-muted text-sm mt-1">
                            Jam Kedatangan: <span className="text-white">{new Date(att.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <span className="badge badge-success">Hadir</span>
                      </div>
                      {att.notes && (
                        <div className="mt-2 pt-2 text-sm text-secondary" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <strong>Catatan:</strong> {att.notes}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {attendance.length > 5 && (
                    <button className="btn btn-secondary w-full mt-2" onClick={() => navigate(`/sales/${id}/attendance`)}>
                      Lihat Semua {attendance.length} Riwayat Kehadiran
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4 border-b pb-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FaExchangeAlt className="text-accent-primary" />
                    <h3 className="m-0">Riwayat Transaksi</h3>
                  </div>
                  {transactions.length > 0 && (
                    <button className="text-accent-primary text-xs bg-transparent border-0 cursor-pointer underline flex items-center gap-1 mt-1" onClick={() => navigate(`/sales/${id}/transactions`)}>
                      Lihat Semua
                    </button>
                  )}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleOpenTransactionModal}>
                  + Transaksi
                </button>
              </div>
              
              {transactions.length === 0 ? (
                <p className="text-muted text-center py-4">Belum ada transaksi barang.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {transactions.slice(0, 5).map(trx => (
                    <div 
                      key={trx.id} 
                      className="p-3 rounded-md flex justify-between items-center cursor-pointer transition-all" 
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                      onClick={() => setSelectedTransaction(trx)}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {trx.type === 'masuk' ? <FaArrowDown className="text-success" /> : <FaArrowUp className="text-danger" />}
                          <strong className={trx.type === 'masuk' ? 'text-success' : 'text-danger'} style={{ fontSize: '0.9rem' }}>
                            {trx.type === 'masuk' ? 'Barang Masuk' : 'Retur / Keluar'}
                          </strong>
                        </div>
                        <div className="text-muted text-xs">
                          {new Date(trx.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <span className="badge badge-primary flex items-center gap-1" style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem', background: 'rgba(59, 130, 246, 0.2)' }}>
                          <FaReceipt /> {trx.receiptId || `TRX-${trx.id.substring(0,6).toUpperCase()}`}
                        </span>
                        <span className="text-accent-primary text-xs flex items-center gap-1 underline" style={{ fontSize: '0.75rem' }}>
                          Cek Rincian <FaSearch style={{fontSize: '0.6rem'}}/>
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {transactions.length > 5 && (
                    <button className="btn btn-secondary w-full mt-2" onClick={() => navigate(`/sales/${id}/transactions`)}>
                      Lihat Semua {transactions.length} Transaksi
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          zIndex: 9999, padding: '1rem', overflowY: 'auto'
        }}>
          <div className="card w-full animate-fade-in" style={{ maxWidth: '500px', margin: '2rem auto', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="mb-6 text-white">Edit Data Sales</h2>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label">Nama Sales</label>
                <input required type="text" className="form-control" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} maxLength={50} />
              </div>
              <div className="form-group">
                <label className="form-label">No WhatsApp</label>
                <input required type="tel" className="form-control" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} maxLength={20} />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Distributor</label>
                <input required type="text" className="form-control" value={formData.distributor} onChange={e => setFormData({...formData, distributor: e.target.value})} maxLength={50} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Barang yang Dibawa</label>
                <div className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    className="form-control" 
                    value={newItem} 
                    onChange={e => setNewItem(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(e); }}
                    placeholder="Ketik nama barang... (Maks 40 karakter)"
                    maxLength={40}
                  />
                  <button type="button" className="btn btn-secondary" onClick={handleAddItem}>
                    Tambah
                  </button>
                </div>
                
                {formData.items.length > 0 && (
                  <div className="p-3 rounded-md" style={{ background: 'rgba(0,0,0,0.2)', minHeight: '60px', maxHeight: '200px', overflowY: 'auto' }}>
                    <div className="flex" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                      {formData.items.map((item, idx) => (
                        <div key={idx} className="badge badge-primary flex items-center gap-2" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', display: 'inline-flex', textAlign: 'left' }}>
                          <span>{item}</span>
                          <FaTimes style={{ cursor: 'pointer', opacity: 0.7, flexShrink: 0 }} onClick={() => handleRemoveItem(idx)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {formData.items.length === 0 && (
                  <p className="text-muted text-sm mt-2">Belum ada barang yang ditambahkan.</p>
                )}
              </div>
              
              <div className="flex gap-4 mt-8">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowEdit(false)}>Batal</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={formData.items.length === 0 && !newItem}>Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View All Items Modal */}
      {showItemsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          zIndex: 9999, padding: '1rem', overflowY: 'auto'
        }}>
          <div className="card w-full animate-fade-in" style={{ maxWidth: '500px', margin: '2rem auto', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex justify-between items-center mb-4 border-b pb-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <h2 className="text-white m-0">Daftar Semua Barang</h2>
              <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => { setShowItemsModal(false); setItemSearch(''); }}>
                <FaTimes />
              </button>
            </div>

            <div className="mb-4">
              <div className="form-control flex items-center gap-2" style={{ padding: '0.25rem 1rem' }}>
                <FaSearch className="text-muted" />
                <input 
                  type="text" 
                  placeholder="Cari nama barang di daftar ini..." 
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', boxShadow: 'none', width: '100%', outline: 'none', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            
            <div className="flex" style={{ flexWrap: 'wrap', gap: '0.5rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {sales.items
                .filter(item => item.toLowerCase().includes(itemSearch.toLowerCase()))
                .map((item, idx) => (
                <span key={idx} className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--text-primary)', padding: '0.5rem 1rem', fontSize: '0.9rem', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', display: 'inline-flex', textAlign: 'left' }}>
                  <FaBox className="text-accent-primary mr-2" style={{ marginRight: '0.5rem', flexShrink: 0 }} /> <span>{item}</span>
                </span>
              ))}
              
              {sales.items.filter(item => item.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                <div className="text-center w-full text-muted italic py-4">Barang "{itemSearch}" tidak ditemukan.</div>
              )}
            </div>
            
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
              <button className="btn btn-secondary w-full" onClick={() => { setShowItemsModal(false); setItemSearch(''); }}>Tutup</button>
            </div>
          </div>
        </div>
      )}
      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card w-full animate-fade-in" style={{ maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="mb-4">Tandai Kunjungan</h3>
            <p className="text-muted text-sm mb-4">
              Konfirmasi kehadiran untuk <strong>{sales.name}</strong> hari ini.
            </p>
            
            <form onSubmit={handleMarkAttendance}>
              <div className="form-group mb-6">
                <label className="form-label">Catatan (Opsional)</label>
                <textarea 
                  className="form-control" 
                  rows="3" 
                  placeholder="Contoh: Kunjungan rutin, bawa barang retur..."
                  value={attendanceNote}
                  onChange={(e) => setAttendanceNote(e.target.value)}
                  style={{ resize: 'none' }}
                ></textarea>
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="button" 
                  className="btn btn-secondary flex-1" 
                  onClick={() => setShowAttendanceModal(false)}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1"
                  disabled={isMarking}
                >
                  Simpan Kunjungan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card w-full animate-fade-in" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="mb-4">Catat Transaksi / Faktur</h3>
            
            <form onSubmit={handleTransactionSubmit}>
              <div className="form-group mb-4">
                <label className="form-label">Jenis Transaksi</label>
                <select 
                  className="form-control"
                  value={transactionForm.type}
                  onChange={e => {
                    setTransactionForm({ type: e.target.value, notes: '', items: [], status: 'selesai', pickupDate: '' });
                    if (sales.items.length > 0) {
                      setTrxItemName(sales.items[0]);
                    } else {
                      setTrxItemName('');
                    }
                  }}
                  required
                >
                  <option value="masuk">Barang Masuk (Stok Bertambah)</option>
                  <option value="retur">Retur / Kedaluwarsa (Stok Berkurang)</option>
                </select>
              </div>

              {transactionForm.type === 'retur' && (
                <div className="form-group mb-4 animate-fade-in" style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <label className="form-label">Status Retur</label>
                  <select 
                    className="form-control mb-3"
                    value={transactionForm.status || 'selesai'}
                    onChange={e => setTransactionForm({...transactionForm, status: e.target.value})}
                  >
                    <option value="selesai">Langsung Selesai (Sudah Diambil Sales)</option>
                    <option value="pending">Menunggu Diambil (Pisahkan Barang)</option>
                  </select>
                  
                  {transactionForm.status === 'pending' && (
                    <div className="animate-fade-in">
                      <label className="form-label text-sm text-accent-primary">Tanggal Rencana Pengambilan *</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={transactionForm.pickupDate || ''}
                        onChange={e => setTransactionForm({...transactionForm, pickupDate: e.target.value})}
                        required={transactionForm.status === 'pending'}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="form-group mb-6">
                <label className="form-label">Keterangan / Nomor Faktur (Opsional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Faktur #INV-001, atau Keterangan lain..."
                  value={transactionForm.notes}
                  onChange={e => setTransactionForm({...transactionForm, notes: e.target.value})}
                  maxLength={100}
                />
              </div>
              
              <div className="border p-4 rounded-md mb-6" style={{ borderColor: 'var(--border-light)', background: 'rgba(0,0,0,0.2)' }}>
                <label className="form-label mb-2 block font-semibold text-white">Keranjang Barang</label>
                
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex gap-2">
                    <select 
                      className="form-control flex-1"
                      value={trxItemName}
                      onChange={e => setTrxItemName(e.target.value)}
                    >
                      {sales.items.length === 0 && <option value="">Tidak ada barang</option>}
                      {sales.items.map((item, idx) => (
                        <option key={idx} value={item}>{item}</option>
                      ))}
                    </select>
                    
                    <input 
                      type="number" 
                      className="form-control" 
                      style={{ width: '80px' }} 
                      min="1"
                      value={trxQuantity}
                      onChange={e => setTrxQuantity(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-2 items-center mt-2">
                    <span className="text-sm text-white" style={{ minWidth: '100px' }}>Tgl Kedaluwarsa:<br/><span className="text-xs text-muted">(Opsional)</span></span>
                    <input 
                      type="date" 
                      className="form-control flex-1" 
                      value={trxExpiredDate}
                      onChange={e => setTrxExpiredDate(e.target.value)}
                    />
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary w-full mt-2" 
                    onClick={handleAddTrxItem} 
                    disabled={!trxItemName}
                  >
                    + Tambah ke Keranjang
                  </button>
                </div>
                
                {transactionForm.items.length > 0 ? (
                  <div className="flex flex-col gap-2 pr-1" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {transactionForm.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 rounded-md" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="text-sm text-white flex flex-col">
                          <div><strong className="mr-3 text-accent-primary">{it.quantity}x</strong> {it.itemName}</div>
                          <div className="text-muted text-xs mt-1">ED: {it.expiredDate}</div>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', background: 'transparent', border: 'none', color: 'var(--danger)' }} onClick={() => handleRemoveTrxItem(idx)}>
                          <FaTimes />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted text-sm italic text-center py-4 border-t border-dashed mt-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>Belum ada barang di keranjang.</div>
                )}
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="button" 
                  className="btn btn-secondary flex-1" 
                  onClick={() => setShowTransactionModal(false)}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1"
                  disabled={isMarking || transactionForm.items.length === 0}
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Transaction Detailed Receipt Modal */}
      {selectedTransaction && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1rem'
        }}>
          <div className="card w-full animate-fade-in shadow-2xl relative" style={{ maxWidth: '400px', background: '#f8fafc', color: '#1e293b', borderRadius: '8px', padding: '0' }}>
            
            <div style={{ padding: '2rem 2rem 1rem 2rem' }}>
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center p-3 rounded-full mb-3" style={{ background: selectedTransaction.type === 'masuk' ? '#d1fae5' : '#fee2e2', color: selectedTransaction.type === 'masuk' ? '#059669' : '#dc2626' }}>
                  {selectedTransaction.type === 'masuk' ? <FaArrowDown size={24} /> : <FaArrowUp size={24} />}
                </div>
                <h2 className="m-0" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0f172a' }}>BUKTI TRANSAKSI</h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0' }}>
                  {selectedTransaction.receiptId || `TRX-${selectedTransaction.id.substring(0,6).toUpperCase()}`}
                </p>
              </div>

              <div className="flex flex-col gap-2 mb-4" style={{ fontSize: '0.85rem' }}>
                <div className="flex justify-between">
                  <span style={{ color: '#64748b' }}>Tanggal:</span>
                  <span style={{ fontWeight: '500' }}>{new Date(selectedTransaction.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#64748b' }}>Waktu:</span>
                  <span style={{ fontWeight: '500' }}>{new Date(selectedTransaction.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#64748b' }}>Tipe:</span>
                  <span style={{ fontWeight: '500', color: selectedTransaction.type === 'masuk' ? '#059669' : '#dc2626' }}>
                    {selectedTransaction.type === 'masuk' ? 'Barang Masuk (IN)' : 'Retur Barang (OUT)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#64748b' }}>Sales:</span>
                  <span style={{ fontWeight: '500' }}>{sales.name}</span>
                </div>
              </div>

              <div style={{ borderTop: '2px dashed #cbd5e1', borderBottom: '2px dashed #cbd5e1', padding: '1rem 0', margin: '1rem 0' }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>Rincian Barang</h4>
                <div className="flex flex-col gap-2 pr-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedTransaction.items && selectedTransaction.items.length > 0 ? (
                    selectedTransaction.items.map((it, i) => (
                      <div key={i} className="flex justify-between items-start" style={{ fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: '500' }}>{it.itemName}</span>
                        <span style={{ fontWeight: 'bold' }}>{it.quantity}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between items-start" style={{ fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: '500' }}>{selectedTransaction.itemName}</span>
                      <span style={{ fontWeight: 'bold' }}>{selectedTransaction.quantity}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedTransaction.notes && (
                <div className="mb-4">
                  <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>Catatan / No. Faktur Asli</h4>
                  <p style={{ fontSize: '0.9rem', fontStyle: 'italic', background: '#f1f5f9', padding: '0.5rem', borderRadius: '4px' }}>
                    "{selectedTransaction.notes}"
                  </p>
                </div>
              )}
            </div>

            <div style={{ background: '#e2e8f0', padding: '1rem', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', textAlign: 'center' }}>
              <button 
                className="btn" 
                style={{ background: '#0f172a', color: 'white', border: 'none', width: '100%', padding: '0.75rem', borderRadius: '6px' }}
                onClick={() => setSelectedTransaction(null)}
              >
                Tutup Bukti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SalesProfile;
