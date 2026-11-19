import React, { useState } from 'react';
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

export const SwapScheduleModal: React.FC<SwapScheduleModalProps> = ({
  todayStr,
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

  const dateEditStatus = getScheduleDateEditStatus(date, todayStr);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        scheduleId,
        originalMemberId,
        replacementMemberId,
        reason: reason.trim() || 'Tukar jadwal piket',
        createdAt: new Date().toISOString(),
      });
    } else if (selectedSchedule) {
      const dayOfWeek = parseDateString(date).getDay();
      const targetKey =
        selectedSchedule.mode === 'mingguan' ? dayOfWeek : date;
      onSavePermanentReplace(
        scheduleId,
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
      className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-modal-title"
    >
      <div className="bg-white border border-stone-200 rounded-xl shadow-xl max-w-lg w-full p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3.5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-stone-700" />
            <h2
              id="swap-modal-title"
              className="text-base font-bold text-stone-900"
            >
              Tukar / Ganti Petugas Piket
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Modal Tukar Jadwal"
            className="p-1 text-stone-400 hover:text-stone-700"
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
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setChangeMode('sementara');
                setDate(todayStr);
                setError('');
              }}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-colors ${
                changeMode === 'sementara'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
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
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-colors ${
                changeMode === 'permanen'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Ganti Jadwal Permanen
            </button>
          </div>

          {changeMode === 'sementara' && !dateEditStatus.canEdit && (
            <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-lg text-xs text-stone-700 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span>{dateEditStatus.reason}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="swap-date-input"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Tanggal ({dayOfWeekName})
              </label>
              <input
                id="swap-date-input"
                type="date"
                value={date}
                min={changeMode === 'sementara' ? todayStr : undefined}
                max={changeMode === 'sementara' ? todayStr : undefined}
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    setError('');
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="swap-schedule-select"
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                Pilih Jadwal Piket
              </label>
              <select
                id="swap-schedule-select"
                value={scheduleId}
                onChange={(e) => setScheduleId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="swap-orig-select"
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                Petugas yang Digantikan
              </label>
              <select
                id="swap-orig-select"
                value={originalMemberId}
                onChange={(e) => setOriginalMemberId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
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
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                Petugas Pengganti
              </label>
              <select
                id="swap-repl-select"
                value={replacementMemberId}
                onChange={(e) => setReplacementMemberId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
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
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                Alasan Pergantian / Tukar Jadwal
              </label>
              <input
                id="swap-reason-input"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Mengikuti olimpiade fisika / Tukar hari piket"
                className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-[#F3E3D0]">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d-secondary px-4 py-2 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-3d-primary px-4 py-2 text-xs font-bold"
            >
              Simpan Pergantian Jadwal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
