import { useMemo, useRef, useState } from 'react';
import { LuX, LuPlus, LuSearch, LuCalendarX, LuPackageX, LuBan, LuTriangleAlert, LuInfo, LuTrash2, LuChevronDown, LuWarehouse, LuSave } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { Stepper } from '../ui';
import { addDraft, updateDraft, deleteDraft, restoreDraft, commitDrafts } from '../../services/dbService';
import AssigneePicker from './AssigneePicker';
import { CONDITIONS, conditionOf, sameReturnItem, timeAgo, whoLabel, formatDate, isStaleDraft, todayStr, autoAssignIds, ownerSales } from '../../utils/returns';

const COND_ICON = { kedaluwarsa: <LuCalendarX />, rusak: <LuPackageX />, tidak_layak: <LuBan /> };

const RecordReturnModal = ({ catalog, frequent, drafts, waiting, sales, onClose, onCommitted }) => {
  const { profile, user } = useAuth();
  const { confirm, toast } = useFeedback();
  const by = { name: profile?.name || null, email: user?.email || null };

  const [name, setName] = useState('');
  const [picked, setPicked] = useState(false);
  const [qty, setQty] = useState(1);
  const [condition, setCondition] = useState('kedaluwarsa');
  const [showMore, setShowMore] = useState(false);
  const [expiredDate, setExpiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [assignIds, setAssignIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const query = name.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query || picked) return [];
    return catalog.filter(c => c.toLowerCase().includes(query)).slice(0, 6);
  }, [catalog, query, picked]);

  const candidate = { itemName: name.trim(), condition, expiredDate };
  const draftDup = picked ? drafts.find(d => sameReturnItem(d, candidate)) : null;
  const waitDup = picked ? waiting.filter(w => sameReturnItem(w, candidate)) : [];
  const waitDupQty = waitDup.reduce((n, w) => n + (Number(w.quantity) || 0), 0);

  // Begitu barang dipilih, sales yang membawa barang itu otomatis terpilih sebagai penerima.
  const autoIds = useMemo(() => (picked ? autoAssignIds(name.trim(), sales) : []), [picked, name, sales]);

  const pick = (value) => {
    setName(value);
    setPicked(true);
    setAssignIds(autoAssignIds(value.trim(), sales));
  };

  const resetForm = () => {
    setName('');
    setPicked(false);
    setQty(1);
    setExpiredDate('');
    setNotes('');
    setPickupDate('');
    setAssignIds([]);
    setShowMore(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const add = async (merge) => {
    const amount = parseInt(qty) || 1;
    setBusy(true);
    try {
      if (merge && draftDup) {
        await updateDraft(draftDup.id, { quantity: (Number(draftDup.quantity) || 0) + amount }, by);
        toast.success(`Jumlah ${draftDup.itemName} ditambah menjadi ${(Number(draftDup.quantity) || 0) + amount}`);
      } else {
        await addDraft({ itemName: name.trim(), quantity: amount, expiredDate, condition, notes, pickupDate, salesIds: assignIds }, by);
        toast.success(`${amount}× ${name.trim()} masuk draf`);
      }
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan ke draf. Periksa koneksi internet.');
    } finally {
      setBusy(false);
    }
  };

  const changeDraftQty = async (d, value) => {
    const n = parseInt(value);
    if (!(n >= 1)) return;
    try {
      await updateDraft(d.id, { quantity: n }, by);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengubah jumlah');
    }
  };

  const removeDraft = async (d) => {
    try {
      await deleteDraft(d.id);
      toast.info(`${d.itemName} dihapus dari draf`, {
        action: { label: 'Urungkan', onClick: () => restoreDraft(d).catch(() => toast.error('Gagal mengurungkan')) },
      });
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus dari draf');
    }
  };

  const clearAll = async () => {
    const ok = await confirm({
      tone: 'danger',
      title: 'Kosongkan seluruh draf?',
      message: `${drafts.length} barang di draf akan dihapus. Draf ini dilihat oleh semua karyawan.`,
      confirmText: 'Ya, kosongkan',
    });
    if (!ok) return;
    try {
      await Promise.all(drafts.map(d => deleteDraft(d.id)));
      toast.info('Draf dikosongkan');
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengosongkan draf');
    }
  };

  const totalQty = drafts.reduce((n, d) => n + (Number(d.quantity) || 0), 0);

  const commit = async () => {
    if (drafts.length === 0) return;
    const ok = await confirm({
      tone: 'primary',
      title: `Simpan ${drafts.length} barang ke gudang?`,
      message: `Total ${totalQty} pcs akan masuk gudang dan otomatis muncul di data sales penerimanya sebagai Menunggu diambil.`,
      details: (
        <ul style={{ listStyle: 'none', display: 'grid', gap: 4 }}>
          {drafts.map(d => {
            const o = ownerSales(d, sales);
            return <li key={d.id}><b>{d.quantity}×</b> {d.itemName} <span className="text-muted">· {conditionOf(d.condition).label} · {o.length ? `untuk ${o.map(s => s.name).join(', ')}` : 'belum ada sales'}</span></li>;
          })}
        </ul>
      ),
      confirmText: 'Ya, simpan',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await commitDrafts(drafts, by);
      toast.success(`${drafts.length} barang tersimpan di gudang`);
      onCommitted?.();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan. Draf Anda masih aman, coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDownName = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!picked && name.trim()) pick(suggestions[0] || name.trim());
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 600 }} role="dialog" aria-modal="true" aria-label="Catat barang retur">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3>Catat Barang Retur</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><LuX /></button>
        </div>
        <p className="text-secondary text-sm" style={{ marginBottom: '1.25rem' }}>
          Isi tiga langkah di bawah, lalu tekan <b>Tambah ke draf</b>. Draf tersimpan otomatis, jadi boleh ditutup dan dilanjutkan nanti.
        </p>

        {drafts.some(isStaleDraft) && (
          <div className="callout callout-warning" style={{ marginBottom: '1.25rem' }}>
            <LuTriangleAlert />
            <div className="callout-body">
              <b>Ada draf dari hari sebelumnya</b>
              <small>Periksa daftar di bawah. Barang yang sudah tidak relevan bisa dihapus sebelum disimpan ke gudang.</small>
            </div>
          </div>
        )}

        {/* Langkah 1 */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="step-title"><span className="step-num">1</span> Barang apa?</div>
          {picked ? (
            <div className="picked-item">
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{name}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPicked(false); setTimeout(() => inputRef.current?.focus(), 50); }}>Ganti</button>
            </div>
          ) : (
            <>
              <div className="input-icon">
                <LuSearch />
                <input ref={inputRef} className="form-control field-big" placeholder="Ketik nama barang…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKeyDownName} maxLength={80} autoFocus autoComplete="off" />
              </div>
              {suggestions.length > 0 && (
                <div className="suggest-list">
                  {suggestions.map(s => (
                    <button key={s} type="button" className="suggest-item" onClick={() => pick(s)}>{s}</button>
                  ))}
                  {!suggestions.some(s => s.toLowerCase() === query) && (
                    <button type="button" className="suggest-item" onClick={() => pick(name.trim())}>
                      <span>Pakai nama “{name.trim()}”</span><small>barang baru</small>
                    </button>
                  )}
                </div>
              )}
              {!query && frequent.length > 0 && (
                <div style={{ marginTop: '0.7rem' }}>
                  <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Sering dicatat — ketuk untuk memilih</div>
                  <div className="quick-chips">
                    {frequent.map(f => <button key={f} type="button" className="quick-chip" onClick={() => pick(f)}>{f}</button>)}
                  </div>
                </div>
              )}
              {query && suggestions.length === 0 && (
                <button type="button" className="btn btn-secondary w-full" style={{ marginTop: '0.5rem' }} onClick={() => pick(name.trim())}>Pakai nama “{name.trim()}”</button>
              )}
            </>
          )}
        </div>

        {/* Langkah 2 */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="step-title"><span className="step-num">2</span> Berapa banyak?</div>
          <div className="flex items-center gap-4 flex-wrap">
            <Stepper value={qty} onChange={setQty} />
            <div className="quick-chips">
              {[5, 10, 20, 50].map(n => (
                <button key={n} type="button" className="quick-chip" onClick={() => setQty((parseInt(qty) || 0) + n)}>+{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Langkah 3 */}
        <div style={{ marginBottom: '1rem' }}>
          <div className="step-title"><span className="step-num">3</span> Kondisinya?</div>
          <div className="choice-grid">
            {CONDITIONS.map(c => (
              <button key={c.id} type="button" className={`choice tone-${c.tone} ${condition === c.id ? 'selected' : ''}`} onClick={() => setCondition(c.id)} aria-pressed={condition === c.id}>
                {COND_ICON[c.id]}
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {picked && (
          <div className="animate-fade-in" style={{ marginBottom: '1rem' }}>
            <div className="step-title"><span className="step-num">4</span> Masuk ke data sales mana?</div>
            <AssigneePicker sales={sales} value={assignIds} onChange={setAssignIds} autoIds={autoIds} />
          </div>
        )}

        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMore(s => !s)} style={{ marginBottom: showMore ? '0.75rem' : '1rem' }}>
          <LuChevronDown style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} /> Kedaluwarsa, janji ambil &amp; catatan (opsional)
        </button>
        {showMore && (
          <div className="flex gap-3 flex-wrap animate-fade-in" style={{ marginBottom: '1rem' }}>
            <div className="form-group flex-1" style={{ minWidth: 160, marginBottom: 0 }}>
              <label className="form-label">Tanggal kedaluwarsa</label>
              <input type="date" className="form-control" value={expiredDate} onChange={(e) => setExpiredDate(e.target.value)} />
            </div>
            <div className="form-group flex-1" style={{ minWidth: 160, marginBottom: 0 }}>
              <label className="form-label">Janji diambil tanggal</label>
              <input type="date" className="form-control" value={pickupDate} min={todayStr()} onChange={(e) => setPickupDate(e.target.value)} />
            </div>
            <div className="form-group flex-1" style={{ minWidth: 160, marginBottom: 0 }}>
              <label className="form-label">Catatan</label>
              <input type="text" className="form-control" placeholder="Mis. rak B, dus penyok" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={100} />
            </div>
          </div>
        )}

        {/* Peringatan dobel */}
        {draftDup && (
          <div className="callout callout-warning" style={{ marginBottom: '0.75rem' }}>
            <LuTriangleAlert />
            <div className="callout-body">
              <b>Sudah ada di draf: {draftDup.quantity}× {draftDup.itemName}</b>
              <small>Dicatat {whoLabel(draftDup)}, {timeAgo(draftDup.createdAt)}. Hindari mencatat dua kali.</small>
            </div>
          </div>
        )}
        {waitDup.length > 0 && (
          <div className="callout callout-info" style={{ marginBottom: '0.75rem' }}>
            <LuInfo />
            <div className="callout-body">
              <b>Barang serupa sudah menunggu di gudang ({waitDupQty} pcs)</b>
              <small>Dicatat {timeAgo(waitDup[0].createdAt)}{waitDup[0].expiredDate ? `, ED ${formatDate(waitDup[0].expiredDate)}` : ''}. Pastikan ini bukan barang yang sama.</small>
            </div>
          </div>
        )}

        {draftDup ? (
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-primary btn-lg flex-1" disabled={busy} onClick={() => add(true)}><LuPlus /> Tambahkan {parseInt(qty) || 1} ke jumlah yang ada</button>
            <button type="button" className="btn btn-secondary btn-lg" disabled={busy} onClick={() => add(false)}>Catat terpisah</button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary btn-lg w-full" disabled={!picked || busy} onClick={() => add(false)}>
            <LuPlus /> Tambah ke draf
          </button>
        )}

        {/* Draf */}
        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: '0.75rem' }}>
            <div>
              <div className="font-bold" style={{ fontSize: '0.95rem' }}>Draf saat ini ({drafts.length} barang · {totalQty} pcs)</div>
              <div className="text-xs text-muted flex items-center gap-1" style={{ marginTop: 2 }}><LuSave /> Tersimpan otomatis · terlihat semua karyawan</div>
            </div>
            {drafts.length > 0 && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={clearAll}><LuTrash2 /> Kosongkan</button>}
          </div>

          {drafts.length === 0 ? (
            <div className="text-muted text-sm text-center" style={{ padding: '1rem 0' }}>Belum ada barang di draf.</div>
          ) : (
            <div className="list" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {drafts.map(d => (
                <div key={d.id} className="list-item" style={{ padding: '0.65rem 0.8rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                    <div className="list-item-title" style={{ whiteSpace: 'normal' }}>{d.itemName}</div>
                    <div className="list-item-sub" style={{ whiteSpace: 'normal' }}>
                      <span className={`badge badge-${conditionOf(d.condition).tone}`} style={{ marginRight: 6 }}>{conditionOf(d.condition).label}</span>
                      {(() => { const o = ownerSales(d, sales); return o.length ? `untuk ${o.slice(0, 2).map(s => s.name).join(', ')}${o.length > 2 ? ` +${o.length - 2}` : ''} · ` : 'belum ada sales · '; })()}
                      {d.expiredDate ? `ED ${formatDate(d.expiredDate)} · ` : ''}{d.pickupDate ? `janji ambil ${formatDate(d.pickupDate)} · ` : ''}{whoLabel(d)}, {timeAgo(d.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stepper size="sm" value={d.quantity} onChange={(v) => changeDraftQty(d, v)} />
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => removeDraft(d)} aria-label={`Hapus ${d.itemName}`}><LuTrash2 /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3" style={{ marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>Tutup, lanjut nanti</button>
          <button type="button" className="btn btn-success flex-1" style={{ minHeight: 46 }} disabled={drafts.length === 0 || busy} onClick={commit}>
            <LuWarehouse /> Simpan ke gudang
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordReturnModal;
