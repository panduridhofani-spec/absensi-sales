import { TOTAL, SECTION, text, num, dateCell, head, stampName } from './xlsxKit';
import { dateKey } from './attendance';

const ACTIVE = { backgroundColor: '#d1fae5', textColor: '#065f46', fontWeight: 'bold', align: 'center' };
const IDLE = { backgroundColor: '#fee2e2', textColor: '#991b1b', fontWeight: 'bold', align: 'center' };

const dayName = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { weekday: 'long' });
};

// summary: hasil summarizeBySales (sudah terfilter & terurut). log: absensi terfilter (sudah ada salesName/distributor).
export const exportAttendanceXlsx = async ({ summary, log, meta }) => {
  const { default: writeExcelFile } = await import('write-excel-file/browser');

  const active = summary.filter(s => s.visits > 0);
  const idle = summary.filter(s => s.visits === 0);
  const totalVisits = log.length;
  const top = [...active].sort((a, b) => b.visits - a.visits)[0];

  // --- Ringkasan ---
  const kv = (k, v) => [text(k, { fontWeight: 'bold' }), text(v, { columnSpan: 3 }), null, null];
  const info = [
    [{ value: 'LAPORAN KEHADIRAN SALES', fontWeight: 'bold', fontSize: 16, columnSpan: 4, textColor: '#4f46e5' }, null, null, null],
    [{ value: 'SalesTrack', fontStyle: 'italic', textColor: '#6b7280', columnSpan: 4 }, null, null, null],
    [null],
    [{ value: 'Informasi laporan', columnSpan: 4, ...SECTION }, null, null, null],
    kv('Periode', meta.periodLabel),
    ...meta.filters.map(([k, v]) => kv(k, v)),
    kv('Diekspor oleh', meta.exportedBy),
    [text('Waktu ekspor', { fontWeight: 'bold' }), { ...dateCell(new Date().toISOString(), 'dd/mm/yyyy hh:mm'), align: 'left', columnSpan: 3 }, null, null],
    [null],
    [{ value: 'Ringkasan', columnSpan: 4, ...SECTION }, null, null, null],
    head(['Keterangan', 'Jumlah', '', '']),
    [text('Total kunjungan', { fontWeight: 'bold' }), num(totalVisits), text(''), text('')],
    [text('Sales terdaftar (sesuai filter)'), num(summary.length), text(''), text('')],
    [text('Sales yang berkunjung'), num(active.length), text(''), text('')],
    [text('Sales belum berkunjung', { textColor: idle.length ? '#991b1b' : undefined }), num(idle.length), text(''), text('')],
    [text('Rata-rata kunjungan per sales aktif'), { ...num(active.length ? totalVisits / active.length : 0), format: '0.0' }, text(''), text('')],
    [text('Sales teraktif'), text(top ? `${top.name} (${top.visits}x)` : '-', { columnSpan: 3 }), null, null],
  ];

  // --- Rekap per Sales ---
  const salesSheet = [
    head(['No', 'Nama Sales', 'Distributor', 'No WhatsApp', 'Total Kunjungan', 'Hari Aktif', 'Terakhir Datang', 'Status']),
    ...summary.map((s, i) => [
      num(i + 1),
      text(s.name, { fontWeight: 'bold' }),
      text(s.distributor),
      text(s.whatsapp, { format: '@' }),
      num(s.visits),
      num(s.days),
      s.last ? dateCell(s.last, 'dd/mm/yyyy hh:mm') : text('Belum berkunjung', { align: 'center', textColor: '#6b7280' }),
      text(s.visits > 0 ? 'Aktif' : 'Belum berkunjung', s.visits > 0 ? ACTIVE : IDLE),
    ]),
    [
      { value: 'TOTAL', columnSpan: 4, align: 'center', ...TOTAL }, null, null, null,
      { value: summary.reduce((n, s) => n + s.visits, 0), type: Number, format: '#,##0', align: 'center', ...TOTAL },
      { value: summary.reduce((n, s) => n + s.days, 0), type: Number, format: '#,##0', align: 'center', ...TOTAL },
      { value: '', type: String, ...TOTAL },
      { value: '', type: String, ...TOTAL },
    ],
  ];

  // --- Log Kunjungan ---
  const logSheet = [
    head(['No', 'Tanggal', 'Hari', 'Jam Datang', 'Nama Sales', 'Distributor', 'Catatan']),
    ...log.map((a, i) => [
      num(i + 1),
      dateCell(a.timestamp),
      text(dayName(a.timestamp), { align: 'center' }),
      dateCell(a.timestamp, 'hh:mm'),
      text(a.salesName, { fontWeight: 'bold' }),
      text(a.distributor),
      text(a.notes, { wrap: true }),
    ]),
  ];

  // --- Rekap Harian ---
  const byDay = {};
  log.forEach((a) => {
    const k = dateKey(a.timestamp);
    byDay[k] = byDay[k] || { ts: a.timestamp, visits: 0, sales: new Set() };
    byDay[k].visits += 1;
    byDay[k].sales.add(a.salesId);
  });
  const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  const dayRows = days.map(([, v]) => ({ ts: v.ts, visits: v.visits, sales: v.sales.size }));
  const dailySheet = [
    head(['Tanggal', 'Hari', 'Jumlah Kunjungan', 'Jumlah Sales Hadir']),
    ...(dayRows.length
      ? dayRows.map(d => [dateCell(d.ts), text(dayName(d.ts), { align: 'center' }), num(d.visits), num(d.sales)])
      : [[{ value: 'Tidak ada kunjungan pada periode ini', columnSpan: 4, align: 'center', textColor: '#6b7280' }, null, null, null]]),
    ...(dayRows.length ? [[
      { value: 'TOTAL', columnSpan: 2, align: 'center', ...TOTAL }, null,
      { value: dayRows.reduce((n, d) => n + d.visits, 0), type: Number, format: '#,##0', align: 'center', ...TOTAL },
      { value: '', type: String, ...TOTAL },
    ]] : []),
  ];

  await writeExcelFile([
    { data: info, sheet: 'Ringkasan', columns: [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }], showGridLines: false },
    { data: salesSheet, sheet: 'Rekap per Sales', columns: [6, 30, 26, 18, 16, 12, 22, 20].map(width => ({ width })), stickyRowsCount: 1, stickyColumnsCount: 2 },
    { data: logSheet, sheet: 'Log Kunjungan', columns: [6, 14, 12, 12, 30, 26, 40].map(width => ({ width })), stickyRowsCount: 1 },
    { data: dailySheet, sheet: 'Rekap Harian', columns: [16, 14, 18, 20].map(width => ({ width })), stickyRowsCount: 1 },
  ]).toFile(`Absensi_Sales_${meta.fileTag}_${stampName()}.xlsx`);
};
