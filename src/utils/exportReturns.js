import { conditionOf, daysSince, whoLabel, isLate, lateDays } from './returns';

import { BODY, TOTAL, text, num, dateCell, dayCell as edCell, head, stampName } from './xlsxKit';

const STATUS_STYLE = {
  diambil: { backgroundColor: '#d1fae5', textColor: '#065f46', fontWeight: 'bold', align: 'center' },
  menunggu: { backgroundColor: '#fef3c7', textColor: '#92400e', fontWeight: 'bold', align: 'center' },
  lama: { backgroundColor: '#fee2e2', textColor: '#991b1b', fontWeight: 'bold', align: 'center' },
};

export const exportReturnsXlsx = async ({ rows, meta }) => {
  const { default: writeExcelFile } = await import('write-excel-file/browser');

  const totalQty = rows.reduce((n, r) => n + (Number(r.quantity) || 0), 0);
  const waiting = rows.filter(r => r.status === 'menunggu');
  const taken = rows.filter(r => r.status === 'diambil');
  const qtyOf = (list) => list.reduce((n, r) => n + (Number(r.quantity) || 0), 0);

  // --- Sheet 1: Ringkasan ---
  const info = [
    [{ value: 'LAPORAN RETUR BARANG', fontWeight: 'bold', fontSize: 16, columnSpan: 4, textColor: '#4f46e5' }, null, null, null],
    [{ value: 'SalesTrack', fontStyle: 'italic', textColor: '#6b7280', columnSpan: 4 }, null, null, null],
    [null],
    [{ value: 'Informasi laporan', fontWeight: 'bold', backgroundColor: '#eef2ff', columnSpan: 4 }, null, null, null],
    [text('Tab / status', { fontWeight: 'bold' }), text(meta.tabLabel, { columnSpan: 3 }), null, null],
    [text('Periode', { fontWeight: 'bold' }), text(meta.periodLabel, { columnSpan: 3 }), null, null],
    ...meta.filters.map(([k, v]) => [text(k, { fontWeight: 'bold' }), text(v, { columnSpan: 3 }), null, null]),
    [text('Diekspor oleh', { fontWeight: 'bold' }), text(meta.exportedBy, { columnSpan: 3 }), null, null],
    [text('Waktu ekspor', { fontWeight: 'bold' }), { ...dateCell(new Date().toISOString(), 'dd/mm/yyyy hh:mm'), align: 'left', columnSpan: 3 }, null, null],
    [null],
    [{ value: 'Ringkasan jumlah', fontWeight: 'bold', backgroundColor: '#eef2ff', columnSpan: 4 }, null, null, null],
    head(['Keterangan', 'Baris data', 'Total pcs', '']),
    [text('Seluruh data pada laporan ini', { fontWeight: 'bold' }), num(rows.length), num(totalQty), text('')],
    [text('Menunggu diambil'), num(waiting.length), num(qtyOf(waiting)), text('')],
    [text('   di antaranya terlambat (janji terlewat)', { textColor: '#991b1b' }), num(waiting.filter(isLate).length), num(qtyOf(waiting.filter(isLate))), text('')],
    [text('   di antaranya belum ada sales penerima', { textColor: '#92400e' }), num(waiting.filter(r => !r.ownerNames?.length).length), num(qtyOf(waiting.filter(r => !r.ownerNames?.length))), text('')],
    [text('Sudah diambil sales'), num(taken.length), num(qtyOf(taken)), text('')],
    [null],
    [{ value: 'Per kondisi barang', fontWeight: 'bold', backgroundColor: '#eef2ff', columnSpan: 4 }, null, null, null],
    head(['Kondisi', 'Baris data', 'Total pcs', '']),
    ...['kedaluwarsa', 'rusak', 'tidak_layak'].map((c) => {
      const list = rows.filter(r => (r.condition || 'kedaluwarsa') === c);
      return [text(conditionOf(c).label), num(list.length), num(qtyOf(list)), text('')];
    }),
  ];

  // --- Sheet 2: Rincian ---
  const detailHead = head([
    'No', 'Nama Barang', 'Jumlah', 'Kondisi', 'Untuk Sales (Penerima)', 'Tgl Kedaluwarsa', 'Status',
    'Tanggal Dicatat', 'Jam Dicatat', 'Dicatat Oleh', 'Lama di Gudang (hari)',
    'Tgl Janji Ambil', 'Janji Sales', 'Terlambat (hari)',
    'Sales Pengambil', 'Distributor', 'Tanggal Diambil', 'Jam Diambil', 'Diserahkan Oleh',
    'Catatan Barang', 'Catatan Serah Terima', 'Kode Batch',
  ]);
  const detailRows = rows.map((r, i) => {
    const isTaken = r.status === 'diambil';
    const aged = !isTaken && daysSince(r.createdAt) >= 14;
    const days = isTaken
      ? Math.max(0, Math.floor((new Date(r.takenAt) - new Date(r.createdAt)) / 86400000))
      : daysSince(r.createdAt);
    const late = isLate(r);
    const statusKey = isTaken ? 'diambil' : late ? 'lama' : aged ? 'lama' : 'menunggu';
    const statusLabel = isTaken ? 'Diambil' : late ? 'Terlambat' : aged ? 'Lama di gudang' : 'Menunggu';
    return [
      num(i + 1),
      text(r.itemName, { wrap: true, fontWeight: 'bold' }),
      num(r.quantity),
      text(conditionOf(r.condition).label, { align: 'center' }),
      r.ownerNames?.length
        ? text(r.ownerNames.join(', '), { wrap: true })
        : text('Belum ada sales', { textColor: '#92400e', backgroundColor: '#fef3c7' }),
      edCell(r.expiredDate),
      text(statusLabel, { ...BODY, ...STATUS_STYLE[statusKey] }),
      dateCell(r.createdAt),
      dateCell(r.createdAt, 'hh:mm'),
      text(whoLabel(r)),
      num(Number.isFinite(days) ? days : 0),
      edCell(r.pickupDate),
      text(r.pickupSalesName),
      late ? num(lateDays(r), { textColor: '#991b1b', fontWeight: 'bold' }) : text('-', { align: 'center' }),
      text(isTaken ? r.salesName : '-',{ fontWeight: isTaken ? 'bold' : undefined }),
      text(isTaken ? r.distributor : '-'),
      isTaken ? dateCell(r.takenAt) : text('-', { align: 'center' }),
      isTaken ? dateCell(r.takenAt, 'hh:mm') : text('-', { align: 'center' }),
      text(isTaken && r.takenBy ? String(r.takenBy).split('@')[0] : '-'),
      text(r.notes, { wrap: true }),
      text(r.takenNote, { wrap: true }),
      text(r.batchId, { align: 'center' }),
    ];
  });
  const totalRow = [
    { value: 'TOTAL', columnSpan: 2, align: 'center', ...TOTAL }, null,
    { value: totalQty, type: Number, format: '#,##0', align: 'center', ...TOTAL },
    ...Array.from({ length: 19 }, () => ({ value: '', type: String, ...TOTAL })),
  ];
  const detail = [detailHead, ...detailRows, totalRow];
  const detailCols = [6, 34, 9, 16, 26, 15, 16, 14, 11, 18, 13, 15, 20, 12, 22, 20, 14, 11, 16, 28, 28, 18].map(width => ({ width }));

  // --- Sheet 3: Rekap per sales ---
  const bySales = {};
  taken.forEach((r) => {
    const key = r.salesId || r.salesName || '-';
    bySales[key] = bySales[key] || { name: r.salesName || '-', distributor: r.distributor || '-', rows: 0, qty: 0, last: null };
    bySales[key].rows += 1;
    bySales[key].qty += Number(r.quantity) || 0;
    if (!bySales[key].last || new Date(r.takenAt) > new Date(bySales[key].last)) bySales[key].last = r.takenAt;
  });
  const salesList = Object.values(bySales).sort((a, b) => b.qty - a.qty);
  const salesSheet = [
    head(['No', 'Nama Sales', 'Distributor', 'Jumlah Jenis Barang', 'Total Pcs Diambil', 'Pengambilan Terakhir']),
    ...(salesList.length
      ? salesList.map((s, i) => [num(i + 1), text(s.name, { fontWeight: 'bold' }), text(s.distributor), num(s.rows), num(s.qty), dateCell(s.last, 'dd/mm/yyyy hh:mm')])
      : [[{ value: 'Tidak ada barang yang diambil pada laporan ini', columnSpan: 6, align: 'center', textColor: '#6b7280' }, null, null, null, null, null]]),
    ...(salesList.length ? [[
      { value: 'TOTAL', columnSpan: 3, align: 'center', ...TOTAL }, null, null,
      { value: salesList.reduce((n, s) => n + s.rows, 0), type: Number, align: 'center', ...TOTAL },
      { value: salesList.reduce((n, s) => n + s.qty, 0), type: Number, format: '#,##0', align: 'center', ...TOTAL },
      { value: '', type: String, ...TOTAL },
    ]] : []),
  ];

  // --- Sheet 4: Rekap per barang ---
  const byItem = {};
  rows.forEach((r) => {
    const key = String(r.itemName || '').trim().toLowerCase();
    byItem[key] = byItem[key] || { name: r.itemName, rows: 0, qty: 0, wait: 0, taken: 0 };
    const q = Number(r.quantity) || 0;
    byItem[key].rows += 1;
    byItem[key].qty += q;
    if (r.status === 'diambil') byItem[key].taken += q; else byItem[key].wait += q;
  });
  const itemList = Object.values(byItem).sort((a, b) => b.qty - a.qty);
  const itemSheet = [
    head(['No', 'Nama Barang', 'Jumlah Catatan', 'Total Pcs', 'Masih Menunggu (pcs)', 'Sudah Diambil (pcs)']),
    ...itemList.map((it, i) => [num(i + 1), text(it.name, { fontWeight: 'bold', wrap: true }), num(it.rows), num(it.qty), num(it.wait), num(it.taken)]),
    [
      { value: 'TOTAL', columnSpan: 2, align: 'center', ...TOTAL }, null,
      { value: itemList.reduce((n, s) => n + s.rows, 0), type: Number, align: 'center', ...TOTAL },
      { value: itemList.reduce((n, s) => n + s.qty, 0), type: Number, format: '#,##0', align: 'center', ...TOTAL },
      { value: itemList.reduce((n, s) => n + s.wait, 0), type: Number, format: '#,##0', align: 'center', ...TOTAL },
      { value: itemList.reduce((n, s) => n + s.taken, 0), type: Number, format: '#,##0', align: 'center', ...TOTAL },
    ],
  ];

  await writeExcelFile([
    { data: info, sheet: 'Ringkasan', columns: [{ width: 30 }, { width: 22 }, { width: 18 }, { width: 18 }], showGridLines: false },
    { data: detail, sheet: 'Rincian Retur', columns: detailCols, stickyRowsCount: 1, stickyColumnsCount: 2 },
    { data: salesSheet, sheet: 'Rekap per Sales', columns: [6, 28, 24, 20, 18, 24].map(width => ({ width })), stickyRowsCount: 1 },
    { data: itemSheet, sheet: 'Rekap per Barang', columns: [6, 38, 16, 14, 22, 20].map(width => ({ width })), stickyRowsCount: 1 },
  ]).toFile(`Retur_Barang_${meta.fileTag}_${stampName()}.xlsx`);
};
