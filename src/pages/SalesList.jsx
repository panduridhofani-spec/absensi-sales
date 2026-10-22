import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuPlus, LuSearch, LuChevronRight, LuX, LuPackage, LuFilter, LuArrowDownAZ, LuUsers, LuPhone } from 'react-icons/lu';
import { getSalesList, addSales } from '../services/dbService';
import { PageHeader, EmptyState, Skeleton } from '../components/ui';
import SelectField from '../components/SelectField';
import { stringOptions, phoneMatches } from '../utils/options';

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
  const [displayLimit, setDisplayLimit] = useState(12);
  const [filterDistributor, setFilterDistributor] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ name: '', whatsapp: '', distributor: '', items: [] });
  const [newItem, setNewItem] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getSalesList();
      setSales(data.map(s => ({ ...s, items: normalizeItems(s.items) })));
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
    const q = search.toLowerCase();
    const passesSearch =
      s.name.toLowerCase().includes(q) ||
      (s.distributor || '').toLowerCase().includes(q) ||
      (s.whatsapp || '').toLowerCase().includes(q) ||
      phoneMatches(s.whatsapp, search) ||
      s.items.some(item => item.toLowerCase().includes(q));
    const passesDist = filterDistributor === 'all' || (s.distributor || '').trim() === filterDistributor;
    return passesSearch && passesDist;
  }).sort((a, b) => {
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
    if (sortBy === 'dist_asc') return (a.distributor || '').localeCompare(b.distributor || '');
    return 0;
  });

  const displayedSales = filteredSales.slice(0, displayLimit);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        if (displayLimit < filteredSales.length) setDisplayLimit(prev => prev + 12);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayLimit, filteredSales.length]);

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
      <PageHeader
        eyebrow="Tim lapangan"
        title="Data Sales"
        subtitle={loading ? 'Memuat...' : `${sales.length} sales terdaftar`}
        actions={
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <LuPlus /> <span>Tambah Sales</span>
          </button>
        }
      />

      <div className="card" style={{ padding: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="input-icon flex-1">
            <LuSearch />
            <input
              type="text"
              placeholder="Cari nama, no. HP, distributor, atau barang..."
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <div style={{ flex: '1 1 180px' }}>
              <SelectField icon={<LuFilter />} value={filterDistributor} onChange={setFilterDistributor} title="Distributor" options={stringOptions(uniqueDistributors, 'Semua distributor')} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <SelectField icon={<LuArrowDownAZ />} value={sortBy} onChange={setSortBy} title="Urutkan" options={[
                { value: 'name_asc', label: 'Nama (A-Z)' },
                { value: 'name_desc', label: 'Nama (Z-A)' },
                { value: 'dist_asc', label: 'Distributor (A-Z)' },
              ]} />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid-auto">
          <Skeleton height={190} /><Skeleton height={190} /><Skeleton height={190} />
        </div>
      ) : displayedSales.length === 0 ? (
        <div className="card">
          <EmptyState icon={<LuUsers />} title="Sales tidak ditemukan" text="Coba ubah kata kunci atau filter pencarian Anda." />
        </div>
      ) : (
        <div className="grid-auto stagger">
          {displayedSales.map(s => (
            <div key={s.id} className="card card-interactive sales-card" onClick={() => navigate(`/sales/${s.id}`)} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/sales/${s.id}`); }}>
              <div className="flex items-center gap-3">
                <div className="avatar">{s.name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <h3 className="truncate">{s.name}</h3>
                  <span className="badge badge-primary" style={{ marginTop: 4 }}>{s.distributor || '-'}</span>
                </div>
              </div>

              {s.whatsapp && (
                <div className="text-sm text-secondary flex items-center gap-2" style={{ marginTop: '0.9rem' }}>
                  <LuPhone /> {s.whatsapp}
                </div>
              )}

              <div style={{ marginTop: '0.9rem' }}>
                <div className="text-xs text-muted font-semibold uppercase tracking-wider flex items-center gap-2" style={{ marginBottom: 6 }}>
                  <LuPackage /> Barang dibawa
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.items.length === 0 ? (
                    <span className="text-muted text-sm">-</span>
                  ) : (
                    s.items.slice(0, 3).map((item, i) => (
                      <span key={i} className="badge" style={{ whiteSpace: 'normal', textAlign: 'left' }}>{item}</span>
                    ))
                  )}
                  {s.items.length > 3 && <span className="badge badge-primary">+{s.items.length - 3}</span>}
                </div>
              </div>

              <div className="sales-card-cta">
                Lihat detail <LuChevronRight />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && displayLimit < filteredSales.length && (
        <div className="text-center mt-6"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Tambah sales baru">
            <div className="card-header">
              <h2>Tambah Sales Baru</h2>
              <button type="button" className="icon-btn" onClick={() => setShowAddModal(false)} aria-label="Tutup"><LuX /></button>
            </div>
            <form onSubmit={handleSubmit}>
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
                  <input
                    type="text"
                    className="form-control"
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(e); }}
                    placeholder="Ketik nama barang (maks 40 karakter)"
                    maxLength={40}
                  />
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
