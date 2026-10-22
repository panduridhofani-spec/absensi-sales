import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../firebase';

export const ROLES = { OWNER: 'owner', ADMIN: 'admin' };

export const getUsers = async () => {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Buat akun lewat app Firebase sekunder agar sesi owner tidak ikut berganti.
export const createUser = async ({ name, email, password, role }) => {
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      role,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.uid || null,
    });
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
};

export const updateUser = (id, data) => updateDoc(doc(db, 'users', id), data);

// Menghapus profil mencabut akses sepenuhnya (login ditolak & Firestore Rules menolak).
export const deleteUserAccess = (id) => deleteDoc(doc(db, 'users', id));

export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
