import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  Database,
  AlertTriangle,
  RotateCcw,
  FlaskConical,
} from 'lucide-react';
import {
  PERMANENT_DEVELOPER_ACCOUNT,
  canDeleteAccount,
  type AppAccount,
  type ViolationResetCutoff,
} from '../utils/piketLogic';
import { CharacterAvatar3D } from './CharacterAvatar3D';

interface DeveloperAccountManagerProps {
  accounts: AppAccount[];
  currentAccount: AppAccount;
  violationRecordsCount: number;
  violationResetCutoff: ViolationResetCutoff | null;
  isTestingMode: boolean;
  onToggleTestingMode: (nextEnabled: boolean) => Promise<void> | void;
  onAddAdminAccount: (newAccount: AppAccount) => Promise<void>;
  onUpdateAccount: (updatedAccount: AppAccount) => Promise<void>;
  onDeleteAdminAccount: (account: AppAccount) => Promise<void>;
  onClearViolationDatabase: () => Promise<void>;
  onResetAllDatabaseData: () => Promise<void>;
}

export const DeveloperAccountManager: React.FC<
  DeveloperAccountManagerProps
> = ({
  accounts,
  currentAccount,
  violationRecordsCount,
  violationResetCutoff,
  isTestingMode,
  onToggleTestingMode,
  onAddAdminAccount,
  onUpdateAccount,
  onDeleteAdminAccount,
  onClearViolationDatabase,
  onResetAllDatabaseData,
}) => {
  const [displayName, setDisplayName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Inline password / name edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');

  // Developer Database Reset modal states
  const [confirmModalType, setConfirmModalType] = useState<
    'clear_violations' | 'reset_all' | null
  >(null);
  const [resetKeyword, setResetKeyword] = useState<string>('');
  const [isExecutingReset, setIsExecutingReset] = useState<boolean>(false);

  useEffect(() => {
    if (!confirmModalType) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExecutingReset) {
        setConfirmModalType(null);
        setResetKeyword('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmModalType, isExecutingReset]);

  const handleConfirmClearViolations = async () => {
    if (isExecutingReset) return;
    setIsExecutingReset(true);
    try {
      await onClearViolationDatabase();
      setConfirmModalType(null);
    } finally {
      setIsExecutingReset(false);
    }
  };

  const handleConfirmResetAll = async () => {
    if (isExecutingReset || resetKeyword.trim().toUpperCase() !== 'RESET') {
      return;
    }
    setIsExecutingReset(true);
    try {
      await onResetAllDatabaseData();
      setConfirmModalType(null);
      setResetKeyword('');
    } finally {
      setIsExecutingReset(false);
    }
  };

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

      {/* Mode Uji Coba (Tanpa Batasan Waktu) Card */}
      <section
        data-testid="card-dev-testing-mode"
        className={`card-3d p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isTestingMode
            ? 'border-indigo-300 bg-indigo-50/40'
            : 'border-slate-200/90'
        }`}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              isTestingMode
                ? 'bg-indigo-600 border-indigo-700 text-white shadow-[0_3px_0_0_#3730A3]'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
            }`}
          >
            <FlaskConical className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Mode Uji Coba (Tanpa Batasan Waktu)
              </h2>
              <span
                data-testid="dev-testing-mode-status"
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                  isTestingMode
                    ? 'bg-indigo-600 text-white border-indigo-700'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {isTestingMode ? 'AKTIF' : 'NONAKTIF'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Saat aktif, semua batasan jam absen pos (Gerbang 06:00–09:15,
              Warsis 09:15–14:15, Shalat 11:45–16:00), kunci tanggal
              lampau/mendatang, batas toleransi 06:45 WIB, dan Otomatis Alfa
              dinonaktifkan sementara agar semua alur dapat diuji kapan saja di
              semua perangkat.
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="btn-dev-toggle-testing-mode"
          aria-pressed={isTestingMode}
          onClick={() => onToggleTestingMode(!isTestingMode)}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition-all whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 ${
            isTestingMode
              ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white shadow-[0_3px_0_0_#3730A3] active:translate-y-0.5'
              : 'btn-3d-primary'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>
            {isTestingMode
              ? 'Nonaktifkan Mode Uji Coba'
              : 'Aktifkan Mode Uji Coba'}
          </span>
        </button>
      </section>

      {/* Developer-Only Database Management & Reset Section */}
      <section
        data-testid="developer-database-reset-section"
        className="card-3d p-5 md:p-6 space-y-4 border-rose-200/90"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pemeliharaan & Reset Database (Khusus Developer)
              </h2>
              <p className="text-xs text-slate-600">
                Admin dan petugas tidak dapat menghapus data pelanggaran. Hanya
                Developer yang memiliki wewenang membersihkan atau mereset
                database.
              </p>
            </div>
          </div>
          {violationResetCutoff && (
            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg self-start sm:self-auto shrink-0">
              Reset Pelanggaran Terakhir: {violationResetCutoff.resetDate}{' '}
              {violationResetCutoff.resetTimeHHMM} WIB
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Clear Violation Database Only (Preserve Accounts & Schedules) */}
          <div
            data-testid="card-dev-clear-violations"
            className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-lg">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  Opsi 1 · Hapus Pelanggaran Saja
                </span>
                <span className="text-[11px] font-mono font-semibold text-amber-800">
                  {violationRecordsCount} catatan tercatat
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Hapus Isi Database Pelanggaran
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Menghapus seluruh catatan pelanggaran (Alfa, Terlambat, dan Dia
                Bohong) serta mereset poin Leaderboard Pelanggaran kembali ke{' '}
                <strong>0</strong>.{' '}
                <strong className="text-slate-800">
                  Akun Admin/Petugas, data anggota, jadwal piket, dan absensi
                  Hadir/Izin tidak ikut terhapus.
                </strong>
              </p>
            </div>

            <button
              type="button"
              data-testid="btn-dev-open-clear-violations"
              onClick={() => setConfirmModalType('clear_violations')}
              className="w-full py-2.5 px-4 text-xs font-bold rounded-xl border border-amber-400 bg-amber-500 hover:bg-amber-600 text-white shadow-[0_3px_0_0_#B45309] active:translate-y-0.5 transition-all inline-flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Database Pelanggaran</span>
            </button>
          </div>

          {/* Option 2: Reset ALL Data Including Admin/Officer Accounts */}
          <div
            data-testid="card-dev-reset-all"
            className="rounded-xl border border-rose-200 bg-rose-50/55 p-4 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                  Opsi 2 · Reset Total
                </span>
                <span className="text-[11px] font-mono font-semibold text-rose-800">
                  +{adminAccounts.length} akun admin/petugas
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Reset Semua Data Termasuk Akun Petugas
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Menghapus seluruh riwayat absensi, data pelanggaran, tukar
                jadwal, libur piket,{' '}
                <strong className="text-rose-800">
                  serta seluruh akun Admin/Petugas
                </strong>{' '}
                dan mengembalikan daftar jadwal & anggota ke setelan awal. Hanya
                akun Developer utama permanen yang tetap dipertahankan.
              </p>
            </div>

            <button
              type="button"
              data-testid="btn-dev-open-reset-all"
              onClick={() => {
                setResetKeyword('');
                setConfirmModalType('reset_all');
              }}
              className="w-full py-2.5 px-4 text-xs font-bold rounded-xl border border-rose-700 bg-rose-600 hover:bg-rose-700 text-white shadow-[0_3px_0_0_#9F1239] active:translate-y-0.5 transition-all inline-flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Reset Semua Data & Akun Petugas</span>
            </button>
          </div>
        </div>
      </section>

      {/* Confirmation Modal for Option 1: Clear Violation Database */}
      {confirmModalType === 'clear_violations' && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 perspective-stage"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-violations-modal-title"
          onClick={() => {
            if (!isExecutingReset) setConfirmModalType(null);
          }}
        >
          <motion.div
            data-testid="modal-confirm-clear-violations"
            initial={{ opacity: 0, scale: 0.94, y: 12, rotateX: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="card-3d max-w-md w-full p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="clear-violations-modal-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Konfirmasi Hapus Database Pelanggaran
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Akun Admin/Petugas & jadwal tidak ikut terhapus
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isExecutingReset}
                onClick={() => setConfirmModalType(null)}
                aria-label="Tutup konfirmasi"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Tindakan ini akan menghapus{' '}
                <strong className="text-slate-900">
                  {violationRecordsCount} catatan pelanggaran
                </strong>{' '}
                (Alfa, Terlambat, Dia Bohong) dari Firestore dan mengatur ulang
                skor Leaderboard Pelanggaran mingguan & bulanan ke{' '}
                <strong>0</strong> di semua perangkat.
              </p>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium">
                Aman: Seluruh akun Admin/Petugas, data anggota OSIS/MPK, jadwal
                piket, dan catatan Hadir/Izin tetap dipertahankan.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={isExecutingReset}
                onClick={() => setConfirmModalType(null)}
                className="btn-3d-secondary px-4 py-2 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                data-testid="btn-confirm-clear-violations"
                disabled={isExecutingReset}
                onClick={handleConfirmClearViolations}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-[0_2px_0_0_#92400E]"
              >
                {isExecutingReset
                  ? 'Menghapus Pelanggaran...'
                  : 'Ya, Hapus Data Pelanggaran'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal for Option 2: Reset ALL Data Including Admin/Officer Accounts */}
      {confirmModalType === 'reset_all' && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 perspective-stage"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-all-modal-title"
          onClick={() => {
            if (!isExecutingReset) {
              setConfirmModalType(null);
              setResetKeyword('');
            }
          }}
        >
          <motion.div
            data-testid="modal-confirm-reset-all"
            initial={{ opacity: 0, scale: 0.94, y: 12, rotateX: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="card-3d max-w-md w-full p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="reset-all-modal-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Konfirmasi Reset Semua Data
                  </h3>
                  <p className="text-[11px] text-rose-600 font-semibold">
                    Tindakan permanen · Termasuk akun Admin/Petugas
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isExecutingReset}
                onClick={() => {
                  setConfirmModalType(null);
                  setResetKeyword('');
                }}
                aria-label="Tutup konfirmasi reset semua"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                <p className="font-bold">Data yang akan dihapus / direset:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Seluruh riwayat absensi, pelanggaran & leaderboard</li>
                  <li>Seluruh riwayat tukar jadwal & jadwal libur piket</li>
                  <li>
                    Semua akun Admin/Petugas ({adminAccounts.length} akun
                    terdaftar)
                  </li>
                  <li>
                    Jadwal piket & daftar anggota dikembalikan ke data awal
                  </li>
                </ul>
              </div>
              <p className="text-[11px] text-slate-500">
                Akun <strong>Developer Utama</strong> bersifat permanen dan
                tetap aktif agar Anda tidak terkunci keluar.
              </p>

              <div className="space-y-1 pt-1">
                <label
                  htmlFor="confirm-reset-keyword"
                  className="block text-xs font-bold text-slate-700"
                >
                  Ketik <span className="font-mono text-rose-700">RESET</span>{' '}
                  untuk melanjutkan:
                </label>
                <input
                  id="confirm-reset-keyword"
                  data-testid="input-confirm-reset-keyword"
                  type="text"
                  autoFocus
                  value={resetKeyword}
                  onChange={(e) => setResetKeyword(e.target.value)}
                  placeholder="Ketik RESET"
                  className="w-full px-3 py-2 text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={isExecutingReset}
                onClick={() => {
                  setConfirmModalType(null);
                  setResetKeyword('');
                }}
                className="btn-3d-secondary px-4 py-2 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                data-testid="btn-confirm-reset-all"
                disabled={
                  isExecutingReset ||
                  resetKeyword.trim().toUpperCase() !== 'RESET'
                }
                onClick={handleConfirmResetAll}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-[0_2px_0_0_#9F1239]"
              >
                {isExecutingReset
                  ? 'Mereset Semua Data...'
                  : 'Reset Semua Data Sekarang'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
