import React, { useState } from 'react';
import {
  Plus,
  Clock,
  MapPin,
  ArrowLeftRight,
  Trash2,
  Edit3,
  UserPlus,
  X,
} from 'lucide-react';
import {
  DAY_NAMES_ID,
  formatFullDateId,
  formatWeekCycleLabel,
  type OsisMember,
  type PiketSchedule,
  type ScheduleMode,
  type ScheduleSwap,
} from '../utils/piketLogic';
import { banner3dImg } from '../assets/brandAssets';

interface ScheduleManagerProps {
  todayStr: string;
  schedules: PiketSchedule[];
  members: OsisMember[];
  swaps: ScheduleSwap[];
  onAddSchedule: (newSchedule: PiketSchedule) => void;
  onUpdateSchedule: (updatedSchedule: PiketSchedule) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onDeleteSwap: (swapId: string) => void;
  onOpenSwapModal: (
    date: string,
    scheduleId: string,
    originalMemberId?: string
  ) => void;
}

const MODE_LABELS: Record<ScheduleMode, string> = {
  harian: 'Sistem Harian',
  mingguan: 'Sistem Mingguan',
  custom: 'Jadwal Custom',
};

export const ScheduleManager: React.FC<ScheduleManagerProps> = ({
  todayStr,
  schedules,
  members,
  swaps,
  onAddSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onDeleteSwap,
  onOpenSwapModal,
}) => {
  const [modeFilter, setModeFilter] = useState<'all' | ScheduleMode>('all');
  const [weekFilter, setWeekFilter] = useState<'all' | 'every_week' | number>(
    'all'
  );
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null
  );

  // Form state for Add / Edit Schedule
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('06:30');
  const [endTime, setEndTime] = useState<string>('07:15');
  const [mode, setMode] = useState<ScheduleMode>('mingguan');
  const [weekSelectionMode, setWeekSelectionMode] = useState<
    'setiap_minggu' | 'pilih_minggu'
  >('setiap_minggu');
  const [activeWeeks, setActiveWeeks] = useState<number[]>([1, 2, 3, 4]);
  const [tasksText, setTasksText] = useState<string>(
    'Menjaga kebersihan pos piket\nMencatat kehadiran dan buku agenda'
  );
  const [activeDays, setActiveDays] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6,
  ]);
  const [dailyMembers, setDailyMembers] = useState<string[]>([]);
  const [weeklyAssignments, setWeeklyAssignments] = useState<
    Record<number, string[]>
  >({
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    0: [],
  });
  const [selectedDayTab, setSelectedDayTab] = useState<number>(1);
  const [customDates, setCustomDates] = useState<string[]>([todayStr]);
  const [newCustomDateInput, setNewCustomDateInput] =
    useState<string>(todayStr);
  const [customDateAssignments, setCustomDateAssignments] = useState<
    Record<string, string[]>
  >({});
  const [formError, setFormError] = useState<string>('');

  // Quick inline member reassignment state
  const [quickAssignScheduleId, setQuickAssignScheduleId] = useState<
    string | null
  >(null);
  const [quickAssignDay, setQuickAssignDay] = useState<number>(1);
  const [quickAssignMemberId, setQuickAssignMemberId] = useState<string>(
    members[0]?.id || ''
  );

  const memberMap = new Map<string, OsisMember>();
  for (const m of members) memberMap.set(m.id, m);

  const filteredSchedules = schedules.filter((s) => {
    if (modeFilter !== 'all' && s.mode !== modeFilter) return false;
    const sWeeks =
      s.activeWeeks && s.activeWeeks.length > 0 ? s.activeWeeks : [1, 2, 3, 4];
    if (weekFilter === 'every_week') {
      return sWeeks.length >= 4;
    }
    if (typeof weekFilter === 'number') {
      return sWeeks.includes(weekFilter);
    }
    return true;
  });

  const openCreateForm = () => {
    setEditingScheduleId(null);
    setTitle('');
    setDescription('');
    setLocation('Ruang Sekretariat OSIS');
    setStartTime('06:30');
    setEndTime('07:15');
    setMode('mingguan');
    setWeekSelectionMode('setiap_minggu');
    setActiveWeeks([1, 2, 3, 4]);
    setTasksText(
      'Menjaga kebersihan pos piket\nMencatat kehadiran dan buku agenda'
    );
    setActiveDays([0, 1, 2, 3, 4, 5, 6]);
    const defaultMemberIds = members.slice(0, 2).map((m) => m.id);
    setDailyMembers(defaultMemberIds);
    setWeeklyAssignments({
      1: defaultMemberIds,
      2: defaultMemberIds,
      3: defaultMemberIds,
      4: defaultMemberIds,
      5: defaultMemberIds,
      6: defaultMemberIds,
      0: defaultMemberIds,
    });
    setCustomDates([todayStr]);
    setCustomDateAssignments({
      [todayStr]: defaultMemberIds,
    });
    setFormError('');
    setShowFormModal(true);
  };

  const openEditForm = (sch: PiketSchedule) => {
    const schWeeks =
      sch.activeWeeks && sch.activeWeeks.length > 0
        ? [...sch.activeWeeks]
        : [1, 2, 3, 4];
    setEditingScheduleId(sch.id);
    setTitle(sch.title);
    setDescription(sch.description);
    setLocation(sch.location);
    setStartTime(sch.startTime);
    setEndTime(sch.endTime);
    setMode(sch.mode);
    setWeekSelectionMode(
      schWeeks.length >= 4 ? 'setiap_minggu' : 'pilih_minggu'
    );
    setActiveWeeks(schWeeks);
    setTasksText(sch.tasks.join('\n'));
    setActiveDays([...sch.activeDays]);
    setDailyMembers([...sch.dailyMembers]);
    setWeeklyAssignments({ ...sch.weeklyAssignments });
    setCustomDates(
      sch.customDates.length > 0 ? [...sch.customDates] : [todayStr]
    );
    setCustomDateAssignments({ ...sch.customDateAssignments });
    setFormError('');
    setShowFormModal(true);
  };

  const toggleWeekNumber = (weekNum: number) => {
    setActiveWeeks((prev) => {
      if (prev.includes(weekNum)) {
        const next = prev.filter((w) => w !== weekNum);
        return next.length > 0 ? next : [weekNum];
      }
      return [...prev, weekNum].sort((a, b) => a - b);
    });
  };

  const toggleDayActive = (dayNum: number) => {
    setActiveDays((prev) =>
      prev.includes(dayNum)
        ? prev.filter((d) => d !== dayNum)
        : [...prev, dayNum].sort()
    );
  };

  const toggleDailyMember = (memberId: string) => {
    setDailyMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleWeeklyDayMember = (dayNum: number, memberId: string) => {
    setWeeklyAssignments((prev) => {
      const current = prev[dayNum] || [];
      const next = current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId];
      return { ...prev, [dayNum]: next };
    });
  };

  const handleAddCustomDate = () => {
    if (!newCustomDateInput) return;
    if (!customDates.includes(newCustomDateInput)) {
      setCustomDates((prev) => [...prev, newCustomDateInput].sort());
      setCustomDateAssignments((prev) => ({
        ...prev,
        [newCustomDateInput]:
          prev[newCustomDateInput] || members.slice(0, 2).map((m) => m.id),
      }));
    }
  };

  const handleRemoveCustomDate = (dt: string) => {
    setCustomDates((prev) => prev.filter((d) => d !== dt));
  };

  const handleSaveScheduleForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Nama jadwal wajib diisi.');
      return;
    }
    if (!location.trim()) {
      setFormError('Lokasi pos piket wajib diisi.');
      return;
    }

    const parsedTasks = tasksText
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    const resolvedWeeks =
      weekSelectionMode === 'setiap_minggu'
        ? [1, 2, 3, 4]
        : activeWeeks.length > 0
        ? activeWeeks
        : [1, 2, 3, 4];

    const schedulePayload: PiketSchedule = {
      id: editingScheduleId || `sch-${Date.now()}`,
      title: title.trim(),
      description:
        description.trim() ||
        `Jadwal piket rutin pengurus OSIS di ${location.trim()}.`,
      location: location.trim(),
      startTime,
      endTime,
      mode,
      activeWeeks: resolvedWeeks,
      tasks:
        parsedTasks.length > 0
          ? parsedTasks
          : ['Menjaga ketertiban dan kebersihan pos piket'],
      activeDays:
        mode === 'custom'
          ? []
          : activeDays.length > 0
          ? activeDays
          : [0, 1, 2, 3, 4, 5, 6],
      dailyMembers,
      weeklyAssignments,
      customDates: mode === 'custom' ? customDates : [],
      customDateAssignments:
        mode === 'custom' ? customDateAssignments : {},
    };

    if (editingScheduleId) {
      onUpdateSchedule(schedulePayload);
    } else {
      onAddSchedule(schedulePayload);
    }
    setShowFormModal(false);
  };

  const handleQuickAddMemberToSchedule = (schedule: PiketSchedule) => {
    const targetMemberId = quickAssignMemberId || members[0]?.id;
    if (!targetMemberId) return;
    if (schedule.mode === 'harian' || schedule.mode === 'custom') {
      const nextDaily = Array.from(
        new Set([...schedule.dailyMembers, targetMemberId])
      );
      onUpdateSchedule({
        ...schedule,
        dailyMembers: nextDaily,
      });
    } else {
      const existing = schedule.weeklyAssignments[quickAssignDay] || [];
      const nextDayMembers = Array.from(
        new Set([...existing, targetMemberId])
      );
      const nextActiveDays = Array.from(
        new Set([...schedule.activeDays, quickAssignDay])
      ).sort();
      onUpdateSchedule({
        ...schedule,
        activeDays: nextActiveDays,
        weeklyAssignments: {
          ...schedule.weeklyAssignments,
          [quickAssignDay]: nextDayMembers,
        },
      });
    }
    setQuickAssignScheduleId(null);
  };

  const handleRemoveMemberFromScheduleDay = (
    schedule: PiketSchedule,
    dayOrMode: number | 'daily',
    memberId: string
  ) => {
    if (dayOrMode === 'daily') {
      onUpdateSchedule({
        ...schedule,
        dailyMembers: schedule.dailyMembers.filter((id) => id !== memberId),
      });
    } else {
      const current = schedule.weeklyAssignments[dayOrMode] || [];
      onUpdateSchedule({
        ...schedule,
        weeklyAssignments: {
          ...schedule.weeklyAssignments,
          [dayOrMode]: current.filter((id) => id !== memberId),
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Filter */}
      <section className="card-3d p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
            <span>Manajemen Multi-Jadwal OSIS (Database Firestore)</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-stone-700">
              {schedules.length} jadwal terdaftar
            </span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">
            Kelola Jadwal & Pergantian Piket (Minggu 1 – Minggu 4)
          </h1>
          <p className="text-sm text-stone-600">
            Atur lebih dari satu jadwal piket dengan sistem waktu Harian,
            Mingguan, atau Custom tanggal, serta pilih siklus Setiap Minggu atau
            Minggu 1 – Minggu 4.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {schedules.length > 0 && members.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onOpenSwapModal(todayStr, schedules[0]?.id || '')
              }
              className="btn-3d-secondary inline-flex items-center gap-2 px-4 py-2 text-xs font-bold whitespace-nowrap"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Tukar / Ganti Piket Harian</span>
            </button>
          )}

          <button
            type="button"
            onClick={openCreateForm}
            className="btn-3d-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal Baru</span>
          </button>
        </div>
      </section>

      {/* Filter Tabs: Sistem Waktu & Siklus Minggu 1-4 */}
      <div className="flex flex-wrap items-center justify-between gap-3 card-3d-soft px-4 py-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#FFF3E0] rounded-xl">
          <button
            type="button"
            onClick={() => setModeFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              modeFilter === 'all'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Semua Sistem ({schedules.length})
          </button>
          <button
            type="button"
            onClick={() => setModeFilter('harian')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              modeFilter === 'harian'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Harian ({schedules.filter((s) => s.mode === 'harian').length})
          </button>
          <button
            type="button"
            onClick={() => setModeFilter('mingguan')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              modeFilter === 'mingguan'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Mingguan ({schedules.filter((s) => s.mode === 'mingguan').length})
          </button>
          <button
            type="button"
            onClick={() => setModeFilter('custom')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              modeFilter === 'custom'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Custom Tanggal ({schedules.filter((s) => s.mode === 'custom').length})
          </button>
        </div>

        {/* Week Cycle Filter (Setiap Minggu / Minggu 1 - Minggu 4) */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#FFF3E0] rounded-xl">
          <button
            type="button"
            onClick={() => setWeekFilter('all')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              weekFilter === 'all'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Semua Minggu
          </button>
          <button
            type="button"
            onClick={() => setWeekFilter('every_week')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              weekFilter === 'every_week'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Setiap Minggu
          </button>
          {[1, 2, 3, 4].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeekFilter(w)}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                weekFilter === w
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Minggu {w}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Cards Grid */}
      {filteredSchedules.length === 0 ? (
        <section className="card-3d p-8 md:p-10 text-center space-y-4">
          <div className="max-w-md mx-auto rounded-2xl overflow-hidden border-2 border-[#F3E3D0] shadow-[0_4px_0_0_#E8D2B8]">
            <img
              src={banner3dImg}
              alt="Ilustrasi 3D Jadwal OSIS"
              className="w-full h-40 object-cover"
            />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-stone-900">
              Belum Ada Jadwal Piket Terdaftar
            </h2>
            <p className="text-xs text-stone-600">
              Tambahkan jadwal piket baru (Harian, Mingguan, atau Custom) dan
              pilih apakah berlaku Setiap Minggu atau pada Minggu 1 – Minggu 4.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="btn-3d-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Jadwal Pertama</span>
          </button>
        </section>
      ) : (
        <div className="space-y-5">
          {filteredSchedules.map((sch) => (
            <article key={sch.id} className="card-3d overflow-hidden">
              <div className="p-5 bg-[#FFFDF8] border-b-2 border-[#F3E3D0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600">
                    <span className="font-bold text-orange-600">
                      {MODE_LABELS[sch.mode]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-sky-700">
                      Siklus: {formatWeekCycleLabel(sch.activeWeeks)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-stone-700">
                      <Clock className="w-3.5 h-3.5 text-orange-500" />
                      {sch.startTime} – {sch.endTime} WIB
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-stone-600">
                      <MapPin className="w-3.5 h-3.5 text-orange-500" />
                      {sch.location}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-stone-900">
                    {sch.title}
                  </h2>
                  <p className="text-sm text-stone-600">{sch.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {members.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAssignMemberId(members[0]?.id || '');
                        setQuickAssignScheduleId(
                          quickAssignScheduleId === sch.id ? null : sch.id
                        );
                      }}
                      className="btn-3d-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Tambah Petugas ke Jadwal</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditForm(sch)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-800 bg-sky-50 border-2 border-sky-200 hover:bg-sky-100 rounded-xl transition-colors whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ubah Jadwal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteSchedule(sch.id)}
                    aria-label={`Hapus ${sch.title}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border-2 border-rose-200 hover:bg-rose-100 rounded-xl transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>

              {/* Quick Inline Add Member Bar */}
              {quickAssignScheduleId === sch.id && (
                <div className="px-5 py-3.5 bg-[#FFF8EE] border-b-2 border-[#F3E3D0] flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-stone-800">
                    Masukkan Anggota ke {sch.title}:
                  </span>
                  {sch.mode === 'mingguan' && (
                    <select
                      aria-label="Pilih Hari Penugasan"
                      value={quickAssignDay}
                      onChange={(e) =>
                        setQuickAssignDay(Number(e.target.value))
                      }
                      className="px-2.5 py-1.5 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
                    >
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <option key={d} value={d}>
                          Hari {DAY_NAMES_ID[d]}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    aria-label="Pilih Anggota Piket"
                    value={quickAssignMemberId}
                    onChange={(e) => setQuickAssignMemberId(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.kelas})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleQuickAddMemberToSchedule(sch)}
                    className="btn-3d-primary px-3 py-1.5 text-xs font-bold"
                  >
                    Simpan Penugasan
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickAssignScheduleId(null)}
                    className="px-2.5 py-1.5 text-xs font-bold text-stone-600 hover:text-stone-900"
                  >
                    Tutup
                  </button>
                </div>
              )}

              {/* Schedule Matrix Breakdown based on Mode */}
              <div className="p-5">
                {sch.mode === 'mingguan' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x-2 divide-[#F3E3D0]">
                    {[1, 2, 3, 4, 5, 6, 0].map((dayNum, idx) => {
                      const dayMembers = sch.weeklyAssignments[dayNum] || [];
                      return (
                        <div
                          key={dayNum}
                          className={`py-2 sm:py-1 ${
                            idx === 0
                              ? 'sm:pr-3'
                              : idx === 6
                              ? 'sm:pl-3'
                              : 'sm:px-3'
                          } space-y-2`}
                        >
                          <div className="flex items-center justify-between border-b border-[#F3E3D0] pb-1.5">
                            <span className="text-xs font-bold text-stone-800">
                              {DAY_NAMES_ID[dayNum]}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums text-stone-500">
                              {dayMembers.length} org
                            </span>
                          </div>
                          {dayMembers.length === 0 ? (
                            <p className="text-xs text-stone-400 italic">
                              Kosong
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {dayMembers.map((mId) => {
                                const m = memberMap.get(mId);
                                if (!m) return null;
                                return (
                                  <li
                                    key={mId}
                                    className="flex items-center justify-between gap-1 text-xs text-stone-700 font-medium"
                                  >
                                    <span className="truncate" title={m.name}>
                                      {m.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveMemberFromScheduleDay(
                                          sch,
                                          dayNum,
                                          mId
                                        )
                                      }
                                      aria-label={`Keluarkan ${m.name} dari hari ${DAY_NAMES_ID[dayNum]}`}
                                      className="text-stone-400 hover:text-rose-600 p-0.5 shrink-0"
                                      title="Hapus dari hari ini"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {sch.mode === 'harian' && (
                  <div className="space-y-3">
                    <div className="text-xs text-stone-500">
                      Hari Aktif:{' '}
                      <span className="font-bold text-stone-800">
                        {sch.activeDays.map((d) => DAY_NAMES_ID[d]).join(', ')}
                      </span>
                    </div>
                    {sch.dailyMembers.length === 0 ? (
                      <p className="text-xs text-stone-400 italic">
                        Belum ada petugas harian yang dipilih.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x-2 divide-[#F3E3D0]">
                        {sch.dailyMembers.map((mId, idx) => {
                          const m = memberMap.get(mId);
                          if (!m) return null;
                          return (
                            <div
                              key={mId}
                              className={`flex items-center justify-between py-2 ${
                                idx === 0 ? 'sm:pr-4' : 'sm:px-4'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className="text-xs font-bold text-stone-900 truncate">
                                  {m.name}
                                </p>
                                <p className="text-[11px] text-stone-500 truncate">
                                  {m.kelas} · {m.jabatan}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMemberFromScheduleDay(
                                    sch,
                                    'daily',
                                    mId
                                  )
                                }
                                aria-label={`Keluarkan ${m.name} dari ${sch.title}`}
                                className="p-1 text-stone-400 hover:text-rose-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {sch.mode === 'custom' && (
                  <div className="space-y-3">
                    <div className="text-xs text-stone-500">
                      Tanggal Pelaksanaan Custom ({sch.customDates.length} hari):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x-2 divide-[#F3E3D0]">
                      {sch.customDates.map((dt, idx) => {
                        const assignedIds =
                          sch.customDateAssignments[dt] || sch.dailyMembers;
                        return (
                          <div
                            key={dt}
                            className={`py-2 ${
                              idx === 0 ? 'sm:pr-4' : 'sm:px-4'
                            } space-y-2`}
                          >
                            <div className="flex items-center justify-between border-b border-[#F3E3D0] pb-1.5">
                              <span className="text-xs font-mono font-bold text-stone-800 tabular-nums">
                                {dt}
                              </span>
                              <span className="text-[11px] text-stone-500">
                                {assignedIds.length} petugas
                              </span>
                            </div>
                            <ul className="space-y-1">
                              {assignedIds.map((mId) => {
                                const m = memberMap.get(mId);
                                return m ? (
                                  <li
                                    key={mId}
                                    className="text-xs text-stone-700 font-medium truncate"
                                  >
                                    {m.name} ({m.kelas})
                                  </li>
                                ) : null;
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Active Temporary Schedule Swaps Section */}
      <section className="card-3d p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Daftar Pergantian / Tukar Jadwal Sementara
            </h2>
            <p className="text-xs text-stone-500">
              Catatan pertukaran atau penggantian petugas piket pada tanggal
              tertentu.
            </p>
          </div>
          <span className="text-xs font-mono font-bold tabular-nums text-stone-500">
            {swaps.length} pergantian tercatat
          </span>
        </div>

        {swaps.length === 0 ? (
          <p className="text-xs text-stone-500 py-4">
            Belum ada pergantian jadwal sementara.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#F3E3D0] text-xs text-stone-500">
                  <th className="py-2.5 pr-4 font-bold">Tanggal</th>
                  <th className="py-2.5 px-4 font-bold">Jadwal Piket</th>
                  <th className="py-2.5 px-4 font-bold">Petugas Asli</th>
                  <th className="py-2.5 px-4 font-bold">Petugas Pengganti</th>
                  <th className="py-2.5 px-4 font-bold">Alasan</th>
                  <th className="py-2.5 pl-4 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7ECE0] text-xs">
                {swaps.map((sw) => {
                  const sch = schedules.find((s) => s.id === sw.scheduleId);
                  const orig = memberMap.get(sw.originalMemberId);
                  const repl = memberMap.get(sw.replacementMemberId);
                  return (
                    <tr key={sw.id} className="hover:bg-[#FFFBF4]">
                      <td className="py-3 pr-4 font-mono tabular-nums text-stone-800 whitespace-nowrap">
                        {formatFullDateId(sw.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-900">
                        {sch?.title || sw.scheduleId}
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        {orig?.name || sw.originalMemberId}
                      </td>
                      <td className="py-3 px-4 font-bold text-sky-700">
                        {repl?.name || sw.replacementMemberId}
                      </td>
                      <td className="py-3 px-4 text-stone-600">{sw.reason}</td>
                      <td className="py-3 pl-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteSwap(sw.id)}
                          className="text-rose-600 hover:text-rose-800 font-bold"
                        >
                          Batalkan
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Form: Add / Edit Schedule */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-schedule-title"
        >
          <div className="card-3d max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-[#F3E3D0] pb-4">
              <h2
                id="modal-schedule-title"
                className="text-lg font-bold text-stone-900"
              >
                {editingScheduleId
                  ? 'Ubah Jadwal Piket OSIS'
                  : 'Tambah Jadwal Piket Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                aria-label="Tutup Modal"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleForm} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border-2 border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="sch-title-input"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Nama Jadwal Piket
                  </label>
                  <input
                    id="sch-title-input"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Piket Ruang Sekretariat Pagi"
                    className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sch-location-input"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Lokasi / Pos Piket
                  </label>
                  <input
                    id="sch-location-input"
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Contoh: Ruang OSIS Lt. 1"
                    className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="sch-mode-select"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Sistem Waktu Piket
                  </label>
                  <select
                    id="sch-mode-select"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ScheduleMode)}
                    className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                  >
                    <option value="mingguan">Mingguan (Per Hari)</option>
                    <option value="harian">Harian (Setiap Hari Aktif)</option>
                    <option value="custom">Custom (Tanggal Tertentu)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sch-start-input"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Jam Mulai
                  </label>
                  <input
                    id="sch-start-input"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border-2 border-[#E7D5C0] rounded-xl"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sch-end-input"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Jam Selesai
                  </label>
                  <input
                    id="sch-end-input"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border-2 border-[#E7D5C0] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="sch-desc-input"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  Deskripsi Singkat
                </label>
                <input
                  id="sch-desc-input"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat tanggung jawab pos piket..."
                  className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
                />
              </div>

              {/* Siklus Minggu Selection: Setiap Minggu vs Minggu 1 - Minggu 4 */}
              {mode !== 'custom' && (
                <div className="p-4 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-2xl space-y-3">
                  <div>
                    <p className="text-xs font-bold text-stone-800">
                      Siklus Minggu Pelaksanaan (Setiap Minggu / Minggu 1 – Minggu 4)
                    </p>
                    <p className="text-[11px] text-stone-500">
                      Pilih apakah jadwal ini berlaku setiap minggu atau hanya pada minggu tertentu dalam satu bulan.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWeekSelectionMode('setiap_minggu');
                        setActiveWeeks([1, 2, 3, 4]);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 transition-colors ${
                        weekSelectionMode === 'setiap_minggu'
                          ? 'bg-orange-500 border-orange-600 text-white'
                          : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-orange-50'
                      }`}
                    >
                      Setiap Minggu (Rutin)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWeekSelectionMode('pilih_minggu');
                        if (activeWeeks.length === 4) {
                          setActiveWeeks([1]);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 transition-colors ${
                        weekSelectionMode === 'pilih_minggu'
                          ? 'bg-orange-500 border-orange-600 text-white'
                          : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-orange-50'
                      }`}
                    >
                      Pilih Minggu (Minggu 1 – Minggu 4)
                    </button>
                  </div>

                  {weekSelectionMode === 'pilih_minggu' && (
                    <div className="pt-2 space-y-1.5">
                      <p className="text-xs font-bold text-stone-700">
                        Pilih minggu aktif (bisa pilih satu atau lebih minggu):
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((wNum) => {
                          const isSelected = activeWeeks.includes(wNum);
                          return (
                            <button
                              key={wNum}
                              type="button"
                              onClick={() => toggleWeekNumber(wNum)}
                              className={`py-2 px-3 text-xs font-bold rounded-xl border-2 transition-colors ${
                                isSelected
                                  ? 'bg-sky-500 border-sky-600 text-white'
                                  : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-sky-50'
                              }`}
                            >
                              Minggu {wNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Configuration by Mode */}
              {mode === 'harian' && (
                <div className="p-4 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-stone-800">
                    Pilih Hari Aktif & Anggota Piket Harian:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDayActive(d)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                          activeDays.includes(d)
                            ? 'bg-orange-500 border-orange-600 text-white'
                            : 'bg-white border-[#E7D5C0] text-stone-600'
                        }`}
                      >
                        {DAY_NAMES_ID[d]}
                      </button>
                    ))}
                  </div>
                  {members.length === 0 ? (
                    <p className="text-xs text-stone-500 italic pt-1">
                      Belum ada anggota terdaftar. Anda dapat menambahkan
                      anggota di tab Anggota Piket.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                      {members.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 text-xs text-stone-700 bg-white p-2 rounded-xl border border-[#E7D5C0] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={dailyMembers.includes(m.id)}
                            onChange={() => toggleDailyMember(m.id)}
                            className="rounded border-stone-300 text-orange-500"
                          />
                          <span className="truncate">{m.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mode === 'mingguan' && (
                <div className="p-4 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-stone-800">
                    Pilih Hari untuk Mengatur Petugas Mingguan:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDayTab(d)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                          selectedDayTab === d
                            ? 'bg-orange-500 border-orange-600 text-white'
                            : 'bg-white border-[#E7D5C0] text-stone-700'
                        }`}
                      >
                        {DAY_NAMES_ID[d]} (
                        {(weeklyAssignments[d] || []).length})
                      </button>
                    ))}
                  </div>
                  {members.length === 0 ? (
                    <p className="text-xs text-stone-500 italic pt-1">
                      Belum ada anggota terdaftar. Anda dapat menambahkan
                      anggota di tab Anggota Piket.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                      {members.map((m) => {
                        const checked = (
                          weeklyAssignments[selectedDayTab] || []
                        ).includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className="flex items-center gap-2 text-xs text-stone-700 bg-white p-2 rounded-xl border border-[#E7D5C0] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleWeeklyDayMember(selectedDayTab, m.id)
                              }
                              className="rounded border-stone-300 text-orange-500"
                            />
                            <span className="truncate">{m.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {mode === 'custom' && (
                <div className="p-4 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newCustomDateInput}
                      onChange={(e) => setNewCustomDateInput(e.target.value)}
                      className="px-3 py-1.5 text-xs font-mono bg-white border-2 border-[#E7D5C0] rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomDate}
                      className="btn-3d-primary px-3 py-1.5 text-xs font-bold"
                    >
                      Tambah Tanggal
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {customDates.map((dt) => (
                      <span
                        key={dt}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-white border border-[#E7D5C0] rounded-lg"
                      >
                        {dt}
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomDate(dt)}
                          className="text-stone-400 hover:text-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {members.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-stone-700 pt-1">
                        Pilih Anggota Bertugas:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {members.map((m) => (
                          <label
                            key={m.id}
                            className="flex items-center gap-2 text-xs text-stone-700 bg-white p-2 rounded-xl border border-[#E7D5C0] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={dailyMembers.includes(m.id)}
                              onChange={() => toggleDailyMember(m.id)}
                              className="rounded border-stone-300 text-orange-500"
                            />
                            <span className="truncate">{m.name}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="sch-tasks-textarea"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  Daftar Tugas Pos Piket (1 baris per tugas)
                </label>
                <textarea
                  id="sch-tasks-textarea"
                  rows={3}
                  value={tasksText}
                  onChange={(e) => setTasksText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-[#F3E3D0]">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="btn-3d-secondary px-4 py-2 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-3d-primary px-4 py-2 text-xs font-bold"
                >
                  {editingScheduleId ? 'Simpan Perubahan' : 'Buat Jadwal Piket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
