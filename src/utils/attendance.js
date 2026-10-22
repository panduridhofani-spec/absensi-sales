export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const ATT_PERIODS = [
  { id: 'hari_ini', label: 'Hari ini' },
  { id: 'kemarin', label: 'Kemarin' },
  { id: '7_hari', label: '7 hari' },
  { id: '30_hari', label: '30 hari' },
  { id: 'bulan_ini', label: 'Bulan ini' },
  { id: 'bulan_lalu', label: 'Bulan lalu' },
  { id: 'per_bulan', label: 'Pilih bulan' },
  { id: 'custom', label: 'Rentang tanggal' },
];

// Batas rentang agar satu kali muat tidak terlalu besar.
export const MAX_RANGE_DAYS = 366;

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const fmt = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => d.toLocaleDateString('id-ID', opts);

// Mengembalikan { start, end (eksklusif), label, valid, error }.
export const attendanceRange = ({ period, month, year, from, to }) => {
  const now = new Date();
  const today = startOfDay(now);
  const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const lastDay = (s, e) => add(e, -1);
  let start;
  let end;
  let label;

  switch (period) {
    case 'hari_ini': start = today; end = add(today, 1); label = `Hari ini, ${fmt(today)}`; break;
    case 'kemarin': start = add(today, -1); end = today; label = `Kemarin, ${fmt(start)}`; break;
    case '7_hari': start = add(today, -6); end = add(today, 1); label = '7 hari terakhir'; break;
    case '30_hari': start = add(today, -29); end = add(today, 1); label = '30 hari terakhir'; break;
    case 'bulan_ini': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 1); label = `${MONTHS[start.getMonth()]} ${start.getFullYear()}`; break;
    case 'bulan_lalu': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 1); label = `${MONTHS[start.getMonth()]} ${start.getFullYear()}`; break;
    case 'per_bulan': start = new Date(year, month, 1); end = new Date(year, month + 1, 1); label = `${MONTHS[month]} ${year}`; break;
    case 'custom': {
      if (!from || !to) return { valid: false, error: 'Pilih tanggal awal dan akhir', start: today, end: add(today, 1), label: 'Rentang belum lengkap' };
      start = startOfDay(new Date(`${from}T00:00:00`));
      end = add(startOfDay(new Date(`${to}T00:00:00`)), 1);
      if (end <= start) return { valid: false, error: 'Tanggal akhir harus setelah tanggal awal', start, end: add(start, 1), label: 'Rentang tidak valid' };
      if ((end - start) / DAY > MAX_RANGE_DAYS) return { valid: false, error: `Rentang maksimal ${MAX_RANGE_DAYS} hari`, start, end, label: 'Rentang terlalu panjang' };
      label = start.getTime() === add(end, -1).getTime() ? fmt(start) : `${fmt(start)} – ${fmt(lastDay(start, end))}`;
      break;
    }
    default: start = today; end = add(today, 1); label = 'Hari ini';
  }
  return { valid: true, start, end, label };
};

const p2 = (n) => String(n).padStart(2, '0');
// Tanggal lokal (YYYY-MM-DD) dari sebuah timestamp ISO.
export const dateKey = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

export const fmtDate = (iso, opts) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', opts || { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtTime = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

// Ringkas per sales: total kunjungan, jumlah hari aktif, dan kunjungan terakhir.
export const summarizeBySales = (sales, attendance) => {
  const map = {};
  sales.forEach(s => { map[s.id] = { id: s.id, name: s.name, distributor: s.distributor || '-', whatsapp: s.whatsapp || '', visits: 0, days: new Set(), last: null, deleted: false }; });
  attendance.forEach(a => {
    if (!map[a.salesId]) map[a.salesId] = { id: a.salesId, name: 'Sales Dihapus', distributor: '-', whatsapp: '', visits: 0, days: new Set(), last: null, deleted: true };
    const m = map[a.salesId];
    m.visits += 1;
    m.days.add(dateKey(a.timestamp));
    if (!m.last || new Date(a.timestamp) > new Date(m.last)) m.last = a.timestamp;
  });
  return Object.values(map).map(m => ({ ...m, days: m.days.size }));
};
