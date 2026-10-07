import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaChevronRight, FaTimes, FaBox, FaFilter, FaSortAlphaDown } from 'react-icons/fa';
import { getSalesList, addSales } from '../services/dbService';

const normalizeItems = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') return items.split(',').map(i => i.trim()).filter(i => i);
  return [];
};

const SalesList = () => {
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [filterDistributor, setFilterDistributor] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    distributor: '',
    items: []
  });
  const [newItem, setNewItem] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getSalesList();
      const normalizedData = data.map(s => ({ ...s, items: normalizeItems(s.items) }));
      setSales(normalizedData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const uniqueDistributors = [...new Set(sales.map(s => (s.distributor || '').trim()).filter(Boolean))].sort();

  const filteredSales = sales.filter(s => {
    const searchLower = search.toLowerCase();
    const nameMatch = s.name.toLowerCase().includes(searchLower);
    const distMatch = (s.distributor || '').toLowerCase().includes(searchLower);
    const itemMatch = s.items.some(item => item.toLowerCase().includes(searchLower));
    
    const passesSearch = nameMatch || distMatch || itemMatch;
    const passesDist = filterDistributor === 'all' || (s.distributor || '').trim() === filterDistributor;
    
    return passesSearch && passesDist;
  }).sort((a, b) => {
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
    if (sortBy === 'dist_asc') return (a.distributor || '').localeCompare(b.distributor || '');
    return 0;
  });

  const displayedSales = filteredSales.slice(0, displayLimit);

  // Infinite Scroll Listener
  useEffect(() => {
    const handleScroll = () => {
      // If we are near the bottom of the page, load more
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        if (displayLimit < filteredSales.length) {
          setDisplayLimit(prev => prev + 10);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayLimit, filteredSales.length]);

  const handleAddItem = (e) => {
    e.preventDefault(); // Prevent form submit if enter is pressed
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addSales(formData);
      setShowAddModal(false);
      setFormData({ name: '', whatsapp: '', distributor: '', items: [] });
      setNewItem('');
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      {/* Sticky Header Section */}
      <div className="sticky-page-header mb-3 md:mb-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
            <div>
              <h1 className="mb-0 md:mb-1 text-lg md:text-3xl">Data Sales</h1>
              <p className="text-secondary text-xs md:text-sm m-0 hidden sm:block">Kelola data profil sales yang berkunjung.</p>
            </div>
            <button className="btn btn-primary text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2" onClick={() => setShowAddModal(true)}>
              <FaPlus /> <span className="hidden sm:inline">Tambah Sales</span>
            </button>
          </div>

          <div className="card flex flex-col md:flex-row gap-2" style={{ padding: '0.5rem 0.75rem', background: 'rgba(30, 41, 59, 0.7)' }}>
            <div className="flex-1 flex items-center gap-3">
              <FaSearch className="text-muted" />
              <input 
                type="text" 
                placeholder="Cari nama, distributor, atau barang..." 
                className="form-control" 
                style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: 0 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-700 pt-3 md:pt-0 md:pl-3">
              <div className="flex items-center gap-2">
                <FaFilter className="text-muted text-sm" />
                <select 
                  className="form-control bg-transparent text-sm" 
                  style={{ border: 'none', padding: '0', cursor: 'pointer', outline: 'none' }}
                  value={filterDistributor}
                  onChange={(e) => setFilterDistributor(e.target.value)}
                >
                  <option value="all" className="bg-slate-800 text-white">Semua Distributor</option>
                  {uniqueDistributors.map(dist => (
                    <option key={dist} value={dist} className="bg-slate-800 text-white">{dist}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <FaSortAlphaDown className="text-muted text-sm" />
                <select 
                  className="form-control bg-transparent text-sm" 
                  style={{ border: 'none', padding: '0', cursor: 'pointer', outline: 'none' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="name_asc" className="bg-slate-800 text-white">Nama (A-Z)</option>
                  <option value="name_desc" className="bg-slate-800 text-white">Nama (Z-A)</option>
                  <option value="dist_asc" className="bg-slate-800 text-white">Distributor (A-Z)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

      <div className="animate-fade-in pb-10">
        {loading ? (
          <div className="text-center mt-8">Loading data...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedSales.length === 0 ? (
              <div className="text-muted text-center py-8" style={{ gridColumn: '1 / -1' }}>
                Tidak ada data sales ditemukan.
              </div>
            ) : (
              displayedSales.map(s => (
                <div key={s.id} className="card flex flex-col justify-between" style={{ cursor: 'pointer', padding: '1.25rem' }} onClick={() => navigate(`/sales/${s.id}`)}>
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="avatar">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{s.name}</h3>
                        <span className="badge badge-primary">{s.distributor}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <p className="text-muted mb-2 flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
                        <FaBox /> Barang:
                      </p>
                      <div className="flex" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                        {s.items.length === 0 ? (
                          <span className="text-muted text-sm">-</span>
                        ) : (
                          s.items.slice(0, 3).map((item, i) => (
                            <span key={i} className="badge" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', display: 'inline-flex', textAlign: 'left' }}>
                              {item}
                            </span>
                          ))
                        )}
                        {s.items.length > 3 && (
                          <span className="badge" style={{ background: 'transparent', color: 'var(--accent-primary)', padding: '0.25rem' }}>
                            +{s.items.length - 3} lagi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end text-accent-primary">
                    <span className="flex items-center gap-1" style={{ fontSize: '0.875rem' }}>Lihat Detail <FaChevronRight /></span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Loading More Indicator */}
        {!loading && displayLimit < filteredSales.length && (
          <div className="text-center mt-8 mb-4">
            <div className="inline-block p-3 rounded-full bg-slate-800 text-muted" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              Memuat lebih banyak data...
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          zIndex: 9999, padding: '1rem', overflowY: 'auto'
        }}>
          <div className="card w-full animate-fade-in" style={{ maxWidth: '500px', margin: '2rem auto', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="mb-6 text-white">Tambah Sales Baru</h2>
            <form onSubmit={handleSubmit}>
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
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowAddModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={formData.items.length === 0 && !newItem}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SalesList;
