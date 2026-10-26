// Lama barang di gudang (hari) sebelum dianggap perlu segera diambil sales.
export const WAREHOUSE_ALERT_DAYS = 14;

export const CONDITIONS = [
  { id: 'kedaluwarsa', label: 'Kedaluwarsa', tone: 'danger' },
  { id: 'rusak', label: 'Rusak', tone: 'warning' },
  { id: 'tidak_layak', label: 'Tidak layak jual', tone: 'info' },
];

export const conditionOf = (id) => CONDITIONS.find(c => c.id === id) || CONDITIONS[0];

export const daysSince = (iso) => {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
};

export const isAged = (r) => r.status === 'menunggu' && daysSince(r.createdAt) >= WAREHOUSE_ALERT_DAYS;

// Tanggal lokal hari ini (YYYY-MM-DD), sama formatnya dengan input type="date".
export const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Terlambat = masih menunggu, punya tanggal janji ambil, dan tanggal itu sudah lewat.
export const isLate = (r) => r.status === 'menunggu' && !!r.pickupDate && r.pickupDate < todayStr();

export const lateDays = (r) => {
  if (!isLate(r)) return 0;
  const a = new Date(`${todayStr()}T00:00:00`).getTime();
  const b = new Date(`${r.pickupDate}T00:00:00`).getTime();
  return Math.max(1, Math.round((a - b) / 86400000));
};

export const isScheduled = (r) => r.status === 'menunggu' && !!r.pickupDate && !isLate(r);

// Daftar peringatan: terlambat lebih dulu (paling lama terlewat di atas), lalu yang lama di gudang.
export const getAlerts = (returns) => {
  const late = returns.filter(isLate).sort((a, b) => lateDays(b) - lateDays(a)).map(r => ({ ...r, alertKind: 'late' }));
  const aged = returns.filter(r => isAged(r) && !isLate(r)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(r => ({ ...r, alertKind: 'aged' }));
  return [...late, ...aged];
};

export const isStaleDraft = (d) => new Date(d.createdAt).toDateString() !== new Date().toDateString();

const norm = (s) => String(s || '').trim().toLowerCase();

export const PERIODS = [
  { id: 'hari_ini', label: 'Hari ini' },
  { id: '7_hari', label: '7 hari' },
  { id: 'bulan_ini', label: 'Bulan ini' },
  { id: 'bulan_lalu', label: 'Bulan lalu' },
  { id: 'semua', label: 'Semua' },
  { id: 'custom', label: 'Pilih tanggal' },
];

// Mengembalikan [awal, akhir) dalam ms, atau null jika tanpa batas.
export const periodRange = (preset, from, to) => {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const day = 86400000;
  const today = startOfDay(now);
  switch (preset) {
    case 'hari_ini': return [today, today + day];
    case '7_hari': return [today - 6 * day, today + day];
    case 'bulan_ini': return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
    case 'bulan_lalu': return [new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()];
    case 'custom': {
      const s = from ? startOfDay(new Date(`${from}T00:00:00`)) : -Infinity;
      const e = to ? startOfDay(new Date(`${to}T00:00:00`)) + day : Infinity;
      return [s, e];
    }
    default: return null;
  }
};

export const timeAgo =(iso) => {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  return `${Math.floor(hr / 24)} hari lalu`;
};

const itemsArray = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') return items.split(',').map(i => i.trim()).filter(Boolean);
  return [];
};

// Sales yang membawa barang ini (berdasarkan daftar "barang yang dibawa" di data sales).
export const autoAssignIds = (itemName, sales) =>
  sales.filter(s => matchesSalesItems(itemName, itemsArray(s.items))).map(s => s.id);

// Sales yang berhak mengambil barang retur ini.
// - Barang baru menyimpan daftar sales (salesIds), bisa kosong = belum ada sales.
// - Barang lama (tanpa salesIds) dicocokkan otomatis dari daftar barang sales.
// - Sales yang tercatat berjanji mengambil selalu ikut dihitung.
export const ownerIds = (r, sales) => {
  const base = Array.isArray(r.salesIds) ? r.salesIds : autoAssignIds(r.itemName, sales);
  const ids = new Set(base);
  if (r.pickupSalesId) ids.add(r.pickupSalesId);
  return [...ids];
};

export const ownerSales = (r, sales) => {
  const ids = ownerIds(r, sales);
  return ids.map(id => sales.find(s => s.id === id)).filter(Boolean);
};

// Barang dianggap sama jika nama, kondisi, dan tanggal kedaluwarsa sama.
export const sameReturnItem = (a, b) =>
  norm(a.itemName) === norm(b.itemName) &&
  (a.condition || 'kedaluwarsa') === (b.condition || 'kedaluwarsa') &&
  String(a.expiredDate || '') === String(b.expiredDate || '');

export const whoLabel = (r) => r.createdByName || (r.createdBy ? String(r.createdBy).split('@')[0] : 'karyawan');

// Apakah barang retur termasuk barang yang dibawa sales ini?
export const matchesSalesItems = (itemName, salesItems = []) => {
  const n = norm(itemName);
  if (!n) return false;
  return salesItems.some(si => {
    const s = norm(si);
    return s === n || s.includes(n) || n.includes(s);
  });
};

export const formatDate = (iso, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', options);
};

export const formatDateTime = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '-'
    : `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
};
