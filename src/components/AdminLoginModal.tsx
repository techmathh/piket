import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import {
  authenticateAccount,
  type AppAccount,
} from '../utils/piketLogic';

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 perspective-stage"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14, rotateX: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="card-3d max-w-md w-full p-5 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="icon-tile-3d-sky w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            >
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold text-sky-700">
                Akses Pengurus & Developer
              </span>
              <h2
                id="login-modal-title"
                className="text-lg font-bold text-slate-900"
              >
                Login Panel Admin OSIS
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Login"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="login-username"
              className="block text-xs font-semibold text-slate-700"
            >
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-username"
                data-testid="login-username-input"
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-700"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                data-testid="login-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? 'Sembunyikan password' : 'Lihat password'
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
              className="btn-3d-secondary px-4 py-2.5 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="login-submit-btn"
              className="btn-3d-primary px-5 py-2.5 text-xs font-semibold"
            >
              Masuk ke Admin Panel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
