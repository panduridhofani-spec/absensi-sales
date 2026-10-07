import React, { useEffect, useState } from 'react';
import { FaSearch, FaExchangeAlt, FaArrowDown, FaArrowUp, FaReceipt, FaFileDownload, FaFilter, FaTrash, FaEdit, FaPrint, FaTimes, FaCalendarAlt, FaCheck, FaExclamationCircle } from 'react-icons/fa';
import { getAllTransactions, getSalesList, deleteTransaction, updateTransaction } from '../services/dbService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', background: '#111', minHeight: '100vh' }}>
          <h2>Something went wrong in AllTransactions.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

const AllTransactionsInner = () => {
  const [transactions, setTransactions] = useState([]);
  const [salesMap, setSalesMap] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDistributor, setFilterDistributor] = useState('all');
  const [filterSales, setFilterSales] = useState('all');
  const [displayLimit, setDisplayLimit] = useState(20);
  const [editTrxModal, setEditTrxModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  
  // Soft Limit State
  const [limitDays, setLimitDays] = useState(60);

  // Safe date formatter to prevent crash on invalid timestamps
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
        const [trx, salesData] = await Promise.all([
          getAllTransactions(limitDays),
          getSalesList()
        ]);
        
        setTransactions(trx);
        
        // Create a map of sales ID to Sales Object for quick lookup
        const sMap = {};
        salesData.forEach(s => {
          sMap[s.id] = { name: s.name, distributor: s.distributor };
        });
        setSalesMap(sMap);

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [limitDays]);

  const handleDeleteTransaction = async (trxId) => {
    if (window.confirm('Yakin ingin menghapus transaksi ini secara global?')) {
      try {
        await deleteTransaction(trxId);
        setTransactions(prev => prev.filter(t => t.id !== trxId));
      } catch (error) {
        console.error("Gagal menghapus transaksi:", error);
        alert("Gagal menghapus transaksi");
      }
    }
  };

  const handleCompleteRetur = async (trxId) => {
    if (window.confirm('Tandai retur ini sebagai sudah diambil?')) {
      try {
        await updateTransaction(trxId, { status: 'selesai' });
        setTransactions(prev => prev.map(t => t.id === trxId ? { ...t, status: 'selesai' } : t));
      } catch (error) {
        console.error("Gagal update transaksi:", error);
        alert("Gagal update transaksi");
      }
    }
  };

  const handleEditTransaction = (trx) => {
    const d = new Date(trx.timestamp);
    const dateStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
    const timeStr = !isNaN(d.getTime()) ? d.toTimeString().substring(0, 5) : '';

    let editItems = [];
    if (Array.isArray(trx.items) && trx.items.length > 0) {
      editItems = [...trx.items];
    } else {
      editItems = [{
        itemName: trx.itemName || '',
        quantity: trx.quantity || 1,
        expiredDate: trx.expiredDate || ''
      }];
    }

    setEditTrxModal({
      ...trx,
      editDate: dateStr,
      editTime: timeStr,
      editNotes: trx.notes || '',
      editItems: editItems
    });
  };

  const handleSaveEditTransaction = async (e) => {
    e.preventDefault();
    if (!editTrxModal.editDate || !editTrxModal.editTime) {
      alert("Tanggal dan Jam wajib diisi!");
      return;
    }

    try {
      const newTimestamp = new Date(`${editTrxModal.editDate}T${editTrxModal.editTime}:00`).toISOString();
      const updates = { 
        timestamp: newTimestamp, 
        notes: editTrxModal.editNotes,
        items: editTrxModal.editItems
      };
      
      await updateTransaction(editTrxModal.id, updates);
      
      setTransactions(prev => {
        const updated = prev.map(t => t.id === editTrxModal.id ? { ...t, ...updates } : t);
        return updated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      });
      
      setEditTrxModal(null);
    } catch (error) {
      console.error("Gagal menyimpan perubahan transaksi:", error);
      alert("Gagal menyimpan perubahan transaksi");
    }
  };

  const exportToCSV = () => {
    if (fullyFilteredTransactions.length === 0) return alert('Tidak ada data untuk diekspor');

    let csvContent = "ID Faktur,Tanggal,Jam,Tipe Transaksi,Nama Sales,Distributor,Nama Barang,Jumlah,Expired Date,Catatan\n";

    fullyFilteredTransactions.forEach(trx => {
      const date = safeFormatDate(trx.timestamp);
      const time = safeFormatTime(trx.timestamp, { hour: '2-digit', minute: '2-digit' });
      const type = trx.type === 'masuk' ? 'Barang Masuk' : 'Retur/Keluar';
      const receiptId = trx.receiptId || (trx.id ? `TRX-${String(trx.id).substring(0,6).toUpperCase()}` : 'TRX-UNKNOWN');
      
      const salesObj = salesMap[trx.salesId] || { name: 'Sales Dihapus', distributor: '-' };
      const salesName = (salesObj.name || 'Sales Dihapus').replace(/,/g, ' ');
      const distName = (salesObj.distributor || '-').replace(/,/g, ' ');
      const notes = (trx.notes || '').replace(/,/g, ' '); 
      
      if (Array.isArray(trx.items) && trx.items.length > 0) {
        trx.items.forEach(it => {
          const itemName = (it.itemName || '').replace(/,/g, ' ');
          const ed = it.expiredDate || '-';
          csvContent += `${receiptId},${date},${time},${type},${salesName},${distName},${itemName},${it.quantity},${ed},${notes}\n`;
        });
      } else {
        const itemName = (trx.itemName || '').replace(/,/g, ' ');
        const ed = trx.expiredDate || '-';
        csvContent += `${receiptId},${date},${time},${type},${salesName},${distName},${itemName},${trx.quantity},${ed},${notes}\n`;
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Global_Transaksi_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        if (displayLimit < transactions.length) { // Simplified condition just to trigger
          setDisplayLimit(prev => prev + 20);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayLimit, transactions.length]);

  if (loading) return <div className="text-center mt-8">Loading...</div>;

  const filteredTransactions = transactions.filter(trx => {
    if (filterType === 'masuk' && trx.type !== 'masuk') return false;
    if (filterType === 'retur_selesai' && !(trx.type === 'retur' && trx.status === 'selesai')) return false;
    if (filterType === 'retur_pending') {
      if (!(trx.type === 'retur' && trx.status === 'pending')) return false;
      if (trx.pickupDate) {
        const pickupDateObj = new Date(trx.pickupDate);
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0);
        if (pickupDateObj < todayObj) return false;
      }
    }
    if (filterType === 'keluar' && trx.type !== 'retur' && trx.type !== 'keluar') return false;
    if (filterType === 'retur_terlambat') {
      if (!(trx.type === 'retur' && trx.status === 'pending' && trx.pickupDate)) return false;
      const pickupDateObj = new Date(trx.pickupDate);
      const todayObj = new Date();
      todayObj.setHours(0,0,0,0);
      if (pickupDateObj >= todayObj) return false;
    }
    
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      
      const receiptIdStr = trx.receiptId ? trx.receiptId.toLowerCase() : (trx.id ? `trx-${String(trx.id).substring(0,6).toLowerCase()}` : '');
      if (receiptIdStr.includes(term)) return true;
      if (trx.notes && String(trx.notes).toLowerCase().includes(term)) return true;
      
      const salesObj = salesMap[trx.salesId] || { name: '', distributor: '' };
      const sName = (salesObj.name || '').toLowerCase();
      const sDist = (salesObj.distributor || '').toLowerCase();
      
      if (sName.includes(term)) return true;
      if (sDist.includes(term)) return true;
      
      if (Array.isArray(trx.items) && trx.items.length > 0) {
        if (trx.items.some(it => (it.itemName || '').toLowerCase().includes(term))) return true;
      } else if (trx.itemName && trx.itemName.toLowerCase().includes(term)) {
        return true;
      }
      
      return false;
    }
    
    return true;
  });

  const uniqueDistributors = [...new Set(Object.values(salesMap).map(s => (s.distributor || '').trim()).filter(Boolean))].sort();
  const uniqueSales = [...new Set(Object.values(salesMap).map(s => (s.name || '').trim()).filter(Boolean))].sort();

  const fullyFilteredTransactions = filteredTransactions.filter(trx => {
    const salesObj = salesMap[trx.salesId] || { name: 'Sales Dihapus', distributor: '-' };
    const passDist = filterDistributor === 'all' || (salesObj.distributor || '').trim() === filterDistributor;
    const passSales = filterSales === 'all' || (salesObj.name || '').trim() === filterSales;
    return passDist && passSales;
  });

  const displayedTransactions = fullyFilteredTransactions.slice(0, displayLimit);

  return (
    <>
      <div className="sticky-page-header mb-3 md:mb-6">
        <div className="flex justify-between items-center mb-3 md:mb-4">
          <div>
            <h1 className="m-0 flex items-center gap-2 text-lg md:text-2xl">
              <FaExchangeAlt className="text-primary" /> Laporan Transaksi Global
            </h1>
            <p className="text-muted mt-1 text-xs md:text-sm hidden sm:block">Cari riwayat suatu barang dari seluruh data Sales</p>
          </div>
          <button className="btn btn-primary flex items-center gap-2 shadow-lg text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2" onClick={exportToCSV} style={{ background: '#059669', borderColor: '#059669' }}>
            <FaFileDownload /> <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>

        <div className="card" style={{ padding: '0.5rem 0.75rem', background: 'rgba(30, 41, 59, 0.7)' }}>
          <div className="flex flex-col xl:flex-row gap-2 md:gap-4 justify-between">
            <div className="flex flex-col md:flex-row gap-3 flex-1">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Cari ID, Barang, Sales, atau Distributor..."
                  className="input pl-10 w-full bg-slate-800"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-700 pt-3 md:pt-0 md:pl-3">
                <FaFilter className="text-muted text-sm shrink-0" />
                <select 
                  className="form-control bg-slate-800 text-sm" 
                  value={filterDistributor}
                  onChange={(e) => setFilterDistributor(e.target.value)}
                >
                  <option value="all">Semua Distributor</option>
                  {uniqueDistributors.map(dist => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
                <select 
                  className="form-control bg-slate-800 text-sm" 
                  value={filterSales}
                  onChange={(e) => setFilterSales(e.target.value)}
                >
                  <option value="all">Semua Sales</option>
                  {uniqueSales.map(sales => (
                    <option key={sales} value={sales}>{sales}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap shrink-0 xl:justify-end items-center border-t xl:border-t-0 xl:border-l border-slate-700 pt-3 xl:pt-0 xl:pl-3">
              <button 
                className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-sm flex-1 md:flex-none`}
                onClick={() => setFilterType('all')}
              >
                Semua
              </button>
              <button 
                className={`btn ${filterType === 'masuk' ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-sm flex-1 md:flex-none`}
                onClick={() => setFilterType('masuk')}
                style={filterType === 'masuk' ? { background: '#059669', borderColor: '#059669' } : {}}
              >
                Masuk
              </button>
              <button 
                className={`btn ${filterType === 'retur_selesai' ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-sm flex-1 md:flex-none`}
                onClick={() => setFilterType('retur_selesai')}
                style={filterType === 'retur_selesai' ? { background: '#dc2626', borderColor: '#dc2626', color: '#fff' } : {}}
              >
                Retur (Selesai)
              </button>
              <button 
                className={`btn ${filterType === 'retur_pending' ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-sm flex-1 md:flex-none`}
                onClick={() => setFilterType('retur_pending')}
                style={filterType === 'retur_pending' ? { background: '#eab308', borderColor: '#eab308', color: '#fff' } : {}}
              >
                Retur (Menunggu)
              </button>
              <button 
                className={`btn ${filterType === 'retur_terlambat' ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-sm flex-1 md:flex-none`}
                onClick={() => setFilterType('retur_terlambat')}
                style={filterType === 'retur_terlambat' ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff', fontWeight: 'bold' } : { color: '#ef4444' }}
              >
                <FaExclamationCircle className="inline mr-1" />
                Jatuh Tempo
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="animate-fade-in pb-10">
        <div className="card p-0 overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.7)' }}>
        {fullyFilteredTransactions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <FaFilter size={32} className="text-muted mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">Tidak ada transaksi ditemukan</h3>
            <p className="text-muted max-w-md mx-auto">Barang atau kata kunci yang Anda cari belum pernah dicatat dalam transaksi manapun.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            {limitDays && fullyFilteredTransactions.length > 0 && (
              <div className="p-3 bg-indigo-900 bg-opacity-20 border-b border-indigo-500/20 text-indigo-200 text-sm flex justify-between items-center">
                <span><span className="font-bold">Info:</span> Hanya menampilkan transaksi {limitDays} hari terakhir untuk menjaga performa.</span>
                <button 
                  onClick={() => setLimitDays(null)}
                  className="btn btn-primary btn-sm py-1 px-3"
                  style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', borderColor: '#4f46e5' }}
                >
                  Muat Semua Data (Lama)
                </button>
              </div>
            )}
            <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-light)' }}>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Tipe</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Tanggal & Jam</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Sales Penanggung Jawab</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">Rincian Barang</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">No Faktur / Catatan</th>
                  <th className="p-4 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayedTransactions.map(trx => {
                  let isOverdue = false;
                  if (trx.type === 'retur' && trx.status === 'pending' && trx.pickupDate) {
                    const pickupDateObj = new Date(trx.pickupDate);
                    const todayObj = new Date();
                    todayObj.setHours(0,0,0,0);
                    if (pickupDateObj < todayObj) isOverdue = true;
                  }
                  
                  return (
                  <tr 
                    key={trx.id} 
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: isOverdue ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }} 
                    className="hover:bg-slate-800 hover:bg-opacity-50 transition-colors"
                    onClick={() => setDetailModal(trx)}
                  >
                    <td className="p-4 align-top" style={{ verticalAlign: 'top' }}>
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2">
                          {trx.type === 'masuk' ? <FaArrowDown className="text-success" /> : <FaArrowUp className="text-danger" />}
                          <span className={trx.type === 'masuk' ? 'text-success font-medium' : 'text-danger font-medium'}>
                            {trx.type === 'masuk' ? 'MASUK' : 'RETUR'}
                          </span>
                        </div>
                        {trx.type === 'retur' && trx.status === 'pending' && (
                          isOverdue ? (
                            <div className="text-[0.65rem] mt-1 px-2 py-1 rounded font-bold inline-block text-center shadow-sm animate-pulse" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                              Jatuh<br/>Tempo
                            </div>
                          ) : (
                            <div className="text-[0.65rem] mt-1 px-2 py-1 rounded font-medium inline-block text-center" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                              Menunggu<br/>Diambil
                            </div>
                          )
                        )}
                        {trx.type === 'retur' && trx.status === 'selesai' && (
                          <div className="text-[0.65rem] mt-1 px-2 py-1 rounded font-medium inline-block text-center" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            Selesai<br/>(Diambil)
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 align-top" style={{ verticalAlign: 'top' }}>
                      <div>{safeFormatDate(trx.timestamp, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div className="text-muted text-sm">{safeFormatTime(trx.timestamp, { hour: '2-digit', minute: '2-digit' })}</div>
                      {trx.type === 'retur' && trx.status === 'pending' && trx.pickupDate && (
                        <div className={`text-xs mt-2 font-bold flex items-center gap-1`} style={{ color: isOverdue ? '#ef4444' : '#eab308' }}>
                          {isOverdue ? <FaExclamationCircle /> : <FaCalendarAlt />}
                          {isOverdue ? 'Jatuh tempo: ' : 'Rencana: '}
                          {safeFormatDate(trx.pickupDate + 'T12:00:00Z', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-top" style={{ verticalAlign: 'top' }}>
                      <div className="font-medium text-white">{salesMap[trx.salesId] ? salesMap[trx.salesId].name : 'Sales Dihapus'}</div>
                      <div className="text-sm text-muted">{salesMap[trx.salesId] ? salesMap[trx.salesId].distributor : '-'}</div>
                    </td>
                    <td className="p-4 align-top" style={{ verticalAlign: 'top' }}>
                      <div className="flex flex-col gap-1 pr-1" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                        {Array.isArray(trx.items) && trx.items.length > 0 ? (
                          trx.items.map((it, i) => (
                            <div key={i} className="text-sm">
                              <div><span className="text-accent-primary font-bold mr-2">{it.quantity}x</span> {it.itemName}</div>
                              {it.expiredDate && <div className="text-xs text-muted ml-6">ED: {it.expiredDate}</div>}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm">
                            <div><span className="text-accent-primary font-bold mr-2">{trx.quantity}x</span> {trx.itemName}</div>
                            {trx.expiredDate && <div className="text-xs text-muted ml-6">ED: {trx.expiredDate}</div>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 align-top" style={{ verticalAlign: 'top' }}>
                      <div 
                        className="flex items-center gap-1 text-xs badge badge-primary mb-1 inline-flex cursor-pointer hover:opacity-80" 
                        style={{ background: 'rgba(59, 130, 246, 0.1)' }}
                        onClick={(e) => { e.stopPropagation(); setDetailModal(trx); }}
                        title="Lihat Detail Transaksi"
                      >
                        <FaReceipt /> {trx.receiptId || (trx.id ? `TRX-${String(trx.id).substring(0,6).toUpperCase()}` : 'TRX-UNKNOWN')}
                      </div>
                      {trx.notes && <div className="text-muted text-xs italic mt-1">"{trx.notes}"</div>}
                    </td>
                    <td className="p-4 text-right align-top" style={{ verticalAlign: 'top' }}>
                      <div className="flex justify-end gap-2 flex-wrap">
                        {trx.type === 'retur' && trx.status === 'pending' && (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: '0.4rem', color: '#10b981', background: 'transparent', border: 'none' }}
                            onClick={(e) => { e.stopPropagation(); handleCompleteRetur(trx.id); }}
                            title="Tandai Sudah Diambil"
                          >
                            <FaCheck />
                          </button>
                        )}
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '0.4rem', color: 'var(--accent-primary)', background: 'transparent', border: 'none' }}
                          onClick={(e) => { e.stopPropagation(); handleEditTransaction(trx); }}
                          title="Edit Waktu & Catatan"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '0.4rem', color: 'var(--danger)', background: 'transparent', border: 'none' }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(trx.id); }}
                          title="Hapus Transaksi"

                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loading More Indicator */}
      {!loading && displayLimit < fullyFilteredTransactions.length && (
        <div className="text-center mt-6 mb-2">
          <div className="inline-block p-3 rounded-full bg-slate-800 text-muted" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            Memuat lebih banyak data...
          </div>
        </div>
      )}
      </div>
      
      {/* Edit Transaction Modal */}
      {editTrxModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card w-full animate-fade-in" style={{ maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="mb-4">Edit Transaksi</h3>
            <p className="text-muted text-sm mb-4">
              Silakan ubah tanggal, jam, catatan, atau rincian barang transaksi.
            </p>
            
            <form onSubmit={handleSaveEditTransaction}>
              <div className="flex gap-4 mb-4">
                <div className="form-group flex-1">
                  <label className="form-label">Tanggal</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    required
                    value={editTrxModal.editDate}
                    onChange={(e) => setEditTrxModal({...editTrxModal, editDate: e.target.value})}
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Jam</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    required
                    value={editTrxModal.editTime}
                    onChange={(e) => setEditTrxModal({...editTrxModal, editTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label mb-2 block">Rincian Barang</label>
                {editTrxModal.editItems.map((item, index) => (
                  <div key={index} className="flex flex-col gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 mb-2 relative">
                    {editTrxModal.editItems.length > 1 && (
                      <button 
                        type="button" 
                        className="absolute top-2 right-2 text-danger hover:text-white" 
                        onClick={() => setEditTrxModal({...editTrxModal, editItems: editTrxModal.editItems.filter((_, i) => i !== index)})}
                      >
                        <FaTimes />
                      </button>
                    )}
                    <input 
                      type="text" 
                      placeholder="Nama Barang" 
                      className="form-control text-sm" 
                      value={item.itemName} 
                      onChange={(e) => {
                        const newItems = [...editTrxModal.editItems];
                        newItems[index].itemName = e.target.value;
                        setEditTrxModal({...editTrxModal, editItems: newItems});
                      }} 
                      required
                    />
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="Qty" 
                        className="form-control text-sm w-1/3" 
                        value={item.quantity} 
                        onChange={(e) => {
                          const newItems = [...editTrxModal.editItems];
                          newItems[index].quantity = parseInt(e.target.value) || 0;
                          setEditTrxModal({...editTrxModal, editItems: newItems});
                        }} 
                        required
                        min="1"
                      />
                      <input 
                        type="date" 
                        className="form-control text-sm w-2/3" 
                        value={item.expiredDate} 
                        onChange={(e) => {
                          const newItems = [...editTrxModal.editItems];
                          newItems[index].expiredDate = e.target.value;
                          setEditTrxModal({...editTrxModal, editItems: newItems});
                        }} 
                      />
                    </div>
                  </div>
                ))}
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm w-full mt-2 border-dashed"
                  onClick={() => setEditTrxModal({...editTrxModal, editItems: [...editTrxModal.editItems, { itemName: '', quantity: 1, expiredDate: '' }]})}
                >
                  + Tambah Barang
                </button>
              </div>

              <div className="form-group mb-6">
                <label className="form-label">Catatan</label>
                <textarea 
                  className="form-control" 
                  rows="2" 
                  value={editTrxModal.editNotes}
                  onChange={(e) => setEditTrxModal({...editTrxModal, editNotes: e.target.value})}
                  style={{ resize: 'none' }}
                ></textarea>
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="button" 
                  className="btn btn-secondary flex-1" 
                  onClick={() => setEditTrxModal(null)}
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

      {/* Detail Modal */}
      {detailModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card w-full animate-fade-in flex flex-col" style={{ maxWidth: '450px', background: 'var(--bg-card)', padding: 0, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            
            {/* Header / Actions */}
            <div className="p-4 flex justify-between items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
              <h3 className="text-lg font-bold flex items-center gap-2">
                {detailModal.type === 'masuk' ? <FaArrowDown className="text-success" /> : <FaArrowUp className="text-danger" />}
                Detail Transaksi
              </h3>
              <button 
                className="btn btn-secondary btn-sm p-2 hover:bg-slate-700"
                style={{ border: 'none' }}
                onClick={() => setDetailModal(null)}
              >
                <FaTimes />
              </button>
            </div>

            {/* Content */}
            <div className="p-5" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              
              <div className="flex flex-col gap-3 mb-6 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">No. Faktur:</span>
                  <span className="font-mono font-medium text-accent-primary">{detailModal.receiptId || (detailModal.id ? `TRX-${String(detailModal.id).substring(0,6).toUpperCase()}` : 'TRX-UNKNOWN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">Tanggal:</span>
                  <span className="font-medium text-white">{safeFormatDate(detailModal.timestamp, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">Waktu:</span>
                  <span className="font-medium text-white">{safeFormatTime(detailModal.timestamp, { hour: '2-digit', minute: '2-digit' })} WIB</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">Tipe:</span>
                  <span className={`font-bold ${detailModal.type === 'masuk' ? 'text-success' : 'text-danger'}`}>
                    {detailModal.type === 'masuk' ? 'Barang Masuk (IN)' : 'Retur Barang (OUT)'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">Sales:</span>
                  <span className="font-medium text-white">
                     {salesMap[detailModal.salesId] ? salesMap[detailModal.salesId].name : 'Sales Dihapus'}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Rincian Barang</h4>
                <div className="flex flex-col gap-3 pr-2" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                   {Array.isArray(detailModal.items) && detailModal.items.length > 0 ? (
                      detailModal.items.map((it, i) => (
                        <div key={i} className="flex justify-between items-start text-sm p-3 bg-slate-800 rounded-lg border border-slate-700">
                          <div>
                            <div className="font-medium text-white pr-4">{it.itemName}</div>
                            {it.expiredDate && <div className="text-xs text-muted mt-1">ED: {it.expiredDate}</div>}
                          </div>
                          <span className="text-accent-primary font-bold bg-blue-900/30 px-2 py-1 rounded">{it.quantity}x</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between items-start text-sm p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <div>
                          <div className="font-medium text-white pr-4">{detailModal.itemName}</div>
                          {detailModal.expiredDate && <div className="text-xs text-muted mt-1">ED: {detailModal.expiredDate}</div>}
                        </div>
                        <span className="text-accent-primary font-bold bg-blue-900/30 px-2 py-1 rounded">{detailModal.quantity}x</span>
                      </div>
                   )}
                </div>
              </div>

              {detailModal.notes && (
                <div className="mb-2 mt-6">
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Catatan / No. Faktur Asli</h4>
                  <div className="p-3 bg-slate-800/80 rounded-lg text-slate-300 text-sm italic border border-slate-700 border-l-4 border-l-accent-primary">
                    "{detailModal.notes}"
                  </div>
                </div>
              )}

            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex justify-end">
              <button 
                className="btn btn-secondary"
                onClick={() => setDetailModal(null)}
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default function AllTransactions() {
  return (
    <ErrorBoundary>
      <AllTransactionsInner />
    </ErrorBoundary>
  );
}
