import { useState } from 'react';
import { LuX, LuCalendarClock, LuUser } from 'react-icons/lu';
import { todayStr, formatDate } from '../../utils/returns';
import SelectField from '../SelectField';
import { salesOptions } from '../../utils/options';

// Atur (atau hapus) tanggal janji pengambilan untuk beberapa barang sekaligus.
const ScheduleModal = ({ items, sales, fixedSales, onClose, onSave }) => {
  const existing = items.find(i => i.pickupDate);
  const [date, setDate] = useState(existing?.pickupDate && existing.pickupDate >= todayStr() ? existing.pickupDate : '');
  const [salesId, setSalesId] = useState(
    fixedSales
      ? fixedSales.id
      : items.every(i => i.pickupSalesId && i.pickupSalesId === items[0].pickupSalesId) ? (items[0].pickupSalesId || '') : ''
  );
  const [saving, setSaving] = useState(false);

  const save = async (clear) => {
    setSaving(true);
    try {
      const s = fixedSales || sales.find(x => x.id === salesId);
      await onSave(
        clear
          ? { pickupDate: '', pickupSalesId: null, pickupSalesName: null }
          : { pickupDate: date, pickupSalesId: s?.id || null, pickupSalesName: s?.name || null }
      );
    } finally {
      setSaving(false);
    }
  };

  const hasSchedule = items.some(i => i.pickupDate);

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 440 }} role="dialog" aria-modal="true" aria-label="Jadwalkan pengambilan">
        <div className="card-header">
          <h3>Jadwalkan Pengambilan</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><LuX /></button>
        </div>
        <p className="text-secondary text-sm mb-4">
          Catat tanggal sales berjanji mengambil <b>{items.length} barang</b>. Jika tanggal terlewat dan barang belum diambil, statusnya menjadi <b>Terlambat</b> dan masuk notifikasi.
        </p>

        <div className="form-group">
          <label className="form-label">Janji diambil tanggal</label>
          <input type="date" className="form-control field-big" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} autoFocus />
          {date && <div className="text-xs text-muted" style={{ marginTop: 6 }}>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>}
        </div>

        {fixedSales ? (
          <div className="callout callout-info" style={{ marginBottom: '1rem' }}>
            <LuUser />
            <div className="callout-body">Janji diambil oleh <b>{fixedSales.name}</b>{fixedSales.distributor ? ` · ${fixedSales.distributor}` : ''}</div>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Sales yang berjanji (opsional)</label>
            <SelectField
              value={salesId}
              onChange={setSalesId}
              options={salesOptions(sales, { value: '', label: '— Belum tahu / siapa saja —' })}
              placeholder="— Belum tahu / siapa saja —"
              title="Sales yang berjanji"
              searchable
            />
          </div>
        )}

        <div className="list" style={{ maxHeight: 130, overflowY: 'auto', marginBottom: '1rem' }}>
          {items.map(i => (
            <div key={i.id} className="list-item" style={{ padding: '0.45rem 0.75rem' }}>
              <span className="text-sm"><b className="text-accent-primary">{i.quantity}×</b> {i.itemName}</span>
              {i.pickupDate && <span className="badge">Sekarang: {formatDate(i.pickupDate)}</span>}
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {hasSchedule && <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => save(true)}>Hapus jadwal</button>}
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>Batal</button>
          <button type="button" className="btn btn-primary flex-1" disabled={!date || saving} onClick={() => save(false)}>
            <LuCalendarClock /> Simpan jadwal
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
