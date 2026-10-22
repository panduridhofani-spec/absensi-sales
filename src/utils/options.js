// Pembuat daftar pilihan untuk SelectField.

export const salesOptions = (sales, emptyOption) => [
  ...(emptyOption ? [emptyOption] : []),
  ...[...sales]
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map(s => ({ value: s.id, label: s.name, hint: s.distributor || undefined })),
];

// Cocokkan kata kunci dengan nomor HP. Format bebas: 0812-3456, +62 812 3456, 62812... semuanya dianggap sama.
const phoneDigits = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.startsWith('62') ? `0${d.slice(2)}` : d;
};

export const phoneMatches = (phone, query) => {
  const raw = String(query || '').trim();
  // Hanya dianggap pencarian nomor jika isinya angka dan tanda pemisah nomor.
  if (!raw || !/^[\d\s+\-().]+$/.test(raw)) return false;
  const q = raw.replace(/\D/g, '');
  if (!q) return false;
  const target = String(phone || '').replace(/\D/g, '');
  return target.includes(q) || phoneDigits(phone).includes(phoneDigits(raw));
};

// Dari daftar string menjadi pilihan, dengan satu pilihan "semua" di awal.
export const stringOptions = (list, allLabel) => [
  { value: 'all', label: allLabel },
  ...list.map(v => ({ value: v, label: v })),
];
