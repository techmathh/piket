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
} from 'lucide-react';
import {
  DAY_NAMES_ID,
  STATUS_LABELS_ID,
  addDays,
  findDateForWeekAndDay,
  formatFullDateId,
  formatWeekCycleLabel,
  getDefaultDisplayDateForHour,
  getMemberOrgLabel,
  getTimeOfDayGreeting,
  getWeekOfMonth,
  normalizeMemberId,
  parseDateString,
  type OsisMember,
  type PiketSchedule,
  type ResolvedScheduleForDate,
  type TimeOfDayPeriod,
} from '../utils/piketLogic';
import { HARMONIZED_NAME_NOTES } from '../data/initialData';
import { CharacterAvatar3D } from './CharacterAvatar3D';
import mascotHeroImg from '../assets/images/osis_mascot_hero_1794405496474.jpg';
import banner3dImg from '../assets/images/osis_3d_banner_1794405497564.jpg';

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
}) => {
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

  // Filter active day's schedules by optional search query
  const filteredSchedules = todaySchedules.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = item.schedule.title.toLowerCase().includes(q);
      const memberMatch = item.dutyMembers.some(
        (dm) =>
          dm.member.name.toLowerCase().includes(q) ||
          dm.member.kelas.toLowerCase().includes(q) ||
          getMemberOrgLabel(dm.member).toLowerCase().includes(q)
      );
      return titleMatch || memberMatch;
    }
    return true;
  });

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
  const getMemberFullSchedule = (memberId: string) => {
    const list: Array<{
      scheduleId: string;
      title: string;
      location: string;
      timeRange: string;
      weekNum: number;
      days: number[];
    }> = [];

    for (const sch of allSchedules) {
      const weekNum = sch.activeWeeks?.[0] || 1;
      const dailyNorm = sch.dailyMembers.map(normalizeMemberId);
      if (sch.mode === 'harian' && dailyNorm.includes(memberId)) {
        list.push({
          scheduleId: sch.id,
          title: sch.title,
          location: sch.location,
          timeRange: `${sch.startTime} – ${sch.endTime}`,
          weekNum,
          days: [1, 2, 3, 4, 5],
        });
      } else if (sch.mode === 'mingguan') {
        const matchedDays: number[] = [];
        for (const d of [1, 2, 3, 4, 5]) {
          const ids = (sch.weeklyAssignments[d] || []).map(normalizeMemberId);
          if (ids.includes(memberId)) matchedDays.push(d);
        }
        if (matchedDays.length > 0) {
          list.push({
            scheduleId: sch.id,
            title: sch.title,
            location: sch.location,
            timeRange: `${sch.startTime} – ${sch.endTime}`,
            weekNum,
            days: matchedDays,
          });
        }
      }
    }
    return list.sort((a, b) => a.weekNum - b.weekNum);
  };

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
        headerBg: 'bg-emerald-50/90 border-emerald-200',
        badgeBg: 'bg-emerald-600 text-white',
        timeText: 'text-emerald-800',
      };
    }
    if (lower.includes('warsis')) {
      return {
        headerBg: 'bg-orange-50/90 border-orange-200',
        badgeBg: 'bg-orange-500 text-white',
        timeText: 'text-orange-800',
      };
    }
    return {
      headerBg: 'bg-sky-50/90 border-sky-200',
      badgeBg: 'bg-sky-600 text-white',
      timeText: 'text-sky-800',
    };
  };

  return (
    <div className="space-y-4">
      {/* 1. Clean Top Header Card: Date, Week Cycle, Live Clock & Only 2 Schedule Navigation Buttons */}
      <section className="card-3d p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          {/* Left: Mascot + Clean Date Title */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl border-2 border-amber-300 shadow-[0_4px_0_0_#F59E0B] overflow-hidden shrink-0 bg-[#FFF3DF]">
              <img
                src={mascotHeroImg}
                alt="Maskot 3D Pengurus OSIS"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-0.5 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-stone-900 leading-tight">
                {formatFullDateId(selectedDate)}
              </h1>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-bold">
                <span className="text-sky-700">
                  Siklus Minggu ke-{currentWeekOfMonth}
                </span>
                <span aria-hidden="true" className="text-stone-300">
                  ·
                </span>
                <span
                  className={
                    isShowingToday
                      ? 'text-emerald-700'
                      : isShowingTomorrow
                      ? 'text-orange-600'
                      : 'text-stone-600'
                  }
                >
                  {isShowingToday
                    ? 'Menampilkan Jadwal Hari Ini'
                    : isShowingTomorrow
                    ? 'Menampilkan Jadwal untuk Besok'
                    : 'Menampilkan Jadwal Hari Pilihan'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Live Clock + Minimal Contextual Buttons (Only 2 buttons: Besok/Hari Ini & Hari Lain) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-stone-900 text-amber-50 rounded-2xl border-2 border-stone-700 shadow-[0_3px_0_0_#1C1917]">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-mono text-xs sm:text-sm font-bold tabular-nums tracking-wider">
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
                  className={`px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                    !isShowingToday ? 'btn-3d-primary' : 'btn-3d-sky'
                  }`}
                >
                  <span>
                    {!isShowingToday
                      ? 'Kembali ke Hari Ini'
                      : 'Cek Jadwal Besok'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  data-testid="btn-cek-jadwal-hari-lain"
                  onClick={() => {
                    setOtherDayTab('picker');
                    setIsOtherDayModalOpen(true);
                  }}
                  className="btn-3d-secondary px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-orange-500" />
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
                  className={`px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                    !isShowingTomorrow ? 'btn-3d-primary' : 'btn-3d-sky'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
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
                  className="btn-3d-secondary px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-orange-500" />
                  <span>Cek Jadwal Hari Lain</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2. Dedicated Relocated Typewriter Greeting Bar + Clean Search Box (Zero extra filter buttons) */}
        <div className="pt-3 border-t-2 border-[#F3E3D0] flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Animated Typewriter Greeting Bubble */}
          <div
            data-testid="typewriter-greeting-box"
            className={`flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 ${
              isNightMode
                ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                : 'bg-[#FFF6E8] border-[#F3DEC0] text-stone-900'
            }`}
          >
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isNightMode
                  ? 'bg-white border-indigo-200'
                  : 'bg-white border-amber-200'
              }`}
            >
              {renderGreetingIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold leading-snug min-h-[1.35rem] flex items-center">
                <span>{typedText}</span>
                <span
                  aria-hidden="true"
                  className="inline-block w-0.5 h-4 ml-0.5 bg-orange-500 animate-pulse shrink-0"
                />
              </p>
            </div>
          </div>

          {/* Right: Compact Search Input (No extra buttons) */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Cari nama petugas piket"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau kelas petugas..."
              className="w-full pl-8 pr-7 py-2 text-xs bg-white border-2 border-[#EBD5B8] rounded-xl focus:outline-none focus:border-orange-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. Responsive 3-Column Schedule Cards Across Mobile, Tablet & Desktop */}
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
              Tidak Ada Jadwal Piket pada Hari Ini
            </h2>
            <p className="text-xs text-stone-600">
              Gunakan tombol <strong>Cek Jadwal Hari Lain</strong> untuk melihat
              jadwal Senin – Jumat pada siklus Minggu 1 – Minggu 4.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-4 sm:gap-5 items-stretch ${
            filteredSchedules.length === 1
              ? 'lg:grid-cols-1'
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
                className="card-3d overflow-hidden flex flex-col h-full"
              >
                {/* Color-Coded Schedule Card Header */}
                <div
                  className={`p-3.5 sm:p-4 border-b-2 ${accent.headerBg} space-y-1.5`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-mono font-bold tabular-nums ${accent.timeText}`}
                    >
                      {schedule.startTime} – {schedule.endTime} WIB
                    </span>
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
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-stone-700 bg-white/90 border border-stone-200 px-2 py-0.5 rounded-lg shrink-0">
                      <Users className="w-3 h-3 text-stone-500" />
                      {dutyMembers.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="truncate font-medium">
                      {schedule.location}
                    </span>
                  </div>
                </div>

                {/* Responsive Officer List with Full Names, Synchronized Classes & OSIS / MPK Labels */}
                <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    {dutyMembers.map((dm, idx) => {
                      const orgLabel = getMemberOrgLabel(dm.member);
                      const isHighlighted =
                        q.length > 0 &&
                        (dm.member.name.toLowerCase().includes(q) ||
                          dm.member.kelas.toLowerCase().includes(q) ||
                          orgLabel.toLowerCase().includes(q));

                      return (
                        <button
                          key={`${dm.member.id}-${idx}`}
                          type="button"
                          onClick={() => setSelectedOfficerModal(dm.member)}
                          className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all flex items-center justify-between gap-2.5 group ${
                            isHighlighted
                              ? 'bg-amber-50 border-orange-400 shadow-[0_3px_0_0_#F97316]'
                              : 'bg-[#FFFDF9] border-[#F3E3D0] hover:border-orange-300 hover:bg-orange-50/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <CharacterAvatar3D
                              name={dm.member.name}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-bold text-stone-900 group-hover:text-orange-600 transition-colors leading-snug break-words">
                                {idx + 1}. {dm.member.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] font-medium text-stone-500">
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
                                  {dm.member.kelas}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {dm.isSwapped && dm.swappedFromMember
                                    ? `Ganti ${dm.swappedFromMember.name}`
                                    : STATUS_LABELS_ID[dm.effectiveStatus]}
                                </span>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              dm.effectiveStatus === 'hadir'
                                ? 'bg-emerald-500'
                                : dm.effectiveStatus === 'terlambat'
                                ? 'bg-sky-500'
                                : dm.effectiveStatus === 'izin' ||
                                  dm.effectiveStatus === 'sakit'
                                ? 'bg-amber-500'
                                : dm.effectiveStatus === 'tidak_piket'
                                ? 'bg-rose-500'
                                : 'bg-stone-300'
                            }`}
                            title={STATUS_LABELS_ID[dm.effectiveStatus]}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Aligned Card Footer */}
                  <div className="pt-2.5 border-t border-[#F3E3D0] flex items-center justify-between text-[11px] text-stone-500">
                    <span>Klik nama untuk kartu jadwal M1–M4</span>
                    <span className="font-mono font-semibold text-stone-700">
                      {
                        dutyMembers.filter(
                          (d) =>
                            d.effectiveStatus === 'hadir' ||
                            d.effectiveStatus === 'terlambat'
                        ).length
                      }
                      /{dutyMembers.length} Hadir
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal: Cek Jadwal Hari Lain, Tabel Minggu 1-4, & Daftar Penyerasian Nama */}
      {isOtherDayModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="other-day-modal-title"
        >
          <div className="card-3d max-w-4xl w-full p-4 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
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
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher inside Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#FFF3E0] border-2 border-[#F3E3D0] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setOtherDayTab('picker')}
                  className={`px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    otherDayTab === 'picker'
                      ? 'bg-orange-500 text-white'
                      : 'text-stone-700 hover:bg-white'
                  }`}
                >
                  Pilih Minggu & Hari
                </button>
                <button
                  type="button"
                  onClick={() => setOtherDayTab('matrix')}
                  className={`px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    otherDayTab === 'matrix'
                      ? 'bg-orange-500 text-white'
                      : 'text-stone-700 hover:bg-white'
                  }`}
                >
                  Tabel Lengkap Minggu 1–4
                </button>
                <button
                  type="button"
                  onClick={() => setOtherDayTab('harmonized')}
                  className={`px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    otherDayTab === 'harmonized'
                      ? 'bg-orange-500 text-white'
                      : 'text-stone-700 hover:bg-white'
                  }`}
                >
                  Nama Diserasikan ({HARMONIZED_NAME_NOTES.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowOriginalImageModal(true)}
                className="btn-3d-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
              >
                <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
                <span>Lihat Gambar Lembar Jadwal Asli</span>
              </button>
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMatrixCategory('warsis')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border-2 transition-all ${
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
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border-2 transition-all ${
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
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border-2 transition-all ${
                      activeMatrixCategory === 'shalat'
                        ? 'bg-sky-600 border-sky-700 text-white'
                        : 'bg-white border-[#E7D5C0] text-stone-700'
                    }`}
                  >
                    3. Absensi Shalat (Minggu 1–4)
                  </button>
                </div>

                {activeMatrixCategory === 'gerbang' ? (
                  <div className="overflow-x-auto">
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
                  <div className="overflow-x-auto">
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

            <div className="flex justify-end pt-2 border-t-2 border-[#F3E3D0]">
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
