import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let unsubProfile = null;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (!u) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      // Pantau profil secara live: jika owner menghapus/menonaktifkan, sesi langsung dicabut.
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          const data = snap.exists() ? snap.data() : null;
          if (!data || data.active === false) {
            setAuthError('Akun Anda tidak aktif atau sudah dihapus. Hubungi owner.');
            setUser(null);
            setProfile(null);
            setLoading(false);
            signOut(auth);
            return;
          }
          setAuthError('');
          setUser(u);
          setProfile({ id: snap.id, ...data });
          setLoading(false);
        },
        () => {
          setAuthError('Tidak dapat memuat profil akun.');
          setUser(null);
          setProfile(null);
          setLoading(false);
          signOut(auth);
        }
      );
    });
    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const login = (email, password) => {
    setAuthError('');
    return signInWithEmailAndPassword(auth, email, password);
  };
  const logout = () => signOut(auth);

  const role = profile?.role || null;
  const value = { user, profile, role, isOwner: role === 'owner', loading, authError, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
