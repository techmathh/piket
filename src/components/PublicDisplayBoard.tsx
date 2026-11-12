import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  Search,
  Calendar,
  X,
  Image as ImageIcon,
  Sun,
  Sunset,
  Moon,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Users,
  Download,
  Activity,
} from 'lucide-react';
import {
  DAY_NAMES_ID,
  DAY_NOTE_SCHEDULE_ID,
  STATUS_LABELS_ID,
  addDays,
  calculateShiftCheckInProgress,
  findDateForWeekAndDay,
  formatFullDateId,
  formatWeekCycleLabel,
  getDayAttendanceNote,
  getDefaultDisplayDateForHour,
  getMemberOrgLabel,
  getMemberPersonalSchedules,
  getShiftTimelineStatus,
  getTimeOfDayGreeting,
  getWeekOfMonth,
  normalizeMemberId,
  parseDateString,
  type AttendanceRecord,
  type OsisMember,
  type PiketSchedule,
  type ResolvedScheduleForDate,
  type TimeOfDayPeriod,
} from '../utils/piketLogic';
import {
  generateDailyAttendancePdfBytes,
  generateMemberPersonalSchedulePdfBytes,
  triggerPdfDownload,
} from '../utils/pdfExporter';
import { HARMONIZED_NAME_NOTES } from '../data/initialData';
import { CharacterAvatar3D } from './CharacterAvatar3D';
import { mascotHeroImg, banner3dImg } from '../assets/brandAssets';

interface PublicDisplayBoardProps {
  todayStr: string;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  nextPreviewDate: string;
  onSelectNextPreviewDate: (dateStr: string) => void;
  todaySchedules: ResolvedScheduleForDate[];
  nextDaySchedules: ResolvedScheduleForDate[];
  allSchedules: PiketSchedule[];
  members: OsisMember[];
  attendanceRecords?: AttendanceRecord[];
}

function matchesCategory(
  schedule: PiketSchedule,
  category: 'warsis' | 'gerbang' | 'shalat'
): boolean {
  const lower = schedule.title.toLowerCase();
  if (category === 'gerbang') return lower.includes('gerbang');
  if (category === 'warsis') return lower.includes('warsis');
  if (category === 'shalat') return lower.includes('shalat');
  return true;
}

function getTypingMessagesForPeriod(period: TimeOfDayPeriod): string[] {
  switch (period) {
    case 'pagi':
      return [
        'Selamat Pagi! Semangat bertugas untuk seluruh petugas piket OSIS hari ini!',
        'Pastikan kesiapan pos Jaga Gerbang, Piket Warsis, dan Absensi Shalat.',
        'Klik nama petugas pada kartu jadwal untuk melihat rincian piket Minggu 1–4.',
      ];
    case 'siang':
      return [
        'Selamat Siang! Tetap semangat menjalankan tugas piket pengurus OSIS hari ini!',
        'Waktunya bertugas untuk tim Piket Warsis dan Petugas Absensi Shalat berjamaah.',
        'Klik nama petugas pada kartu jadwal untuk melihat rincian piket Minggu 1–4.',
      ];
    case 'sore':
      return [
        'Selamat Sore! Terima kasih atas dedikasi seluruh petugas piket OSIS hari ini!',
        'Pastikan kebersihan pos piket dan pencatatan presensi hari ini sudah rapi.',
        'Gunakan tombol Cek Jadwal Besok untuk melihat petugas yang bertugas esok hari.',
      ];
    case 'malam':
      return [
        'Selamat Malam! Selamat beristirahat, berikut adalah jadwal piket untuk besok.',
        'Bagi petugas yang terjadwal besok pagi, persiapkan diri dan hadir tepat waktu ya!',
        'Gunakan tombol Jadwal Hari Ini atau Cek Jadwal Hari Lain untuk mengecek hari lain.',
      ];
  }
}

export const PublicDisplayBoard: React.FC<PublicDisplayBoardProps> = ({
  todayStr,
  selectedDate,
  onSelectDate,
  onSelectNextPreviewDate,
  todaySchedules,
  allSchedules,
  members,
  attendanceRecords = [],
}) => {
  const currentDayNote = getDayAttendanceNote(
    selectedDate,
    attendanceRecords,
    DAY_NOTE_SCHEDULE_ID
  );
  const [currentTime, setCurrentTime] = useState<string>('07:00:00');
  const [realHour, setRealHour] = useState<number>(() => new Date().getHours());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOfficerModal, setSelectedOfficerModal] =
    useState<OsisMember | null>(null);

  // Modal state for "Cek Jadwal Hari Lain"
  const [isOtherDayModalOpen, setIsOtherDayModalOpen] =
    useState<boolean>(false);
  const [otherDayTab, setOtherDayTab] = useState<
    'picker' | 'matrix' | 'harmonized'
  >('picker');
  const [activeMatrixCategory, setActiveMatrixCategory] = useState<
    'warsis' | 'gerbang' | 'shalat'
  >('warsis');
  const [showOriginalImageModal, setShowOriginalImageModal] =
    useState<boolean>(false);

  const tomorrowStr = addDays(todayStr, 1);

  // Quick Pos filter for mobile/tablet so users on phones can jump straight to a pos without long scrolling
  const [selectedPosCategory, setSelectedPosCategory] = useState<
    'all' | 'gerbang' | 'warsis' | 'shalat'
  >('all');
  // Quick Org / Status filter so users can filter OSIS, MPK, or Sudah Hadir
  const [orgFilter, setOrgFilter] = useState<'all' | 'OSIS' | 'MPK' | 'hadir'>(
    'all'
  );
  const [mobileMatrixWeek, setMobileMatrixWeek] = useState<number>(
    getWeekOfMonth(selectedDate)
  );

  useEffect(() => {
    setMobileMatrixWeek(getWeekOfMonth(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hh}:${mm}:${ss}`);
      setRealHour(now.getHours());
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const greetingInfo = getTimeOfDayGreeting(realHour);
  const isNightMode = greetingInfo.isNightMode;

  // Typewriter animation state for the Greeting Bar
  const typingPhrases = getTypingMessagesForPeriod(greetingInfo.period);
  const [phraseIndex, setPhraseIndex] = useState<number>(0);
  const [typedText, setTypedText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    setPhraseIndex(0);
    setTypedText('');
    setIsDeleting(false);
  }, [greetingInfo.period]);

  useEffect(() => {
    const currentPhrase = typingPhrases[phraseIndex % typingPhrases.length];
    let timeoutId: ReturnType<typeof setTimeout>;

    if (!isDeleting && typedText.length < currentPhrase.length) {
      timeoutId = setTimeout(() => {
        setTypedText(currentPhrase.slice(0, typedText.length + 1));
      }, 36);
    } else if (!isDeleting && typedText.length === currentPhrase.length) {
      timeoutId = setTimeout(() => {
        setIsDeleting(true);
      }, 2800);
    } else if (isDeleting && typedText.length > 0) {
      timeoutId = setTimeout(() => {
        setTypedText(currentPhrase.slice(0, typedText.length - 1));
      }, 16);
    } else {
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % typingPhrases.length);
    }

    return () => clearTimeout(timeoutId);
  }, [typedText, isDeleting, phraseIndex, typingPhrases]);

  // Automatically sync displayed date when transitioning between daytime (Today) and nighttime (Tomorrow)
  useEffect(() => {
    const targetDefaultDate = getDefaultDisplayDateForHour(todayStr, realHour);
    onSelectDate(targetDefaultDate);
    onSelectNextPreviewDate(addDays(targetDefaultDate, 1));
  }, [realHour, todayStr]);

  const currentWeekOfMonth = getWeekOfMonth(selectedDate);
  const selectedDayOfWeek = parseDateString(selectedDate).getDay();

  const isShowingToday = selectedDate === todayStr;
  const isShowingTomorrow = selectedDate === tomorrowStr;

  const memberMap = new Map<string, OsisMember>();
  for (const m of members) memberMap.set(m.id, m);

  // Filter active day's schedules by optional search query, orgFilter, & mobile pos tab
  const filteredSchedules = todaySchedules
    .map((item) => {
      if (
        selectedPosCategory !== 'all' &&
        !matchesCategory(item.schedule, selectedPosCategory)
      ) {
        return null;
      }

      const q = searchQuery.trim().toLowerCase();
      const titleMatch = q ? item.schedule.title.toLowerCase().includes(q) : false;

      const filteredMembers = item.dutyMembers.filter((dm) => {
        const orgLabel = getMemberOrgLabel(dm.member);
        if (orgFilter === 'OSIS' && orgLabel !== 'OSIS') return false;
        if (orgFilter === 'MPK' && orgLabel !== 'MPK') return false;
        if (
          orgFilter === 'hadir' &&
          dm.effectiveStatus !== 'hadir' &&
          dm.effectiveStatus !== 'terlambat'
        ) {
          return false;
        }
        if (q && !titleMatch) {
          return (
            dm.member.name.toLowerCase().includes(q) ||
            dm.member.kelas.toLowerCase().includes(q) ||
            orgLabel.toLowerCase().includes(q)
          );
        }
        return true;
      });

      if ((q || orgFilter !== 'all') && filteredMembers.length === 0) {
        return null;
      }

      return {
        ...item,
        dutyMembers: filteredMembers,
      };
    })
    .filter((item): item is ResolvedScheduleForDate => item !== null);

  // Total officers & overall live check-in progress today across all schedules
  const allDutyMembersToday = todaySchedules.flatMap((s) => s.dutyMembers);
  const dailyOverallProgress =
    calculateShiftCheckInProgress(allDutyMembersToday);
  const totalOfficersToday = dailyOverallProgress.totalMembers;
  const shiftTimeline = getShiftTimelineStatus(
    todaySchedules,
    currentTime,
    isShowingToday
  );

  // Jump to specific Week (1..4) and Day (1..5)
  const handleSelectWeekAndDay = (targetWeek: number, targetDay: number) => {
    const effectiveDay =
      targetDay === 0 || targetDay === 6 ? 1 : targetDay;
    const nextDateStr = findDateForWeekAndDay(
      selectedDate,
      targetWeek,
      effectiveDay
    );
    onSelectDate(nextDateStr);
    onSelectNextPreviewDate(addDays(nextDateStr, 1));
  };

  // Compute all shifts across Minggu 1..4 for a clicked member
  const getMemberFullSchedule = (memberId: string) =>
    getMemberPersonalSchedules(memberId, allSchedules);

  const getScheduleForMatrix = (
    cat: 'warsis' | 'gerbang' | 'shalat',
    weekNum: number
  ): PiketSchedule | undefined => {
    return allSchedules.find(
      (s) =>
        matchesCategory(s, cat) &&
        (s.activeWeeks ? s.activeWeeks.includes(weekNum) : true)
    );
  };

  const originalBoardImageMap: Record<'warsis' | 'gerbang' | 'shalat', string> =
    {
      warsis: '/assets/aistudio/warsis_c1b848ba.jpg',
      gerbang: '/assets/aistudio/gerbang_6941e875.jpg',
      shalat: '/assets/aistudio/sholat_5f922f02.jpg',
    };

  const renderGreetingIcon = () => {
    if (greetingInfo.period === 'malam') {
      return <Moon className="w-5 h-5 text-indigo-600 shrink-0" />;
    }
    if (greetingInfo.period === 'sore') {
      return <Sunset className="w-5 h-5 text-orange-600 shrink-0" />;
    }
    return <Sun className="w-5 h-5 text-amber-500 shrink-0" />;
  };

  const getScheduleAccentStyle = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('gerbang')) {
      return {
        headerBg: 'bg-emerald-50/95 border-emerald-200',
        badgeBg: 'bg-emerald-600 text-white',
        timeText: 'text-emerald-800',
        shortLabel: 'Pos 1 · Pagi',
      };
    }
    if (lower.includes('warsis')) {
      return {
        headerBg: 'bg-orange-50/95 border-orange-200',
        badgeBg: 'bg-orange-500 text-white',
        timeText: 'text-orange-800',
        shortLabel: 'Pos 2 · Istirahat',
      };
    }
    return {
      headerBg: 'bg-sky-50/95 border-sky-200',
      badgeBg: 'bg-sky-600 text-white',
      timeText: 'text-sky-800',
      shortLabel: 'Pos 3 · Dzuhur',
    };
  };

  return (
    <div className="space-y-3.5 sm:space-y-5">
      {/* 1. Clean, Layperson-Friendly Top Header Card (Optimized for Mobile, Tablet, & Desktop) */}
      <section className="card-3d p-3.5 sm:p-5 md:p-6 space-y-2.5 sm:space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 sm:gap-4">
          {/* Top Row on Mobile: Mascot + Clear Date Title + Live Clock on Right */}
          <div className="flex items-center justify-between gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl border-2 border-amber-300 shadow-[0_3px_0_0_#F59E0B] overflow-hidden shrink-0 bg-[#FFF3DF]">
                <img
                  src={mascotHeroImg}
                  alt="Maskot 3D Pengurus OSIS"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs font-extrabold tracking-wide">
                  <span
                    className={
                      isShowingToday
                        ? 'text-emerald-700'
                        : isShowingTomorrow
                        ? 'text-orange-600'
                        : 'text-sky-700'
                    }
                  >
                    {isShowingToday
                      ? 'JADWAL HARI INI'
                      : isShowingTomorrow
                      ? 'JADWAL UNTUK BESOK'
                      : 'JADWAL HARI PILIHAN'}
                  </span>
                  <span aria-hidden="true" className="text-stone-300">
                    ·
                  </span>
                  <span className="text-sky-700">
                    Siklus Minggu ke-{currentWeekOfMonth}
                  </span>
                  <span aria-hidden="true" className="text-stone-300 hidden sm:inline">
                    ·
                  </span>
                  <span className="text-stone-500 hidden sm:inline font-semibold">
                    {totalOfficersToday} petugas bertugas
                  </span>
                </div>

                <h1 className="text-base sm:text-2xl md:text-3xl font-bold tracking-tight text-stone-900 leading-tight">
                  {formatFullDateId(selectedDate)}
                </h1>
              </div>
            </div>

            {/* Compact Live Clock visible on Mobile top-right so it doesn't crowd the 2 navigation buttons */}
            <div className="flex lg:hidden items-center gap-1.5 px-2.5 py-1.5 bg-stone-900 text-amber-50 rounded-xl border-2 border-stone-700 shadow-[0_3px_0_0_#1C1917] shrink-0">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-mono text-xs font-bold tabular-nums">
                {currentTime.slice(0, 5)}
              </span>
              <span className="text-[10px] text-amber-200/80 font-semibold">
                WIB
              </span>
            </div>
          </div>

          {/* Right / Bottom on Mobile: Live Clock (Desktop) + 2 Ergonomic Touch Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-2.5 bg-stone-900 text-amber-50 rounded-2xl border-2 border-stone-700 shadow-[0_3px_0_0_#1C1917]">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-mono text-sm font-bold tabular-nums tracking-wider">
                {currentTime}
              </span>
              <span className="text-[11px] text-amber-200/80 font-semibold">
                WIB
              </span>
            </div>

            {!isNightMode ? (
              <>
                <button
                  type="button"
                  data-testid="btn-cek-jadwal-besok"
                  onClick={() => {
                    const target = isShowingTomorrow ? todayStr : tomorrowStr;
                    onSelectDate(target);
                    onSelectNextPreviewDate(addDays(target, 1));
                  }}
                  className={`w-full sm:w-auto justify-center px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                    !isShowingToday ? 'btn-3d-primary' : 'btn-3d-sky'
                  }`}
                >
                  <span>
                    {!isShowingToday
                      ? 'Kembali ke Hari Ini'
                      : 'Cek Jadwal Besok'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>

                <button
                  type="button"
                  data-testid="btn-cek-jadwal-hari-lain"
                  onClick={() => {
                    setOtherDayTab('picker');
                    setIsOtherDayModalOpen(true);
                  }}
                  className="btn-3d-secondary w-full sm:w-auto justify-center px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>Cek Jadwal Hari Lain</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="btn-jadwal-hari-ini"
                  onClick={() => {
                    const target = isShowingToday ? tomorrowStr : todayStr;
                    onSelectDate(target);
                    onSelectNextPreviewDate(addDays(target, 1));
                  }}
                  className={`w-full sm:w-auto justify-center px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                    !isShowingTomorrow ? 'btn-3d-primary' : 'btn-3d-sky'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {!isShowingTomorrow
                      ? 'Kembali ke Jadwal Besok'
                      : 'Jadwal Hari Ini'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="btn-cek-jadwal-hari-lain"
                  onClick={() => {
                    setOtherDayTab('picker');
                    setIsOtherDayModalOpen(true);
                  }}
                  className="btn-3d-secondary w-full sm:w-auto justify-center px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>Cek Jadwal Hari Lain</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Optional Day-Level Keterangan / Status Libur Banner on Public Display */}
        {currentDayNote && (
          <div
            data-testid="public-day-note-banner"
            className={`p-3 sm:p-3.5 rounded-2xl border-2 flex items-center gap-2.5 sm:gap-3 ${
              currentDayNote.isHoliday
                ? 'bg-rose-50/95 border-rose-300 text-rose-950'
                : 'bg-amber-50/95 border-amber-300 text-amber-950'
            }`}
          >
            <span
              className={`px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-extrabold shrink-0 ${
                currentDayNote.isHoliday
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {currentDayNote.isHoliday
                ? 'STATUS HARI LIBUR'
                : 'KETERANGAN HARI INI'}
            </span>
            <p className="text-xs sm:text-sm font-bold leading-snug">
              {currentDayNote.note}
            </p>
          </div>
        )}

        {/* 2. Live Operational Shift & Daily Check-In Progress Strip */}
        {todaySchedules.length > 0 && (
          <div
            data-testid="public-live-summary-strip"
            className="p-2.5 sm:p-3.5 rounded-2xl bg-[#FFFBF4] border-2 border-[#F2E1C9] flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3"
          >
            {/* Left: Live Shift Timeline Status */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  shiftTimeline.state === 'live'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : shiftTimeline.state === 'upcoming'
                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : 'bg-sky-100 text-sky-700 border-sky-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-[13px] font-bold text-stone-900 leading-snug truncate">
                  {shiftTimeline.headline}
                </p>
                <p className="text-[11px] text-stone-500 truncate">
                  {shiftTimeline.subline}
                </p>
              </div>
            </div>

            {/* Right: Overall Daily Check-In Progress Bar & Metrics */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 lg:w-[440px] shrink-0">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-stone-700">
                    Total Kehadiran Hari Ini
                  </span>
                  <span className="font-mono font-bold tabular-nums text-emerald-700">
                    {dailyOverallProgress.checkedInCount}/
                    {dailyOverallProgress.totalMembers} Hadir (
                    {dailyOverallProgress.checkedInPercentage}%)
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Progress Kehadiran Seluruh Shift Hari Ini"
                  aria-valuenow={dailyOverallProgress.checkedInPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-full h-2 bg-stone-200/90 rounded-full overflow-hidden border border-stone-300 flex"
                >
                  <div
                    style={{
                      width: `${dailyOverallProgress.checkedInPercentage}%`,
                    }}
                    className="h-full bg-emerald-500 transition-all duration-300"
                  />
                  {dailyOverallProgress.excusedPercentage > 0 && (
                    <div
                      style={{
                        width: `${dailyOverallProgress.excusedPercentage}%`,
                      }}
                      className="h-full bg-amber-400 transition-all duration-300"
                    />
                  )}
                  {dailyOverallProgress.absentPercentage > 0 && (
                    <div
                      style={{
                        width: `${dailyOverallProgress.absentPercentage}%`,
                      }}
                      className="h-full bg-rose-500 transition-all duration-300"
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-stone-500 font-mono tabular-nums">
                  <span className="text-emerald-700">
                    Hadir: {dailyOverallProgress.checkedInCount}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700">
                    Izin/Skt: {dailyOverallProgress.excusedCount}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-700">
                    Alfa: {dailyOverallProgress.absentCount}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-stone-500">
                    Belum: {dailyOverallProgress.pendingCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Animated Typewriter Greeting Bar + Smart Search & Quick Org Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3">
          {/* Animated Typewriter Greeting Bubble */}
          <div
            data-testid="typewriter-greeting-box"
            className={`flex-1 flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2 rounded-2xl border-2 ${
              isNightMode
                ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                : 'bg-[#FFF6E8] border-[#F3DEC0] text-stone-900'
            }`}
          >
            <div
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isNightMode
                  ? 'bg-white border-indigo-200'
                  : 'bg-white border-amber-200'
              }`}
            >
              {renderGreetingIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold leading-snug min-h-[1.25rem] flex items-center">
                <span>{typedText}</span>
                <span
                  aria-hidden="true"
                  className="inline-block w-0.5 h-4 ml-0.5 bg-orange-500 animate-pulse shrink-0"
                />
              </p>
            </div>
          </div>

          {/* Right: Search Input + Quick Organization Filter (Semua / OSIS / MPK / Hadir) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <div className="grid grid-cols-4 sm:flex items-center gap-1 p-1 bg-[#FFF5E6] border-2 border-[#EBD5B8] rounded-xl shrink-0">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'OSIS', label: 'OSIS' },
                  { id: 'MPK', label: 'MPK' },
                  { id: 'hadir', label: 'Hadir' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOrgFilter(tab.id)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap text-center ${
                    orgFilter === tab.id
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Cari nama petugas piket"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau kelas (XI-A)..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-medium bg-white border-2 border-[#EBD5B8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4. Mobile & Tablet Quick Pos Filter Bar (Hidden on Large Desktop where all 3 columns fit side-by-side) */}
        {todaySchedules.length > 1 && (
          <div className="lg:hidden pt-1">
            <div
              role="tablist"
              aria-label="Filter Pos Piket"
              className="grid grid-cols-4 gap-1.5 p-1 bg-[#FFF3E0] border-2 border-[#F3DEC0] rounded-2xl"
            >
              <button
                type="button"
                role="tab"
                data-testid="mobile-pos-tab-all"
                aria-selected={selectedPosCategory === 'all'}
                onClick={() => setSelectedPosCategory('all')}
                className={`py-2 px-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center truncate ${
                  selectedPosCategory === 'all'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-stone-700 hover:bg-white/70'
                }`}
              >
                Semua ({todaySchedules.length})
              </button>
              <button
                type="button"
                role="tab"
                data-testid="mobile-pos-tab-gerbang"
                aria-selected={selectedPosCategory === 'gerbang'}
                onClick={() => setSelectedPosCategory('gerbang')}
                className={`py-2 px-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center truncate ${
                  selectedPosCategory === 'gerbang'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-stone-700 hover:bg-white/70'
                }`}
              >
                Gerbang
              </button>
              <button
                type="button"
                role="tab"
                data-testid="mobile-pos-tab-warsis"
                aria-selected={selectedPosCategory === 'warsis'}
                onClick={() => setSelectedPosCategory('warsis')}
                className={`py-2 px-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center truncate ${
                  selectedPosCategory === 'warsis'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-stone-700 hover:bg-white/70'
                }`}
              >
                Warsis
              </button>
              <button
                type="button"
                role="tab"
                data-testid="mobile-pos-tab-shalat"
                aria-selected={selectedPosCategory === 'shalat'}
                onClick={() => setSelectedPosCategory('shalat')}
                className={`py-2 px-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center truncate ${
                  selectedPosCategory === 'shalat'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-stone-700 hover:bg-white/70'
                }`}
              >
                Shalat
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. Responsive Schedule Cards Across Mobile, Tablet & Desktop */}
      {filteredSchedules.length === 0 ? (
        <div className="card-3d p-6 sm:p-8 text-center space-y-3">
          <div className="max-w-xs mx-auto rounded-2xl overflow-hidden border-2 border-[#F3E3D0]">
            <img
              src={banner3dImg}
              alt="Ilustrasi 3D Meja Piket OSIS"
              className="w-full h-36 object-cover"
            />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base sm:text-lg font-bold text-stone-900">
              {searchQuery.trim()
                ? `Tidak ditemukan petugas dengan kata kunci "${searchQuery}"`
                : 'Tidak Ada Jadwal Piket pada Hari Ini'}
            </h2>
            <p className="text-xs text-stone-600">
              Gunakan tombol <strong>Cek Jadwal Hari Lain</strong> untuk melihat
              jadwal Senin – Jumat pada siklus Minggu 1 – Minggu 4.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-4 sm:gap-5 items-start ${
            filteredSchedules.length === 1
              ? 'lg:grid-cols-1 max-w-3xl mx-auto w-full'
              : filteredSchedules.length === 2
              ? 'md:grid-cols-2'
              : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {filteredSchedules.map((resolved) => {
            const { schedule, dutyMembers } = resolved;
            const q = searchQuery.trim().toLowerCase();
            const accent = getScheduleAccentStyle(schedule.title);

            return (
              <article
                key={schedule.id}
                className="card-3d overflow-hidden flex flex-col"
              >
                {/* Clear, Scannable Schedule Card Header */}
                <div
                  className={`p-3.5 sm:p-4 border-b-2 ${accent.headerBg} space-y-1.5`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold tabular-nums">
                      <span className={accent.timeText}>
                        Pukul {schedule.startTime} – {schedule.endTime} WIB
                      </span>
                      {isShowingToday &&
                        currentTime.slice(0, 5) >= schedule.startTime &&
                        currentTime.slice(0, 5) <= schedule.endTime && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-sans font-extrabold">
                            BERLANGSUNG
                          </span>
                        )}
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${accent.badgeBg}`}
                    >
                      {formatWeekCycleLabel(schedule.activeWeeks)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                      {schedule.title}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-stone-700 bg-white/95 border border-stone-200 px-2.5 py-0.5 rounded-lg shrink-0">
                      <Users className="w-3.5 h-3.5 text-stone-500" />
                      <span>{dutyMembers.length} orang</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-stone-600">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="truncate font-medium">
                        Lokasi: {schedule.location}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-stone-500 shrink-0">
                      {accent.shortLabel}
                    </span>
                  </div>
                </div>

                {/* Officer List: Easy to Read on Mobile & Desktop with Clear Status Pill */}
                <div className="p-3 sm:p-3.5 flex flex-col space-y-2.5">
                  <div className="grid grid-cols-1 gap-1.5">
                    {dutyMembers.map((dm, idx) => {
                      const orgLabel = getMemberOrgLabel(dm.member);
                      const isHighlighted =
                        q.length > 0 &&
                        (dm.member.name.toLowerCase().includes(q) ||
                          dm.member.kelas.toLowerCase().includes(q) ||
                          orgLabel.toLowerCase().includes(q));

                      const statusStyle =
                        dm.effectiveStatus === 'hadir'
                          ? {
                              dot: 'bg-emerald-500',
                              pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                              label: 'Hadir',
                            }
                          : dm.effectiveStatus === 'terlambat'
                          ? {
                              dot: 'bg-sky-500',
                              pill: 'bg-sky-50 text-sky-800 border-sky-200',
                              label: 'Terlambat',
                            }
                          : dm.effectiveStatus === 'izin' ||
                            dm.effectiveStatus === 'sakit'
                          ? {
                              dot: 'bg-amber-500',
                              pill: 'bg-amber-50 text-amber-800 border-amber-200',
                              label: STATUS_LABELS_ID[dm.effectiveStatus],
                            }
                          : dm.effectiveStatus === 'tidak_piket'
                          ? {
                              dot: 'bg-rose-500',
                              pill: 'bg-rose-50 text-rose-800 border-rose-200',
                              label: 'Alfa',
                            }
                          : {
                              dot: 'bg-stone-300',
                              pill: 'bg-stone-100 text-stone-600 border-stone-200',
                              label: 'Belum Absen',
                            };

                      return (
                        <button
                          key={`${dm.member.id}-${idx}`}
                          type="button"
                          onClick={() => setSelectedOfficerModal(dm.member)}
                          className={`text-left px-3 py-2 rounded-xl border-2 transition-all flex items-center justify-between gap-2.5 group ${
                            isHighlighted
                              ? 'bg-amber-50 border-orange-400 shadow-[0_3px_0_0_#F97316]'
                              : 'bg-[#FFFDF9] border-[#F3E3D0] hover:border-orange-300 hover:bg-orange-50/40 active:scale-[0.99]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <CharacterAvatar3D
                              name={dm.member.name}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] sm:text-sm font-bold text-stone-900 group-hover:text-orange-600 transition-colors leading-snug break-words">
                                {idx + 1}. {dm.member.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] font-medium text-stone-500">
                                <span
                                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold border ${
                                    orgLabel === 'OSIS'
                                      ? 'bg-orange-100 text-orange-800 border-orange-300'
                                      : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                  }`}
                                >
                                  {orgLabel}
                                </span>
                                <span className="font-mono font-bold text-sky-700">
                                  Kelas {dm.member.kelas}
                                </span>
                                {dm.attendance &&
                                  dm.attendance.checkInTime &&
                                  dm.attendance.checkInTime !== '-' && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono text-[10px] text-emerald-700 font-semibold">
                                        {dm.attendance.checkInTime} WIB
                                      </span>
                                    </>
                                  )}
                                {dm.isSwapped && dm.swappedFromMember && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-sky-700 font-semibold">
                                      Ganti {dm.swappedFromMember.name}
                                    </span>
                                  </>
                                )}
                                {dm.attendance?.note && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                                    Ket: {dm.attendance.note}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Clear Status Badge for Laypeople */}
                          <div
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border shrink-0 ${statusStyle.pill}`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${statusStyle.dot}`}
                              title={STATUS_LABELS_ID[dm.effectiveStatus]}
                            />
                            <span className="text-[11px] font-bold">
                              {statusStyle.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Aligned Card Footer with Live Shift Check-In Progress Bar & Helpful Hint */}
                  {(() => {
                    const shiftProg = calculateShiftCheckInProgress(dutyMembers);
                    return (
                      <div className="pt-2 border-t border-[#F3E3D0] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-stone-600">
                          <span className="font-medium">
                            Progress Check-In Shift
                          </span>
                          <span className="font-mono font-bold tabular-nums text-emerald-700">
                            {shiftProg.checkedInCount}/{shiftProg.totalMembers}{' '}
                            Hadir ({shiftProg.checkedInPercentage}%)
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`Progress Check-In ${schedule.title}`}
                          aria-valuenow={shiftProg.checkedInPercentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="w-full h-2 bg-stone-200/90 rounded-full overflow-hidden border border-stone-300 flex"
                        >
                          <div
                            style={{
                              width: `${shiftProg.checkedInPercentage}%`,
                            }}
                            className="h-full bg-emerald-500 transition-all duration-300"
                          />
                          {shiftProg.excusedPercentage > 0 && (
                            <div
                              style={{
                                width: `${shiftProg.excusedPercentage}%`,
                              }}
                              className="h-full bg-amber-400 transition-all duration-300"
                            />
                          )}
                          {shiftProg.absentPercentage > 0 && (
                            <div
                              style={{
                                width: `${shiftProg.absentPercentage}%`,
                              }}
                              className="h-full bg-rose-500 transition-all duration-300"
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-stone-400 text-center pt-0.5">
                          Ketuk nama petugas untuk melihat jadwal Minggu 1–4
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal: Cek Jadwal Hari Lain, Tabel Minggu 1-4, & Daftar Penyerasian Nama */}
      {isOtherDayModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-2.5 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="other-day-modal-title"
        >
          <div className="card-3d max-w-4xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-[#F3E3D0] pb-3.5">
              <div>
                <span className="text-xs font-bold text-orange-600">
                  Navigasi & Tabel Jadwal Piket OSIS
                </span>
                <h2
                  id="other-day-modal-title"
                  className="text-lg sm:text-xl font-bold text-stone-900"
                >
                  Cek Jadwal Hari Lain & Tabel Minggu 1–4
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOtherDayModalOpen(false)}
                aria-label="Tutup Navigasi Jadwal"
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher inside Modal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="grid grid-cols-3 sm:flex items-center gap-1.5 p-1 bg-[#FFF3E0] border-2 border-[#F3E3D0] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setOtherDayTab('picker')}
                  className={`px-2.5 sm:px-3.5 py-2 text-xs font-bold rounded-xl transition-all text-center ${
                    otherDayTab === 'picker'
                      ? 'bg-orange-500 text-white'
                      : 'text-stone-700 hover:bg-white'
                  }`}
                >
                  Pilih Hari
                </button>
                <button
                  type="button"
                  onClick={() => setOtherDayTab('matrix')}
                  className={`px-2.5 sm:px-3.5 py-2 text-xs font-bold rounded-xl transition-all text-center ${
                    otherDayTab === 'matrix'
                      ? 'bg-orange-500 text-white'
                      : 'text-stone-700 hover:bg-white'
                  }`}
                >
                  Tabel M1–M4
                </button>
                <button
                  type="button"
                  onClick={() => setOtherDayTab('harmonized')}
                  className={`px-2.5 sm:px-3.5 py-2 text-xs font-bold rounded-xl transition-all text-center ${
                    otherDayTab === 'harmonized'
                      ? 'bg-orange-500 text-white'
                      : 'text-stone-700 hover:bg-white'
                  }`}
                >
                  Data Nama ({HARMONIZED_NAME_NOTES.length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-download-daily-pdf-public"
                  onClick={() => {
                    const pdfBytes = generateDailyAttendancePdfBytes(
                      selectedDate,
                      todaySchedules,
                      currentTime
                    );
                    triggerPdfDownload(
                      pdfBytes,
                      `jadwal-presensi-piket-${selectedDate}.pdf`
                    );
                  }}
                  className="btn-3d-primary inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Unduh PDF Hari Ini</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOriginalImageModal(true)}
                  className="btn-3d-secondary inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>Lembar Jadwal Asli</span>
                </button>
              </div>
            </div>

            {otherDayTab === 'picker' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">
                    1. Pilih Siklus Minggu (Minggu 1 – Minggu 4):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[1, 2, 3, 4].map((wNum) => {
                      const isActiveWeek = currentWeekOfMonth === wNum;
                      return (
                        <button
                          key={wNum}
                          type="button"
                          onClick={() =>
                            handleSelectWeekAndDay(wNum, selectedDayOfWeek)
                          }
                          className={`p-3 rounded-2xl border-2 text-xs font-bold transition-all ${
                            isActiveWeek
                              ? 'bg-orange-500 border-orange-600 text-white shadow-[0_3px_0_0_#C2410C]'
                              : 'bg-[#FFFDF9] border-[#E7D5C0] text-stone-800 hover:bg-orange-50'
                          }`}
                        >
                          Minggu {wNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">
                    2. Pilih Hari Piket (Senin – Jumat):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[1, 2, 3, 4, 5].map((dayNum) => {
                      const isActiveDay = selectedDayOfWeek === dayNum;
                      return (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => {
                            handleSelectWeekAndDay(currentWeekOfMonth, dayNum);
                            setIsOtherDayModalOpen(false);
                          }}
                          className={`p-3 rounded-2xl border-2 text-xs font-bold transition-all ${
                            isActiveDay
                              ? 'bg-sky-500 border-sky-600 text-white shadow-[0_3px_0_0_#0284C7]'
                              : 'bg-[#F0F8FF] border-[#C6E3FA] text-stone-800 hover:bg-sky-100'
                          }`}
                        >
                          {DAY_NAMES_ID[dayNum]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-[#FFFDF8] border-2 border-[#F3E3D0] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-stone-800">
                      Pilih Tanggal Kalender Tertentu
                    </p>
                    <p className="text-[11px] text-stone-500">
                      Saat ini terpilih: {formatFullDateId(selectedDate)} (Minggu
                      ke-{currentWeekOfMonth})
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      aria-label="Pilih Tanggal Jadwal"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          onSelectDate(e.target.value);
                          onSelectNextPreviewDate(addDays(e.target.value, 1));
                          setIsOtherDayModalOpen(false);
                        }
                      }}
                      className="px-3 py-2 text-xs font-mono font-bold bg-white border-2 border-[#EBD5B8] rounded-xl text-stone-800"
                    />
                    <button
                      type="button"
                      onClick={() => setIsOtherDayModalOpen(false)}
                      className="btn-3d-primary px-4 py-2 text-xs font-bold"
                    >
                      Tampilkan Jadwal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {otherDayTab === 'matrix' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMatrixCategory('warsis')}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl border-2 transition-all ${
                      activeMatrixCategory === 'warsis'
                        ? 'bg-orange-500 border-orange-600 text-white'
                        : 'bg-white border-[#E7D5C0] text-stone-700'
                    }`}
                  >
                    1. Piket Warsis (Minggu 1–4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMatrixCategory('gerbang')}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl border-2 transition-all ${
                      activeMatrixCategory === 'gerbang'
                        ? 'bg-emerald-600 border-emerald-700 text-white'
                        : 'bg-white border-[#E7D5C0] text-stone-700'
                    }`}
                  >
                    2. Jaga Gerbang (Minggu 1–4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMatrixCategory('shalat')}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl border-2 transition-all ${
                      activeMatrixCategory === 'shalat'
                        ? 'bg-sky-600 border-sky-700 text-white'
                        : 'bg-white border-[#E7D5C0] text-stone-700'
                    }`}
                  >
                    3. Absensi Shalat (Minggu 1–4)
                  </button>
                </div>

                {/* Mobile Week Selector for Matrix so phone users don't have to scroll horizontally */}
                <div className="md:hidden space-y-3">
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-xl">
                    {[1, 2, 3, 4].map((wNum) => (
                      <button
                        key={wNum}
                        type="button"
                        onClick={() => setMobileMatrixWeek(wNum)}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          mobileMatrixWeek === wNum
                            ? 'bg-stone-900 text-white'
                            : 'text-stone-600'
                        }`}
                      >
                        Minggu {wNum}
                      </button>
                    ))}
                  </div>

                  {activeMatrixCategory === 'gerbang' ? (
                    <div className="p-3.5 bg-[#FFFDF8] border-2 border-[#F3E3D0] rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900">
                          Petugas Jaga Gerbang · Minggu {mobileMatrixWeek}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectWeekAndDay(
                              mobileMatrixWeek,
                              selectedDayOfWeek
                            );
                            setIsOtherDayModalOpen(false);
                          }}
                          className="text-xs font-bold text-orange-600 underline"
                        >
                          Buka Minggu Ini
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {(
                          getScheduleForMatrix('gerbang', mobileMatrixWeek)
                            ?.dailyMembers || []
                        ).map((rawId, idx) => {
                          const mId = normalizeMemberId(rawId);
                          const m = memberMap.get(mId);
                          if (!m) return null;
                          const orgLabel = getMemberOrgLabel(m);
                          return (
                            <button
                              key={mId}
                              type="button"
                              onClick={() => setSelectedOfficerModal(m)}
                              className="w-full text-left flex items-center gap-2 p-2 rounded-xl border bg-white border-[#F3E3D0] text-xs"
                            >
                              <span className="font-mono text-stone-400">
                                {idx + 1}.
                              </span>
                              <span className="font-bold text-stone-900 flex-1">
                                {m.name}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                  orgLabel === 'OSIS'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {orgLabel}
                              </span>
                              <span className="font-mono font-bold text-sky-700">
                                {m.kelas}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {[1, 2, 3, 4, 5].map((dayNum) => {
                        const sch = getScheduleForMatrix(
                          activeMatrixCategory,
                          mobileMatrixWeek
                        );
                        const dayMemberIds =
                          sch?.weeklyAssignments[dayNum] || [];
                        return (
                          <div
                            key={dayNum}
                            className="p-3 bg-[#FFFDF8] border-2 border-[#F3E3D0] rounded-2xl space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-stone-900">
                                {DAY_NAMES_ID[dayNum]} · Minggu{' '}
                                {mobileMatrixWeek}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectWeekAndDay(
                                    mobileMatrixWeek,
                                    dayNum
                                  );
                                  setIsOtherDayModalOpen(false);
                                }}
                                className="text-xs font-bold text-orange-600 underline"
                              >
                                Buka Jadwal
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {dayMemberIds.map((rawId) => {
                                const mId = normalizeMemberId(rawId);
                                const m = memberMap.get(mId);
                                if (!m) return null;
                                const orgLabel = getMemberOrgLabel(m);
                                return (
                                  <button
                                    key={mId}
                                    type="button"
                                    onClick={() => setSelectedOfficerModal(m)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border bg-white border-[#E7D5C0] text-xs font-medium text-stone-800"
                                  >
                                    <span className="font-bold">{m.name}</span>
                                    <span
                                      className={`text-[9px] font-extrabold px-1 rounded ${
                                        orgLabel === 'OSIS'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-indigo-100 text-indigo-800'
                                      }`}
                                    >
                                      {orgLabel}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-sky-700">
                                      {m.kelas}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Desktop & Tablet Full 4-Week Matrix Table */}
                {activeMatrixCategory === 'gerbang' ? (
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#FFF8EE] border-b-2 border-[#F3E3D0] text-xs text-stone-700">
                          {[1, 2, 3, 4].map((wNum) => (
                            <th key={wNum} className="py-2.5 px-3 font-bold">
                              <div className="flex items-center justify-between">
                                <span>Minggu {wNum}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectWeekAndDay(
                                      wNum,
                                      selectedDayOfWeek
                                    );
                                    setIsOtherDayModalOpen(false);
                                  }}
                                  className="text-[11px] text-orange-600 hover:underline font-semibold"
                                >
                                  Buka
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {[1, 2, 3, 4].map((wNum) => {
                            const sch = getScheduleForMatrix('gerbang', wNum);
                            const memberIds = sch?.dailyMembers || [];
                            return (
                              <td
                                key={wNum}
                                className="p-2.5 align-top border-r last:border-r-0 border-[#F3E3D0] space-y-1.5"
                              >
                                {memberIds.map((rawId, idx) => {
                                  const mId = normalizeMemberId(rawId);
                                  const m = memberMap.get(mId);
                                  if (!m) return null;
                                  const orgLabel = getMemberOrgLabel(m);
                                  return (
                                    <button
                                      key={mId}
                                      type="button"
                                      onClick={() => {
                                        setSelectedOfficerModal(m);
                                      }}
                                      className="w-full text-left flex items-center gap-1.5 p-1.5 rounded-xl border bg-[#FFFDF9] hover:bg-orange-50 border-[#F3E3D0] text-xs"
                                    >
                                      <span className="w-4 text-center font-mono text-[10px] text-stone-400 shrink-0">
                                        {idx + 1}.
                                      </span>
                                      <span className="font-bold text-stone-900 truncate">
                                        {m.name}
                                      </span>
                                      <span
                                        className={`text-[9px] font-extrabold px-1 rounded shrink-0 ml-auto ${
                                          orgLabel === 'OSIS'
                                            ? 'bg-orange-100 text-orange-800'
                                            : 'bg-indigo-100 text-indigo-800'
                                        }`}
                                      >
                                        {orgLabel}
                                      </span>
                                      <span className="text-[10px] font-mono text-sky-700 shrink-0">
                                        {m.kelas}
                                      </span>
                                    </button>
                                  );
                                })}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#FFF8EE] border-b-2 border-[#F3E3D0] text-xs text-stone-700">
                          <th className="py-2.5 px-3 font-bold w-24">Hari</th>
                          {[1, 2, 3, 4].map((wNum) => (
                            <th key={wNum} className="py-2.5 px-3 font-bold">
                              Minggu {wNum}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-[#F3E3D0] text-xs">
                        {[1, 2, 3, 4, 5].map((dayNum) => (
                          <tr key={dayNum}>
                            <td className="p-3 font-bold text-stone-900 align-top bg-[#FFFDF8] border-r-2 border-[#F3E3D0]">
                              {DAY_NAMES_ID[dayNum]}
                            </td>
                            {[1, 2, 3, 4].map((wNum) => {
                              const sch = getScheduleForMatrix(
                                activeMatrixCategory,
                                wNum
                              );
                              const dayMemberIds =
                                sch?.weeklyAssignments[dayNum] || [];
                              return (
                                <td
                                  key={wNum}
                                  className="p-2.5 align-top border-r last:border-r-0 border-[#F3E3D0] space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-stone-400">
                                      M{wNum}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleSelectWeekAndDay(wNum, dayNum);
                                        setIsOtherDayModalOpen(false);
                                      }}
                                      className="text-[10px] font-bold text-orange-600 hover:underline"
                                    >
                                      Pilih Hari Ini
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {dayMemberIds.map((rawId) => {
                                      const mId = normalizeMemberId(rawId);
                                      const m = memberMap.get(mId);
                                      if (!m) return null;
                                      const orgLabel = getMemberOrgLabel(m);
                                      return (
                                        <button
                                          key={mId}
                                          type="button"
                                          onClick={() =>
                                            setSelectedOfficerModal(m)
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border bg-white hover:bg-orange-50 border-[#E7D5C0] text-[11px] text-stone-800 font-medium"
                                        >
                                          <span>{m.name}</span>
                                          <span
                                            className={`text-[9px] font-extrabold px-1 rounded ${
                                              orgLabel === 'OSIS'
                                                ? 'bg-orange-100 text-orange-800'
                                                : 'bg-indigo-100 text-indigo-800'
                                            }`}
                                          >
                                            {orgLabel}
                                          </span>
                                          <span className="text-[9px] font-mono text-sky-700">
                                            {m.kelas}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {otherDayTab === 'harmonized' && (
              <div className="space-y-3">
                <p className="text-xs text-stone-600">
                  Seluruh penulisan nama petugas yang mirip di lembar jadwal{' '}
                  <strong>Piket Warsis</strong>, <strong>Jaga Gerbang</strong>,
                  dan <strong>Absensi Shalat</strong> telah disamakan agar
                  jadwal dan rekap presensi tidak membingungkan (sementara{' '}
                  <strong>Dwi Ayu X A</strong> dan <strong>Dwi X F</strong>{' '}
                  tetap dipisahkan karena berbeda orang):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {HARMONIZED_NAME_NOTES.map((item) => (
                    <div
                      key={item.canonical}
                      className="p-3 bg-[#FFFDF8] border-2 border-[#F3E3D0] rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-stone-900">
                            {item.canonical}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded">
                            {item.kelas}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 pl-5">
                          Tertulis: {item.variants}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive 3D Officer Personal Schedule Modal */}
      {selectedOfficerModal && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="officer-modal-title"
        >
          <div className="card-3d max-w-lg w-full p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-[#F3E3D0] pb-4">
              <div className="flex items-center gap-3.5">
                <CharacterAvatar3D
                  name={selectedOfficerModal.name}
                  size="lg"
                />
                <div>
                  <span className="text-xs font-bold text-orange-600">
                    Kartu Jadwal Petugas (Minggu 1 – Minggu 4)
                  </span>
                  <h2
                    id="officer-modal-title"
                    className="text-lg sm:text-xl font-bold text-stone-900"
                  >
                    {selectedOfficerModal.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-extrabold border ${
                        getMemberOrgLabel(selectedOfficerModal) === 'OSIS'
                          ? 'bg-orange-100 text-orange-800 border-orange-300'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                      }`}
                    >
                      {getMemberOrgLabel(selectedOfficerModal)}
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-700">
                      Kelas {selectedOfficerModal.kelas}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOfficerModal(null)}
                aria-label="Tutup Kartu Petugas"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-stone-700">
                Daftar Penugasan Piket di Minggu 1 – Minggu 4 (Klik hari untuk
                membuka jadwalnya):
              </p>
              <div className="space-y-2.5">
                {getMemberFullSchedule(selectedOfficerModal.id).map(
                  (item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-[#FFFDF8] border-2 border-[#F3E3D0] rounded-2xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-stone-900">
                          {item.title} (Minggu {item.weekNum})
                        </span>
                        <span className="text-xs font-mono font-bold text-orange-600">
                          {item.timeRange} WIB
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.days.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              handleSelectWeekAndDay(item.weekNum, d);
                              setSelectedOfficerModal(null);
                              setIsOtherDayModalOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-sky-50 hover:bg-sky-500 text-sky-800 hover:text-white border border-sky-200 rounded-xl transition-colors"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>
                              Minggu {item.weekNum} · {DAY_NAMES_ID[d]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t-2 border-[#F3E3D0]">
              <button
                type="button"
                data-testid="btn-download-personal-pdf"
                onClick={() => {
                  const pdfBytes = generateMemberPersonalSchedulePdfBytes(
                    selectedOfficerModal,
                    allSchedules
                  );
                  const slug = selectedOfficerModal.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-');
                  triggerPdfDownload(
                    pdfBytes,
                    `kartu-jadwal-${slug}.pdf`
                  );
                }}
                className="btn-3d-sky inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Kartu Jadwal (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOfficerModal(null)}
                className="btn-3d-primary px-4 py-2 text-xs font-bold"
              >
                Tutup Kartu Jadwal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Gambar Lembar Jadwal Asli */}
      {showOriginalImageModal && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="orig-image-modal-title"
        >
          <div className="card-3d max-w-3xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-[#F3E3D0] pb-3">
              <h2
                id="orig-image-modal-title"
                className="text-base font-bold text-stone-900"
              >
                Lembar Jadwal Resmi OSIS
              </h2>
              <button
                type="button"
                onClick={() => setShowOriginalImageModal(false)}
                aria-label="Tutup Gambar Jadwal"
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveMatrixCategory('warsis')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border ${
                  activeMatrixCategory === 'warsis'
                    ? 'bg-orange-500 border-orange-600 text-white'
                    : 'bg-white border-[#E7D5C0] text-stone-700'
                }`}
              >
                Jadwal Piket Warsis
              </button>
              <button
                type="button"
                onClick={() => setActiveMatrixCategory('gerbang')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border ${
                  activeMatrixCategory === 'gerbang'
                    ? 'bg-emerald-600 border-emerald-700 text-white'
                    : 'bg-white border-[#E7D5C0] text-stone-700'
                }`}
              >
                Jadwal Jaga Gerbang
              </button>
              <button
                type="button"
                onClick={() => setActiveMatrixCategory('shalat')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border ${
                  activeMatrixCategory === 'shalat'
                    ? 'bg-sky-600 border-sky-700 text-white'
                    : 'bg-white border-[#E7D5C0] text-stone-700'
                }`}
              >
                Jadwal Petugas Absensi Shalat
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border-2 border-[#F3E3D0] bg-white">
              <img
                src={originalBoardImageMap[activeMatrixCategory]}
                alt="Gambar Lembar Jadwal Resmi OSIS"
                className="w-full h-auto object-contain max-h-[65vh] mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
