import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  UserCheck,
  Plus,
  Users,
} from 'lucide-react';
import {
  addDays,
  formatFullDateId,
  formatWeekCycleLabel,
  getWeekOfMonth,
  STATUS_LABELS_ID,
  type AttendanceRecord,
  type AttendanceStatus,
  type OsisMember,
  type PiketSchedule,
  type ResolvedScheduleForDate,
} from '../utils/piketLogic';
import { CharacterAvatar3D } from './CharacterAvatar3D';
import mascotHeroImg from '../assets/images/osis_mascot_hero_1794405496474.jpg';
import banner3dImg from '../assets/images/osis_3d_banner_1794405497564.jpg';

interface LiveDisplayAndAttendanceProps {
  todayStr: string;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  nextPreviewDate: string;
  onSelectNextPreviewDate: (dateStr: string) => void;
  todaySchedules: ResolvedScheduleForDate[];
  nextDaySchedules: ResolvedScheduleForDate[];
  allSchedules: PiketSchedule[];
  members: OsisMember[];
  onRecordAttendance: (
    date: string,
    scheduleId: string,
    memberId: string,
    status: AttendanceStatus,
    note?: string
  ) => void;
  onMarkAllPresent: (date: string, scheduleId: string) => void;
  onOpenSwapModal: (
    date: string,
    scheduleId: string,
    originalMemberId?: string
  ) => void;
  onOpenNewScheduleModal: () => void;
  onOpenMembersTab: () => void;
}

const MODE_LABELS: Record<string, string> = {
  harian: 'Sistem Harian',
  mingguan: 'Sistem Mingguan',
  custom: 'Jadwal Custom',
};

export const LiveDisplayAndAttendance: React.FC<
  LiveDisplayAndAttendanceProps
> = ({
  todayStr,
  selectedDate,
  onSelectDate,
  nextPreviewDate,
  onSelectNextPreviewDate,
  todaySchedules,
  nextDaySchedules,
  members,
  onRecordAttendance,
  onMarkAllPresent,
  onOpenSwapModal,
  onOpenNewScheduleModal,
  onOpenMembersTab,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('06:45:00');
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});

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

  const filteredTodaySchedules =
    scheduleFilter === 'all'
      ? todaySchedules
      : todaySchedules.filter((s) => s.schedule.id === scheduleFilter);

  // Calculate today's KPI counts
  let totalOfficersToday = 0;
  let countHadir = 0;
  let countTerlambat = 0;
  let countIzinSakit = 0;
  let countTidakPiket = 0;
  let countBelumAbsen = 0;

  for (const sch of todaySchedules) {
    for (const dm of sch.dutyMembers) {
      totalOfficersToday += 1;
      if (dm.effectiveStatus === 'hadir') countHadir += 1;
      else if (dm.effectiveStatus === 'terlambat') countTerlambat += 1;
      else if (dm.effectiveStatus === 'izin' || dm.effectiveStatus === 'sakit')
        countIzinSakit += 1;
      else if (dm.effectiveStatus === 'tidak_piket') countTidakPiket += 1;
      else countBelumAbsen += 1;
    }
  }

  const attendancePercentage =
    totalOfficersToday > 0
      ? Math.round(((countHadir + countTerlambat) / totalOfficersToday) * 100)
      : 0;

  const handleStartEditNote = (
    scheduleId: string,
    memberId: string,
    existingRecord: AttendanceRecord | null
  ) => {
    const key = `${scheduleId}:${memberId}`;
    setEditingNoteKey(key);
    setNoteDraft(existingRecord?.note || '');
  };

  const handleSaveNote = (
    scheduleId: string,
    memberId: string,
    currentStatus: AttendanceStatus
  ) => {
    const statusToSave: AttendanceStatus =
      currentStatus === 'belum_absen' ? 'hadir' : currentStatus;
    onRecordAttendance(
      selectedDate,
      scheduleId,
      memberId,
      statusToSave,
      noteDraft.trim()
    );
    setEditingNoteKey(null);
    setNoteDraft('');
  };

  const toggleTaskCheck = (scheduleId: string, taskIdx: number) => {
    const key = `${selectedDate}:${scheduleId}:${taskIdx}`;
    setCheckedTasks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const tomorrowDefault = addDays(selectedDate, 1);
  const dayAfterDefault = addDays(selectedDate, 2);
  const threeDaysDefault = addDays(selectedDate, 3);

  return (
    <div className="space-y-6">
      {/* Top Admin Attendance Header Bar with 3D Character Mascot */}
      <section className="card-3d p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b-2 border-[#F3E3D0]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl border-2 border-amber-300 shadow-[0_4px_0_0_#F59E0B] overflow-hidden shrink-0 bg-[#FFF3DF]">
              <img
                src={mascotHeroImg}
                alt="Maskot 3D Admin OSIS"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-orange-600">
                <span>Admin Panel · Pencatatan Presensi Kehadiran</span>
                <span aria-hidden="true">·</span>
                <span className="text-sky-700">
                  Siklus: Minggu ke-{getWeekOfMonth(selectedDate)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-stone-600">
                  {formatFullDateId(selectedDate)}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900">
                Input Presensi Kehadiran Petugas Piket
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live Digital Clock */}
            <div
              className="flex items-center gap-2.5 px-4 py-2 bg-stone-900 text-amber-50 rounded-2xl border-2 border-stone-700 shadow-[0_4px_0_0_#1C1917]"
              aria-label="Waktu Saat Ini"
            >
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-mono text-base font-bold tabular-nums tracking-wider">
                {currentTime}
              </span>
              <span className="text-xs text-amber-200/80 font-semibold">
                WIB
              </span>
            </div>

            {/* Date Selector Controls */}
            <div className="flex items-center bg-[#FFF5E6] border-2 border-[#EBD5B8] rounded-2xl p-1 shadow-[0_3px_0_0_#DEC09A]">
              <button
                type="button"
                onClick={() => {
                  const prev = addDays(selectedDate, -1);
                  onSelectDate(prev);
                  onSelectNextPreviewDate(addDays(prev, 1));
                }}
                className="p-1.5 text-stone-700 hover:text-stone-900 hover:bg-white rounded-xl transition-colors"
                aria-label="Hari Sebelumnya"
                title="Hari Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectDate(todayStr);
                  onSelectNextPreviewDate(addDays(todayStr, 1));
                }}
                className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                  selectedDate === todayStr
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900'
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
                className="p-1.5 text-stone-700 hover:text-stone-900 hover:bg-white rounded-xl transition-colors"
                aria-label="Hari Berikutnya"
                title="Hari Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <input
              type="date"
              aria-label="Pilih Tanggal Presensi"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(e.target.value);
                  onSelectNextPreviewDate(addDays(e.target.value, 1));
                }
              }}
              className="px-3 py-2 text-xs font-mono font-semibold tabular-nums bg-white border-2 border-[#EBD5B8] rounded-2xl text-stone-800 shadow-[0_3px_0_0_#DEC09A] focus:outline-none focus:border-orange-400"
            />
          </div>
        </div>

        {/* 4-Column Full-Width KPI Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x-2 divide-[#F3E3D0] pt-5">
          <div className="py-2 sm:py-1 sm:pr-5">
            <p className="text-xs font-semibold text-stone-500">
              Jadwal Berjalan Hari Ini
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-stone-900">
                {todaySchedules.length}
              </span>
              <span className="text-xs text-stone-500 font-mono tabular-nums">
                {totalOfficersToday} petugas terjadwal
              </span>
            </div>
          </div>

          <div className="py-2 sm:py-1 sm:px-5">
            <p className="text-xs font-semibold text-stone-500">
              Sudah Piket / Hadir
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                {countHadir + countTerlambat}
              </span>
              <span className="text-xs text-emerald-700 font-mono tabular-nums font-bold">
                {attendancePercentage}% hadir
              </span>
            </div>
          </div>

          <div className="py-2 sm:py-1 sm:px-5">
            <p className="text-xs font-semibold text-stone-500">
              Izin & Sakit Terkonfirmasi
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-amber-700">
                {countIzinSakit}
              </span>
              <span className="text-xs text-stone-500 font-mono tabular-nums">
                Dengan keterangan
              </span>
            </div>
          </div>

          <div className="py-2 sm:py-1 sm:pl-5">
            <p className="text-xs font-semibold text-stone-500">
              Tidak Piket · Belum Absen
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-rose-700">
                {countTidakPiket}{' '}
                <span className="text-sm font-normal text-stone-400">/</span>{' '}
                <span className="text-stone-600">{countBelumAbsen}</span>
              </span>
              <span className="text-xs text-stone-500 font-mono tabular-nums">
                Alfa / Menunggu
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Side-by-Side Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Active Schedules Running Today + Live Attendance Controls */}
        <div className="lg:col-span-8 space-y-5">
          {/* Filter Bar for Multiple Active Schedules */}
          <div className="flex flex-wrap items-center justify-between gap-3 card-3d-soft px-4 py-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#FFF3E0] rounded-xl">
              <button
                type="button"
                onClick={() => setScheduleFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  scheduleFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Semua Jadwal ({todaySchedules.length})
              </button>
              {todaySchedules.map((item) => (
                <button
                  key={item.schedule.id}
                  type="button"
                  onClick={() => setScheduleFilter(item.schedule.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    scheduleFilter === item.schedule.id
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {item.schedule.title.replace(/^Piket\s+/i, '')}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenMembersTab}
                className="btn-3d-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold whitespace-nowrap shrink-0"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Tambah Anggota ({members.length})</span>
              </button>
              <button
                type="button"
                onClick={onOpenNewScheduleModal}
                className="btn-3d-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Jadwal Baru</span>
              </button>
            </div>
          </div>

          {/* Active Schedules List */}
          {filteredTodaySchedules.length === 0 ? (
            <div className="card-3d p-8 md:p-10 text-center space-y-4">
              <div className="max-w-md mx-auto rounded-2xl overflow-hidden border-2 border-[#F3E3D0] shadow-[0_4px_0_0_#E8D2B8]">
                <img
                  src={banner3dImg}
                  alt="Ilustrasi 3D Jadwal Kosong"
                  className="w-full h-44 object-cover"
                />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-xl font-bold text-stone-900">
                  Belum Ada Jadwal Piket Aktif pada Tanggal Ini
                </h2>
                <p className="text-sm text-stone-600">
                  {members.length === 0
                    ? 'Database siap digunakan! Mulailah dengan menambahkan anggota pengurus OSIS dan membuat jadwal piket.'
                    : `Belum ada jadwal harian, mingguan, atau tanggal custom yang berjalan pada ${formatFullDateId(selectedDate)}.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onOpenMembersTab}
                  className="btn-3d-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold"
                >
                  <Users className="w-4 h-4" />
                  <span>1. Kelola Anggota Piket</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenNewScheduleModal}
                  className="btn-3d-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  <span>2. Buat Jadwal Piket</span>
                </button>
              </div>
            </div>
          ) : (
            filteredTodaySchedules.map((resolved) => {
              const { schedule, dutyMembers } = resolved;
              const presentInSchedule = dutyMembers.filter(
                (m) =>
                  m.effectiveStatus === 'hadir' ||
                  m.effectiveStatus === 'terlambat'
              ).length;

              return (
                <article
                  key={schedule.id}
                  className="card-3d overflow-hidden"
                >
                  {/* Schedule Header */}
                  <div className="p-5 bg-[#FFFDF8] border-b-2 border-[#F3E3D0] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600">
                        <span className="font-mono font-bold text-orange-600 tabular-nums">
                          {schedule.startTime} – {schedule.endTime} WIB
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{MODE_LABELS[schedule.mode]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-sky-700">
                          {formatWeekCycleLabel(schedule.activeWeeks)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-stone-600">
                          <MapPin className="w-3.5 h-3.5 text-orange-500" />
                          {schedule.location}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-stone-900">
                        {schedule.title}
                      </h2>
                      <p className="text-sm text-stone-600">
                        {schedule.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenSwapModal(selectedDate, schedule.id)
                        }
                        className="btn-3d-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold whitespace-nowrap shrink-0"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Ganti / Tukar Petugas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMarkAllPresent(selectedDate, schedule.id)
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border-2 border-emerald-400 rounded-xl shadow-[0_3px_0_0_#34D399] transition-colors whitespace-nowrap shrink-0"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Semua Hadir</span>
                      </button>
                    </div>
                  </div>

                  {/* Duty Officers & Direct Attendance Marking Table */}
                  <div className="divide-y-2 divide-[#F7ECE0]">
                    {dutyMembers.map((dm) => {
                      const noteKey = `${schedule.id}:${dm.member.id}`;
                      const isEditingThisNote = editingNoteKey === noteKey;

                      return (
                        <div
                          key={dm.member.id}
                          className="p-4 sm:px-5 hover:bg-[#FFFBF4] transition-colors"
                        >
                          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                            {/* Member Info with 3D Character Avatar */}
                            <div className="flex items-center gap-3.5 min-w-0">
                              <CharacterAvatar3D
                                name={dm.member.name}
                                size="md"
                              />
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-stone-900">
                                    {dm.member.name}
                                  </span>
                                  <span
                                    aria-hidden="true"
                                    className="text-stone-300"
                                  >
                                    ·
                                  </span>
                                  <span className="text-xs font-mono font-semibold text-stone-600 tabular-nums">
                                    {dm.member.kelas}
                                  </span>
                                  <span
                                    aria-hidden="true"
                                    className="text-stone-300"
                                  >
                                    ·
                                  </span>
                                  <span className="text-xs text-stone-500">
                                    {dm.member.jabatan}
                                  </span>
                                </div>

                                {/* Swap Info or Current Attendance Metadata */}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                  <span
                                    className={`font-bold ${
                                      dm.effectiveStatus === 'hadir'
                                        ? 'text-emerald-700'
                                        : dm.effectiveStatus === 'terlambat'
                                        ? 'text-sky-700'
                                        : dm.effectiveStatus === 'izin' ||
                                          dm.effectiveStatus === 'sakit'
                                        ? 'text-amber-700'
                                        : dm.effectiveStatus === 'tidak_piket'
                                        ? 'text-rose-700'
                                        : 'text-stone-500'
                                    }`}
                                  >
                                    Status: {STATUS_LABELS_ID[dm.effectiveStatus]}
                                  </span>

                                  {dm.attendance &&
                                    dm.attendance.checkInTime !== '-' && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="font-mono tabular-nums">
                                          Jam Absen: {dm.attendance.checkInTime}
                                        </span>
                                      </>
                                    )}

                                  {dm.isSwapped && dm.swappedFromMember && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-sky-700 font-semibold">
                                        Pengganti {dm.swappedFromMember.name} (
                                        {dm.swapReason})
                                      </span>
                                    </>
                                  )}

                                  {dm.attendance?.note && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="italic text-stone-600">
                                        &ldquo;{dm.attendance.note}&rdquo;
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Interactive Attendance Status Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  onRecordAttendance(
                                    selectedDate,
                                    schedule.id,
                                    dm.member.id,
                                    'hadir',
                                    dm.attendance?.note
                                  )
                                }
                                aria-label={`Tandai ${dm.member.name} Hadir Piket`}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 transition-colors whitespace-nowrap shrink-0 ${
                                  dm.effectiveStatus === 'hadir'
                                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-[0_3px_0_0_#059669]'
                                    : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-emerald-50 hover:text-emerald-700'
                                }`}
                              >
                                Piket / Hadir
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onRecordAttendance(
                                    selectedDate,
                                    schedule.id,
                                    dm.member.id,
                                    'terlambat',
                                    dm.attendance?.note
                                  )
                                }
                                aria-label={`Tandai ${dm.member.name} Terlambat`}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border-2 transition-colors whitespace-nowrap shrink-0 ${
                                  dm.effectiveStatus === 'terlambat'
                                    ? 'bg-sky-500 border-sky-600 text-white shadow-[0_3px_0_0_#0284C7]'
                                    : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-sky-50 hover:text-sky-700'
                                }`}
                              >
                                Terlambat
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onRecordAttendance(
                                    selectedDate,
                                    schedule.id,
                                    dm.member.id,
                                    'izin',
                                    dm.attendance?.note
                                  )
                                }
                                aria-label={`Tandai ${dm.member.name} Izin`}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border-2 transition-colors whitespace-nowrap shrink-0 ${
                                  dm.effectiveStatus === 'izin'
                                    ? 'bg-amber-500 border-amber-600 text-white shadow-[0_3px_0_0_#D97706]'
                                    : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-amber-50 hover:text-amber-800'
                                }`}
                              >
                                Izin
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onRecordAttendance(
                                    selectedDate,
                                    schedule.id,
                                    dm.member.id,
                                    'sakit',
                                    dm.attendance?.note
                                  )
                                }
                                aria-label={`Tandai ${dm.member.name} Sakit`}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border-2 transition-colors whitespace-nowrap shrink-0 ${
                                  dm.effectiveStatus === 'sakit'
                                    ? 'bg-orange-500 border-orange-600 text-white shadow-[0_3px_0_0_#EA580C]'
                                    : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-orange-50 hover:text-orange-800'
                                }`}
                              >
                                Sakit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onRecordAttendance(
                                    selectedDate,
                                    schedule.id,
                                    dm.member.id,
                                    'tidak_piket',
                                    dm.attendance?.note
                                  )
                                }
                                aria-label={`Tandai ${dm.member.name} Tidak Piket`}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border-2 transition-colors whitespace-nowrap shrink-0 ${
                                  dm.effectiveStatus === 'tidak_piket'
                                    ? 'bg-rose-500 border-rose-600 text-white shadow-[0_3px_0_0_#E11D48]'
                                    : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-rose-50 hover:text-rose-700'
                                }`}
                              >
                                Tidak Piket
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleStartEditNote(
                                    schedule.id,
                                    dm.member.id,
                                    dm.attendance
                                  )
                                }
                                aria-label={`Catatan untuk ${dm.member.name}`}
                                title="Tambah/Ubah Catatan Keterangan"
                                className="p-1.5 text-stone-600 hover:text-stone-900 bg-[#FFF5E6] border-2 border-[#E7D5C0] rounded-xl transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Optional Inline Note Editor */}
                          {isEditingThisNote && (
                            <div className="mt-3 pt-3 border-t border-[#F3E3D0] flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <input
                                type="text"
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Tulis keterangan absensi (contoh: Izin lomba cerdas cermat, Sudah menyapu ruang OSIS)..."
                                className="flex-1 px-3 py-1.5 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveNote(
                                      schedule.id,
                                      dm.member.id,
                                      dm.effectiveStatus
                                    )
                                  }
                                  className="btn-3d-primary px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                                >
                                  Simpan Catatan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteKey(null)}
                                  className="btn-3d-secondary px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Schedule Footer: Checklist Tugas Piket & Progress */}
                  <div className="px-5 py-3.5 bg-[#FFF8EE] border-t-2 border-[#F3E3D0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold text-stone-800">
                        Checklist Tugas Pos:
                      </span>
                      {schedule.tasks.map((task, idx) => {
                        const isChecked = Boolean(
                          checkedTasks[`${selectedDate}:${schedule.id}:${idx}`]
                        );
                        return (
                          <label
                            key={idx}
                            className="inline-flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTaskCheck(schedule.id, idx)}
                              className="rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                            />
                            <span
                              className={
                                isChecked ? 'line-through text-stone-400' : ''
                              }
                            >
                              {task}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="text-xs font-mono font-bold tabular-nums text-stone-600 shrink-0">
                      Kehadiran Pos: {presentInSchedule}/{dutyMembers.length}{' '}
                      petugas
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: Side-by-Side Next Day Schedule Preview */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="card-3d-sky p-5 space-y-4">
            <div className="space-y-1 border-b-2 border-[#C6E3FA] pb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-800">
                  Cek Jadwal Hari Berikutnya
                </span>
                <span className="text-xs font-mono font-bold tabular-nums text-sky-700">
                  {nextDaySchedules.length} jadwal
                </span>
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {formatFullDateId(nextPreviewDate)}
              </h2>
              <p className="text-xs text-stone-600">
                Pantau daftar petugas piket hari esok atau tanggal mendatang dan
                kelola pergantian jadwal lebih awal.
              </p>

              {/* Quick Day Switcher */}
              <div className="pt-2 flex items-center gap-1 p-1 bg-white/80 border-2 border-[#C6E3FA] rounded-2xl">
                <button
                  type="button"
                  onClick={() => onSelectNextPreviewDate(tomorrowDefault)}
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${
                    nextPreviewDate === tomorrowDefault
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Besok (+1)
                </button>
                <button
                  type="button"
                  onClick={() => onSelectNextPreviewDate(dayAfterDefault)}
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${
                    nextPreviewDate === dayAfterDefault
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Lusa (+2)
                </button>
                <button
                  type="button"
                  onClick={() => onSelectNextPreviewDate(threeDaysDefault)}
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${
                    nextPreviewDate === threeDaysDefault
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  +3 Hari
                </button>
              </div>
            </div>

            {/* Next Day Schedule List */}
            {nextDaySchedules.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm font-bold text-stone-700">
                  Tidak ada jadwal piket pada tanggal ini.
                </p>
                <p className="text-xs text-stone-500">
                  Pilih hari lain atau tambahkan jadwal baru di menu Kelola
                  Jadwal.
                </p>
              </div>
            ) : (
              <div className="divide-y-2 divide-[#D6EBFC]">
                {nextDaySchedules.map((nextItem) => (
                  <div
                    key={nextItem.schedule.id}
                    className="py-4 first:pt-0 last:pb-0 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-800">
                          <span className="font-mono font-bold tabular-nums">
                            {nextItem.schedule.startTime} –{' '}
                            {nextItem.schedule.endTime}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{MODE_LABELS[nextItem.schedule.mode]}</span>
                        </div>
                        <h3 className="text-sm font-bold text-stone-900 mt-0.5">
                          {nextItem.schedule.title}
                        </h3>
                        <p className="text-xs text-stone-600">
                          {nextItem.schedule.location}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onOpenSwapModal(
                            nextPreviewDate,
                            nextItem.schedule.id
                          )
                        }
                        className="px-2.5 py-1 text-xs font-bold text-sky-800 bg-white border border-sky-300 hover:bg-sky-50 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        Tukar Piket
                      </button>
                    </div>

                    {/* Assigned Officers for Tomorrow */}
                    <div className="space-y-1.5 pt-1">
                      {nextItem.dutyMembers.map((dm) => (
                        <div
                          key={dm.member.id}
                          className="flex items-center gap-2.5 text-xs py-1.5 px-2.5 bg-white/90 border border-[#C6E3FA] rounded-xl"
                        >
                          <CharacterAvatar3D
                            name={dm.member.name}
                            size="sm"
                          />
                          <div className="truncate flex-1">
                            <span className="font-bold text-stone-800">
                              {dm.member.name}
                            </span>
                            <span className="text-stone-400 mx-1.5">·</span>
                            <span className="font-mono text-stone-500 tabular-nums">
                              {dm.member.kelas}
                            </span>
                            {dm.isSwapped && dm.swappedFromMember && (
                              <span className="block text-[11px] font-semibold text-sky-700">
                                Menggantikan {dm.swappedFromMember.name}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action to switch main view to the previewed date */}
            <div className="pt-3 border-t-2 border-[#C6E3FA]">
              <button
                type="button"
                onClick={() => {
                  onSelectDate(nextPreviewDate);
                  onSelectNextPreviewDate(addDays(nextPreviewDate, 1));
                }}
                className="btn-3d-secondary w-full py-2 px-4 text-xs font-bold"
              >
                Buka Tanggal Ini di Layar Utama
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
