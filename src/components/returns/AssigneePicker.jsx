import { LuX, LuUserPlus, LuTriangleAlert, LuWand } from 'react-icons/lu';
import SelectField from '../SelectField';
import { salesOptions } from '../../utils/options';

// Memilih sales mana saja yang akan menerima barang retur di data/profilnya.
// Awalnya terisi otomatis dari "barang yang dibawa" tiap sales; bisa dikurangi atau ditambah manual.
const AssigneePicker = ({ sales, value, onChange, autoIds = [], compact = false }) => {
  const selected = value.map(id => sales.find(s => s.id === id)).filter(Boolean);
  const available = sales.filter(s => !value.includes(s.id));
  const isAuto = value.length === autoIds.length && value.every(id => autoIds.includes(id));

  return (
    <div>
      {!compact && (
        <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
          {isAuto && selected.length > 0 ? (
            <span className="flex items-center gap-1"><LuWand /> Otomatis dari barang yang dibawa sales</span>
          ) : 'Diatur manual'}
        </div>
      )}

      {selected.length === 0 ? (
        <div className="callout callout-warning" style={{ marginBottom: '0.6rem' }}>
          <LuTriangleAlert />
          <div className="callout-body">
            <b>Belum ada sales yang membawa barang ini</b>
            <small>Barang tetap tercatat di gudang. Pilih sales di bawah, atau biarkan kosong dan atur nanti.</small>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" style={{ marginBottom: '0.6rem' }}>
          {selected.map(s => (
            <span key={s.id} className="badge badge-primary" style={{ padding: '0.4rem 0.4rem 0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'normal', textAlign: 'left' }}>
              <span>
                {s.name}
                {s.distributor && <span className="text-muted" style={{ fontWeight: 400 }}> · {s.distributor}</span>}
              </span>
              <button type="button" className="icon-btn" style={{ width: 22, height: 22, fontSize: '0.8rem', flexShrink: 0 }} onClick={() => onChange(value.filter(id => id !== s.id))} aria-label={`Hapus ${s.name}`}><LuX /></button>
            </span>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <SelectField
          value=""
          onChange={(id) => id && onChange([...value, id])}
          options={salesOptions(available)}
          placeholder="+ Tambah sales lain"
          title="Tambah sales penerima"
          icon={<LuUserPlus />}
          searchable
        />
      )}
    </div>
  );
};

export default AssigneePicker;
