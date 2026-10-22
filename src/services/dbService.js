import { db, auth } from '../firebase';
import { collection, getDocs, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, writeBatch, runTransaction } from 'firebase/firestore';

const USE_LOCAL_STORAGE = import.meta.env.VITE_FIREBASE_API_KEY === undefined || import.meta.env.VITE_FIREBASE_API_KEY === '';

// Cleaned up auto-seed logic

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- API Methods ---

export const getSalesList = async () => {
  if (USE_LOCAL_STORAGE) {
    return JSON.parse(localStorage.getItem('sales_data'));
  } else {
    const salesCol = collection(db, 'sales');
    const salesSnapshot = await getDocs(salesCol);
    let docs = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return docs;
  }
};

export const getSalesById = async (id) => {
  if (USE_LOCAL_STORAGE) {
    const sales = JSON.parse(localStorage.getItem('sales_data'));
    return sales.find(s => s.id === id);
  } else {
    const docRef = doc(db, 'sales', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  }
};

export const addSales = async (salesData) => {
  if (USE_LOCAL_STORAGE) {
    const sales = JSON.parse(localStorage.getItem('sales_data'));
    const newSales = { id: generateId(), ...salesData };
    sales.push(newSales);
    localStorage.setItem('sales_data', JSON.stringify(sales));
    return newSales.id;
  } else {
    const docRef = await addDoc(collection(db, 'sales'), salesData);
    return docRef.id;
  }
};

export const updateSales = async (id, salesData) => {
  if (USE_LOCAL_STORAGE) {
    const sales = JSON.parse(localStorage.getItem('sales_data'));
    const index = sales.findIndex(s => s.id === id);
    if (index !== -1) {
      sales[index] = { ...sales[index], ...salesData };
      localStorage.setItem('sales_data', JSON.stringify(sales));
    }
  } else {
    const docRef = doc(db, 'sales', id);
    await updateDoc(docRef, salesData);
  }
};

export const deleteSales = async (id) => {
  if (USE_LOCAL_STORAGE) {
    let sales = JSON.parse(localStorage.getItem('sales_data'));
    sales = sales.filter(s => s.id !== id);
    localStorage.setItem('sales_data', JSON.stringify(sales));
    
    // Also delete attendance for this sales
    let attendance = JSON.parse(localStorage.getItem('attendance_data'));
    attendance = attendance.filter(a => a.salesId !== id);
    localStorage.setItem('attendance_data', JSON.stringify(attendance));
  } else {
    await deleteDoc(doc(db, 'sales', id));
    // NOTE: In a real Firebase setup, you might want a Cloud Function to clean up attendance,
    // or manually query and delete them here.
  }
};

export const recordAttendance = async (salesId, dateStr, notes = '') => {
  if (USE_LOCAL_STORAGE) {
    const attendance = JSON.parse(localStorage.getItem('attendance_data'));
    const newRecord = {
      id: generateId(),
      salesId,
      date: dateStr, // e.g. "2023-10-04"
      timestamp: new Date().toISOString(),
      notes
    };
    attendance.push(newRecord);
    localStorage.setItem('attendance_data', JSON.stringify(attendance));
    return newRecord;
  } else {
    const attendanceData = {
      salesId,
      date: dateStr,
      timestamp: new Date().toISOString(),
      notes
    };
    await addDoc(collection(db, 'attendance'), attendanceData);
  }
};

export const updateAttendance = async (id, attendanceData) => {
  if (USE_LOCAL_STORAGE) {
    const attendance = JSON.parse(localStorage.getItem('attendance_data'));
    const index = attendance.findIndex(a => a.id === id);
    if (index !== -1) {
      attendance[index] = { ...attendance[index], ...attendanceData };
      localStorage.setItem('attendance_data', JSON.stringify(attendance));
    }
  } else {
    const docRef = doc(db, 'attendance', id);
    await updateDoc(docRef, attendanceData);
  }
};

export const deleteAttendance = async (id) => {
  if (USE_LOCAL_STORAGE) {
    let attendance = JSON.parse(localStorage.getItem('attendance_data'));
    attendance = attendance.filter(a => a.id !== id);
    localStorage.setItem('attendance_data', JSON.stringify(attendance));
  } else {
    await deleteDoc(doc(db, 'attendance', id));
  }
};

export const getAttendanceForSales = async (salesId, limitDays = 30) => {
  if (USE_LOCAL_STORAGE) {
    let attendance = JSON.parse(localStorage.getItem('attendance_data'));
    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      attendance = attendance.filter(a => {
        const ts = a.timestamp || a.checkInTime;
        return ts >= cutoff.toISOString();
      });
    }
    return attendance
      .filter(a => a.salesId === salesId)
      .map(a => ({ ...a, timestamp: a.timestamp || a.checkInTime }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else {
    let q = query(
      collection(db, 'attendance'),
      where('salesId', '==', salesId)
    );
    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, timestamp: data.timestamp || data.checkInTime };
    });

    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      const cutoffStr = cutoff.toISOString();
      records = records.filter(r => r.timestamp >= cutoffStr);
    }

    return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
};

export const getAllAttendance = async (limitDays = 30) => {
  if (USE_LOCAL_STORAGE) {
    let attendance = JSON.parse(localStorage.getItem('attendance_data'));
    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      attendance = attendance.filter(a => {
        const ts = a.timestamp || a.checkInTime;
        return ts >= cutoff.toISOString();
      });
    }
    return attendance
      .map(a => ({ ...a, timestamp: a.timestamp || a.checkInTime }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else {
    let q;
    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      q = query(collection(db, 'attendance'), where('timestamp', '>=', cutoff.toISOString()));
    } else {
      q = query(collection(db, 'attendance'));
    }
    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, timestamp: data.timestamp || data.checkInTime };
    });
    
    return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
};

// Hanya mengambil absensi dalam rentang waktu [startISO, endISO) — tidak memuat seluruh riwayat.
export const getAttendanceRange = async (startISO, endISO) => {
  const normalize = (a) => ({ ...a, timestamp: a.timestamp || a.checkInTime });
  const byNewest = (a, b) => new Date(b.timestamp) - new Date(a.timestamp);
  if (USE_LOCAL_STORAGE) {
    return readLocalList('attendance_data')
      .map(normalize)
      .filter(a => a.timestamp >= startISO && a.timestamp < endISO)
      .sort(byNewest);
  }
  const q = query(collection(db, 'attendance'), where('timestamp', '>=', startISO), where('timestamp', '<', endISO));
  const snap = await getDocs(q);
  return snap.docs.map(d => normalize({ id: d.id, ...d.data() })).sort(byNewest);
};

const readLocalList = (key) => JSON.parse(localStorage.getItem(key) || '[]');

// --- Transactions API ---

export const addTransaction = async (transactionData) => {
  const receiptId = `TRX-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  if (USE_LOCAL_STORAGE) {
    const transactions = JSON.parse(localStorage.getItem('transactions_data'));
    const newRecord = {
      id: generateId(),
      receiptId,
      timestamp: new Date().toISOString(),
      ...transactionData
    };
    transactions.push(newRecord);
    localStorage.setItem('transactions_data', JSON.stringify(transactions));
    return newRecord.id;
  } else {
    const newRecord = {
      receiptId,
      timestamp: new Date().toISOString(),
      ...transactionData
    };
    const docRef = await addDoc(collection(db, 'transactions'), newRecord);
    return docRef.id;
  }
};

export const updateTransaction = async (id, transactionData) => {
  if (USE_LOCAL_STORAGE) {
    const transactions = JSON.parse(localStorage.getItem('transactions_data'));
    const index = transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...transactionData };
      localStorage.setItem('transactions_data', JSON.stringify(transactions));
    }
  } else {
    const docRef = doc(db, 'transactions', id);
    await updateDoc(docRef, transactionData);
  }
};

export const deleteTransaction = async (id) => {
  if (USE_LOCAL_STORAGE) {
    let transactions = JSON.parse(localStorage.getItem('transactions_data'));
    transactions = transactions.filter(t => t.id !== id);
    localStorage.setItem('transactions_data', JSON.stringify(transactions));
  } else {
    await deleteDoc(doc(db, 'transactions', id));
  }
};

export const getTransactionsForSales = async (salesId, limitDays = 60) => {
  if (USE_LOCAL_STORAGE) {
    let transactions = JSON.parse(localStorage.getItem('transactions_data'));
    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      transactions = transactions.filter(t => t.timestamp >= cutoff.toISOString());
    }
    return transactions
      .filter(t => t.salesId === salesId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else {
    let q = query(
      collection(db, 'transactions'),
      where('salesId', '==', salesId)
    );
    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      const cutoffStr = cutoff.toISOString();
      records = records.filter(r => r.timestamp >= cutoffStr);
    }

    return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
};

export const getAllTransactions = async (limitDays = 60) => {
  if (USE_LOCAL_STORAGE) {
    let transactions = JSON.parse(localStorage.getItem('transactions_data'));
    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      transactions = transactions.filter(t => t.timestamp >= cutoff.toISOString());
    }
    return transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else {
    let q;
    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      q = query(collection(db, 'transactions'), where('timestamp', '>=', cutoff.toISOString()));
    } else {
      q = query(collection(db, 'transactions'));
    }
    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
};

// --- Products (Master Barang) API ---

export const getProducts = async () => {
  if (USE_LOCAL_STORAGE) {
    const data = localStorage.getItem('products_data');
    return data ? JSON.parse(data) : [];
  } else {
    const q = query(collection(db, 'products_data'), orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

export const addProduct = async (productData) => {
  const newProduct = { ...productData, createdAt: new Date().toISOString() };
  if (USE_LOCAL_STORAGE) {
    const data = JSON.parse(localStorage.getItem('products_data') || '[]');
    newProduct.id = generateId();
    data.push(newProduct);
    localStorage.setItem('products_data', JSON.stringify(data));
    return newProduct.id;
  } else {
    const docRef = await addDoc(collection(db, 'products_data'), newProduct);
    return docRef.id;
  }
};

export const updateProduct = async (id, productData) => {
  if (USE_LOCAL_STORAGE) {
    const data = JSON.parse(localStorage.getItem('products_data') || '[]');
    const index = data.findIndex(p => p.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...productData, updatedAt: new Date().toISOString() };
      localStorage.setItem('products_data', JSON.stringify(data));
      return true;
    }
    return false;
  } else {
    const docRef = doc(db, 'products_data', id);
    await updateDoc(docRef, { ...productData, updatedAt: new Date().toISOString() });
    return true;
  }
};

export const deleteProduct = async (id) => {
  if (USE_LOCAL_STORAGE) {
    let data = JSON.parse(localStorage.getItem('products_data') || '[]');
    data = data.filter(p => p.id !== id);
    localStorage.setItem('products_data', JSON.stringify(data));
    return true;
  } else {
    await deleteDoc(doc(db, 'products_data', id));
    return true;
  }
};


// --- Retur Barang (global) API ---
// Satu dokumen = satu baris barang. Status: 'menunggu' (di gudang) -> 'diambil' (oleh sales).

const readLocal = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const writeLocal = (key, data) => localStorage.setItem(key, JSON.stringify(data));

export const getReturns = async () => {
  if (USE_LOCAL_STORAGE) {
    return readLocal('returns_data').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const snap = await getDocs(collection(db, 'returns'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getReturnsForSales = async (salesId) => {
  if (USE_LOCAL_STORAGE) {
    return readLocal('returns_data')
      .filter(r => r.salesId === salesId)
      .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
  }
  const snap = await getDocs(query(collection(db, 'returns'), where('salesId', '==', salesId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
};

export const addReturns = async (items) => {
  const now = new Date().toISOString();
  const by = auth.currentUser?.email || null;
  const records = items.map(i => ({
    itemName: i.itemName,
    quantity: i.quantity,
    expiredDate: i.expiredDate || '',
    condition: i.condition || 'kedaluwarsa',
    notes: i.notes || '',
    status: 'menunggu',
    createdAt: now,
    createdBy: by,
  }));
  if (USE_LOCAL_STORAGE) {
    const data = readLocal('returns_data');
    records.forEach(r => data.push({ id: generateId(), ...r }));
    writeLocal('returns_data', data);
    return;
  }
  await Promise.all(records.map(r => addDoc(collection(db, 'returns'), r)));
};

export const updateReturn = async (id, data) => {
  if (USE_LOCAL_STORAGE) {
    const all = readLocal('returns_data');
    const idx = all.findIndex(r => r.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...data };
      writeLocal('returns_data', all);
    }
    return;
  }
  await updateDoc(doc(db, 'returns', id), data);
};

export const deleteReturn = async (id) => {
  if (USE_LOCAL_STORAGE) {
    writeLocal('returns_data', readLocal('returns_data').filter(r => r.id !== id));
    return;
  }
  await deleteDoc(doc(db, 'returns', id));
};

// Tandai beberapa baris retur sebagai diambil oleh seorang sales.
// Dicek di dalam transaksi: jika karyawan lain sudah menyerahkan barang yang sama lebih dulu,
// seluruh operasi dibatalkan dan error 'already-taken' dilempar (mencegah transaksi dobel).
export const markReturnsTaken = async (ids, sales, note = '') => {
  const patch = {
    status: 'diambil',
    salesId: sales.id,
    salesName: sales.name,
    distributor: sales.distributor || '',
    takenAt: new Date().toISOString(),
    takenNote: note,
    takenBy: auth.currentUser?.email || null,
  };
  if (USE_LOCAL_STORAGE) {
    await Promise.all(ids.map(id => updateReturn(id, patch)));
    return;
  }
  await runTransaction(db, async (tx) => {
    const refs = ids.map(id => doc(db, 'returns', id));
    const snaps = await Promise.all(refs.map(r => tx.get(r)));
    const conflicts = snaps
      .filter(s => !s.exists() || s.data().status !== 'menunggu')
      .map(s => (s.exists() ? { itemName: s.data().itemName, salesName: s.data().salesName } : { itemName: 'Barang dihapus', salesName: null }));
    if (conflicts.length > 0) {
      const err = new Error('already-taken');
      err.code = 'already-taken';
      err.conflicts = conflicts;
      throw err;
    }
    refs.forEach(r => tx.update(r, patch));
  });
};

// Kembalikan ke status menunggu (jika salah menandai).
export const undoReturnTaken = async (id) => {
  const patch = { status: 'menunggu', salesId: null, salesName: null, distributor: null, takenAt: null, takenNote: '', takenBy: null };
  await updateReturn(id, patch);
};

// --- Realtime & Draf bersama ---
// Draf = daftar barang retur yang sedang dicatat, tersimpan otomatis dan terlihat semua karyawan.
// Baru masuk ke 'returns' ketika dikonfirmasi (commitDrafts), sehingga transaksi sehari bisa dijadikan satu.

const sortNewest = (list) => list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export const subscribeReturns = (onData, onError) =>
  onSnapshot(
    collection(db, 'returns'),
    (snap) => onData(sortNewest(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    onError
  );

export const subscribeDrafts = (onData, onError) =>
  onSnapshot(
    collection(db, 'return_drafts'),
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))),
    onError
  );

export const addDraft = async (item, by = {}) => {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'return_drafts'), {
    itemName: item.itemName,
    quantity: item.quantity,
    expiredDate: item.expiredDate || '',
    condition: item.condition || 'kedaluwarsa',
    notes: item.notes || '',
    pickupDate: item.pickupDate || '',
    createdAt: now,
    updatedAt: now,
    createdBy: by.email || auth.currentUser?.email || null,
    createdByName: by.name || null,
  });
  return ref.id;
};

export const updateDraft = (id, patch, by = {}) =>
  updateDoc(doc(db, 'return_drafts', id), {
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedByName: by.name || null,
  });

export const deleteDraft = (id) => deleteDoc(doc(db, 'return_drafts', id));

// Mengembalikan draf yang baru dihapus (untuk tombol "Urungkan").
export const restoreDraft = (draft) => setDoc(doc(db, 'return_drafts', draft.id), draft);

// Pindahkan seluruh draf terpilih ke gudang dalam satu operasi atomik.
export const commitDrafts = async (drafts, by = {}) => {
  const batchId = `B-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const wb = writeBatch(db);
  drafts.forEach((d) => {
    wb.set(doc(collection(db, 'returns')), {
      itemName: d.itemName,
      quantity: d.quantity,
      expiredDate: d.expiredDate || '',
      condition: d.condition,
      notes: d.notes || '',
      pickupDate: d.pickupDate || '',
      pickupSalesId: d.pickupSalesId || null,
      pickupSalesName: d.pickupSalesName || null,
      status: 'menunggu',
      createdAt: d.createdAt,
      createdBy: d.createdBy || null,
      createdByName: d.createdByName || null,
      committedAt: new Date().toISOString(),
      committedByName: by.name || null,
      batchId,
    });
    wb.delete(doc(db, 'return_drafts', d.id));
  });
  await wb.commit();
  return batchId;
};
