import React, { useState } from 'react';
import { Lock, User, X, Eye, EyeOff } from 'lucide-react';
import {
  authenticateAccount,
  type AppAccount,
} from '../utils/piketLogic';
import { mascotHeroImg } from '../assets/brandAssets';

interface AdminLoginModalProps {
  accounts: AppAccount[];
  onSuccessLogin: (account: AppAccount) => void;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  accounts,
  onSuccessLogin,
  onClose,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const matched = authenticateAccount(accounts, username, password);
    if (!matched) {
      setErrorMessage(
        'Username atau password tidak sesuai. Silakan periksa kembali.'
      );
      return;
    }

    onSuccessLogin(matched);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="card-3d max-w-md w-full p-5 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#F3E3D0] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl border-2 border-amber-300 shadow-[0_3px_0_0_#F59E0B] overflow-hidden shrink-0 bg-[#FFF3DF]">
              <img
                src={mascotHeroImg}
                alt="Maskot Login OSIS"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-orange-600">
                Akses Pengurus & Developer
              </span>
              <h2
                id="login-modal-title"
                className="text-xl font-bold text-stone-900"
              >
                Login Panel Admin OSIS
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Login"
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border-2 border-rose-200 text-xs font-bold text-rose-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="login-username"
              className="block text-xs font-bold text-stone-700"
            >
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-username"
                data-testid="login-username-input"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border-2 border-[#EBD5B8] rounded-xl text-stone-900 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-bold text-stone-700"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                data-testid="login-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border-2 border-[#EBD5B8] rounded-xl text-stone-900 focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? 'Sembunyikan password' : 'Lihat password'
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d-secondary px-4 py-2.5 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="login-submit-btn"
              className="btn-3d-primary px-5 py-2.5 text-xs font-bold"
            >
              Masuk ke Admin Panel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
