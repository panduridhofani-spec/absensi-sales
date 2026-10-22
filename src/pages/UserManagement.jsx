import { useCallback, useEffect, useState } from 'react';
import { LuUserPlus, LuKeyRound, LuTrash2, LuPower, LuShieldCheck, LuUser } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import SelectField from '../components/SelectField';
import { getUsers, createUser, updateUser, deleteUserAccess, resetPassword, ROLES } from '../services/userService';
import { PageHeader, EmptyState, Skeleton } from '../components/ui';

const ERRORS = {
  'auth/email-already-in-use': 'Email sudah terdaftar. Hapus akses lama atau pakai email lain.',
  'auth/weak-password': 'Password minimal 6 karakter.',
  'auth/invalid-email': 'Format email tidak valid.',
};

const EMPTY = { name: '', email: '', password: '', role: ROLES.ADMIN };
const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: 'Admin', hint: 'Akses penuh, tanpa kelola user' },
  { value: ROLES.OWNER, label: 'Owner', hint: 'Akses penuh + kelola user' },
];

const UserManagement = () => {
  const { user: me } = useAuth();
  const { confirm } = useFeedback();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      setUsers(await getUsers());
    } catch {
      setMessage({ type: 'error', text: 'Gagal memuat daftar user.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, okText) => {
    setMessage({ type: '', text: '' });
    try {
      await fn();
      setMessage({ type: 'ok', text: okText });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: ERRORS[err.code] || 'Terjadi kesalahan. Coba lagi.' });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    await run(
      () => createUser({ ...form, name: form.name.trim(), email: form.email.trim() }),
      'User berhasil ditambahkan.'
    );
    setForm(EMPTY);
    setSaving(false);
  };

  const toggleActive = (u) =>
    run(() => updateUser(u.id, { active: !u.active }), u.active ? 'User dinonaktifkan.' : 'User diaktifkan.');

  const changeRole = (u, role) => run(() => updateUser(u.id, { role }), 'Role diperbarui.');

  const remove = async (u) => {
    const ok = await confirm({
      tone: 'danger',
      title: `Hapus akses ${u.name || u.email}?`,
      message: `${u.email} tidak akan bisa login lagi. Gunakan "Nonaktifkan" jika hanya ingin menutup akses sementara.`,
      confirmText: 'Ya, hapus akses',
    });
    if (ok) run(() => deleteUserAccess(u.id), 'Akses user dihapus.');
  };

  const reset = async (u) => {
    const ok = await confirm({
      tone: 'primary',
      title: 'Kirim email reset password?',
      message: `Tautan reset akan dikirim ke ${u.email}.`,
      confirmText: 'Ya, kirim',
    });
    if (ok) run(() => resetPassword(u.email), 'Email reset password terkirim.');
  };

  return (
    <>
      <PageHeader
        eyebrow="Khusus Owner"
        title="Kelola User"
        subtitle="Tambah, ubah, nonaktifkan, dan hapus akses admin."
      />

      {message.text && (
        <div
          role="status"
          className={`badge ${message.type === 'error' ? 'badge-danger' : 'badge-success'} animate-dropdown`}
          style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', fontSize: '0.85rem', whiteSpace: 'normal' }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleCreate} className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <h3 className="card-title">Tambah user baru</h3>
          <span className="icon-tile"><LuUserPlus /></span>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <div>
            <label className="form-label">Nama</label>
            <input placeholder="Nama lengkap" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" placeholder="nama@perusahaan.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Password awal</label>
            <input type="password" placeholder="Min. 6 karakter" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
          </div>
          <div>
            <label className="form-label">Role</label>
            <SelectField value={form.role} onChange={(v) => setForm({ ...form, role: v })} title="Role" options={ROLE_OPTIONS} />
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <LuUserPlus /> {saving ? 'Menyimpan...' : 'Tambah user'}
          </button>
        </div>
      </form>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Daftar user</h3>
          <span className="badge badge-primary">{users.length} akun</span>
        </div>

        {loading ? (
          <div className="list"><Skeleton height={72} /><Skeleton height={72} /></div>
        ) : users.length === 0 ? (
          <EmptyState icon={<LuUser />} title="Belum ada user" text="Tambahkan admin pertama lewat form di atas." />
        ) : (
          <div className="list stagger">
            {users.map((u) => {
              const isMe = u.id === me?.uid;
              return (
                <div key={u.id} className="list-item" style={{ flexWrap: 'wrap', opacity: u.active ? 1 : 0.65 }}>
                  <div className="list-item-main" style={{ flex: '1 1 240px' }}>
                    <div className="avatar">{(u.name || u.email || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="list-item-title">
                        {u.name || '-'} {isMe && <span className="badge badge-info" style={{ marginLeft: 4 }}>Anda</span>}
                      </div>
                      <div className="list-item-sub">{u.email}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <span className={`badge ${u.role === 'owner' ? 'badge-warning' : 'badge-primary'}`}>
                          <LuShieldCheck /> {u.role === 'owner' ? 'Owner' : 'Admin'}
                        </span>
                        <span className={`badge badge-dot ${u.active ? 'badge-success' : 'badge-danger'}`}>
                          {u.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <SelectField size="sm" value={u.role} disabled={isMe} onChange={(v) => changeRole(u, v)} title="Ubah role" options={ROLE_OPTIONS} aria-label={`Role ${u.name || u.email}`} />
                    <button className="btn btn-secondary btn-sm" onClick={() => reset(u)}><LuKeyRound /> Reset</button>
                    <button className="btn btn-secondary btn-sm" disabled={isMe} onClick={() => toggleActive(u)}>
                      <LuPower /> {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={isMe} onClick={() => remove(u)}><LuTrash2 /> Hapus</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default UserManagement;
