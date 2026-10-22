import { useMemo, useState } from 'react';
import { LuX, LuHandshake, LuSearch } from 'react-icons/lu';
import SelectField from '../SelectField';
import { salesOptions } from '../../utils/options';
import { conditionOf, formatDate, matchesSalesItems, isLate, lateDays } from '../../utils/returns';

// Cocok jika barangnya termasuk barang yang dibawa sales, atau memang dijanjikan untuk sales itu.
const isForSales = (r, s) => r.pickupSalesId === s.id || matchesSalesItems(r.itemName, Array.isArray(s.items) ? s.items : []);

const PickupModal = ({ sales, waiting, preselected, onClose, onConfirm }) => {
  const [salesId, setSalesId] = useState('');
  const [selected, setSelected] = useState(() => new Set(preselected));
  const [showAll, setShowAll] = useState(preselected.length > 0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const current = sales.find(s => s.id === salesId);

  const { matching, others } = useMemo(() => {
    if (!current) return { matching: [], others: waiting };
    return {
      matching: waiting.filter(r => isForSales(r, current)),
      others: waiting.filter(r => !isForSales(r, current)),
    };
  }, [current, waiting]);

  const visible = current ? (showAll ? [...matching, ...others] : matching) : [];

  const chooseSales = (id) => {
    setSalesId(id);
    const s = sales.find(x => x.id === id);
    if (!s) return;
    // Jika karyawan sudah memilih barang lebih dulu, pilihan itu dipertahankan.
    if (preselected.length > 0) return;
    // Otomatis centang semua barang yang cocok dengan barang yang dibawa sales ini.
    setSelected(new Set(waiting.filter(r => isForSales(r, s)).map(r => r.id)));
  };

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const confirm = async () => {
    const ids = [...selected].filter(id => visible.some(r => r.id === id));
    if (!current || ids.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(ids, current, note);
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = [...selected].filter(id => visible.some(r => r.id === id)).length;

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }} role="dialog" aria-modal="true" aria-label="Sales ambil barang retur">
        <div className="card-header">
          <h3>Sales Ambil Barang</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><LuX /></button>
        </div>

        <div className="form-group">
          <label className="form-label">Pilih sales yang datang</label>
          <SelectField
            value={salesId}
            onChange={chooseSales}
            options={salesOptions(sales)}
            placeholder="— Pilih sales —"
            title="Pilih sales yang datang"
            searchable
          />
        </div>

        {!current ? (
          <div className="text-muted text-sm text-center" style={{ padding: '1.5rem 0' }}>Pilih sales untuk melihat barang retur yang cocok.</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 8 }}>
              <div className="text-xs text-muted font-semibold uppercase tracking-wider">
                {matching.length} barang cocok dengan barang {current.name.split(' ')[0]}
              </div>
              {others.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(s => !s)}>
                  <LuSearch /> {showAll ? 'Hanya yang cocok' : `Tampilkan semua (+${others.length})`}
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="text-muted text-sm text-center" style={{ padding: '1.25rem 0' }}>
                Tidak ada barang retur yang cocok untuk sales ini.
              </div>
            ) : (
              <div className="list" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {visible.map(r => {
                  const isMatch = matching.includes(r);
                  return (
                    <label key={r.id} className="list-item" style={{ cursor: 'pointer', padding: '0.65rem 0.85rem', borderColor: selected.has(r.id) ? 'var(--accent-primary)' : undefined }}>
                      <div className="list-item-main">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} style={{ width: 18, height: 18 }} />
                        <div style={{ minWidth: 0 }}>
                          <div className="list-item-title"><b className="text-accent-primary">{r.quantity}×</b> {r.itemName}</div>
                          <div className="list-item-sub">
                            {conditionOf(r.condition).label}{r.expiredDate ? ` · ED ${formatDate(r.expiredDate)}` : ''}
                            {r.pickupDate ? (
                              <span style={{ color: isLate(r) ? 'var(--danger)' : undefined, fontWeight: isLate(r) ? 600 : undefined }}>
                                {` · janji ${formatDate(r.pickupDate)}${r.pickupSalesName ? ` (${r.pickupSalesName})` : ''}${isLate(r) ? `, terlambat ${lateDays(r)} hari` : ''}`}
                              </span>
                            ) : ''}
                          </div>
                        </div>
                      </div>
                      {!isMatch && <span className="badge badge-warning">Tidak cocok</span>}
                    </label>
                  );
                })}
              </div>
            )}

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Catatan serah terima (opsional)</label>
              <input type="text" className="form-control" placeholder="Mis. diterima langsung oleh sales" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} />
            </div>
          </>
        )}

        <div className="flex gap-3" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>Batal</button>
          <button type="button" className="btn btn-primary flex-1" disabled={!current || selectedCount === 0 || saving} onClick={confirm}>
            <LuHandshake /> {saving ? 'Menyimpan...' : `Serahkan ${selectedCount || ''} barang`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PickupModal;
