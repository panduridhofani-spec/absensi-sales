import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';

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
    let q;
    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      q = query(
        collection(db, 'attendance'),
        where('salesId', '==', salesId),
        where('timestamp', '>=', cutoff.toISOString())
      );
    } else {
      q = query(
        collection(db, 'attendance'),
        where('salesId', '==', salesId)
      );
    }
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, timestamp: data.timestamp || data.checkInTime };
    });
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
    let q;
    if (limitDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limitDays);
      q = query(
        collection(db, 'transactions'),
        where('salesId', '==', salesId),
        where('timestamp', '>=', cutoff.toISOString())
      );
    } else {
      q = query(
        collection(db, 'transactions'),
        where('salesId', '==', salesId)
      );
    }
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
