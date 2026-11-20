import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowLeftRight, Lock } from 'lucide-react';
import {
  DAY_NAMES_ID,
  getBaseMemberIdsForScheduleOnDate,
  getScheduleDateEditStatus,
  parseDateString,
  type OsisMember,
  type PiketSchedule,
  type ScheduleSwap,
} from '../utils/piketLogic';

interface SwapScheduleModalProps {
  todayStr: string;
  isTestingMode?: boolean;
  initialDate: string;
  initialScheduleId: string;
  initialOriginalMemberId?: string;
  schedules: PiketSchedule[];
  members: OsisMember[];
  onClose: () => void;
  onSaveTemporarySwap: (swap: ScheduleSwap) => void;
  onSavePermanentReplace: (
    scheduleId: string,
    targetDayOrDate: number | string,
    oldMemberId: string,
    newMemberId: string
  ) => void;
}

function formatScheduleOptionLabel(s: PiketSchedule): string {
  const weeks =
    s.activeWeeks && s.activeWeeks.length > 0 && s.activeWeeks.length < 4
      ? ` — Minggu ${s.activeWeeks.join(', ')}`
      : '';
  return `${s.title}${weeks}`;
}

export const SwapScheduleModal: React.FC<SwapScheduleModalProps> = ({
  todayStr,
  isTestingMode = false,
  initialDate,
  initialScheduleId,
  initialOriginalMemberId,
  schedules,
  members,
  onClose,
  onSaveTemporarySwap,
  onSavePermanentReplace,
}) => {
  const [changeMode, setChangeMode] = useState<'sementara' | 'permanen'>(
    'sementara'
  );
  const [date, setDate] = useState<string>(initialDate || todayStr);
  const [scheduleId, setScheduleId] = useState<string>(
    initialScheduleId || schedules[0]?.id || ''
  );

  const selectedSchedule =
    schedules.find((s) => s.id === scheduleId) || schedules[0];
  const effectiveScheduleId = selectedSchedule?.id || '';

  const baseForDate = selectedSchedule
    ? getBaseMemberIdsForScheduleOnDate(selectedSchedule, date)
    : { isActive: false, memberIds: [] };

  const defaultOrigId =
    initialOriginalMemberId ||
    baseForDate.memberIds[0] ||
    members[0]?.id ||
    '';

  const [originalMemberId, setOriginalMemberId] =
    useState<string>(defaultOrigId);
  const [replacementMemberId, setReplacementMemberId] = useState<string>(
    members.find((m) => m.id !== defaultOrigId)?.id || members[0]?.id || ''
  );
  const [reason, setReason] = useState<string>(
    'Izin kegiatan sekolah / tukar jadwal piket'
  );
  const [error, setError] = useState<string>('');

  // Keep originalMemberId synced when schedule or date changes if current selection isn't scheduled on the new slot
  useEffect(() => {
    if (
      baseForDate.memberIds.length > 0 &&
      !baseForDate.memberIds.includes(originalMemberId)
    ) {
      const nextOrig = baseForDate.memberIds[0];
      setOriginalMemberId(nextOrig);
      if (replacementMemberId === nextOrig) {
        const nextRepl =
          members.find((m) => m.id !== nextOrig)?.id || members[0]?.id || '';
        setReplacementMemberId(nextRepl);
      }
    }
  }, [effectiveScheduleId, date]);

  // Allow Escape key to close modal cleanly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dateEditStatus = getScheduleDateEditStatus(
    date,
    todayStr,
    isTestingMode
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveScheduleId || !selectedSchedule) {
      setError('Jadwal piket belum tersedia.');
      return;
    }
    if (changeMode === 'sementara' && !dateEditStatus.canEdit) {
      setError(dateEditStatus.reason);
      return;
    }
    if (!originalMemberId || !replacementMemberId) {
      setError('Pilih petugas asli dan petugas pengganti.');
      return;
    }
    if (originalMemberId === replacementMemberId) {
      setError('Petugas asli dan petugas pengganti tidak boleh sama.');
      return;
    }

    if (changeMode === 'sementara') {
      onSaveTemporarySwap({
        id: `swap-${Date.now()}`,
        date,
        scheduleId: effectiveScheduleId,
        originalMemberId,
        replacementMemberId,
        reason: reason.trim() || 'Tukar jadwal piket',
        createdAt: new Date().toISOString(),
      });
    } else {
      const dayOfWeek = parseDateString(date).getDay();
      const targetKey =
        selectedSchedule.mode === 'mingguan' ? dayOfWeek : date;
      onSavePermanentReplace(
        effectiveScheduleId,
        targetKey,
        originalMemberId,
        replacementMemberId
      );
    }

    onClose();
  };

  const dayOfWeekName = DAY_NAMES_ID[parseDateString(date).getDay()];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4 perspective-stage"
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-modal-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14, rotateX: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="card-3d max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-slate-700" />
            <h2
              id="swap-modal-title"
              className="text-base font-bold text-slate-900"
            >
              Tukar / Ganti Petugas Piket
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Modal Tukar Jadwal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
              {error}
            </div>
          )}

          {/* Switch between Temporary Date Swap and Permanent Schedule Change */}
          <div className="segmented-3d flex items-center gap-1 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setChangeMode('sementara');
                setDate(todayStr);
                setError('');
              }}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                changeMode === 'sementara'
                  ? 'segmented-3d-active'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tukar Hari Ini (Sementara)
            </button>
            <button
              type="button"
              onClick={() => {
                setChangeMode('permanen');
                setError('');
              }}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                changeMode === 'permanen'
                  ? 'segmented-3d-active'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ganti Jadwal Permanen
            </button>
          </div>

          {changeMode === 'sementara' && !dateEditStatus.canEdit && (
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{dateEditStatus.reason}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="swap-date-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tanggal ({dayOfWeekName})
              </label>
              <input
                id="swap-date-input"
                type="date"
                value={date}
                min={
                  changeMode === 'sementara' && !isTestingMode
                    ? todayStr
                    : undefined
                }
                max={
                  changeMode === 'sementara' && !isTestingMode
                    ? todayStr
                    : undefined
                }
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    setError('');
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label
                htmlFor="swap-schedule-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Pilih Jadwal Piket
              </label>
              <select
                id="swap-schedule-select"
                value={effectiveScheduleId}
                onChange={(e) => {
                  setScheduleId(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatScheduleOptionLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="swap-orig-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Petugas yang Digantikan
              </label>
              <select
                id="swap-orig-select"
                value={originalMemberId}
                onChange={(e) => {
                  setOriginalMemberId(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
              >
                {members.map((m) => {
                  const isScheduled = baseForDate.memberIds.includes(m.id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} {isScheduled ? '(Terjadwal)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label
                htmlFor="swap-repl-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Petugas Pengganti
              </label>
              <select
                id="swap-repl-select"
                value={replacementMemberId}
                onChange={(e) => {
                  setReplacementMemberId(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.kelas})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {changeMode === 'sementara' && (
            <div>
              <label
                htmlFor="swap-reason-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Alasan Pergantian / Tukar Jadwal
              </label>
              <input
                id="swap-reason-input"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Mengikuti olimpiade fisika / Tukar hari piket"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d-secondary px-4 py-2 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-3d-primary px-4 py-2 text-xs font-semibold"
            >
              Simpan Pergantian Jadwal
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
