import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaExclamationCircle, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { getSalesList, getAllTransactions, updateTransaction } from '../services/dbService';

const Notifications = () => {
  const [overdueRetur, setOverdueRetur] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, unread, read
  const [readNotifs, setReadNotifs] = useState(() => {
    const saved = localStorage.getItem('readNotifs');
    return saved ? JSON.parse(saved) : [];
  });
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const sales = await getSalesList();
      const transactions = await getAllTransactions();
      
      const today = new Date().toISOString().split('T')[0];
      
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

  useEffect(() => {
    fetchData();
  }, []);

  const handleCompleteRetur = async (trxId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Tandai retur ini sebagai sudah diambil?')) {
      try {
        await updateTransaction(trxId, { status: 'selesai' });
        fetchData();
      } catch (error) {
        console.error("Gagal update transaksi:", error);
        alert("Gagal update transaksi");
      }
    }
  };

  return (
    <>
      <div className="sticky-page-header mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            className="btn btn-secondary flex-shrink-0"
            style={{ padding: '0.5rem' }}
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="mb-0 text-xl md:text-3xl">Semua Notifikasi</h1>
            <p className="text-secondary text-sm m-0 hidden sm:block">Pusat pemberitahuan dan peringatan sistem.</p>
          </div>
        </div>
      </div>

      {/* Filter dan Pencarian */}
      <div className="card p-3 mb-4 md:mb-6" style={{ background: 'var(--surface)' }}>
        <div className="flex flex-col md:flex-row gap-3 justify-between">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Cari nama sales, ID transaksi..." 
              className="form-control pl-4 w-full bg-slate-100 dark:bg-slate-800"
              style={{ border: '1px solid var(--border-light)' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 shrink-0 overflow-x-auto pb-1 md:pb-0">
            <button 
              className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'} px-3 py-1.5 text-sm whitespace-nowrap`}
              onClick={() => setFilterType('all')}
            >
              Semua
            </button>
            <button 
              className={`btn ${filterType === 'unread' ? 'btn-primary' : 'btn-secondary'} px-3 py-1.5 text-sm whitespace-nowrap`}
              onClick={() => setFilterType('unread')}
            >
              Belum Dibaca
            </button>
            <button 
              className={`btn ${filterType === 'read' ? 'btn-primary' : 'btn-secondary'} px-3 py-1.5 text-sm whitespace-nowrap`}
              onClick={() => setFilterType('read')}
            >
              Sudah Dibaca
            </button>
          </div>
        </div>
      </div>

      {(() => {
        const filteredNotifs = overdueRetur.filter(trx => {
          const isRead = readNotifs.includes(trx.id);
          if (filterType === 'unread' && isRead) return false;
          if (filterType === 'read' && !isRead) return false;
          
          if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            if ((trx.salesName || '').toLowerCase().includes(term)) return true;
            if ((trx.receiptId || '').toLowerCase().includes(term)) return true;
            return false;
          }
          return true;
        });

        return (
          <div className="animate-fade-in pb-10">
            <div className="card p-0 overflow-hidden" style={{ background: 'var(--surface)' }}>
              {loading ? (
                <div className="p-8 text-center text-muted">Loading notifikasi...</div>
              ) : filteredNotifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center">
                  <div className="w-20 h-20 rounded-full mb-4 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.05)' }}>
                    <FaBell className="text-muted opacity-30 text-4xl" />
                  </div>
                  <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Tidak ada notifikasi</h3>
                  <p className="text-muted max-w-md mx-auto m-0">Tidak ada pemberitahuan yang sesuai dengan filter Anda.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {filteredNotifs.map((trx, idx) => {
                    const isRead = readNotifs.includes(trx.id);
                
                const handleNotifClick = () => {
                  if (!isRead) {
                    const newRead = [...readNotifs, trx.id];
                    setReadNotifs(newRead);
                    localStorage.setItem('readNotifs', JSON.stringify(newRead));
                  }
                  navigate(`/sales/${trx.salesId}/transactions`);
                };

                return (
                  <div 
                    key={trx.id} 
                    className="p-4 md:p-6 transition-colors border-b flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
                    style={{ 
                      borderColor: 'var(--border-light)',
                      background: isRead ? 'transparent' : 'rgba(239, 68, 68, 0.05)',
                      cursor: 'default'
                    }}
                  >
                    <div className="flex gap-4 items-start cursor-pointer w-full relative" onClick={handleNotifClick}>
                      {!isRead && <span className="absolute -left-2 top-0 w-2 h-2 rounded-full bg-red-500 hidden md:block"></span>}
                    <div className="p-3 rounded-xl flex-shrink-0" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                       <FaExclamationCircle className="text-red-500 text-2xl" />
                    </div>
                    <div className="flex-1">
                      <div className="text-base md:text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                        Retur Barang Terlambat Diambil
                      </div>
                      <div className="text-sm text-muted mb-2">
                        Sales <span className="font-semibold" style={{color:'var(--text-primary)'}}>{trx.salesName}</span> belum mengambil barang retur (No: {trx.receiptId}).
                      </div>
                      <div className="text-xs font-semibold px-2.5 py-1 inline-block rounded border border-red-200/20" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                        Jatuh tempo: {new Date(trx.pickupDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 w-full sm:w-auto flex justify-end">
                    <button 
                      className="btn w-full sm:w-auto flex items-center justify-center gap-2 hover:opacity-90"
                      style={{ background: '#10b981', color: '#fff', border: 'none' }}
                      onClick={(e) => handleCompleteRetur(trx.id, e)}
                    >
                      <FaCheck />
                      <span>Tandai Diambil</span>
                    </button>
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
        );
      })()}
    </>
  );
};

export default Notifications;
