// Gaya dan pembuat sel bersama untuk semua laporan Excel.

export const HEADER = {
  fontWeight: 'bold',
  textColor: '#ffffff',
  backgroundColor: '#4f46e5',
  align: 'center',
  alignVertical: 'center',
  wrap: true,
  borderStyle: 'thin',
  borderColor: '#c7d2fe',
  height: 30,
};
export const BODY = { borderStyle: 'thin', borderColor: '#e5e7eb', alignVertical: 'center' };
export const TOTAL = { fontWeight: 'bold', backgroundColor: '#eef2ff', borderStyle: 'thin', borderColor: '#c7d2fe' };
export const SECTION = { fontWeight: 'bold', backgroundColor: '#eef2ff' };

export const text = (v, extra = {}) => ({ value: v == null || v === '' ? '-' : String(v), type: String, ...BODY, ...extra });
export const num = (v, extra = {}) => ({ value: Number(v) || 0, type: Number, format: '#,##0', align: 'center', ...BODY, ...extra });
export const dateCell = (iso, format = 'dd/mm/yyyy', extra = {}) => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return text('-', { align: 'center', ...extra });
  return { value: d, type: Date, format, align: 'center', ...BODY, ...extra };
};
// Tanggal berformat YYYY-MM-DD (dari input type="date").
export const dayCell = (ymd) => {
  if (!ymd) return text('-', { align: 'center' });
  const d = new Date(`${ymd}T00:00:00`);
  return isNaN(d.getTime()) ? text(ymd, { align: 'center' }) : { value: d, type: Date, format: 'dd/mm/yyyy', align: 'center', ...BODY };
};
export const head = (labels) => labels.map(v => ({ value: v, ...HEADER }));

export const stampName = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};
