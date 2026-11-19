import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Calendar,
  CalendarOff,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Lock,
  MoonStar,
  Search,
  Shield,
  Store,
  Trophy,
  X,
} from 'lucide-react';
import {
  DAY_NAMES_ID,
  HOLIDAY_CATEGORY_LABELS,
  STATUS_LABELS_ID,
  addDays,
  calculateShiftCheckInProgress,
  canPublicEditAttendanceRecord,
  evaluatePublicAttendanceSubmission,
  findDateForWeekAndDay,
  formatFullDateId,
  formatShortDateRangeId,
  getActiveHolidaysForDate,
  getDayAttendanceNote,
  getHolidayForScheduleOnDate,
  getMemberOrgLabel,
  getMemberPersonalSchedules,
  getPosAttendanceWindowStatus,
  getPosRuleInfo,
  getScheduleDateEditStatus,
  getWeekOfMonth,
  isAttendanceVerifiedByAdmin,
  isPublicSelfAttendance,
  parseCompletedSessionsFromNote,
  parseDateString,
  parseLieAttendanceRecord,
  type AttendanceRecord,
  type AttendanceStatus,
  type OsisMember,
  type PiketSchedule,
  type PublicAttendanceChoice,
  type ResolvedDutyMember,
  type ResolvedScheduleForDate,
  type ScheduleSwap,
} from '../utils/piketLogic';
import {
  generateDailyAttendancePdfBytes,
  generateMemberPersonalSchedulePdfBytes,
  triggerPdfDownload,
} from '../utils/pdfExporter';
import { ViolationLeaderboard } from './ViolationLeaderboard';
import { SceneEmblem3D } from './SceneEmblem3D';
import { TiltCard3D } from './TiltCard3D';

interface PublicDisplayBoardProps {
  todayStr: string;
  currentTimeHHMM: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  nextPreviewDate: string;
  onSelectNextPreviewDate: (date: string) => void;
  todaySchedules: ResolvedScheduleForDate[];
  nextDaySchedules: ResolvedScheduleForDate[];
  allSchedules: PiketSchedule[];
  members: OsisMember[];
  swaps: ScheduleSwap[];
  attendanceRecords: AttendanceRecord[];
  isLeaderboardEnabled: boolean;
  onPublicRecordAttendance: (
    date: string,
    scheduleId: string,
    memberId: string,
    status: AttendanceStatus,
    checkInTime: string,
    note: string
  ) => Promise<void> | void;
}

export const PublicDisplayBoard: React.FC<PublicDisplayBoardProps> = ({
  todayStr,
  currentTimeHHMM,
  selectedDate,
  onSelectDate,
  onSelectNextPreviewDate,
  todaySchedules,
  allSchedules,
  members,
  swaps,
  attendanceRecords,
  isLeaderboardEnabled,
  onPublicRecordAttendance,
}) => {
  const [liveTime, setLiveTime] = useState<string>(`${currentTimeHHMM}:00`);
  const [activeView, setActiveView] = useState<'jadwal' | 'leaderboard'>(
    'jadwal'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orgFilter, setOrgFilter] = useState<'all' | 'OSIS' | 'MPK'>('all');
  const [mobilePosTab, setMobilePosTab] = useState<
    'all' | 'gerbang' | 'warsis' | 'shalat'
  >('all');
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] =
    useState<boolean>(false);

  // Unified Public Attendance + Personal Schedule Modal state (IDs only so live Firestore updates stay in sync)
  const [attendanceModalTarget, setAttendanceModalTarget] = useState<{
    scheduleId: string;
    memberId: string;
  } | null>(null);
  const [attendanceModalTab, setAttendanceModalTab] = useState<
    'absen' | 'jadwal'
  >('absen');
  const [selectedChoice, setSelectedChoice] =
    useState<PublicAttendanceChoice>('hadir');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [izinReason, setIzinReason] = useState<string>('');
  const [attendanceFormError, setAttendanceFormError] = useState<string>('');
  const [isSubmittingAttendance, setIsSubmittingAttendance] =
    useState<boolean>(false);

  useEffect(() => {
    const syncClock = () => {
      const now = new Date();
      setLiveTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    };
    syncClock();
    const timer = window.setInterval(syncClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Automatically return to schedule view if Admin disables the Leaderboard feature
  useEffect(() => {
    if (!isLeaderboardEnabled && activeView === 'leaderboard') {
      setActiveView('jadwal');
    }
  }, [isLeaderboardEnabled, activeView]);

  // Close open modals cleanly on Escape key
  useEffect(() => {
    if (!attendanceModalTarget && !isDatePickerModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAttendanceModalTarget(null);
        setIsDatePickerModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attendanceModalTarget, isDatePickerModalOpen]);

  const tomorrowStr = addDays(todayStr, 1);
  const isShowingToday = selectedDate === todayStr;
  const isShowingTomorrow = selectedDate === tomorrowStr;
  const currentWeekOfMonth = getWeekOfMonth(selectedDate);
  const selectedDayOfWeek = parseDateString(selectedDate).getDay();
  const dateEditStatus = getScheduleDateEditStatus(selectedDate, todayStr);
  const nowHHMM = liveTime.slice(0, 5);

  const activeHolidaysOnDate = getActiveHolidaysForDate(
    selectedDate,
    attendanceRecords
  );
  const activeDayNote = getDayAttendanceNote(selectedDate, attendanceRecords);

  const matchesCategory = (
    schedule: PiketSchedule,
    cat: 'warsis' | 'gerbang' | 'shalat'
  ) => {
    const lower = schedule.title.toLowerCase();
    if (cat === 'gerbang') return lower.includes('gerbang');
    if (cat === 'warsis') return lower.includes('warsis') || lower.includes('wasis');
    return lower.includes('shalat') || lower.includes('sholat');
  };

  // Filtered schedules for display
  const q = searchQuery.trim().toLowerCase();
  const filteredTodaySchedules = todaySchedules
    .map((item) => {
      const titleMatch = q
        ? item.schedule.title.toLowerCase().includes(q)
        : false;
      const filteredMembers = item.dutyMembers.filter((dm) => {
        const org = getMemberOrgLabel(dm.member);
        if (orgFilter === 'OSIS' && org !== 'OSIS') return false;
        if (orgFilter === 'MPK' && org !== 'MPK') return false;
        if (q && !titleMatch) {
          return (
            dm.member.name.toLowerCase().includes(q) ||
            dm.member.kelas.toLowerCase().includes(q) ||
            org.toLowerCase().includes(q)
          );
        }
        return true;
      });
      if ((q || orgFilter !== 'all') && filteredMembers.length === 0) {
        return null;
      }
      return { ...item, dutyMembers: filteredMembers };
    })
    .filter((item): item is ResolvedScheduleForDate => item !== null);

  // Overall progress excluding holiday pos
  const activeNonHolidaySchedules = todaySchedules.filter(
    (s) =>
      !getHolidayForScheduleOnDate(
        selectedDate,
        s.schedule.title,
        attendanceRecords
      )
  );
  const dailyOverallProgress = calculateShiftCheckInProgress(
    activeNonHolidaySchedules.flatMap((s) => s.dutyMembers)
  );
  const totalOfficersToday = todaySchedules.reduce(
    (sum, s) => sum + s.dutyMembers.length,
    0
  );

  const openPublicAttendanceModal = (
    schedule: PiketSchedule,
    dutyMember: ResolvedDutyMember,
    initialTab: 'absen' | 'jadwal' = 'absen'
  ) => {
    const rule = getPosRuleInfo(schedule.title);
    const existing = dutyMember.attendance;

    let defaultChoice: PublicAttendanceChoice = 'hadir';
    if (existing) {
      if (existing.status === 'terlambat') defaultChoice = 'terlambat';
      else if (existing.status === 'izin' || existing.status === 'sakit')
        defaultChoice = 'izin';
      else if (existing.status === 'tidak_piket') defaultChoice = 'alfa';
      else defaultChoice = 'hadir';
    }

    const prevSessions = parseCompletedSessionsFromNote(
      schedule.title,
      existing?.note
    );
    const defaultSessions =
      rule.requiredSessions && rule.requiredSessions.length > 0
        ? prevSessions.length > 0
          ? prevSessions
          : [rule.requiredSessions[0].id]
        : [];

    setAttendanceModalTarget({
      scheduleId: schedule.id,
      memberId: dutyMember.member.id,
    });
    setAttendanceModalTab(initialTab);
    setSelectedChoice(defaultChoice);
    setSelectedSessions(defaultSessions);
    setIzinReason(
      existing && (existing.status === 'izin' || existing.status === 'sakit')
        ? existing.note
        : ''
    );
    setAttendanceFormError('');
  };

  // Derive live schedule & dutyMember from current resolved schedules so real-time updates never go stale
  const liveAttendanceModalData = (() => {
    if (!attendanceModalTarget) return null;
    const foundSchedule = todaySchedules.find(
      (s) => s.schedule.id === attendanceModalTarget.scheduleId
    );
    if (!foundSchedule) return null;
    const foundDutyMember = foundSchedule.dutyMembers.find(
      (dm) => dm.member.id === attendanceModalTarget.memberId
    );
    if (!foundDutyMember) return null;
    return {
      schedule: foundSchedule.schedule,
      dutyMember: foundDutyMember,
    };
  })();

  const handleSubmitPublicAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveAttendanceModalData) return;

    const { schedule: targetSchedule, dutyMember: targetDutyMember } =
      liveAttendanceModalData;

    if (!dateEditStatus.canEdit) {
      setAttendanceFormError(dateEditStatus.reason);
      return;
    }

    const posHoliday = getHolidayForScheduleOnDate(
      selectedDate,
      targetSchedule.title,
      attendanceRecords
    );
    if (posHoliday) {
      setAttendanceFormError(
        `${targetSchedule.title} sedang libur piket (${posHoliday.reason}).`
      );
      return;
    }

    if (
      targetDutyMember.attendance &&
      isAttendanceVerifiedByAdmin(targetDutyMember.attendance)
    ) {
      setAttendanceFormError(
        'Status absensi sudah diverifikasi oleh Admin dan tidak dapat diubah secara publik.'
      );
      return;
    }

    const windowStatus = getPosAttendanceWindowStatus(targetSchedule, nowHHMM);
    if (!windowStatus.isOpen) {
      setAttendanceFormError(windowStatus.message);
      return;
    }

    const evalResult = evaluatePublicAttendanceSubmission({
      scheduleTitle: targetSchedule.title,
      choice: selectedChoice,
      currentTimeHHMM: nowHHMM,
      selectedSessions,
      izinReason,
    });

    if (!evalResult.valid) {
      setAttendanceFormError(
        evalResult.error || 'Mohon lengkapi data absensi terlebih dahulu.'
      );
      return;
    }

    setIsSubmittingAttendance(true);
    try {
      await onPublicRecordAttendance(
        selectedDate,
        targetSchedule.id,
        targetDutyMember.member.id,
        evalResult.status,
        evalResult.checkInTime,
        evalResult.note
      );
      setAttendanceModalTarget(null);
    } catch {
      setAttendanceFormError(
        'Gagal mengirim absensi. Periksa koneksi internet lalu coba lagi.'
      );
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleDownloadDailyPdf = () => {
    const holidayNoteForPdf =
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
        : activeDayNote;

    const bytes = generateDailyAttendancePdfBytes(
      selectedDate,
      todaySchedules,
      liveTime,
      holidayNoteForPdf
    );
    triggerPdfDownload(bytes, `jadwal-piket-osis-${selectedDate}.pdf`);
  };

  const handleSelectWeekAndDay = (targetWeek: number, targetDay: number) => {
    const effectiveDay = targetDay === 0 || targetDay === 6 ? 1 : targetDay;
    const nextDateStr = findDateForWeekAndDay(
      selectedDate,
      targetWeek,
      effectiveDay
    );
    onSelectDate(nextDateStr);
    onSelectNextPreviewDate(addDays(nextDateStr, 1));
  };

  const getStatusTextStyle = (status: AttendanceStatus, isFake: boolean) => {
    if (isFake) return 'text-rose-700 font-semibold';
    if (status === 'hadir') return 'text-emerald-700 font-semibold';
    if (status === 'terlambat') return 'text-amber-700 font-semibold';
    if (status === 'izin' || status === 'sakit')
      return 'text-sky-700 font-semibold';
    if (status === 'tidak_piket') return 'text-rose-700 font-semibold';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-24 sm:pb-12">
      {/* 1. Sculpted 3D Top Header with Live Rotating 3D Emblem */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="card-3d px-4 sm:px-5 py-4 space-y-3.5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* 3D Rotating Cube Emblem + Date & quiet inline metadata */}
          <div className="flex items-center gap-3.5 min-w-0">
            <SceneEmblem3D size="md" />
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span
                  className={
                    isShowingToday
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-slate-700'
                  }
                >
                  {isShowingToday
                    ? 'Jadwal Hari Ini'
                    : isShowingTomorrow
                    ? 'Jadwal Besok'
                    : 'Jadwal Pilihan'}
                </span>
                <span aria-hidden="true">·</span>
                <span>Minggu ke-{currentWeekOfMonth}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{totalOfficersToday} petugas</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {formatFullDateId(selectedDate)}
              </h1>
            </div>
          </div>

          {/* 3D Hardware Clock Bezel & Tactile Date Switcher */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="clock-bezel-3d inline-flex items-center gap-1.5 px-3 py-1.5 text-white rounded-xl font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-sky-300" />
              <span>{liveTime.slice(0, 5)} WIB</span>
            </span>

            {isShowingToday ? (
              <button
                type="button"
                data-testid="btn-cek-jadwal-besok"
                onClick={() => {
                  onSelectDate(tomorrowStr);
                  onSelectNextPreviewDate(addDays(tomorrowStr, 1));
                }}
                className="btn-3d-secondary px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              >
                Besok
              </button>
            ) : (
              <button
                type="button"
                data-testid="btn-jadwal-hari-ini"
                onClick={() => {
                  onSelectDate(todayStr);
                  onSelectNextPreviewDate(tomorrowStr);
                }}
                className="btn-3d-primary px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              >
                Hari Ini
              </button>
            )}

            <button
              type="button"
              data-testid="btn-cek-jadwal-hari-lain"
              onClick={() => setIsDatePickerModalOpen(true)}
              className="btn-3d-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Pilih Tanggal</span>
            </button>
          </div>
        </div>

        {/* Navigation Switch (Jadwal Piket | Leaderboard Pelanggaran) + Minimal Filters */}
        <div className="pt-3 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {isLeaderboardEnabled ? (
            <div
              role="tablist"
              aria-label="Tampilan Utama"
              className="segmented-3d inline-flex items-center p-1 rounded-xl self-start"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'jadwal'}
                data-testid="tab-public-jadwal"
                onClick={() => setActiveView('jadwal')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  activeView === 'jadwal'
                    ? 'segmented-3d-active'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Jadwal Piket
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'leaderboard'}
                data-testid="tab-public-leaderboard"
                onClick={() => setActiveView('leaderboard')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  activeView === 'leaderboard'
                    ? 'segmented-3d-active'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Leaderboard Pelanggaran</span>
              </button>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-700">
              Daftar Petugas Piket
            </span>
          )}

          {(activeView === 'jadwal' || !isLeaderboardEnabled) && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="segmented-3d inline-flex items-center p-0.5 rounded-lg">
                {(['all', 'OSIS', 'MPK'] as const).map((org) => (
                  <button
                    key={org}
                    type="button"
                    onClick={() => setOrgFilter(org)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                      orgFilter === org
                        ? 'segmented-3d-active'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {org === 'all' ? 'Semua' : org}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 sm:w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau kelas..."
                  aria-label="Cari nama petugas piket"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300/90 rounded-lg text-slate-800 placeholder:text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] focus:outline-none focus:border-slate-500"
                />
              </div>

              <button
                type="button"
                data-testid="btn-download-daily-pdf-public"
                onClick={handleDownloadDailyPdf}
                className="btn-3d-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                title="Unduh daftar piket hari ini sebagai PDF"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          )}
        </div>
      </motion.header>

      {/* 2. Active View: 3D Perspective Switch between Leaderboard Pelanggaran & Jadwal Piket */}
      <div className="perspective-stage">
        <AnimatePresence mode="wait">
          {isLeaderboardEnabled && activeView === 'leaderboard' ? (
            <motion.div
              key="public-view-leaderboard"
              initial={{ opacity: 0, y: 12, rotateX: 4 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8, rotateX: -3 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <ViolationLeaderboard
                todayStr={todayStr}
                currentTimeHHMM={nowHHMM}
                schedules={allSchedules}
                members={members}
                swaps={swaps}
                attendanceRecords={attendanceRecords}
                defaultPeriod="mingguan"
              />
            </motion.div>
          ) : (
            <motion.div
              key={`public-view-jadwal-${selectedDate}`}
              initial={{ opacity: 0, y: 12, rotateX: 4 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8, rotateX: -3 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
          {/* Active Holiday Notice (Only rendered if a holiday applies on selectedDate) */}
          {activeHolidaysOnDate.length > 0 && (
            <div
              data-testid="public-holiday-summary-banner"
              className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1"
            >
              <div className="flex items-center gap-1.5 font-semibold text-rose-800">
                <CalendarOff className="w-4 h-4 shrink-0" />
                <span>Informasi Libur Piket Aktif</span>
              </div>
              <div className="space-y-1 pl-5">
                {activeHolidaysOnDate.map((h) => (
                  <p key={h.id}>
                    <strong className="text-rose-900">
                      {HOLIDAY_CATEGORY_LABELS[h.category]}
                    </strong>{' '}
                    ({formatShortDateRangeId(h.startDate, h.endDate)}) —{' '}
                    {h.reason}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Legacy Single-Day Note Banner */}
          {activeDayNote && activeHolidaysOnDate.length === 0 && (
            <div
              data-testid="public-day-note-banner"
              className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900"
            >
              <strong>
                {activeDayNote.isHoliday ? 'Libur Piket:' : 'Catatan Hari Ini:'}
              </strong>{' '}
              {activeDayNote.note}
            </div>
          )}

          {/* Past / Future Date Lock Notice (Only rendered when viewing non-today dates) */}
          {!dateEditStatus.canEdit && (
            <div
              data-testid="public-date-lock-banner"
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
            >
              <span className="inline-flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  <strong className="text-slate-800">
                    {dateEditStatus.label}:
                  </strong>{' '}
                  {dateEditStatus.reason}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectDate(todayStr);
                  onSelectNextPreviewDate(tomorrowStr);
                }}
                className="font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-700 whitespace-nowrap"
              >
                Kembali ke Hari Ini
              </button>
            </div>
          )}

          {/* Slim Single-Line 3D Attendance Summary Bar */}
          {activeNonHolidaySchedules.length > 0 && (
            <div className="card-3d-soft px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
                <span className="font-semibold text-slate-900">
                  Kehadiran: {dailyOverallProgress.checkedInCount}/
                  {dailyOverallProgress.totalMembers} (
                  {dailyOverallProgress.checkedInPercentage}%)
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span>
                  Hadir{' '}
                  <strong className="text-emerald-700">
                    {dailyOverallProgress.hadirCount}
                  </strong>
                </span>
                <span>
                  Terlambat{' '}
                  <strong className="text-amber-700">
                    {dailyOverallProgress.terlambatCount}
                  </strong>
                </span>
                <span>
                  Izin{' '}
                  <strong className="text-sky-700">
                    {dailyOverallProgress.excusedCount}
                  </strong>
                </span>
                <span>
                  Alfa{' '}
                  <strong className="text-rose-700">
                    {dailyOverallProgress.absentCount}
                  </strong>
                </span>
                {dailyOverallProgress.pendingCount > 0 && (
                  <span>
                    Belum{' '}
                    <strong className="text-slate-700">
                      {dailyOverallProgress.pendingCount}
                    </strong>
                  </span>
                )}
              </div>

              <div
                role="progressbar"
                aria-label="Progress Kehadiran Piket Hari Ini"
                aria-valuenow={dailyOverallProgress.checkedInPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="progress-3d-track w-full sm:w-48 h-2.5 rounded-full overflow-hidden flex shrink-0"
              >
                <div
                  className="progress-3d-fill bg-gradient-to-b from-emerald-400 to-emerald-600 h-full transition-all duration-300"
                  style={{
                    width: `${dailyOverallProgress.checkedInPercentage}%`,
                  }}
                />
                <div
                  className="progress-3d-fill bg-gradient-to-b from-sky-400 to-sky-600 h-full transition-all duration-300"
                  style={{
                    width: `${dailyOverallProgress.excusedPercentage}%`,
                  }}
                />
                <div
                  className="progress-3d-fill bg-gradient-to-b from-rose-400 to-rose-600 h-full transition-all duration-300"
                  style={{
                    width: `${dailyOverallProgress.absentPercentage}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Mobile Pos Filter Tabs */}
          {filteredTodaySchedules.length > 1 && (
            <div className="segmented-3d flex lg:hidden items-center gap-1 p-1 rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'Semua Pos' },
                  { id: 'gerbang', label: 'Gerbang' },
                  { id: 'warsis', label: 'Warsis' },
                  { id: 'shalat', label: 'Shalat' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`mobile-pos-tab-${tab.id}`}
                  onClick={() => setMobilePosTab(tab.id)}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                    mobilePosTab === tab.id
                      ? 'segmented-3d-active'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* 3. Sculpted 3-Column Interactive 3D Pos Cards */}
          {filteredTodaySchedules.length === 0 ? (
            <div className="card-3d px-6 py-12 text-center space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                {todaySchedules.length === 0
                  ? 'Tidak ada jadwal piket pada tanggal ini'
                  : 'Tidak ada petugas yang cocok dengan pencarian'}
              </p>
              <p className="text-xs text-slate-500">
                {todaySchedules.length === 0
                  ? 'Gunakan tombol Pilih Tanggal untuk melihat jadwal hari piket lainnya.'
                  : 'Coba ubah kata kunci pencarian atau pilih filter Semua.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {filteredTodaySchedules.map((resolvedItem, cardIdx) => {
                const { schedule, dutyMembers } = resolvedItem;
                const posRule = getPosRuleInfo(schedule.title);
                const posHoliday = getHolidayForScheduleOnDate(
                  selectedDate,
                  schedule.title,
                  attendanceRecords
                );
                const windowStatus = getPosAttendanceWindowStatus(
                  schedule,
                  nowHHMM
                );

                // Mobile tab filter
                const hiddenOnMobile =
                  mobilePosTab !== 'all' &&
                  !matchesCategory(schedule, mobilePosTab);

                const PosIcon =
                  posRule.category === 'gerbang'
                    ? Shield
                    : posRule.category === 'warsis'
                    ? Store
                    : MoonStar;

                const tile3dCls =
                  posRule.category === 'gerbang'
                    ? 'icon-tile-3d-sky'
                    : posRule.category === 'warsis'
                    ? 'icon-tile-3d-emerald'
                    : 'icon-tile-3d-indigo';

                return (
                  <TiltCard3D
                    key={schedule.id}
                    index={cardIdx}
                    testId={`public-pos-card-${schedule.id}`}
                    className={hiddenOnMobile ? 'hidden lg:block' : 'block'}
                  >
                    {/* Clean Sculpted Pos Header */}
                    <div className="px-4 py-3.5 border-b border-slate-200/85 bg-gradient-to-b from-slate-50/70 to-white space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-700 tabular-nums">
                          {schedule.startTime} – {schedule.endTime} WIB
                        </span>
                        {posHoliday ? (
                          <span className="font-semibold text-rose-700">
                            Libur Piket
                          </span>
                        ) : !dateEditStatus.canEdit ? (
                          <span className="text-slate-400 font-medium">
                            {dateEditStatus.state === 'past'
                              ? 'Selesai'
                              : 'Belum Aktif'}
                          </span>
                        ) : windowStatus.isOpen ? (
                          <span className="font-semibold text-emerald-700">
                            Absen Dibuka
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">
                            {windowStatus.state === 'before'
                              ? 'Belum Buka'
                              : 'Waktu Habis'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className={`${tile3dCls} w-9 h-9 rounded-xl flex items-center justify-center shrink-0`}
                        >
                          <PosIcon className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
                            {schedule.title}
                          </h2>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {dutyMembers.length} petugas · {schedule.location}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed">
                        {posHoliday ? (
                          <span
                            data-testid={`public-pos-holiday-${schedule.id}`}
                            className="text-rose-700 font-medium"
                          >
                            Libur ({formatShortDateRangeId(posHoliday.startDate, posHoliday.endDate)}): {posHoliday.reason}
                          </span>
                        ) : (
                          <span data-testid={`pos-rule-${schedule.id}`}>
                            {posRule.ruleSummary}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Clean Hairline Officer List (No nested cards-within-cards, no avatars) */}
                    <div className="divide-y divide-slate-100">
                      {dutyMembers.map((dm, idx) => {
                        const orgLabel = getMemberOrgLabel(dm.member);
                        const lieInfo = parseLieAttendanceRecord(dm.attendance);
                        const isFake = lieInfo.isLie;
                        const isAdminVerified = isAttendanceVerifiedByAdmin(
                          dm.attendance
                        );
                        const isPendingVerify = isPublicSelfAttendance(
                          dm.attendance
                        );

                        return (
                          <div
                            key={`${schedule.id}-${dm.member.id}`}
                            data-testid={`public-officer-row-${schedule.id}-${dm.member.id}`}
                            className={`px-4 py-3 space-y-2 ${
                              isFake ? 'bg-rose-50/40' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              {/* Clickable Name & Quiet Metadata */}
                              <button
                                type="button"
                                onClick={() =>
                                  openPublicAttendanceModal(
                                    schedule,
                                    dm,
                                    dateEditStatus.canEdit &&
                                      !posHoliday &&
                                      windowStatus.isOpen &&
                                      !isAdminVerified
                                      ? 'absen'
                                      : 'jadwal'
                                  )
                                }
                                className="min-w-0 flex-1 text-left group"
                              >
                                <div className="flex items-baseline gap-2">
                                  <span className="font-mono text-xs text-slate-400 tabular-nums w-4 shrink-0">
                                    {idx + 1}.
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 group-hover:text-slate-700 truncate">
                                      {dm.member.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {orgLabel} · {dm.member.kelas}
                                      {dm.isSwapped && dm.swappedFromMember
                                        ? ` · Menggantikan ${dm.swappedFromMember.name}`
                                        : ''}
                                    </p>
                                  </div>
                                </div>
                              </button>

                              {/* Right Status & Action */}
                              <div className="flex items-center gap-2 shrink-0">
                                {dm.effectiveStatus !== 'belum_absen' && (
                                  <div className="text-right">
                                    <span
                                      className={`block text-xs whitespace-nowrap ${getStatusTextStyle(
                                        dm.effectiveStatus,
                                        isFake
                                      )}`}
                                    >
                                      {STATUS_LABELS_ID[dm.effectiveStatus]}
                                    </span>
                                    {dm.isAutoAlfa ? (
                                      <span
                                        data-testid={`public-auto-alfa-${schedule.id}-${dm.member.id}`}
                                        className="block text-[10px] text-rose-600"
                                      >
                                        Otomatis Alfa
                                      </span>
                                    ) : isPendingVerify ? (
                                      <span className="block text-[10px] text-amber-600">
                                        Menunggu verifikasi
                                      </span>
                                    ) : isAdminVerified && !isFake ? (
                                      <span className="block text-[10px] text-emerald-600">
                                        Terverifikasi
                                      </span>
                                    ) : null}
                                  </div>
                                )}

                                {!dateEditStatus.canEdit ? (
                                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                    {dateEditStatus.state === 'past'
                                      ? ''
                                      : 'Terkunci'}
                                  </span>
                                ) : posHoliday ? (
                                  <span className="text-[11px] font-medium text-rose-600 whitespace-nowrap">
                                    Libur
                                  </span>
                                ) : isAdminVerified ? (
                                  <span
                                    title="Status sudah ditetapkan Admin"
                                    className="inline-flex items-center gap-1 text-[11px] text-slate-400"
                                  >
                                    <Lock className="w-3 h-3" />
                                  </span>
                                ) : !windowStatus.isOpen ? (
                                  dm.effectiveStatus === 'belum_absen' ? (
                                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                      {windowStatus.state === 'before'
                                        ? 'Belum buka'
                                        : 'Tutup'}
                                    </span>
                                  ) : null
                                ) : (
                                  <button
                                    type="button"
                                    data-testid={`btn-public-absen-${schedule.id}-${dm.member.id}`}
                                    onClick={() =>
                                      openPublicAttendanceModal(
                                        schedule,
                                        dm,
                                        'absen'
                                      )
                                    }
                                    className={`px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                                      dm.effectiveStatus === 'belum_absen'
                                        ? 'btn-3d-primary'
                                        : 'btn-3d-secondary'
                                    }`}
                                  >
                                    {dm.effectiveStatus === 'belum_absen'
                                      ? 'Absen'
                                      : 'Ubah'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Non-lie note (e.g. Izin reason or session progress) */}
                            {!isFake &&
                              dm.attendance?.note &&
                              dm.effectiveStatus !== 'belum_absen' && (
                                <p className="pl-6 text-[11px] text-slate-500 leading-snug">
                                  {dm.attendance.note}
                                </p>
                              )}

                            {/* Clean Two-Tier "Dia bohong $alasan" Box */}
                            {isFake && (
                              <div
                                data-testid={`public-lie-callout-${schedule.id}-${dm.member.id}`}
                                className="ml-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 space-y-0.5"
                              >
                                {lieInfo.selfClaim && (
                                  <p className="text-[11px] text-slate-500 leading-tight">
                                    Absen diisi sendiri:{' '}
                                    <span className="line-through">
                                      {lieInfo.selfClaim}
                                    </span>
                                  </p>
                                )}
                                <p className="text-xs sm:text-sm font-bold text-rose-700 leading-snug flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                  <span>{lieInfo.headline}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </TiltCard3D>
                );
              })}
            </div>
          )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Public Self-Attendance & Personal Schedule Modal */}
      {liveAttendanceModalData && (() => {
        const { schedule, dutyMember } = liveAttendanceModalData;
        const posRule = getPosRuleInfo(schedule.title);
        const posHoliday = getHolidayForScheduleOnDate(
          selectedDate,
          schedule.title,
          attendanceRecords
        );
        const windowStatus = getPosAttendanceWindowStatus(schedule, nowHHMM);
        const personalSchedules = getMemberPersonalSchedules(
          dutyMember.member.id,
          allSchedules
        );
        const isGerbangLateNow =
          posRule.category === 'gerbang' &&
          selectedChoice === 'hadir' &&
          posRule.maxToleranceTime &&
          nowHHMM > posRule.maxToleranceTime;

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-3 sm:p-4 perspective-stage"
            onClick={() => setAttendanceModalTarget(null)}
          >
            <motion.div
              data-testid="public-attendance-modal"
              initial={{ opacity: 0, scale: 0.94, y: 14, rotateX: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="card-3d w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {schedule.title} · {schedule.startTime}–{schedule.endTime}{' '}
                    WIB
                  </p>
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {dutyMember.member.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {getMemberOrgLabel(dutyMember.member)} ·{' '}
                    {dutyMember.member.kelas}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttendanceModalTarget(null)}
                  aria-label="Tutup modal absensi"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Tab Switcher */}
              <div className="px-5 pt-3">
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAttendanceModalTab('absen')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      attendanceModalTab === 'absen'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Isi Absensi
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceModalTab('jadwal')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      attendanceModalTab === 'jadwal'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Jadwal Minggu 1–4
                  </button>
                </div>
              </div>

              <div className="p-5">
                {attendanceModalTab === 'absen' ? (
                  <form
                    onSubmit={handleSubmitPublicAttendance}
                    className="space-y-4"
                  >
                    {/* Concise Rule Info */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-0.5">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>Ketentuan Pos</span>
                        <span className="font-mono tabular-nums text-slate-500">
                          {nowHHMM} WIB
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        {posRule.ruleSummary}
                      </p>
                    </div>

                    {/* Lock Checks */}
                    {!dateEditStatus.canEdit ? (
                      <div
                        data-testid="modal-date-locked-notice"
                        className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-2"
                      >
                        <Lock className="w-5 h-5 text-slate-400 mx-auto" />
                        <p className="text-sm font-semibold text-slate-900">
                          {dateEditStatus.label}
                        </p>
                        <p className="text-xs text-slate-600">
                          {dateEditStatus.reason}
                        </p>
                      </div>
                    ) : posHoliday ? (
                      <div
                        data-testid="modal-holiday-locked-notice"
                        className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-center space-y-1.5"
                      >
                        <CalendarOff className="w-5 h-5 text-rose-600 mx-auto" />
                        <p className="text-sm font-semibold text-rose-900">
                          Piket Sedang Libur
                        </p>
                        <p className="text-xs text-rose-700">
                          {HOLIDAY_CATEGORY_LABELS[posHoliday.category]} (
                          {formatShortDateRangeId(
                            posHoliday.startDate,
                            posHoliday.endDate
                          )}
                          ) — {posHoliday.reason}
                        </p>
                      </div>
                    ) : !windowStatus.isOpen ? (
                      <div
                        data-testid="modal-window-locked-notice"
                        className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-1.5"
                      >
                        <Clock className="w-5 h-5 text-slate-400 mx-auto" />
                        <p className="text-sm font-semibold text-slate-900">
                          {windowStatus.state === 'before'
                            ? 'Absensi Belum Dibuka'
                            : 'Waktu Absensi Telah Berakhir'}
                        </p>
                        <p className="text-xs text-slate-600">
                          {windowStatus.message}
                        </p>
                      </div>
                    ) : isAttendanceVerifiedByAdmin(dutyMember.attendance) ? (
                      <div
                        data-testid="modal-admin-verified-notice"
                        className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-2"
                      >
                        <Lock className="w-5 h-5 text-slate-500 mx-auto" />
                        <p className="text-sm font-semibold text-slate-900">
                          Status Sudah Ditetapkan Admin
                        </p>
                        <p className="text-xs text-slate-600">
                          Absensi yang sudah diverifikasi atau diisi oleh Admin
                          tidak dapat diubah melalui halaman publik.
                        </p>
                      </div>
                    ) : !canPublicEditAttendanceRecord(
                        dutyMember.attendance,
                        schedule.title
                      ).allowed ? (
                      <div
                        data-testid="modal-violation-locked-notice"
                        className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-center space-y-2"
                      >
                        <Lock className="w-5 h-5 text-rose-600 mx-auto" />
                        <p className="text-sm font-semibold text-rose-900">
                          Data Pelanggaran Terkunci
                        </p>
                        <p className="text-xs text-rose-700">
                          {
                            canPublicEditAttendanceRecord(
                              dutyMember.attendance,
                              schedule.title
                            ).reason
                          }
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* 4 Options */}
                        <div className="space-y-2">
                          <span className="block text-xs font-semibold text-slate-700">
                            Pilih Status Kehadiran
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {(
                              [
                                {
                                  id: 'hadir',
                                  label: 'Hadir',
                                  active:
                                    'bg-emerald-600 border-emerald-600 text-white',
                                },
                                {
                                  id: 'terlambat',
                                  label: 'Terlambat',
                                  active:
                                    'bg-amber-600 border-amber-600 text-white',
                                },
                                {
                                  id: 'izin',
                                  label: 'Izin',
                                  active: 'bg-sky-600 border-sky-600 text-white',
                                },
                                {
                                  id: 'alfa',
                                  label: 'Alfa',
                                  active:
                                    'bg-rose-600 border-rose-600 text-white',
                                },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                data-testid={`public-choice-${opt.id}`}
                                onClick={() => {
                                  setSelectedChoice(opt.id);
                                  setAttendanceFormError('');
                                }}
                                className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                                  selectedChoice === opt.id
                                    ? opt.active
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Gerbang > 06:45 Warning */}
                        {isGerbangLateNow && (
                          <div
                            data-testid="gerbang-late-warning"
                            className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900"
                          >
                            Waktu sudah melewati toleransi 06:45 WIB. Status
                            otomatis dicatat sebagai <strong>Terlambat</strong>.
                          </div>
                        )}

                        {/* Multi-Session Checkboxes for Warsis (09:15 & 11:45) and Shalat (Dzuhur & Ashar) */}
                        {posRule.requiredSessions &&
                          posRule.requiredSessions.length > 0 &&
                          (selectedChoice === 'hadir' ||
                            selectedChoice === 'terlambat') && (
                            <div className="space-y-2">
                              <span className="block text-xs font-semibold text-slate-700">
                                Sesi Jaga yang Dilaksanakan (Wajib 2×)
                              </span>
                              <div className="space-y-1.5">
                                {posRule.requiredSessions.map((sess) => {
                                  const checked = selectedSessions.includes(
                                    sess.id
                                  );
                                  return (
                                    <button
                                      key={sess.id}
                                      type="button"
                                      data-testid={`session-checkbox-${sess.id}`}
                                      onClick={() => {
                                        setSelectedSessions((prev) =>
                                          prev.includes(sess.id)
                                            ? prev.filter(
                                                (id) => id !== sess.id
                                              )
                                            : [...prev, sess.id]
                                        );
                                        setAttendanceFormError('');
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                                        checked
                                          ? 'bg-slate-900 border-slate-900 text-white'
                                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span>
                                        {sess.label}
                                        {sess.timeLabel
                                          ? ` (${sess.timeLabel})`
                                          : ''}
                                      </span>
                                      {checked && (
                                        <Check className="w-3.5 h-3.5 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedSessions.length === 1 && (
                                <p className="text-[11px] text-amber-700">
                                  Baru 1× sesi — akan tercatat sebagai Terlambat
                                  hingga sesi kedua dicentang.
                                </p>
                              )}
                            </div>
                          )}

                        {/* Izin Reason Input */}
                        {selectedChoice === 'izin' && (
                          <div className="space-y-1.5">
                            <label
                              htmlFor="public-izin-reason"
                              className="block text-xs font-semibold text-slate-700"
                            >
                              Keterangan Izin (Wajib)
                            </label>
                            <textarea
                              id="public-izin-reason"
                              data-testid="input-public-izin-reason"
                              rows={2}
                              value={izinReason}
                              onChange={(e) => {
                                setIzinReason(e.target.value);
                                setAttendanceFormError('');
                              }}
                              placeholder="Contoh: Dispensasi lomba, sakit, atau urusan keluarga..."
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
                            />
                          </div>
                        )}

                        {attendanceFormError && (
                          <p className="text-xs font-medium text-rose-700">
                            {attendanceFormError}
                          </p>
                        )}

                        <button
                          type="submit"
                          data-testid="btn-submit-public-attendance"
                          disabled={isSubmittingAttendance}
                          className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                        >
                          <ClipboardCheck className="w-4 h-4" />
                          <span>
                            {isSubmittingAttendance
                              ? 'Menyimpan...'
                              : 'Simpan Absensi'}
                          </span>
                        </button>
                      </>
                    )}
                  </form>
                ) : (
                  <div className="space-y-3">
                    {personalSchedules.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">
                        Belum ada jadwal piket terdaftar untuk petugas ini.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                        {personalSchedules.map((ps) => (
                          <div
                            key={`${ps.scheduleId}-${ps.weekNum}`}
                            className="px-3.5 py-2.5 bg-white text-xs space-y-0.5"
                          >
                            <div className="flex items-center justify-between font-semibold text-slate-900">
                              <span>{ps.title}</span>
                              <span className="text-slate-500">
                                Minggu {ps.weekNum}
                              </span>
                            </div>
                            <p className="text-slate-600">
                              {ps.days.map((d) => DAY_NAMES_ID[d]).join(', ')} ·{' '}
                              <span className="font-mono">{ps.timeRange}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      data-testid="btn-download-personal-pdf"
                      onClick={() => {
                        const pdfBytes =
                          generateMemberPersonalSchedulePdfBytes(
                            dutyMember.member,
                            allSchedules
                          );
                        triggerPdfDownload(
                          pdfBytes,
                          `jadwal-piket-${dutyMember.member.name
                            .toLowerCase()
                            .replace(/\s+/g, '-')}.pdf`
                        );
                      }}
                      className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Kartu Jadwal (PDF)</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* 5. Clean 3D Date Picker Modal (Cek Jadwal Hari Lain) */}
      {isDatePickerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-3 sm:p-4 perspective-stage"
          onClick={() => setIsDatePickerModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14, rotateX: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="card-3d w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Pilih Tanggal Jadwal
              </h3>
              <button
                type="button"
                onClick={() => setIsDatePickerModalOpen(false)}
                aria-label="Tutup pilih tanggal"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="public-date-picker-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tanggal Spesifik
                </label>
                <input
                  id="public-date-picker-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onSelectDate(e.target.value);
                    onSelectNextPreviewDate(addDays(e.target.value, 1));
                    setIsDatePickerModalOpen(false);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700">
                  Lompat ke Siklus Minggu
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        handleSelectWeekAndDay(w, selectedDayOfWeek);
                        setIsDatePickerModalOpen(false);
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg ${
                        currentWeekOfMonth === w
                          ? 'btn-3d-primary'
                          : 'btn-3d-secondary'
                      }`}
                    >
                      M{w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700">
                  Pilih Hari (Senin – Jumat)
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        handleSelectWeekAndDay(currentWeekOfMonth, d);
                        setIsDatePickerModalOpen(false);
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg ${
                        selectedDayOfWeek === d
                          ? 'btn-3d-primary'
                          : 'btn-3d-secondary'
                      }`}
                    >
                      {DAY_NAMES_ID[d].slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectDate(todayStr);
                  onSelectNextPreviewDate(tomorrowStr);
                  setIsDatePickerModalOpen(false);
                }}
                className="w-full py-2.5 text-xs font-semibold rounded-xl btn-3d-primary inline-flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Kembali ke Hari Ini</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
