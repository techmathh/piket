import React, { useState, useEffect } from 'react';
import {
  Clock,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  CalendarOff,
  Trash2,
  Lock,
  ShieldCheck,
  AlertTriangle,
  SlidersHorizontal,
  Info,
  Check,
  X,
  RotateCcw,
  Trophy,
  FlaskConical,
} from 'lucide-react';
import {
  DAY_ATTENDANCE_NOTE_PRESETS,
  DAY_NOTE_SCHEDULE_ID,
  HOLIDAY_CATEGORY_LABELS,
  LIE_REASON_PRESETS,
  STATUS_LABELS_ID,
  addDays,
  buildAdminVerificationNote,
  calculateShiftCheckInProgress,
  canAccountModifyViolationRecord,
  canDeleteViolationData,
  formatFullDateId,
  formatSelfAttendanceClaim,
  formatShortDateRangeId,
  getActiveHolidaysForDate,
  getDayAttendanceNote,
  getHolidayForScheduleOnDate,
  getHolidayRangeRules,
  getMemberOrgLabel,
  getPosRuleInfo,
  getScheduleDateEditStatus,
  getWeekOfMonth,
  isAttendanceVerifiedByAdmin,
  isFakeAttendanceRecord,
  isPublicSelfAttendance,
  isViolationAttendanceRecord,
  parseLieAttendanceRecord,
  type AppAccount,
  type AttendanceRecord,
  type AttendanceStatus,
  type HolidayCategory,
  type OsisMember,
  type PiketSchedule,
  type ResolvedDutyMember,
  type ResolvedScheduleForDate,
} from '../utils/piketLogic';
import {
  generateDailyAttendancePdfBytes,
  triggerPdfDownload,
} from '../utils/pdfExporter';

interface LiveDisplayAndAttendanceProps {
  currentAccount: AppAccount | null;
  todayStr: string;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  nextPreviewDate: string;
  onSelectNextPreviewDate: (dateStr: string) => void;
  todaySchedules: ResolvedScheduleForDate[];
  nextDaySchedules: ResolvedScheduleForDate[];
  allSchedules: PiketSchedule[];
  members: OsisMember[];
  attendanceRecords: AttendanceRecord[];
  isLeaderboardEnabled: boolean;
  onToggleLeaderboardEnabled: (nextEnabled: boolean) => void;
  isTestingMode: boolean;
  onToggleTestingMode: (nextEnabled: boolean) => void;
  onRecordAttendance: (
    date: string,
    scheduleId: string,
    memberId: string,
    status: AttendanceStatus,
    note?: string
  ) => void;
  onClearAttendance: (
    date: string,
    scheduleId: string,
    memberId: string
  ) => void;
  onMarkAllPresent: (date: string, scheduleId: string) => void;
  onSaveDayOrShiftNote: (
    date: string,
    note: string,
    isHoliday: boolean,
    applyToAllMembers: boolean,
    targetScheduleId?: string
  ) => void;
  onClearDayOrShiftNote: (date: string, targetScheduleId?: string) => void;
  onSaveHolidayRange: (
    category: HolidayCategory,
    startDate: string,
    endDate: string,
    reason: string
  ) => Promise<void> | void;
  onDeleteHolidayRange: (holidayId: string) => Promise<void> | void;
  onOpenSwapModal: (
    date: string,
    scheduleId: string,
    originalMemberId?: string
  ) => void;
  onOpenNewScheduleModal: () => void;
  onOpenMembersTab: () => void;
}

type VerificationFilter = 'all' | 'pending_verify' | 'fake' | 'belum_absen';

export const LiveDisplayAndAttendance: React.FC<
  LiveDisplayAndAttendanceProps
> = ({
  currentAccount,
  todayStr,
  selectedDate,
  onSelectDate,
  onSelectNextPreviewDate,
  todaySchedules,
  attendanceRecords,
  isLeaderboardEnabled,
  onToggleLeaderboardEnabled,
  isTestingMode,
  onToggleTestingMode,
  onRecordAttendance,
  onClearAttendance,
  onMarkAllPresent,
  onClearDayOrShiftNote,
  onSaveHolidayRange,
  onDeleteHolidayRange,
  onOpenSwapModal,
}) => {
  const canDeleteViolations = canDeleteViolationData(currentAccount);
  const [currentTime, setCurrentTime] = useState<string>('07:00:00');
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [verifyFilter, setVerifyFilter] = useState<VerificationFilter>('all');
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);

  // Inline correction drawer state per officer row ("scheduleId:memberId")
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<AttendanceStatus>('hadir');
  const [draftIsFake, setDraftIsFake] = useState<boolean>(false);
  const [draftLieReason, setDraftLieReason] = useState<string>('');
  const [draftNote, setDraftNote] = useState<string>('');

  // Legacy single-day note (kept for backward compatibility)
  const currentDayNote = getDayAttendanceNote(
    selectedDate,
    attendanceRecords,
    DAY_NOTE_SCHEDULE_ID
  );

  // Per-Category Date-Range Holiday ("Libur Piket") manager state
  const allHolidayRules = getHolidayRangeRules(attendanceRecords);
  const activeHolidaysOnDate = getActiveHolidaysForDate(
    selectedDate,
    attendanceRecords
  );
  const [isHolidayPanelOpen, setIsHolidayPanelOpen] = useState<boolean>(false);
  const [holidayCategory, setHolidayCategory] =
    useState<HolidayCategory>('all');
  const [holidayStartDate, setHolidayStartDate] = useState<string>(todayStr);
  const [holidayEndDate, setHolidayEndDate] = useState<string>(todayStr);
  const [holidayReason, setHolidayReason] = useState<string>('');
  const [holidayFormError, setHolidayFormError] = useState<string>('');
  const [isSavingHoliday, setIsSavingHoliday] = useState<boolean>(false);

  const dateEditStatus = getScheduleDateEditStatus(
    selectedDate,
    todayStr,
    isTestingMode
  );

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hh}:${mm}:${ss}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close open inline row editor when changing dates
  useEffect(() => {
    setEditingRowKey(null);
  }, [selectedDate]);

  // Overall stats
  const allDutyMembersToday = todaySchedules.flatMap((s) => s.dutyMembers);
  const overallProgress = calculateShiftCheckInProgress(allDutyMembersToday);
  const pendingVerificationCount = allDutyMembersToday.filter((dm) =>
    isPublicSelfAttendance(dm.attendance)
  ).length;
  const fakeAttendanceCount = allDutyMembersToday.filter((dm) =>
    isFakeAttendanceRecord(dm.attendance)
  ).length;

  // Filtered schedules & duty members
  const filteredTodaySchedules = todaySchedules
    .filter(
      (s) => scheduleFilter === 'all' || s.schedule.id === scheduleFilter
    )
    .map((s) => {
      if (verifyFilter === 'all') return s;
      const filteredMembers = s.dutyMembers.filter((dm) => {
        if (verifyFilter === 'pending_verify') {
          return isPublicSelfAttendance(dm.attendance);
        }
        if (verifyFilter === 'fake') {
          return isFakeAttendanceRecord(dm.attendance);
        }
        if (verifyFilter === 'belum_absen') {
          return dm.effectiveStatus === 'belum_absen';
        }
        return true;
      });
      return { ...s, dutyMembers: filteredMembers };
    });

  const handleExportPdf = () => {
    const activeHolidaySummary =
      activeHolidaysOnDate.length > 0
        ? {
            note: activeHolidaysOnDate
              .map(
                (h) =>
                  `${HOLIDAY_CATEGORY_LABELS[h.category]} (${formatShortDateRangeId(
                    h.startDate,
                    h.endDate
                  )}): ${h.reason}`
              )
              .join(' | '),
            isHoliday: true,
          }
        : currentDayNote;

    const pdfBytes = generateDailyAttendancePdfBytes(
      selectedDate,
      scheduleFilter === 'all'
        ? todaySchedules
        : todaySchedules.filter((s) => s.schedule.id === scheduleFilter),
      currentTime,
      activeHolidaySummary
    );
    const suffix = scheduleFilter === 'all' ? 'semua-pos' : scheduleFilter;
    const filename = `verifikasi-piket-osis-${selectedDate}-${suffix}.pdf`;
    triggerPdfDownload(pdfBytes, filename);
    setPdfFeedback(`PDF (${filename}) berhasil diunduh.`);
    setTimeout(() => setPdfFeedback(null), 3500);
  };

  const handleOpenHolidayPanel = () => {
    const defaultStart = selectedDate >= todayStr ? selectedDate : todayStr;
    setHolidayStartDate(defaultStart);
    setHolidayEndDate(defaultStart);
    setHolidayFormError('');
    setIsHolidayPanelOpen((prev) => !prev);
  };

  const handleSubmitHolidayRange = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = holidayReason.trim();
    if (!cleanReason) {
      setHolidayFormError('Alasan libur piket wajib diisi.');
      return;
    }
    if (!isTestingMode && holidayStartDate < todayStr) {
      setHolidayFormError(
        'Tanggal mulai libur tidak boleh di hari yang sudah berlalu.'
      );
      return;
    }
    if (holidayEndDate < holidayStartDate) {
      setHolidayFormError(
        'Tanggal selesai libur harus sama atau setelah tanggal mulai.'
      );
      return;
    }

    setIsSavingHoliday(true);
    setHolidayFormError('');
    try {
      await onSaveHolidayRange(
        holidayCategory,
        holidayStartDate,
        holidayEndDate,
        cleanReason
      );
      setHolidayReason('');
    } catch {
      setHolidayFormError('Gagal menyimpan jadwal libur piket.');
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleOpenCorrectionDrawer = (
    scheduleId: string,
    dm: ResolvedDutyMember
  ) => {
    const key = `${scheduleId}:${dm.member.id}`;
    if (editingRowKey === key) {
      setEditingRowKey(null);
      return;
    }
    const parsedLie = parseLieAttendanceRecord(dm.attendance);
    setEditingRowKey(key);
    setDraftStatus(
      dm.effectiveStatus === 'belum_absen' ? 'hadir' : dm.effectiveStatus
    );
    setDraftIsFake(parsedLie.isLie);
    setDraftLieReason(parsedLie.isLie ? parsedLie.lieReason : '');
    setDraftNote(parsedLie.isLie ? '' : dm.attendance?.note || '');
  };

  const handleQuickVerifyValid = (
    scheduleId: string,
    dm: ResolvedDutyMember
  ) => {
    if (!dateEditStatus.canEdit) return;
    const targetStatus =
      dm.effectiveStatus === 'belum_absen' ? 'hadir' : dm.effectiveStatus;
    const existingNote = dm.attendance?.note?.trim();
    const isExistingLie = isFakeAttendanceRecord(dm.attendance);
    const noteToSave =
      existingNote && !isExistingLie
        ? existingNote
        : buildAdminVerificationNote(targetStatus, dm.effectiveStatus, false);
    onRecordAttendance(
      selectedDate,
      scheduleId,
      dm.member.id,
      targetStatus,
      noteToSave
    );
  };

  /**
   * Direct 1-click Admin attendance (immediately verified — no secondary verification step required).
   * Clicking the currently active status again toggles/cancels the attendance mark cleanly.
   */
  const handleDirectAdminAttendance = (
    scheduleId: string,
    dm: ResolvedDutyMember,
    status: 'hadir' | 'terlambat' | 'izin' | 'tidak_piket'
  ) => {
    if (!dateEditStatus.canEdit) return;

    const isViolationRow =
      isViolationAttendanceRecord(dm.attendance) || dm.isAutoAlfa;

    const alreadySelectedByAdmin =
      Boolean(dm.attendance) &&
      isAttendanceVerifiedByAdmin(dm.attendance) &&
      dm.effectiveStatus === status &&
      !isFakeAttendanceRecord(dm.attendance);

    if (alreadySelectedByAdmin) {
      if (!canDeleteViolations && isViolationRow) {
        return;
      }
      onClearAttendance(selectedDate, scheduleId, dm.member.id);
      return;
    }

    const perm = canAccountModifyViolationRecord(
      currentAccount,
      dm.attendance,
      status,
      false
    );
    if (!perm.allowed) return;
    if (
      !canDeleteViolations &&
      dm.isAutoAlfa &&
      status !== 'tidak_piket' &&
      status !== 'terlambat'
    ) {
      return;
    }

    const defaultNotes: Record<typeof status, string> = {
      hadir: 'Diabsen langsung oleh Admin',
      terlambat: 'Terlambat (diabsen langsung oleh Admin)',
      izin: 'Izin (diabsen langsung oleh Admin)',
      tidak_piket: 'Alfa (diabsen langsung oleh Admin)',
    };
    onRecordAttendance(
      selectedDate,
      scheduleId,
      dm.member.id,
      status,
      defaultNotes[status]
    );
  };

  const handleCancelAttendance = (
    scheduleId: string,
    dm: ResolvedDutyMember
  ) => {
    if (!dateEditStatus.canEdit || !dm.attendance) return;
    if (!canDeleteViolations && isViolationAttendanceRecord(dm.attendance)) {
      return;
    }
    onClearAttendance(selectedDate, scheduleId, dm.member.id);
    if (editingRowKey === `${scheduleId}:${dm.member.id}`) {
      setEditingRowKey(null);
    }
  };

  const handleQuickLieAttendance = (
    scheduleId: string,
    dm: ResolvedDutyMember,
    correctedStatus: 'tidak_piket' | 'terlambat'
  ) => {
    if (!dateEditStatus.canEdit) return;
    const selfClaim = formatSelfAttendanceClaim(dm.attendance);
    const note = buildAdminVerificationNote(
      correctedStatus,
      dm.effectiveStatus,
      true,
      draftLieReason,
      selfClaim
    );
    onRecordAttendance(
      selectedDate,
      scheduleId,
      dm.member.id,
      correctedStatus,
      note
    );
    setEditingRowKey(null);
    setDraftLieReason('');
  };

  const handleSubmitManualCorrection = (
    scheduleId: string,
    dm: ResolvedDutyMember
  ) => {
    if (!dateEditStatus.canEdit) return;
    const selfClaim = formatSelfAttendanceClaim(dm.attendance);
    const finalNote = buildAdminVerificationNote(
      draftStatus,
      dm.effectiveStatus,
      draftIsFake,
      draftIsFake ? draftLieReason || draftNote : draftNote,
      selfClaim
    );
    onRecordAttendance(
      selectedDate,
      scheduleId,
      dm.member.id,
      draftStatus,
      finalNote
    );
    setEditingRowKey(null);
    setDraftNote('');
    setDraftLieReason('');
  };

  const getStatusBadgeClasses = (status: AttendanceStatus, isFake: boolean) => {
    if (isFake) return 'bg-rose-100 text-rose-800 border-rose-300';
    switch (status) {
      case 'hadir':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'terlambat':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'izin':
      case 'sakit':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'tidak_piket':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-stone-100 text-stone-600 border-stone-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Sculpted 3D Top Header & Date Switcher */}
      <section className="card-3d p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Verifikasi Kehadiran Piket
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-slate-700">
                {formatFullDateId(selectedDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span>Minggu ke-{getWeekOfMonth(selectedDate)}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-600">
                <Clock className="w-3 h-3" />
                {currentTime.slice(0, 5)} WIB
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* Compact Date Stepper */}
            <div className="inline-flex items-center border border-stone-200 rounded-lg bg-stone-50 p-0.5">
              <button
                type="button"
                onClick={() => {
                  const prev = addDays(selectedDate, -1);
                  onSelectDate(prev);
                  onSelectNextPreviewDate(addDays(prev, 1));
                }}
                aria-label="Hari Sebelumnya"
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectDate(todayStr);
                  onSelectNextPreviewDate(addDays(todayStr, 1));
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedDate === todayStr
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-700 hover:bg-white'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = addDays(selectedDate, 1);
                  onSelectDate(next);
                  onSelectNextPreviewDate(addDays(next, 1));
                }}
                aria-label="Hari Berikutnya"
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-md transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <input
              type="date"
              aria-label="Pilih Tanggal Verifikasi"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(e.target.value);
                  onSelectNextPreviewDate(addDays(e.target.value, 1));
                }
              }}
              className="px-2.5 py-1.5 text-xs font-mono bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:border-stone-400"
            />

            <button
              type="button"
              data-testid="btn-toggle-testing-mode"
              aria-pressed={isTestingMode}
              onClick={() => onToggleTestingMode(!isTestingMode)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap ${
                isTestingMode
                  ? 'border-indigo-400 bg-indigo-600 text-white shadow-[0_2px_0_0_#3730A3] hover:-translate-y-0.5'
                  : 'btn-3d-secondary text-slate-600'
              }`}
              title={
                isTestingMode
                  ? 'Mode Uji Coba sedang aktif (tanpa batasan jam & tanggal). Klik untuk menonaktifkan.'
                  : 'Aktifkan Mode Uji Coba agar absensi & verifikasi bisa diuji kapan saja tanpa batasan waktu.'
              }
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Uji Coba: {isTestingMode ? 'Aktif' : 'Nonaktif'}</span>
            </button>

            <button
              type="button"
              data-testid="btn-toggle-leaderboard-feature"
              aria-pressed={isLeaderboardEnabled}
              onClick={() => onToggleLeaderboardEnabled(!isLeaderboardEnabled)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap ${
                isLeaderboardEnabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_2px_0_0_#A7F3D0] hover:-translate-y-0.5'
                  : 'btn-3d-secondary text-slate-600'
              }`}
              title={
                isLeaderboardEnabled
                  ? 'Leaderboard Pelanggaran sedang aktif di halaman utama. Klik untuk menonaktifkan.'
                  : 'Leaderboard Pelanggaran sedang nonaktif. Klik untuk mengaktifkan.'
              }
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>
                Leaderboard: {isLeaderboardEnabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </button>

            <button
              type="button"
              data-testid="btn-open-holiday-manager"
              onClick={handleOpenHolidayPanel}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                isHolidayPanelOpen
                  ? 'rounded-lg bg-rose-600 border border-rose-700 text-white shadow-[0_2px_0_0_#9F1239]'
                  : 'btn-3d-secondary text-slate-700'
              }`}
            >
              <CalendarOff className="w-3.5 h-3.5" />
              <span>
                Libur Piket
                {allHolidayRules.length > 0
                  ? ` (${allHolidayRules.length})`
                  : ''}
              </span>
            </button>

            <button
              type="button"
              data-testid="btn-export-attendance-pdf"
              onClick={handleExportPdf}
              className="btn-3d-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Active Mode Uji Coba Banner */}
        {isTestingMode && (
          <div
            data-testid="admin-testing-mode-banner"
            className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-900"
          >
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong className="text-indigo-950">
                  Mode Uji Coba Aktif (Tanpa Batasan Waktu):
                </strong>{' '}
                Absensi publik, verifikasi, dan tukar jadwal terbuka 24 jam
                untuk semua tanggal & pos piket.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleTestingMode(false)}
              className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold whitespace-nowrap self-start sm:self-auto"
            >
              Nonaktifkan
            </button>
          </div>
        )}

        {/* Strict Date Lock Banner for Past / Future Dates */}
        {!dateEditStatus.canEdit && (
          <div
            data-testid="admin-date-lock-banner"
            className="p-3 rounded-lg bg-stone-100 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-700"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-stone-500 shrink-0" />
              <span>
                <strong className="text-stone-900">
                  Mode Lihat Saja ({dateEditStatus.label}):
                </strong>{' '}
                {dateEditStatus.reason}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectDate(todayStr);
                onSelectNextPreviewDate(addDays(todayStr, 1));
              }}
              className="px-3 py-1 rounded-md bg-stone-900 text-white font-semibold whitespace-nowrap self-start sm:self-auto"
            >
              Buka Hari Ini
            </button>
          </div>
        )}

        {/* Active Per-Category Holiday Banner(s) on Selected Date */}
        {activeHolidaysOnDate.length > 0 && !isHolidayPanelOpen && (
          <div
            data-testid="admin-active-holidays-banner"
            className="p-3 rounded-lg border bg-rose-50 border-rose-200 space-y-2 text-xs text-rose-900"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold uppercase tracking-wide text-[11px] text-rose-800">
                Libur Piket Aktif pada Tanggal Ini
              </span>
              <button
                type="button"
                onClick={handleOpenHolidayPanel}
                className="text-rose-700 hover:underline font-semibold text-xs"
              >
                Kelola Libur
              </button>
            </div>
            <div className="space-y-1.5">
              {activeHolidaysOnDate.map((h) => (
                <div
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-white border border-rose-200 rounded-md px-2.5 py-1.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                      {HOLIDAY_CATEGORY_LABELS[h.category]}
                    </span>
                    <span className="font-mono font-semibold text-rose-800 text-[11px]">
                      {formatShortDateRangeId(h.startDate, h.endDate)}
                    </span>
                    <span className="text-stone-700 font-medium">
                      — {h.reason}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteHolidayRange(h.id)}
                    className="text-rose-700 hover:underline font-semibold inline-flex items-center gap-1 text-[11px]"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Single-Day Note Banner (if any exists in DB) */}
        {currentDayNote && (
          <div
            data-testid="active-day-note-banner"
            className="p-3 rounded-lg border bg-amber-50 border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wide text-[11px]">
                {currentDayNote.isHoliday ? 'Libur:' : 'Catatan:'}
              </span>
              <span className="font-medium">{currentDayNote.note}</span>
            </div>
            {dateEditStatus.canEdit && (
              <button
                type="button"
                data-testid="btn-clear-day-note"
                onClick={() =>
                  onClearDayOrShiftNote(selectedDate, DAY_NOTE_SCHEDULE_ID)
                }
                className="text-rose-700 hover:underline font-semibold inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus</span>
              </button>
            )}
          </div>
        )}

        {/* Per-Category Date-Range Holiday ("Libur Piket") Manager Panel */}
        {isHolidayPanelOpen && (
          <div
            data-testid="holiday-manager-panel"
            className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Atur Libur Piket (Per Kategori & Rentang Tanggal)
                </h2>
                <p className="text-[11px] text-stone-500">
                  Pilih kategori jadwal piket, rentang tanggal libur, dan alasan
                  resmi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHolidayPanelOpen(false)}
                aria-label="Tutup Pengaturan Libur"
                className="p-1 text-stone-400 hover:text-stone-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitHolidayRange} className="space-y-3">
              {/* 1. Kategori Jadwal Piket */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-bold text-stone-700 uppercase tracking-wide">
                  1. Kategori Jadwal Piket
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'Semua Kategori' },
                      { id: 'gerbang', label: 'Jaga Gerbang' },
                      { id: 'warsis', label: 'Piket Warsis' },
                      { id: 'shalat', label: 'Absensi Shalat' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      data-testid={`holiday-cat-${cat.id}`}
                      onClick={() => setHolidayCategory(cat.id)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        holidayCategory === cat.id
                          ? 'bg-stone-900 border-stone-900 text-white'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Rentang Tanggal (Dari - Sampai) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="holiday-start-date"
                    className="block text-[11px] font-bold text-stone-700 uppercase tracking-wide"
                  >
                    2. Dari Tanggal
                  </label>
                  <input
                    id="holiday-start-date"
                    data-testid="input-holiday-start-date"
                    type="date"
                    min={isTestingMode ? undefined : todayStr}
                    value={holidayStartDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHolidayStartDate(val);
                      if (val && holidayEndDate < val) {
                        setHolidayEndDate(val);
                      }
                      setHolidayFormError('');
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:border-stone-500"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="holiday-end-date"
                    className="block text-[11px] font-bold text-stone-700 uppercase tracking-wide"
                  >
                    Sampai Tanggal
                  </label>
                  <input
                    id="holiday-end-date"
                    data-testid="input-holiday-end-date"
                    type="date"
                    min={holidayStartDate || todayStr}
                    value={holidayEndDate}
                    onChange={(e) => {
                      setHolidayEndDate(e.target.value);
                      setHolidayFormError('');
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:border-stone-500"
                  />
                </div>
              </div>

              {/* 3. Alasan Libur */}
              <div className="space-y-1.5">
                <label
                  htmlFor="holiday-reason-input"
                  className="block text-[11px] font-bold text-stone-700 uppercase tracking-wide"
                >
                  3. Alasan Libur Piket (Wajib)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_ATTENDANCE_NOTE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setHolidayReason(preset);
                        setHolidayFormError('');
                      }}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border ${
                        holidayReason === preset
                          ? 'bg-stone-900 border-stone-900 text-white'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  id="holiday-reason-input"
                  data-testid="input-holiday-reason"
                  type="text"
                  value={holidayReason}
                  onChange={(e) => {
                    setHolidayReason(e.target.value);
                    setHolidayFormError('');
                  }}
                  placeholder="Contoh: Libur Semester, Classmeeting, Ujian Sekolah, Rapat Guru..."
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:border-stone-500"
                />
              </div>

              {holidayFormError && (
                <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {holidayFormError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsHolidayPanelOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  data-testid="btn-save-holiday-range"
                  disabled={isSavingHoliday}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white"
                >
                  {isSavingHoliday ? 'Menyimpan...' : 'Simpan Libur Piket'}
                </button>
              </div>
            </form>

            {/* Saved Holiday Rules List */}
            {allHolidayRules.length > 0 && (
              <div className="pt-3 border-t border-stone-200 space-y-2">
                <span className="block text-[11px] font-bold text-stone-600 uppercase tracking-wide">
                  Daftar Libur Piket Terjadwal ({allHolidayRules.length})
                </span>
                <div className="space-y-1.5">
                  {allHolidayRules.map((rule) => (
                    <div
                      key={rule.id}
                      data-testid={`holiday-rule-item-${rule.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] shrink-0">
                          {HOLIDAY_CATEGORY_LABELS[rule.category]}
                        </span>
                        <span className="font-mono font-semibold text-stone-800 text-[11px] shrink-0">
                          {formatShortDateRangeId(rule.startDate, rule.endDate)}
                        </span>
                        <span className="text-stone-600 truncate">
                          {rule.reason}
                        </span>
                      </div>
                      <button
                        type="button"
                        data-testid={`btn-delete-holiday-${rule.id}`}
                        onClick={() => onDeleteHolidayRange(rule.id)}
                        className="inline-flex items-center gap-1 text-rose-700 hover:underline font-semibold text-[11px] shrink-0 self-start sm:self-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {pdfFeedback && (
          <div
            role="status"
            data-testid="pdf-export-feedback"
            className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{pdfFeedback}</span>
          </div>
        )}

        {/* Compact Progress & Summary Line */}
        <div className="pt-3 border-t border-stone-100 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-600">
              <span>
                Hadir:{' '}
                <strong className="font-mono text-emerald-700">
                  {overallProgress.hadirCount}
                </strong>
              </span>
              <span>
                Terlambat:{' '}
                <strong className="font-mono text-sky-700">
                  {overallProgress.terlambatCount}
                </strong>
              </span>
              <span>
                Izin:{' '}
                <strong className="font-mono text-amber-700">
                  {overallProgress.excusedCount}
                </strong>
              </span>
              <span>
                Alfa:{' '}
                <strong className="font-mono text-rose-700">
                  {overallProgress.absentCount}
                </strong>
              </span>
              <span>
                Belum Absen:{' '}
                <strong className="font-mono text-stone-700">
                  {overallProgress.pendingCount}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
              {pendingVerificationCount > 0 && (
                <span className="text-amber-700 font-semibold">
                  Perlu Verifikasi: {pendingVerificationCount}
                </span>
              )}
              {fakeAttendanceCount > 0 && (
                <span className="text-rose-700 font-semibold">
                  Dia Bohong: {fakeAttendanceCount}
                </span>
              )}
              <span
                data-testid="active-shift-checkin-count"
                className="font-bold text-stone-900"
              >
                {overallProgress.checkedInCount}/{overallProgress.totalMembers}{' '}
                ({overallProgress.checkedInPercentage}%)
              </span>
            </div>
          </div>

          <div
            role="progressbar"
            aria-label="Progress Kehadiran Hari Ini"
            aria-valuenow={overallProgress.checkedInPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="progress-3d-track w-full h-2.5 rounded-full overflow-hidden flex"
          >
            <div
              style={{ width: `${overallProgress.checkedInPercentage}%` }}
              className="progress-3d-fill h-full bg-gradient-to-b from-emerald-400 to-emerald-600 transition-all duration-300"
            />
            {overallProgress.excusedPercentage > 0 && (
              <div
                style={{ width: `${overallProgress.excusedPercentage}%` }}
                className="progress-3d-fill h-full bg-gradient-to-b from-amber-300 to-amber-500 transition-all duration-300"
              />
            )}
            {overallProgress.absentPercentage > 0 && (
              <div
                style={{ width: `${overallProgress.absentPercentage}%` }}
                className="progress-3d-fill h-full bg-gradient-to-b from-rose-400 to-rose-600 transition-all duration-300"
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. Simple Filter Bar (Pos & Verification Status) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setScheduleFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              scheduleFilter === 'all'
                ? 'bg-stone-900 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            Semua Pos ({todaySchedules.length})
          </button>
          {todaySchedules.map((item) => (
            <button
              key={item.schedule.id}
              type="button"
              onClick={() => setScheduleFilter(item.schedule.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                scheduleFilter === item.schedule.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {item.schedule.title
                .replace(/^Jadwal\s+/i, '')
                .replace(/^(Piket|Petugas)\s+/i, '')}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'all', label: 'Semua' },
              {
                id: 'pending_verify',
                label: `Perlu Verifikasi (${pendingVerificationCount})`,
              },
              { id: 'fake', label: `Dia Bohong (${fakeAttendanceCount})` },
              {
                id: 'belum_absen',
                label: `Belum Absen (${overallProgress.pendingCount})`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setVerifyFilter(f.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                verifyFilter === f.id
                  ? 'bg-stone-200 text-stone-900 font-semibold'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Clean Verification List per Pos */}
      {filteredTodaySchedules.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-stone-800">
            Tidak ada jadwal piket aktif pada {formatFullDateId(selectedDate)}.
          </p>
          <p className="text-xs text-stone-500">
            Gunakan pemilih tanggal di atas untuk melihat hari lain atau atur
            jadwal di menu Jadwal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTodaySchedules.map(({ schedule, dutyMembers }) => {
            const posRule = getPosRuleInfo(schedule.title);
            const posHoliday = getHolidayForScheduleOnDate(
              selectedDate,
              schedule.title,
              attendanceRecords
            );
            return (
              <section
                key={schedule.id}
                data-testid={`admin-pos-section-${schedule.id}`}
                className="card-3d overflow-hidden"
              >
                {/* Clean Sculpted Pos Header */}
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/90 bg-gradient-to-b from-slate-50/70 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">
                        {schedule.title}
                      </h2>
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {schedule.startTime} – {schedule.endTime} WIB
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-600">
                        {schedule.location}
                      </span>
                      {posHoliday && (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                          LIBUR PIKET
                        </span>
                      )}
                    </div>
                    {posHoliday ? (
                      <p
                        data-testid={`admin-pos-holiday-${schedule.id}`}
                        className="text-xs text-rose-700 font-semibold flex items-center gap-1.5"
                      >
                        <CalendarOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>
                          Libur (
                          {formatShortDateRangeId(
                            posHoliday.startDate,
                            posHoliday.endDate
                          )}
                          ): {posHoliday.reason}
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{posRule.ruleSummary}</span>
                      </p>
                    )}
                  </div>

                  {dateEditStatus.canEdit && !posHoliday && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenSwapModal(selectedDate, schedule.id)
                        }
                        className="btn-3d-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
                        <span>Tukar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMarkAllPresent(selectedDate, schedule.id)
                        }
                        className="btn-3d-emerald inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verifikasi Semua</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Officer Verification Rows */}
                {dutyMembers.length === 0 ? (
                  <p className="px-5 py-6 text-xs text-stone-500 text-center">
                    Tidak ada petugas yang cocok dengan filter status saat ini.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {dutyMembers.map((dm, idx) => {
                      const rowKey = `${schedule.id}:${dm.member.id}`;
                      const isEditing = editingRowKey === rowKey;
                      const isPendingVerify = isPublicSelfAttendance(
                        dm.attendance
                      );
                      const isVerified = isAttendanceVerifiedByAdmin(
                        dm.attendance
                      );
                      const lieInfo = parseLieAttendanceRecord(dm.attendance);
                      const isFake = lieInfo.isLie;
                      const orgLabel = getMemberOrgLabel(dm.member);
                      const isViolationRow =
                        isViolationAttendanceRecord(dm.attendance) ||
                        dm.isAutoAlfa;
                      const isViolationLockedForAdmin =
                        isViolationRow && !canDeleteViolations;

                      return (
                        <div
                          key={rowKey}
                          data-testid={`admin-verify-row-${schedule.id}-${dm.member.id}`}
                          className={`px-4 sm:px-5 py-3 ${
                            isFake
                              ? 'bg-rose-50/35'
                              : isPendingVerify
                              ? 'bg-amber-50/30'
                              : ''
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                            {/* Officer Identity & Current Record */}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-mono text-stone-400 w-5">
                                  {idx + 1}.
                                </span>
                                <span className="text-sm font-semibold text-stone-900">
                                  {dm.member.name}
                                </span>
                                <span className="text-[11px] text-stone-500 font-medium">
                                  {orgLabel} · {dm.member.kelas}
                                </span>
                                {!isFake &&
                                  dm.attendance?.checkInTime &&
                                  dm.attendance.checkInTime !== '-' && (
                                    <span className="text-[11px] font-mono text-stone-500">
                                      ({dm.attendance.checkInTime} WIB)
                                    </span>
                                  )}
                              </div>

                              {/* Neat Two-Tier Lie Callout vs Normal Verification / Auto-Alfa Status */}
                              {isFake ? (
                                <div
                                  data-testid={`admin-lie-callout-${dm.member.id}`}
                                  className="ml-7 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 space-y-1 max-w-xl"
                                >
                                  {lieInfo.selfClaim && (
                                    <p className="text-[11px] text-stone-500 font-medium leading-tight">
                                      Absen diisi sendiri:{' '}
                                      <span className="line-through">
                                        {lieInfo.selfClaim}
                                      </span>
                                    </p>
                                  )}
                                  <p className="text-sm font-extrabold text-rose-700 leading-snug flex items-start gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <span>{lieInfo.headline}</span>
                                  </p>
                                </div>
                              ) : (
                                <div className="pl-7 flex flex-wrap items-center gap-2 text-[11px]">
                                  {isPendingVerify ? (
                                    <span className="font-semibold text-amber-700">
                                      Absen Publik · Menunggu Verifikasi
                                    </span>
                                  ) : isVerified ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                      <ShieldCheck className="w-3 h-3" />
                                      Terverifikasi (Langsung sah)
                                    </span>
                                  ) : dm.isAutoAlfa ? (
                                    <span
                                      data-testid={`admin-auto-alfa-${dm.member.id}`}
                                      className="font-semibold text-rose-700"
                                    >
                                      Otomatis Alfa · Tidak mengisi absen hingga batas waktu
                                    </span>
                                  ) : (
                                    <span className="text-stone-400">
                                      Belum mengisi absen
                                    </span>
                                  )}

                                  {dm.attendance?.note && (
                                    <>
                                      <span
                                        aria-hidden="true"
                                        className="text-stone-300"
                                      >
                                        ·
                                      </span>
                                      <span className="text-stone-600">
                                        {dm.attendance.note}
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Direct Admin Attendance + Verification Action Controls */}
                            <div className="flex flex-wrap items-center gap-1.5 pl-7 sm:pl-0 shrink-0">
                              {dateEditStatus.canEdit && !posHoliday ? (
                                <>
                                  {/* Direct 1-click Admin attendance (no verification needed) */}
                                  <div
                                    className="inline-flex items-center p-0.5 bg-stone-100 rounded-lg border border-stone-200"
                                    role="group"
                                    aria-label={`Absen langsung admin untuk ${dm.member.name}`}
                                  >
                                    {(
                                      [
                                        {
                                          id: 'hadir',
                                          label: 'Hadir',
                                          active:
                                            'bg-emerald-600 text-white shadow-xs',
                                        },
                                        {
                                          id: 'terlambat',
                                          label: 'Telat',
                                          active:
                                            'bg-amber-600 text-white shadow-xs',
                                        },
                                        {
                                          id: 'izin',
                                          label: 'Izin',
                                          active:
                                            'bg-sky-600 text-white shadow-xs',
                                        },
                                        {
                                          id: 'tidak_piket',
                                          label: 'Alfa',
                                          active:
                                            'bg-rose-600 text-white shadow-xs',
                                        },
                                      ] as const
                                    ).map((btn) => {
                                      const isSelected =
                                        isVerified &&
                                        dm.effectiveStatus === btn.id &&
                                        !isFake;
                                      const isBlockedForAdmin =
                                        isViolationLockedForAdmin &&
                                        (btn.id === 'hadir' ||
                                          btn.id === 'izin');
                                      return (
                                        <button
                                          key={btn.id}
                                          type="button"
                                          disabled={isBlockedForAdmin}
                                          data-testid={`btn-admin-direct-${btn.id}-${dm.member.id}`}
                                          onClick={() =>
                                            handleDirectAdminAttendance(
                                              schedule.id,
                                              dm,
                                              btn.id
                                            )
                                          }
                                          className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                                            isBlockedForAdmin
                                              ? 'text-stone-300 cursor-not-allowed'
                                              : isSelected
                                              ? btn.active
                                              : 'text-stone-600 hover:text-stone-900 hover:bg-white'
                                          }`}
                                          title={
                                            isBlockedForAdmin
                                              ? 'Data pelanggaran dilindungi dan hanya dapat diubah ke Hadir/Izin oleh Developer'
                                              : isSelected
                                              ? isViolationLockedForAdmin
                                                ? 'Status pelanggaran terkunci (hanya Developer yang dapat membatalkan)'
                                                : `Klik lagi untuk membatalkan tanda ${btn.label}`
                                              : `Absen langsung ${btn.label} oleh Admin (tanpa perlu verifikasi)`
                                          }
                                        >
                                          {btn.label}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {dm.attendance && !isViolationLockedForAdmin && (
                                    <button
                                      type="button"
                                      data-testid={`btn-admin-cancel-attendance-${dm.member.id}`}
                                      aria-label={`Batalkan tanda absen ${dm.member.name}`}
                                      onClick={() =>
                                        handleCancelAttendance(schedule.id, dm)
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md border border-stone-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-stone-600 transition-colors whitespace-nowrap"
                                      title="Hilangkan tanda absen (batalkan jika kepencet)"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Batal</span>
                                    </button>
                                  )}

                                  {isViolationLockedForAdmin && (
                                    <span
                                      data-testid={`badge-violation-locked-${dm.member.id}`}
                                      title="Data pelanggaran dilindungi dan hanya dapat dihapus oleh Developer"
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-rose-200 bg-rose-50 text-rose-700 whitespace-nowrap"
                                    >
                                      <Lock className="w-3 h-3" />
                                      <span>Pelanggaran Terkunci</span>
                                    </span>
                                  )}

                                  {isPendingVerify && (
                                    <button
                                      type="button"
                                      data-testid={`btn-admin-verify-valid-${dm.member.id}`}
                                      onClick={() =>
                                        handleQuickVerifyValid(schedule.id, dm)
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
                                      title="Konfirmasi absensi publik ini valid"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Verifikasi</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    data-testid={`btn-admin-correct-${dm.member.id}`}
                                    onClick={() =>
                                      handleOpenCorrectionDrawer(
                                        schedule.id,
                                        dm
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                                      isEditing
                                        ? 'bg-stone-900 border-stone-900 text-white'
                                        : 'bg-white border-stone-200 hover:bg-stone-100 text-stone-700'
                                    }`}
                                  >
                                    <SlidersHorizontal className="w-3 h-3" />
                                    <span>Koreksi / Bohong</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span
                                    className={`px-2.5 py-1 rounded-md border text-xs font-semibold ${getStatusBadgeClasses(
                                      dm.effectiveStatus,
                                      isFake
                                    )}`}
                                  >
                                    {STATUS_LABELS_ID[dm.effectiveStatus]}
                                  </span>
                                  {posHoliday ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                                      <CalendarOff className="w-3 h-3" />
                                      Libur
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                                      <Lock className="w-3 h-3" />
                                      Terkunci
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Expandable Clean Verification & "Dia bohong $alasan" Correction Panel */}
                          {isEditing && dateEditStatus.canEdit && !posHoliday && (
                            <div
                              data-testid={`admin-correction-panel-${dm.member.id}`}
                              className="mt-3 ml-0 sm:ml-7 p-3.5 rounded-lg bg-stone-50 border border-stone-200 space-y-3"
                            >
                              {/* Quick "Dia bohong $alasan" Block */}
                              <div className="space-y-2">
                                <span className="block text-[11px] font-bold text-rose-700 uppercase tracking-wide">
                                  Tandai Bohong (Dia bohong + Alasan)
                                </span>

                                <div className="flex flex-wrap gap-1.5">
                                  {LIE_REASON_PRESETS.map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setDraftLieReason(preset)}
                                      className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                                        draftLieReason === preset
                                          ? 'bg-rose-600 border-rose-600 text-white'
                                          : 'bg-white border-stone-200 text-stone-700 hover:bg-rose-50'
                                      }`}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>

                                <input
                                  type="text"
                                  data-testid={`input-lie-reason-${dm.member.id}`}
                                  value={draftLieReason}
                                  onChange={(e) =>
                                    setDraftLieReason(e.target.value)
                                  }
                                  placeholder="Tulis alasan (contoh: tidak ada di pos saat jam piket)..."
                                  className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-rose-400"
                                />

                                <div className="p-2 rounded-md bg-white border border-rose-200 text-[11px] space-y-0.5">
                                  {formatSelfAttendanceClaim(dm.attendance) && (
                                    <p className="text-stone-500">
                                      Absen diisi sendiri:{' '}
                                      <span className="line-through">
                                        {formatSelfAttendanceClaim(dm.attendance)}
                                      </span>
                                    </p>
                                  )}
                                  <p className="text-xs font-extrabold text-rose-700">
                                    Dia bohong{' '}
                                    {draftLieReason.trim() ||
                                      'tidak melaksanakan piket di lokasi'}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    data-testid={`btn-fake-alfa-${dm.member.id}`}
                                    onClick={() =>
                                      handleQuickLieAttendance(
                                        schedule.id,
                                        dm,
                                        'tidak_piket'
                                      )
                                    }
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                                  >
                                    Set Alfa — Dia Bohong
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`btn-fake-terlambat-${dm.member.id}`}
                                    onClick={() =>
                                      handleQuickLieAttendance(
                                        schedule.id,
                                        dm,
                                        'terlambat'
                                      )
                                    }
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                                  >
                                    Set Terlambat — Dia Bohong
                                  </button>
                                </div>
                              </div>

                              {/* Manual Status & Note Correction */}
                              <div className="pt-2.5 border-t border-stone-200 space-y-2.5">
                                <span className="block text-[11px] font-bold text-stone-600 uppercase tracking-wide">
                                  Atau Pilih Status Verifikasi Manual
                                </span>
                                {isViolationLockedForAdmin && (
                                  <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      Data pelanggaran dilindungi: Admin tidak
                                      dapat menghapus atau mengubah status
                                      pelanggaran menjadi Hadir/Izin (khusus
                                      Developer).
                                    </span>
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                  {(
                                    [
                                      { id: 'hadir', label: 'Hadir' },
                                      { id: 'terlambat', label: 'Terlambat' },
                                      { id: 'izin', label: 'Izin' },
                                      { id: 'tidak_piket', label: 'Alfa' },
                                    ] as const
                                  ).map((st) => {
                                    const isDisabledOption =
                                      isViolationLockedForAdmin &&
                                      (st.id === 'hadir' || st.id === 'izin');
                                    return (
                                      <button
                                        key={st.id}
                                        type="button"
                                        disabled={isDisabledOption}
                                        onClick={() => setDraftStatus(st.id)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                          isDisabledOption
                                            ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                                            : draftStatus === st.id
                                            ? 'bg-stone-900 border-stone-900 text-white'
                                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                                        }`}
                                      >
                                        {st.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <input
                                    type="text"
                                    value={draftNote}
                                    onChange={(e) =>
                                      setDraftNote(e.target.value)
                                    }
                                    placeholder="Keterangan verifikasi normal (opsional)..."
                                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-500"
                                  />
                                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 cursor-pointer shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={draftIsFake}
                                      onChange={(e) =>
                                        setDraftIsFake(e.target.checked)
                                      }
                                      className="rounded border-rose-300 text-rose-600"
                                    />
                                    <span>Tandai Dia Bohong</span>
                                  </label>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    {dm.attendance &&
                                      !isViolationLockedForAdmin && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCancelAttendance(
                                              schedule.id,
                                              dm
                                            )
                                          }
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          <span>Hapus Tanda Absen</span>
                                        </button>
                                      )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingRowKey(null)}
                                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
                                    >
                                      Tutup
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSubmitManualCorrection(
                                          schedule.id,
                                          dm
                                        )
                                      }
                                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white"
                                    >
                                      Simpan Verifikasi
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
