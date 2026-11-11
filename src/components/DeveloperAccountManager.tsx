import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Lock,
  User,
  KeyRound,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import {
  PERMANENT_DEVELOPER_ACCOUNT,
  canDeleteAccount,
  type AppAccount,
} from '../utils/piketLogic';
import { CharacterAvatar3D } from './CharacterAvatar3D';

interface DeveloperAccountManagerProps {
  accounts: AppAccount[];
  currentAccount: AppAccount;
  onAddAdminAccount: (newAccount: AppAccount) => Promise<void>;
  onUpdateAccount: (updatedAccount: AppAccount) => Promise<void>;
  onDeleteAdminAccount: (account: AppAccount) => Promise<void>;
}

export const DeveloperAccountManager: React.FC<
  DeveloperAccountManagerProps
> = ({
  accounts,
  currentAccount,
  onAddAdminAccount,
  onUpdateAccount,
  onDeleteAdminAccount,
}) => {
  const [displayName, setDisplayName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Inline password / name edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');

  // Ensure permanent developer account is always present at top
  const devAccount =
    accounts.find(
      (a) => a.id === PERMANENT_DEVELOPER_ACCOUNT.id || a.role === 'developer'
    ) || PERMANENT_DEVELOPER_ACCOUNT;

  const adminAccounts = accounts.filter(
    (a) => a.id !== devAccount.id && a.role === 'admin'
  );

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanPass = password;

    if (cleanUsername.length < 3) {
      setFormError('Username minimal harus 3 karakter.');
      return;
    }
    if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
      setFormError(
        'Username hanya boleh berisi huruf kecil, angka, titik, atau garis bawah.'
      );
      return;
    }
    if (cleanPass.length < 4) {
      setFormError('Password minimal harus 4 karakter.');
      return;
    }
    if (!cleanName) {
      setFormError('Nama lengkap / jabatan admin wajib diisi.');
      return;
    }

    const exists = [devAccount, ...adminAccounts].some(
      (a) => a.username.trim().toLowerCase() === cleanUsername
    );
    if (exists) {
      setFormError(`Username "${cleanUsername}" sudah digunakan.`);
      return;
    }

    const newAdmin: AppAccount = {
      id: `acc-admin-${Date.now()}`,
      username: cleanUsername,
      password: cleanPass,
      displayName: cleanName,
      role: 'admin',
      isProtected: false,
      createdAt: new Date().toISOString(),
    };

    await onAddAdminAccount(newAdmin);
    setDisplayName('');
    setUsername('');
    setPassword('');
  };

  const startEdit = (acc: AppAccount) => {
    setEditingId(acc.id);
    setEditDisplayName(acc.displayName);
    setEditPassword(acc.password);
  };

  const saveEdit = async (acc: AppAccount) => {
    if (!editDisplayName.trim() || editPassword.length < 4) return;
    await onUpdateAccount({
      ...acc,
      displayName: editDisplayName.trim(),
      password: editPassword,
    });
    setEditingId(null);
  };

  if (currentAccount.role !== 'developer') {
    return (
      <div className="card-3d p-8 text-center space-y-2">
        <h2 className="text-lg font-bold text-stone-900">
          Khusus Role Developer
        </h2>
        <p className="text-xs text-stone-600">
          Halaman manajemen akun admin ini hanya dapat diakses oleh akun
          Developer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="card-3d p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
            <ShieldCheck className="w-4 h-4" />
            <span>Panel Khusus Role Developer · Firebase Firestore</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">
            Manajemen Akun Developer & Admin OSIS
          </h1>
          <p className="text-xs text-stone-600">
            Akun Developer bersifat permanen (tidak dapat dihapus) dan memiliki
            akses penuh untuk menambahkan akun Admin pengurus OSIS.
          </p>
        </div>

        <div className="text-xs font-mono font-bold text-stone-700 bg-[#FFF3E0] border-2 border-[#F5D7B0] px-3.5 py-2 rounded-xl shrink-0">
          1 Developer · {adminAccounts.length} Admin Aktif
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Tambah Akun Admin */}
        <section className="lg:col-span-5 card-3d p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b-2 border-[#F3E3D0] pb-3.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-600">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Tambah Akun Admin Baru
              </h2>
              <p className="text-xs text-stone-500">
                Buat username & password login untuk pengurus OSIS
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-4">
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border-2 border-rose-200 text-xs font-bold text-rose-700"
              >
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="new-admin-name"
                className="block text-xs font-bold text-stone-700"
              >
                Nama Pengurus / Jabatan Admin
              </label>
              <input
                id="new-admin-name"
                data-testid="new-admin-name-input"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoh: Sekretaris OSIS / Admin Piket"
                className="w-full px-3.5 py-2 text-xs bg-white border-2 border-[#EBD5B8] rounded-xl text-stone-900 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-admin-username"
                className="block text-xs font-bold text-stone-700"
              >
                Username Login
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="new-admin-username"
                  data-testid="new-admin-username-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: adminpiket"
                  className="w-full pl-8 pr-3.5 py-2 text-xs font-mono bg-white border-2 border-[#EBD5B8] rounded-xl text-stone-900 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-admin-password"
                className="block text-xs font-bold text-stone-700"
              >
                Password Login
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="new-admin-password"
                  data-testid="new-admin-password-input"
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 4 karakter..."
                  className="w-full pl-8 pr-3.5 py-2 text-xs font-mono bg-white border-2 border-[#EBD5B8] rounded-xl text-stone-900 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="add-admin-submit-btn"
              className="btn-3d-primary w-full py-2.5 px-4 text-xs font-bold inline-flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Simpan Akun Admin ke Firebase</span>
            </button>
          </form>
        </section>

        {/* Right Column: Daftar Akun (1 Developer Permanen + Daftar Admin) */}
        <section className="lg:col-span-7 space-y-4">
          {/* 1. Akun Developer Khusus (Permanen & Tidak Bisa Dihapus) */}
          <div
            data-testid="permanent-developer-card"
            className="card-3d p-5 bg-[#FFFDF8] border-2 border-amber-300 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-3 py-1 rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                Role Khusus: Developer (Akun Permanen)
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-xl">
                <Lock className="w-3 h-3 text-stone-500" />
                Tidak Dapat Dihapus
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-3">
                <CharacterAvatar3D name={devAccount.displayName} size="md" />
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    {devAccount.displayName}
                  </h3>
                  <p className="text-xs font-mono text-stone-600">
                    Role: <strong>Developer</strong> · Status: <strong>Aktif & Terkunci</strong>
                  </p>
                </div>
              </div>

              {editingId === devAccount.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Password baru..."
                    className="px-2.5 py-1.5 text-xs font-mono bg-white border-2 border-amber-300 rounded-xl w-36"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(devAccount)}
                    className="btn-3d-primary px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="btn-3d-secondary px-2.5 py-1.5 text-xs font-bold"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(devAccount)}
                  className="btn-3d-secondary px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Edit3 className="w-3.5 h-3.5 text-orange-500" />
                  <span>Ubah Password</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Daftar Akun Admin Pengurus OSIS */}
          <div className="card-3d p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b-2 border-[#F3E3D0] pb-3">
              <h3 className="text-base font-bold text-stone-900">
                Daftar Akun Admin Pengurus OSIS ({adminAccounts.length})
              </h3>
              <span className="text-xs text-stone-500">
                Dapat mencatat presensi & mengelola jadwal
              </span>
            </div>

            {adminAccounts.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <p className="text-sm font-bold text-stone-700">
                  Belum Ada Akun Admin Tambahan
                </p>
                <p className="text-xs text-stone-500">
                  Gunakan formulir di sebelah kiri untuk menambahkan akun Admin
                  pengurus OSIS baru.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {adminAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    data-testid={`admin-account-row-${acc.username}`}
                    className="p-3.5 rounded-2xl bg-[#FFFDF9] border-2 border-[#F3E3D0] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CharacterAvatar3D name={acc.displayName} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-stone-900 truncate">
                            {acc.displayName}
                          </p>
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                            Role: Admin
                          </span>
                        </div>
                        <p className="text-xs font-mono text-stone-600">
                          Username: <strong>@{acc.username}</strong> · Password:{' '}
                          <strong>••••••••</strong>
                        </p>
                      </div>
                    </div>

                    {editingId === acc.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          placeholder="Nama admin"
                          className="px-2.5 py-1.5 text-xs bg-white border-2 border-[#EBD5B8] rounded-xl w-32"
                        />
                        <input
                          type="text"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Password"
                          className="px-2.5 py-1.5 text-xs font-mono bg-white border-2 border-[#EBD5B8] rounded-xl w-28"
                        />
                        <button
                          type="button"
                          onClick={() => saveEdit(acc)}
                          className="btn-3d-primary px-3 py-1.5 text-xs font-bold"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="btn-3d-secondary px-2.5 py-1.5 text-xs font-bold"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(acc)}
                          className="btn-3d-secondary px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-stone-600" />
                          <span>Edit</span>
                        </button>
                        {canDeleteAccount(acc) && (
                          <button
                            type="button"
                            onClick={() => onDeleteAdminAccount(acc)}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
