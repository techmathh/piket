import React, { useState } from 'react';
import {
  Plus,
  Clock,
  MapPin,
  ArrowLeftRight,
  Trash2,
  Edit3,
  UserPlus,
  Search,
  X,
  Calendar,
  Users,
  CalendarDays,
} from 'lucide-react';
import {
  DAY_NAMES_ID,
  MONDAY_FIRST_DAYS,
  formatActiveDaysLabel,
  formatFullDateId,
  formatWeekCycleLabel,
  getMemberOrgLabel,
  getWeekOfMonth,
  normalizeMemberId,
  type OsisMember,
  type PiketSchedule,
  type ScheduleMode,
  type ScheduleSwap,
} from '../utils/piketLogic';
import { banner3dImg } from '../assets/brandAssets';

interface ScheduleManagerProps {
  todayStr: string;
  selectedDate?: string;
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
  mingguan: 'Sistem Mingguan (Per Hari)',
  custom: 'Custom Tanggal Khusus',
};

function matchesPosCategory(
  sch: PiketSchedule,
  cat: 'all' | 'gerbang' | 'warsis' | 'shalat'
): boolean {
  if (cat === 'all') return true;
  const lower = sch.title.toLowerCase();
  if (cat === 'gerbang') return lower.includes('gerbang');
  if (cat === 'warsis') return lower.includes('warsis');
  if (cat === 'shalat') return lower.includes('shalat');
  return true;
}

export const ScheduleManager: React.FC<ScheduleManagerProps> = ({
  todayStr,
  selectedDate,
  schedules,
  members,
  swaps,
  onAddSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onDeleteSwap,
  onOpenSwapModal,
}) => {
  // Default to the current active week (1..4) of selectedDate or todayStr so the admin sees the 3 relevant schedules immediately
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>(() =>
    getWeekOfMonth(selectedDate || todayStr)
  );
  const [posCategory, setPosCategory] = useState<
    'all' | 'gerbang' | 'warsis' | 'shalat'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inline custom day editor state per schedule card
  const [customDaysOpenForScheduleId, setCustomDaysOpenForScheduleId] =
    useState<string | null>(null);

  // Quick inline member add state (targets a specific schedule + day or custom date)
  const [quickAssignTarget, setQuickAssignTarget] = useState<{
    scheduleId: string;
    dayOrMode: number | 'daily' | string;
  } | null>(null);
  const [quickAssignMemberId, setQuickAssignMemberId] = useState<string>(
    members[0]?.id || ''
  );
  const [quickAssignFilter, setQuickAssignFilter] = useState<string>('');

  // Modal state for Create / Edit Schedule
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null
  );
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('06:30');
  const [endTime, setEndTime] = useState<string>('07:15');
  const [mode, setMode] = useState<ScheduleMode>('mingguan');
  const [activeWeeks, setActiveWeeks] = useState<number[]>([1]);
  const [tasksText, setTasksText] = useState<string>(
    'Menjaga kebersihan pos piket\nMencatat kehadiran petugas'
  );
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);
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
  const [selectedCustomDateTab, setSelectedCustomDateTab] =
    useState<string>(todayStr);
  const [newCustomDateInput, setNewCustomDateInput] =
    useState<string>(todayStr);
  const [customDateAssignments, setCustomDateAssignments] = useState<
    Record<string, string[]>
  >({});
  const [modalMemberSearch, setModalMemberSearch] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const memberMap = new Map<string, OsisMember>();
  for (const m of members) memberMap.set(m.id, m);

  // Filter schedules by selectedWeek, posCategory, and optional searchQuery
  const filteredSchedules = schedules.filter((sch) => {
    const sWeeks =
      sch.activeWeeks && sch.activeWeeks.length > 0
        ? sch.activeWeeks
        : [1, 2, 3, 4];
    if (
      sch.mode !== 'custom' &&
      selectedWeek !== 'all' &&
      !sWeeks.includes(selectedWeek)
    ) {
      return false;
    }
    if (!matchesPosCategory(sch, posCategory)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (
        sch.title.toLowerCase().includes(q) ||
        sch.location.toLowerCase().includes(q)
      ) {
        return true;
      }
      const allAssignedIds =
        sch.mode === 'harian'
          ? sch.dailyMembers
          : sch.mode === 'custom'
          ? [
              ...sch.dailyMembers,
              ...Object.values(sch.customDateAssignments || {}).flat(),
            ]
          : Object.values(sch.weeklyAssignments).flat();
      return allAssignedIds.some((rawId) => {
        const m = memberMap.get(normalizeMemberId(rawId));
        return (
          m &&
          (m.name.toLowerCase().includes(q) ||
            m.kelas.toLowerCase().includes(q) ||
            getMemberOrgLabel(m).toLowerCase().includes(q))
        );
      });
    }
    return true;
  });

  const openCreateForm = (initialMode: ScheduleMode = 'mingguan') => {
    const defaultWeek = typeof selectedWeek === 'number' ? selectedWeek : 1;
    setEditingScheduleId(null);
    setTitle('');
    setDescription('');
    setLocation('Ruang Sekretariat OSIS');
    setStartTime('06:30');
    setEndTime('07:15');
    setMode(initialMode);
    setActiveWeeks([defaultWeek]);
    setTasksText('Menjaga kebersihan pos piket\nMencatat kehadiran petugas');
    setActiveDays([1, 2, 3, 4, 5]);
    const defaultMemberIds = members.slice(0, 2).map((m) => m.id);
    setDailyMembers(defaultMemberIds);
    setWeeklyAssignments({
      1: defaultMemberIds,
      2: defaultMemberIds,
      3: defaultMemberIds,
      4: defaultMemberIds,
      5: defaultMemberIds,
      6: [],
      0: [],
    });
    setSelectedDayTab(1);
    setCustomDates([todayStr]);
    setSelectedCustomDateTab(todayStr);
    setNewCustomDateInput(todayStr);
    setCustomDateAssignments({ [todayStr]: defaultMemberIds });
    setModalMemberSearch('');
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
    setActiveWeeks(schWeeks);
    setTasksText(sch.tasks.join('\n'));
    const initialActiveDays =
      sch.activeDays.length > 0 ? [...sch.activeDays] : [1, 2, 3, 4, 5];
    setActiveDays(initialActiveDays);
    setDailyMembers(sch.dailyMembers.map(normalizeMemberId));
    const normWeekly: Record<number, string[]> = {};
    for (const [k, list] of Object.entries(sch.weeklyAssignments)) {
      normWeekly[Number(k)] = (list || []).map(normalizeMemberId);
    }
    setWeeklyAssignments(normWeekly);
    const firstActiveDay =
      MONDAY_FIRST_DAYS.find((d) => initialActiveDays.includes(d)) ?? 1;
    setSelectedDayTab(firstActiveDay);
    const nextCustomDates =
      sch.customDates.length > 0 ? [...sch.customDates] : [todayStr];
    setCustomDates(nextCustomDates);
    setSelectedCustomDateTab(nextCustomDates[0] || todayStr);
    const normCustomMap: Record<string, string[]> = {};
    for (const [dtKey, list] of Object.entries(
      sch.customDateAssignments || {}
    )) {
      normCustomMap[dtKey] = (list || []).map(normalizeMemberId);
    }
    setCustomDateAssignments(normCustomMap);
    setModalMemberSearch('');
    setFormError('');
    setShowFormModal(true);
  };

  // Toggle an active day directly on a schedule card (Inline Custom Hari)
  const handleInlineToggleScheduleDay = (
    schedule: PiketSchedule,
    dayNum: number
  ) => {
    const currentDays =
      schedule.activeDays && schedule.activeDays.length > 0
        ? schedule.activeDays
        : [1, 2, 3, 4, 5];
    const isCurrentlyActive = currentDays.includes(dayNum);
    let nextDays: number[];
    if (isCurrentlyActive) {
      nextDays = currentDays.filter((d) => d !== dayNum);
      if (nextDays.length === 0) {
        // Keep at least 1 active day
        return;
      }
    } else {
      nextDays = [...currentDays, dayNum];
    }
    onUpdateSchedule({
      ...schedule,
      activeDays: nextDays,
    });
  };

  const handleInlinePresetDays = (
    schedule: PiketSchedule,
    presetDays: number[]
  ) => {
    onUpdateSchedule({
      ...schedule,
      activeDays: presetDays,
    });
  };

  const handleQuickAddMember = (schedule: PiketSchedule) => {
    if (!quickAssignTarget) return;
    const targetMemberId = quickAssignMemberId || members[0]?.id;
    if (!targetMemberId) return;

    if (quickAssignTarget.dayOrMode === 'daily') {
      const nextDaily = Array.from(
        new Set([
          ...schedule.dailyMembers.map(normalizeMemberId),
          targetMemberId,
        ])
      );
      onUpdateSchedule({
        ...schedule,
        dailyMembers: nextDaily,
      });
    } else if (typeof quickAssignTarget.dayOrMode === 'number') {
      const dayNum = quickAssignTarget.dayOrMode;
      const existing = (schedule.weeklyAssignments[dayNum] || []).map(
        normalizeMemberId
      );
      const nextDayMembers = Array.from(new Set([...existing, targetMemberId]));
      const nextActiveDays = Array.from(
        new Set([...schedule.activeDays, dayNum])
      );
      const updatedWeekly: Record<number, string[]> = {
        ...schedule.weeklyAssignments,
        [dayNum]: nextDayMembers,
      };
      // If weekend days are currently using the default fallback (0 mirrors 1, 6 mirrors 5), keep them synced
      if (
        customDaysOpenForScheduleId !== schedule.id &&
        schedule.activeDays.length === 7
      ) {
        if (dayNum === 1) updatedWeekly[0] = nextDayMembers;
        if (dayNum === 5) updatedWeekly[6] = nextDayMembers;
      }
      onUpdateSchedule({
        ...schedule,
        activeDays: nextActiveDays,
        weeklyAssignments: updatedWeekly,
      });
    } else {
      // Custom date string YYYY-MM-DD
      const dateKey = String(quickAssignTarget.dayOrMode);
      const existing = (
        schedule.customDateAssignments[dateKey] ||
        schedule.dailyMembers ||
        []
      ).map(normalizeMemberId);
      const nextDateMembers = Array.from(
        new Set([...existing, targetMemberId])
      );
      const nextCustomDates = Array.from(
        new Set([...schedule.customDates, dateKey])
      ).sort();
      onUpdateSchedule({
        ...schedule,
        customDates: nextCustomDates,
        customDateAssignments: {
          ...schedule.customDateAssignments,
          [dateKey]: nextDateMembers,
        },
      });
    }
    setQuickAssignTarget(null);
    setQuickAssignFilter('');
  };

  const handleRemoveMemberFromScheduleDay = (
    schedule: PiketSchedule,
    dayOrMode: number | 'daily' | string,
    memberIdToRemove: string
  ) => {
    const normRemove = normalizeMemberId(memberIdToRemove);
    if (dayOrMode === 'daily') {
      onUpdateSchedule({
        ...schedule,
        dailyMembers: schedule.dailyMembers.filter(
          (id) => normalizeMemberId(id) !== normRemove
        ),
      });
    } else if (typeof dayOrMode === 'number') {
      const current = schedule.weeklyAssignments[dayOrMode] || [];
      const nextDayMembers = current.filter(
        (id) => normalizeMemberId(id) !== normRemove
      );
      const updatedWeekly: Record<number, string[]> = {
        ...schedule.weeklyAssignments,
        [dayOrMode]: nextDayMembers,
      };
      if (
        customDaysOpenForScheduleId !== schedule.id &&
        schedule.activeDays.length === 7
      ) {
        if (dayOrMode === 1) updatedWeekly[0] = nextDayMembers;
        if (dayOrMode === 5) updatedWeekly[6] = nextDayMembers;
      }
      onUpdateSchedule({
        ...schedule,
        weeklyAssignments: updatedWeekly,
      });
    } else {
      const dateKey = String(dayOrMode);
      const current =
        schedule.customDateAssignments[dateKey] || schedule.dailyMembers || [];
      onUpdateSchedule({
        ...schedule,
        customDateAssignments: {
          ...schedule.customDateAssignments,
          [dateKey]: current.filter(
            (id) => normalizeMemberId(id) !== normRemove
          ),
        },
      });
    }
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

  const toggleModalActiveDay = (dayNum: number) => {
    setActiveDays((prev) => {
      if (prev.includes(dayNum)) {
        const next = prev.filter((d) => d !== dayNum);
        return next.length > 0 ? next : [dayNum];
      }
      return [...prev, dayNum];
    });
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
    if (!activeDays.includes(dayNum)) {
      setActiveDays((prev) => Array.from(new Set([...prev, dayNum])));
    }
  };

  const toggleCustomDateMember = (dateStr: string, memberId: string) => {
    setCustomDateAssignments((prev) => {
      const current = prev[dateStr] || dailyMembers || [];
      const next = current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId];
      return { ...prev, [dateStr]: next };
    });
  };

  const handleAddCustomDate = () => {
    if (!newCustomDateInput) return;
    if (!customDates.includes(newCustomDateInput)) {
      const nextDates = [...customDates, newCustomDateInput].sort();
      setCustomDates(nextDates);
      setCustomDateAssignments((prev) => ({
        ...prev,
        [newCustomDateInput]:
          prev[newCustomDateInput] ||
          dailyMembers ||
          members.slice(0, 2).map((m) => m.id),
      }));
    }
    setSelectedCustomDateTab(newCustomDateInput);
  };

  const handleRemoveCustomDate = (dt: string) => {
    const next = customDates.filter((d) => d !== dt);
    const safeNext = next.length > 0 ? next : [todayStr];
    setCustomDates(safeNext);
    if (selectedCustomDateTab === dt) {
      setSelectedCustomDateTab(safeNext[0]);
    }
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
      activeWeeks: activeWeeks.length > 0 ? activeWeeks : [1, 2, 3, 4],
      tasks:
        parsedTasks.length > 0
          ? parsedTasks
          : ['Menjaga ketertiban dan kebersihan pos piket'],
      activeDays:
        mode === 'custom'
          ? []
          : activeDays.length > 0
          ? activeDays
          : [1, 2, 3, 4, 5],
      dailyMembers,
      weeklyAssignments,
      customDates: mode === 'custom' ? customDates : [],
      customDateAssignments: mode === 'custom' ? customDateAssignments : {},
    };

    if (editingScheduleId) {
      onUpdateSchedule(schedulePayload);
    } else {
      onAddSchedule(schedulePayload);
    }
    setShowFormModal(false);
  };

  const getCardHeaderAccent = (schTitle: string) => {
    const lower = schTitle.toLowerCase();
    if (lower.includes('gerbang')) {
      return {
        bg: 'bg-emerald-50/90 border-emerald-200',
        badge: 'bg-emerald-600 text-white',
      };
    }
    if (lower.includes('warsis')) {
      return {
        bg: 'bg-orange-50/90 border-orange-200',
        badge: 'bg-orange-500 text-white',
      };
    }
    return {
      bg: 'bg-sky-50/90 border-sky-200',
      badge: 'bg-sky-600 text-white',
    };
  };

  // Filtered member list for the Add/Edit Modal checklist
  const modalFilteredMembers = members.filter((m) => {
    if (!modalMemberSearch.trim()) return true;
    const q = modalMemberSearch.trim().toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.kelas.toLowerCase().includes(q) ||
      getMemberOrgLabel(m).toLowerCase().includes(q)
    );
  });

  // Filtered member list for the inline quick-add dropdown
  const quickFilteredMembers = members.filter((m) => {
    if (!quickAssignFilter.trim()) return true;
    const q = quickAssignFilter.trim().toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.kelas.toLowerCase().includes(q) ||
      getMemberOrgLabel(m).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* 1. Simplified Top Header + Step-by-Step Week & Pos Filter Bar */}
      <section className="card-3d p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b-2 border-[#F3E3D0]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-orange-600">
              <span>Pengaturan Jadwal Piket OSIS & MPK</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-700">
                Menampilkan {filteredSchedules.length} dari {schedules.length}{' '}
                jadwal
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
              Kelola Jadwal & Custom Hari Piket
            </h1>
            <p className="text-xs sm:text-sm text-stone-600">
              Pilih <strong>Minggu (1–4)</strong>, atur{' '}
              <strong>Custom Hari Aktif (Senin–Minggu)</strong>, atau buat{' '}
              <strong>Jadwal Tanggal Khusus</strong>.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex flex-wrap items-center gap-2 shrink-0">
            {schedules.length > 0 && members.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onOpenSwapModal(
                    todayStr,
                    filteredSchedules[0]?.id || schedules[0]?.id || ''
                  )
                }
                className="btn-3d-secondary inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span>Tukar Piket</span>
              </button>
            )}

            <button
              type="button"
              data-testid="btn-create-custom-date-schedule"
              onClick={() => openCreateForm('custom')}
              className="btn-3d-sky inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap"
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>+ Jadwal Tanggal Khusus</span>
            </button>

            <button
              type="button"
              data-testid="btn-create-schedule"
              onClick={() => openCreateForm('mingguan')}
              className="col-span-2 sm:col-span-1 btn-3d-primary inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Tambah Jadwal Baru</span>
            </button>
          </div>
        </div>

        {/* Clean 3-Part Filter Toolbar: 1) Siklus Minggu 1-4, 2) Pos Piket, 3) Cari Petugas */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {/* Step 1: Pilih Minggu */}
            <div className="grid grid-cols-5 sm:flex items-center gap-1 p-1 bg-[#FFF3E0] border-2 border-[#EBD5B8] rounded-xl">
              {[1, 2, 3, 4].map((wNum) => (
                <button
                  key={wNum}
                  type="button"
                  data-testid={`filter-week-${wNum}`}
                  onClick={() => setSelectedWeek(wNum)}
                  className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-center whitespace-nowrap ${
                    selectedWeek === wNum
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-stone-700 hover:bg-white/80'
                  }`}
                >
                  <span className="sm:hidden">Mgg {wNum}</span>
                  <span className="hidden sm:inline">Minggu {wNum}</span>
                </button>
              ))}
              <button
                type="button"
                data-testid="filter-week-all"
                onClick={() => setSelectedWeek('all')}
                className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-center whitespace-nowrap ${
                  selectedWeek === 'all'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-white/80'
                }`}
              >
                Semua ({schedules.length})
              </button>
            </div>

            {/* Step 2: Pilih Pos */}
            <div className="grid grid-cols-4 sm:flex items-center gap-1 p-1 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-xl">
              {(
                [
                  { id: 'all', label: 'Semua Pos' },
                  { id: 'gerbang', label: 'Gerbang' },
                  { id: 'warsis', label: 'Warsis' },
                  { id: 'shalat', label: 'Shalat' },
                ] as const
              ).map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => setPosCategory(pos.id)}
                  className={`px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-center whitespace-nowrap ${
                    posCategory === pos.id
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-white/80'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Search Officer or Pos */}
          <div className="relative w-full lg:w-64 shrink-0">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Cari jadwal atau nama petugas"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama petugas / kelas..."
              className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-white border-2 border-[#EBD5B8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. Clean Schedule Cards for the Selected Week */}
      {filteredSchedules.length === 0 ? (
        <section className="card-3d p-8 text-center space-y-4">
          <div className="max-w-xs mx-auto rounded-2xl overflow-hidden border-2 border-[#F3E3D0]">
            <img
              src={banner3dImg}
              alt="Ilustrasi 3D Jadwal OSIS"
              className="w-full h-36 object-cover"
            />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base sm:text-lg font-bold text-stone-900">
              Tidak Ada Jadwal yang Cocok dengan Filter
            </h2>
            <p className="text-xs text-stone-600">
              Coba pilih minggu lain atau klik tombol di bawah untuk menampilkan
              semua jadwal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedWeek('all');
              setPosCategory('all');
              setSearchQuery('');
            }}
            className="btn-3d-secondary px-4 py-2 text-xs font-bold"
          >
            Reset Filter Jadwal
          </button>
        </section>
      ) : (
        <div className="space-y-4">
          {filteredSchedules.map((sch) => {
            const accent = getCardHeaderAccent(sch.title);
            const effectiveActiveDays =
              sch.activeDays && sch.activeDays.length > 0
                ? sch.activeDays
                : [1, 2, 3, 4, 5];
            const isCustomDaysOpen = customDaysOpenForScheduleId === sch.id;

            // Show Monday-Friday active days by default, plus Saturday/Sunday when Custom Hari is open or explicitly customized
            const visibleWeekDays = MONDAY_FIRST_DAYS.filter((d) => {
              if (!effectiveActiveDays.includes(d)) return false;
              if (d >= 1 && d <= 5) return true;
              return isCustomDaysOpen || effectiveActiveDays.length < 7;
            });

            return (
              <article key={sch.id} className="card-3d overflow-hidden">
                {/* Compact, Clear Card Header */}
                <div
                  className={`p-4 sm:p-5 border-b-2 ${accent.bg} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] ${accent.badge}`}
                      >
                        {sch.mode === 'custom'
                          ? 'Tanggal Khusus'
                          : formatWeekCycleLabel(sch.activeWeeks)}
                      </span>
                      <span className="font-mono text-stone-700 inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-orange-500" />
                        {sch.startTime} – {sch.endTime} WIB
                      </span>
                      <span aria-hidden="true" className="text-stone-300">
                        ·
                      </span>
                      <span className="text-stone-600 inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-orange-500" />
                        {sch.location}
                      </span>
                      <span aria-hidden="true" className="text-stone-300">
                        ·
                      </span>
                      <span className="text-stone-600 font-semibold">
                        {MODE_LABELS[sch.mode]}
                      </span>
                      {sch.mode !== 'custom' && (
                        <>
                          <span aria-hidden="true" className="text-stone-300">
                            ·
                          </span>
                          <span className="text-sky-800 bg-white/80 border border-sky-200 px-2 py-0.5 rounded-md text-[11px]">
                            Hari: {formatActiveDaysLabel(effectiveActiveDays)}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-stone-900">
                      {sch.title}
                    </h2>
                  </div>

                  {/* Card Actions: Custom Hari, Edit & Delete */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {sch.mode !== 'custom' && (
                      <button
                        type="button"
                        data-testid={`btn-custom-days-${sch.id}`}
                        onClick={() =>
                          setCustomDaysOpenForScheduleId(
                            isCustomDaysOpen ? null : sch.id
                          )
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border-2 transition-colors whitespace-nowrap ${
                          isCustomDaysOpen
                            ? 'bg-orange-500 border-orange-600 text-white'
                            : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-orange-50'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span>Custom Hari</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditForm(sch)}
                      className="btn-3d-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-700" />
                      <span>Edit Jadwal & Petugas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSchedule(sch.id)}
                      aria-label={`Hapus ${sch.title}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border-2 border-rose-200 hover:bg-rose-100 rounded-xl transition-colors whitespace-nowrap"
                      title="Hapus Jadwal Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
                  </div>
                </div>

                {/* Inline Custom Hari Bar (Toggles Senin..Minggu directly on the card) */}
                {isCustomDaysOpen && sch.mode !== 'custom' && (
                  <div
                    data-testid={`panel-custom-days-${sch.id}`}
                    className="p-3.5 bg-[#FFF6E8] border-b-2 border-[#F3DEC0] space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-800">
                        Pilih Hari Aktif untuk{' '}
                        <strong className="text-orange-700">{sch.title}</strong>{' '}
                        (Klik hari untuk mengaktifkan / meliburkan):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleInlinePresetDays(sch, [1, 2, 3, 4, 5])
                          }
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-[#E7D5C0] text-stone-700 hover:bg-orange-50"
                        >
                          Senin–Jumat
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleInlinePresetDays(sch, [1, 2, 3, 4, 5, 6])
                          }
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-[#E7D5C0] text-stone-700 hover:bg-orange-50"
                        >
                          Senin–Sabtu
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleInlinePresetDays(sch, [0, 1, 2, 3, 4, 5, 6])
                          }
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-[#E7D5C0] text-stone-700 hover:bg-orange-50"
                        >
                          Setiap Hari
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-7 gap-1.5">
                      {MONDAY_FIRST_DAYS.map((dNum) => {
                        const isDayOn = effectiveActiveDays.includes(dNum);
                        return (
                          <button
                            key={dNum}
                            type="button"
                            data-testid={`toggle-day-${sch.id}-${dNum}`}
                            onClick={() =>
                              handleInlineToggleScheduleDay(sch, dNum)
                            }
                            className={`py-2 px-2.5 rounded-xl border-2 text-xs font-bold flex items-center justify-between gap-1.5 transition-all ${
                              isDayOn
                                ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                                : 'bg-white border-stone-200 text-stone-400 hover:border-stone-300'
                            }`}
                          >
                            <span>{DAY_NAMES_ID[dNum]}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/15">
                              {isDayOn ? 'Aktif' : 'Libur'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inline Quick-Add Member Bar (Opens when clicking "+ Tambah" on any day, daily pos, or custom date) */}
                {quickAssignTarget &&
                  quickAssignTarget.scheduleId === sch.id && (
                    <div className="p-3.5 bg-[#FFF8EE] border-b-2 border-[#F3E3D0] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                        <UserPlus className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>
                          Tambah Petugas ke{' '}
                          <strong className="text-orange-700">
                            {quickAssignTarget.dayOrMode === 'daily'
                              ? `${sch.title} (Harian)`
                              : typeof quickAssignTarget.dayOrMode === 'number'
                              ? `Hari ${
                                  DAY_NAMES_ID[quickAssignTarget.dayOrMode]
                                }`
                              : `Tanggal ${quickAssignTarget.dayOrMode}`}
                          </strong>
                          :
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={quickAssignFilter}
                          onChange={(e) => {
                            setQuickAssignFilter(e.target.value);
                            const firstMatch = members.find(
                              (m) =>
                                m.name
                                  .toLowerCase()
                                  .includes(e.target.value.toLowerCase()) ||
                                m.kelas
                                  .toLowerCase()
                                  .includes(e.target.value.toLowerCase())
                            );
                            if (firstMatch) {
                              setQuickAssignMemberId(firstMatch.id);
                            }
                          }}
                          placeholder="Ketik nama untuk cari..."
                          className="px-2.5 py-1.5 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl w-40 focus:outline-none focus:border-orange-400"
                        />

                        <select
                          aria-label="Pilih Anggota Piket"
                          value={quickAssignMemberId}
                          onChange={(e) =>
                            setQuickAssignMemberId(e.target.value)
                          }
                          className="px-2.5 py-1.5 text-xs font-bold bg-white border-2 border-[#E7D5C0] rounded-xl text-stone-800 max-w-xs"
                        >
                          {quickFilteredMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({getMemberOrgLabel(m)} · {m.kelas})
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleQuickAddMember(sch)}
                          className="btn-3d-primary px-3 py-1.5 text-xs font-bold"
                        >
                          Tambahkan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickAssignTarget(null);
                            setQuickAssignFilter('');
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-stone-500 hover:text-stone-800"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                {/* Schedule Content Body */}
                <div className="p-4 sm:p-5">
                  {sch.mode === 'mingguan' && (
                    <div
                      className={`grid grid-cols-1 sm:grid-cols-2 ${
                        visibleWeekDays.length >= 6
                          ? 'lg:grid-cols-6'
                          : 'lg:grid-cols-5'
                      } gap-3`}
                    >
                      {visibleWeekDays.map((dayNum) => {
                        const rawDayMembers =
                          sch.weeklyAssignments[dayNum] || [];
                        return (
                          <div
                            key={dayNum}
                            className="p-3 rounded-2xl bg-[#FFFDF9] border-2 border-[#F3E3D0] flex flex-col justify-between space-y-2.5"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-[#F3E3D0] pb-1.5">
                                <span className="text-xs font-bold text-stone-900">
                                  {DAY_NAMES_ID[dayNum]}
                                </span>
                                <span className="text-[11px] font-mono font-bold tabular-nums text-stone-500">
                                  {rawDayMembers.length} petugas
                                </span>
                              </div>

                              {rawDayMembers.length === 0 ? (
                                <p className="text-xs text-stone-400 italic py-1">
                                  Belum ada petugas
                                </p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {rawDayMembers.map((rawId) => {
                                    const normId = normalizeMemberId(rawId);
                                    const m = memberMap.get(normId);
                                    if (!m) return null;
                                    const orgLabel = getMemberOrgLabel(m);
                                    return (
                                      <li
                                        key={normId}
                                        className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl bg-white border border-[#EFE0CE] text-xs"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p
                                            className="font-bold text-stone-900 truncate"
                                            title={m.name}
                                          >
                                            {m.name}
                                          </p>
                                          <div className="flex items-center gap-1 mt-0.5">
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
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveMemberFromScheduleDay(
                                              sch,
                                              dayNum,
                                              normId
                                            )
                                          }
                                          aria-label={`Keluarkan ${m.name} dari hari ${DAY_NAMES_ID[dayNum]}`}
                                          className="text-stone-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 shrink-0"
                                          title="Hapus dari hari ini"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setQuickAssignMemberId(members[0]?.id || '');
                                setQuickAssignFilter('');
                                setQuickAssignTarget({
                                  scheduleId: sch.id,
                                  dayOrMode: dayNum,
                                });
                              }}
                              className="w-full py-1.5 px-2 rounded-xl border border-dashed border-orange-300 text-[11px] font-bold text-orange-700 hover:bg-orange-50 inline-flex items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Tambah ke {DAY_NAMES_ID[dayNum]}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {sch.mode === 'harian' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-stone-600">
                          Bertugas rutin setiap{' '}
                          <strong className="text-stone-900">
                            {formatActiveDaysLabel(effectiveActiveDays)}
                          </strong>{' '}
                          pada{' '}
                          <strong className="text-emerald-700">
                            {formatWeekCycleLabel(sch.activeWeeks)}
                          </strong>{' '}
                          ({sch.dailyMembers.length} petugas):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickAssignMemberId(members[0]?.id || '');
                            setQuickAssignFilter('');
                            setQuickAssignTarget({
                              scheduleId: sch.id,
                              dayOrMode: 'daily',
                            });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Tambah Petugas Harian</span>
                        </button>
                      </div>

                      {sch.dailyMembers.length === 0 ? (
                        <p className="text-xs text-stone-400 italic">
                          Belum ada petugas harian yang dipilih.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          {sch.dailyMembers.map((rawId, idx) => {
                            const normId = normalizeMemberId(rawId);
                            const m = memberMap.get(normId);
                            if (!m) return null;
                            const orgLabel = getMemberOrgLabel(m);
                            return (
                              <div
                                key={normId}
                                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FFFDF9] border-2 border-[#F3E3D0]"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-stone-900 truncate">
                                    {idx + 1}. {m.name}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span
                                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                        orgLabel === 'OSIS'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-indigo-100 text-indigo-800'
                                      }`}
                                    >
                                      {orgLabel}
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-sky-700">
                                      Kelas {m.kelas}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveMemberFromScheduleDay(
                                      sch,
                                      'daily',
                                      normId
                                    )
                                  }
                                  aria-label={`Keluarkan ${m.name} dari ${sch.title}`}
                                  className="p-1 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 shrink-0"
                                  title="Keluarkan dari jadwal ini"
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
                      <div className="flex items-center justify-between text-xs text-stone-600">
                        <span>
                          Tanggal Pelaksanaan Khusus ({sch.customDates.length}{' '}
                          hari terjadwal):
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {sch.customDates.map((dt) => {
                          const assignedIds =
                            sch.customDateAssignments[dt] || sch.dailyMembers;
                          return (
                            <div
                              key={dt}
                              className="p-3 rounded-2xl bg-[#FFFDF9] border-2 border-[#F3E3D0] flex flex-col justify-between space-y-2.5"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between border-b border-[#F3E3D0] pb-1.5">
                                  <div>
                                    <p className="text-xs font-bold text-stone-900">
                                      {formatFullDateId(dt)}
                                    </p>
                                    <p className="text-[10px] font-mono text-stone-500">
                                      {dt} · {assignedIds.length} petugas
                                    </p>
                                  </div>
                                </div>
                                <ul className="space-y-1.5">
                                  {assignedIds.map((rawId) => {
                                    const normId = normalizeMemberId(rawId);
                                    const m = memberMap.get(normId);
                                    if (!m) return null;
                                    const orgLabel = getMemberOrgLabel(m);
                                    return (
                                      <li
                                        key={normId}
                                        className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl bg-white border border-[#EFE0CE] text-xs"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="font-bold text-stone-900 truncate">
                                            {m.name}
                                          </p>
                                          <span className="text-[10px] font-mono text-sky-700 font-bold">
                                            {orgLabel} · {m.kelas}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveMemberFromScheduleDay(
                                              sch,
                                              dt,
                                              normId
                                            )
                                          }
                                          className="text-stone-400 hover:text-rose-600 p-1 rounded-lg"
                                          title="Hapus dari tanggal ini"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAssignMemberId(members[0]?.id || '');
                                  setQuickAssignFilter('');
                                  setQuickAssignTarget({
                                    scheduleId: sch.id,
                                    dayOrMode: dt,
                                  });
                                }}
                                className="w-full py-1.5 px-2 rounded-xl border border-dashed border-orange-300 text-[11px] font-bold text-orange-700 hover:bg-orange-50 inline-flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah Petugas</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 3. Active Temporary Schedule Swaps Section */}
      <section className="card-3d p-4 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Riwayat Tukar / Ganti Piket Sementara
            </h2>
            <p className="text-xs text-stone-500">
              Daftar pertukaran petugas piket khusus pada tanggal tertentu tanpa
              mengubah jadwal permanen.
            </p>
          </div>
          <span className="text-xs font-mono font-bold tabular-nums text-stone-600 bg-[#FFF8EE] border border-[#EBD5B8] px-3 py-1 rounded-xl shrink-0">
            {swaps.length} pergantian aktif
          </span>
        </div>

        {swaps.length === 0 ? (
          <p className="text-xs text-stone-500 py-2">
            Belum ada pergantian jadwal sementara yang tercatat.
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
                  const orig = memberMap.get(
                    normalizeMemberId(sw.originalMemberId)
                  );
                  const repl = memberMap.get(
                    normalizeMemberId(sw.replacementMemberId)
                  );
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

      {/* 4. Simplified Modal Form: Add / Edit Schedule with Custom Hari & Member Search */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-schedule-title"
        >
          <div className="card-3d max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-[#F3E3D0] pb-3.5">
              <div>
                <span className="text-xs font-bold text-orange-600">
                  Formulir Jadwal & Custom Hari Piket OSIS / MPK
                </span>
                <h2
                  id="modal-schedule-title"
                  className="text-lg font-bold text-stone-900"
                >
                  {editingScheduleId
                    ? 'Edit Jadwal, Hari Aktif & Petugas'
                    : 'Tambah Jadwal Piket Baru'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                aria-label="Tutup Modal"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleForm} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border-2 border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                  {formError}
                </div>
              )}

              {/* Basic Info: Nama Pos & Lokasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="sch-title-input"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Nama Jadwal / Pos Piket
                  </label>
                  <input
                    id="sch-title-input"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Jadwal Piket Warsis / Piket Acara Khusus"
                    className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sch-location-input"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Lokasi Tugas
                  </label>
                  <input
                    id="sch-location-input"
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Contoh: Warung OSIS (Warsis)"
                    className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>

              {/* Sistem Waktu & Jam */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label
                    htmlFor="sch-mode-select"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Sistem Penugasan
                  </label>
                  <select
                    id="sch-mode-select"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ScheduleMode)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                  >
                    <option value="mingguan">Mingguan (Beda per Hari)</option>
                    <option value="harian">
                      Harian (Sama di Hari yang Dipilih)
                    </option>
                    <option value="custom">
                      Custom Tanggal (Pilih Tanggal Kalender)
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sch-start-input"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Jam Mulai (WIB)
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
                    Jam Selesai (WIB)
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

              {/* Siklus Minggu Selection + Custom Hari Aktif (Senin..Minggu) */}
              {mode !== 'custom' && (
                <div className="p-3.5 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-2xl space-y-3">
                  {/* Siklus Minggu */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800">
                        Berlaku pada Siklus Minggu:
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveWeeks([1, 2, 3, 4])}
                        className="text-[11px] font-bold text-orange-600 hover:underline"
                      >
                        Pilih Semua Minggu (M1–M4)
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((wNum) => {
                        const isSelected = activeWeeks.includes(wNum);
                        return (
                          <button
                            key={wNum}
                            type="button"
                            onClick={() => toggleWeekNumber(wNum)}
                            className={`py-1.5 px-3 text-xs font-bold rounded-xl border-2 transition-colors ${
                              isSelected
                                ? 'bg-orange-500 border-orange-600 text-white'
                                : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-orange-50'
                            }`}
                          >
                            Minggu {wNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Hari Jadwal (Senin..Minggu) */}
                  <div className="pt-2.5 border-t border-[#F3E3D0] space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-800">
                        Custom Hari Aktif Jadwal (Pilih Hari Pelaksanaan):
                      </span>
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setActiveDays([1, 2, 3, 4, 5])}
                          className="text-sky-700 hover:underline"
                        >
                          Senin–Jumat
                        </button>
                        <span className="text-stone-300">·</span>
                        <button
                          type="button"
                          onClick={() => setActiveDays([1, 2, 3, 4, 5, 6])}
                          className="text-sky-700 hover:underline"
                        >
                          Senin–Sabtu
                        </button>
                        <span className="text-stone-300">·</span>
                        <button
                          type="button"
                          onClick={() => setActiveDays([0, 1, 2, 3, 4, 5, 6])}
                          className="text-sky-700 hover:underline"
                        >
                          Setiap Hari
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {MONDAY_FIRST_DAYS.map((dNum) => {
                        const isDayActive = activeDays.includes(dNum);
                        return (
                          <button
                            key={dNum}
                            type="button"
                            data-testid={`modal-day-toggle-${dNum}`}
                            onClick={() => toggleModalActiveDay(dNum)}
                            className={`py-1.5 px-2 text-xs font-bold rounded-xl border-2 transition-colors text-center ${
                              isDayActive
                                ? 'bg-emerald-600 border-emerald-700 text-white'
                                : 'bg-white border-[#E7D5C0] text-stone-400 hover:text-stone-700'
                            }`}
                          >
                            {DAY_NAMES_ID[dNum]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Member Selection with Search Filter */}
              <div className="p-3.5 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-2xl space-y-3">
                {mode === 'mingguan' && (
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-stone-800">
                      1. Pilih Hari untuk Mengatur Petugas:
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {MONDAY_FIRST_DAYS.map((d) => {
                        const isDayEnabled = activeDays.includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSelectedDayTab(d)}
                            className={`py-2 px-1.5 text-xs font-bold rounded-xl border transition-colors text-center ${
                              selectedDayTab === d
                                ? 'bg-sky-600 border-sky-700 text-white'
                                : isDayEnabled
                                ? 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-sky-50'
                                : 'bg-stone-100 border-stone-200 text-stone-400'
                            }`}
                          >
                            {DAY_NAMES_ID[d]} (
                            {(weeklyAssignments[d] || []).length})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {mode === 'custom' && (
                  <div className="space-y-2.5 pb-2.5 border-b border-[#F3E3D0]">
                    <span className="block text-xs font-bold text-stone-800">
                      1. Tambah & Pilih Tanggal Custom Pelaksanaan Piket:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        aria-label="Pilih tanggal custom"
                        value={newCustomDateInput}
                        onChange={(e) => setNewCustomDateInput(e.target.value)}
                        className="px-3 py-1.5 text-xs font-mono bg-white border-2 border-[#E7D5C0] rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomDate}
                        className="btn-3d-primary px-3 py-1.5 text-xs font-bold"
                      >
                        + Tambah Tanggal
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {customDates.map((dt) => {
                        const isSelectedDate = selectedCustomDateTab === dt;
                        const countForDate = (
                          customDateAssignments[dt] ||
                          dailyMembers ||
                          []
                        ).length;
                        return (
                          <div
                            key={dt}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-xl border-2 transition-colors ${
                              isSelectedDate
                                ? 'bg-sky-600 border-sky-700 text-white font-bold'
                                : 'bg-white border-[#E7D5C0] text-stone-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedCustomDateTab(dt)}
                              className="inline-flex items-center gap-1"
                            >
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>
                                {dt} ({countForDate})
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomDate(dt)}
                              aria-label={`Hapus tanggal ${dt}`}
                              className="hover:text-rose-300 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Search Input for Member Checkboxes */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-800 inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-orange-500" />
                    <span>
                      {mode === 'mingguan'
                        ? `2. Centang Petugas Hari ${DAY_NAMES_ID[selectedDayTab]}:`
                        : mode === 'custom'
                        ? `2. Centang Petugas Tanggal ${selectedCustomDateTab}:`
                        : 'Centang Petugas yang Bertugas:'}
                    </span>
                  </span>
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={modalMemberSearch}
                      onChange={(e) => setModalMemberSearch(e.target.value)}
                      placeholder="Cari nama / kelas..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                    />
                    {modalMemberSearch && (
                      <button
                        type="button"
                        onClick={() => setModalMemberSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto p-1">
                  {modalFilteredMembers.map((m) => {
                    const isChecked =
                      mode === 'mingguan'
                        ? (weeklyAssignments[selectedDayTab] || []).includes(
                            m.id
                          )
                        : mode === 'custom'
                        ? (
                            customDateAssignments[selectedCustomDateTab] ||
                            dailyMembers ||
                            []
                          ).includes(m.id)
                        : dailyMembers.includes(m.id);
                    const orgLabel = getMemberOrgLabel(m);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center justify-between gap-2 text-xs p-2 rounded-xl border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-orange-50 border-orange-400 font-bold text-stone-900'
                            : 'bg-white border-[#E7D5C0] text-stone-700 hover:bg-white/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              mode === 'mingguan'
                                ? toggleWeeklyDayMember(selectedDayTab, m.id)
                                : mode === 'custom'
                                ? toggleCustomDateMember(
                                    selectedCustomDateTab,
                                    m.id
                                  )
                                : toggleDailyMember(m.id)
                            }
                            className="rounded border-stone-300 text-orange-500 shrink-0"
                          />
                          <span className="truncate">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
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
                        </div>
                      </label>
                    );
                  })}
                </div>
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
