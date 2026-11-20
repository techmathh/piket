export type AttendanceStatus =
  | 'hadir'
  | 'terlambat'
  | 'izin'
  | 'sakit'
  | 'tidak_piket'
  | 'belum_absen';

export type ScheduleMode = 'harian' | 'mingguan' | 'custom';

export type MemberOrgLabel = 'OSIS' | 'MPK';

export interface OsisMember {
  id: string;
  name: string;
  kelas: string;
  jabatan: string; // "OSIS" or "MPK"
  phone: string;
  active: boolean;
}

export const LEGACY_MEMBER_ID_MAP: Record<string, string> = {
  'osis-shahnan': 'osis-azka',
  'osis-andes': 'osis-surya',
  'osis-rida': 'osis-faridathun',
};

export function normalizeMemberId(memberId: string): string {
  return LEGACY_MEMBER_ID_MAP[memberId] || memberId;
}

export function getMemberOrgLabel(member: OsisMember): MemberOrgLabel {
  if (member.jabatan.toUpperCase().includes('MPK')) {
    return 'MPK';
  }
  return 'OSIS';
}


export interface PiketSchedule {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: string; // "06:30"
  endTime: string; // "07:15"
  mode: ScheduleMode;
  tasks: string[];
  // Week cycle within a month: [1, 2, 3, 4] = Setiap Minggu, or specific weeks e.g. [1, 3] or [2]
  activeWeeks?: number[]; // 1 = Minggu 1, 2 = Minggu 2, 3 = Minggu 3, 4 = Minggu 4
  // For 'harian': runs every day in activeDays (default [1,2,3,4,5,6]) with dailyMembers
  activeDays: number[]; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  dailyMembers: string[]; // member IDs for 'harian' or fallback for 'custom'
  // For 'mingguan': member IDs per day of week (0..6)
  weeklyAssignments: Record<number, string[]>;
  // For 'custom': specific YYYY-MM-DD dates and member assignments per date
  customDates: string[];
  customDateAssignments: Record<string, string[]>;
}

export interface ScheduleSwap {
  id: string;
  date: string; // YYYY-MM-DD
  scheduleId: string;
  originalMemberId: string;
  replacementMemberId: string;
  reason: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  scheduleId: string;
  memberId: string;
  status: AttendanceStatus;
  checkInTime: string; // HH:mm or "-"
  note: string;
  recordedBy: string;
}

export interface ResolvedDutyMember {
  member: OsisMember;
  isSwapped: boolean;
  swappedFromMember?: OsisMember;
  swapReason?: string;
  swapId?: string;
  attendance: AttendanceRecord | null;
  effectiveStatus: AttendanceStatus;
  isAutoAlfa?: boolean;
}

export interface AutoAlfaContext {
  todayStr: string;
  currentTimeHHMM: string;
  isTestingMode?: boolean;
}

export interface ResolvedScheduleForDate {
  schedule: PiketSchedule;
  date: string;
  dayOfWeek: number;
  weekOfMonth: number;
  dutyMembers: ResolvedDutyMember[];
}

export interface MemberRecapRow {
  member: OsisMember;
  totalScheduled: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  tidakPiket: number;
  belumAbsen: number;
  attendanceRate: number; // 0 - 100
  disciplineLabel: string;
}

export interface PeriodRecapSummary {
  startDate: string;
  endDate: string;
  totalDutySlots: number;
  totalHadir: number;
  totalTerlambat: number;
  totalIzin: number;
  totalSakit: number;
  totalTidakPiket: number;
  totalBelumAbsen: number;
  overallAttendanceRate: number;
  memberRows: MemberRecapRow[];
}

export type AccountRole = 'developer' | 'admin';

export interface AppAccount {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: AccountRole;
  isProtected: boolean;
  createdAt: string;
}

export const PERMANENT_DEVELOPER_ACCOUNT: AppAccount = {
  id: 'acc-developer',
  username: 'developer',
  password: 'devosis123',
  displayName: 'Developer Sistem OSIS',
  role: 'developer',
  isProtected: true,
  createdAt: '2026-11-01T00:00:00.000Z',
};

/**
 * Authenticates a user by username and password against the accounts list,
 * always ensuring the permanent developer account is available as fallback.
 */
export function authenticateAccount(
  accounts: AppAccount[],
  usernameInput: string,
  passwordInput: string
): AppAccount | null {
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput;
  if (!cleanUser || !cleanPass) return null;

  const hasDevInList = accounts.some(
    (a) => a.id === PERMANENT_DEVELOPER_ACCOUNT.id || a.role === 'developer'
  );
  const effectiveList = hasDevInList
    ? accounts
    : [PERMANENT_DEVELOPER_ACCOUNT, ...accounts];

  const matched = effectiveList.find(
    (acc) =>
      acc.username.trim().toLowerCase() === cleanUser &&
      acc.password === cleanPass
  );
  return matched || null;
}

/**
 * Checks whether an account can be deleted.
 * The permanent developer account can NEVER be deleted.
 */
export function canDeleteAccount(account: AppAccount): boolean {
  if (
    account.id === PERMANENT_DEVELOPER_ACCOUNT.id ||
    account.role === 'developer' ||
    account.isProtected
  ) {
    return false;
  }
  return true;
}

/**
 * Checks whether the current logged-in account has permission to add/manage admin accounts.
 * Only the developer role can add or delete admin accounts.
 */
export function canManageAdminAccounts(account: AppAccount | null): boolean {
  return Boolean(account && account.role === 'developer');
}

export const DAY_NAMES_ID: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

export const STATUS_LABELS_ID: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  tidak_piket: 'Alfa',
  belum_absen: 'Belum Absen',
};

/**
 * Parses a YYYY-MM-DD string into a local Date object without timezone drift.
 */
export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

/**
 * Formats a Date object to YYYY-MM-DD string.
 */
export function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the week of the month (1..4) for a YYYY-MM-DD string.
 * Days 1-7 -> Minggu 1, Days 8-14 -> Minggu 2, Days 15-21 -> Minggu 3, Days 22+ -> Minggu 4.
 */
export function getWeekOfMonth(dateStr: string): number {
  const dt = parseDateString(dateStr);
  const dayOfMonth = dt.getDate();
  if (dayOfMonth <= 7) return 1;
  if (dayOfMonth <= 14) return 2;
  if (dayOfMonth <= 21) return 3;
  return 4;
}

/**
 * Formats the week cycle label of a schedule (e.g. "Setiap Minggu" or "Minggu 1 & 3").
 */
export function formatWeekCycleLabel(activeWeeks?: number[]): string {
  const weeks =
    activeWeeks && activeWeeks.length > 0 ? activeWeeks : [1, 2, 3, 4];
  const uniqueSorted = Array.from(new Set(weeks)).sort((a, b) => a - b);
  if (uniqueSorted.length >= 4) {
    return 'Setiap Minggu';
  }
  return `Minggu ${uniqueSorted.join(', ')}`;
}

/**
 * Adds `days` to a YYYY-MM-DD date string and returns a new YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  const dt = parseDateString(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatDateString(dt);
}

/**
 * Finds the exact YYYY-MM-DD date within the same month as `referenceDateStr`
 * that falls in `targetWeek` (1..4) and matches `targetDayOfWeek` (0..6).
 */
export function findDateForWeekAndDay(
  referenceDateStr: string,
  targetWeek: number,
  targetDayOfWeek: number
): string {
  const ref = parseDateString(referenceDateStr);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const clampedWeek = Math.min(Math.max(targetWeek, 1), 4);
  const startDay = (clampedWeek - 1) * 7 + 1;

  for (let d = startDay; d <= startDay + 6; d++) {
    const candidate = new Date(year, month, d, 12, 0, 0);
    if (candidate.getDay() === targetDayOfWeek) {
      return formatDateString(candidate);
    }
  }
  return referenceDateStr;
}


/**
 * Formats a YYYY-MM-DD string into readable Indonesian date, e.g. "Rabu, 11 November 2026".
 */
export function formatFullDateId(dateStr: string): string {
  const dt = parseDateString(dateStr);
  const dayName = DAY_NAMES_ID[dt.getDay()];
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return `${dayName}, ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

export type TimeOfDayPeriod = 'pagi' | 'siang' | 'sore' | 'malam';

export interface TimeOfDayGreetingInfo {
  period: TimeOfDayPeriod;
  greeting: string; // "Selamat Pagi" | "Selamat Siang" | "Selamat Sore" | "Selamat Malam"
  subtitle: string;
  isNightMode: boolean;
}

/**
 * Returns the Indonesian greeting and night-mode flag for a given hour (0..23).
 * - Pagi (04:00 - 10:59): Displays Today's schedule by default
 * - Siang (11:00 - 14:59): Displays Today's schedule by default
 * - Sore (15:00 - 17:59): Displays Today's schedule by default
 * - Malam (18:00 - 03:59): Automatically switches default display to Tomorrow's schedule
 */
export function getTimeOfDayGreeting(hour: number): TimeOfDayGreetingInfo {
  const normalizedHour = ((hour % 24) + 24) % 24;
  if (normalizedHour >= 4 && normalizedHour < 11) {
    return {
      period: 'pagi',
      greeting: 'Selamat Pagi',
      subtitle: 'Semangat bertugas untuk seluruh petugas piket hari ini!',
      isNightMode: false,
    };
  }
  if (normalizedHour >= 11 && normalizedHour < 15) {
    return {
      period: 'siang',
      greeting: 'Selamat Siang',
      subtitle: 'Tetap semangat menjalankan tugas piket hari ini!',
      isNightMode: false,
    };
  }
  if (normalizedHour >= 15 && normalizedHour < 18) {
    return {
      period: 'sore',
      greeting: 'Selamat Sore',
      subtitle: 'Terima kasih atas dedikasi petugas piket hari ini!',
      isNightMode: false,
    };
  }
  return {
    period: 'malam',
    greeting: 'Selamat Malam',
    subtitle: 'Menampilkan jadwal piket untuk besok agar petugas dapat bersiap.',
    isNightMode: true,
  };
}

/**
 * Returns the default target date string to display based on the hour of the day:
 * - Pagi / Siang / Sore (04:00 - 17:59) -> todayStr
 * - Malam (18:00 - 03:59) -> tomorrow (addDays(todayStr, 1))
 */
export function getDefaultDisplayDateForHour(
  todayStr: string,
  hour: number
): string {
  const { isNightMode } = getTimeOfDayGreeting(hour);
  return isNightMode ? addDays(todayStr, 1) : todayStr;
}

/**
 * Determines whether a schedule is active on a given YYYY-MM-DD date,
 * checking both the week of month (Minggu 1 - Minggu 4) and day of week,
 * and returns the list of base assigned member IDs before swaps.
 */
export function getBaseMemberIdsForScheduleOnDate(
  schedule: PiketSchedule,
  dateStr: string
): { isActive: boolean; memberIds: string[] } {
  const dt = parseDateString(dateStr);
  const dayOfWeek = dt.getDay();
  const weekOfMonth = getWeekOfMonth(dateStr);
  const allowedWeeks =
    schedule.activeWeeks && schedule.activeWeeks.length > 0
      ? schedule.activeWeeks
      : [1, 2, 3, 4];

  if (schedule.mode === 'harian') {
    if (!allowedWeeks.includes(weekOfMonth)) {
      return { isActive: false, memberIds: [] };
    }
    const isActive = schedule.activeDays.includes(dayOfWeek);
    if (!isActive) return { isActive: false, memberIds: [] };
    const specific = schedule.weeklyAssignments[dayOfWeek];
    const members =
      schedule.dailyMembers && schedule.dailyMembers.length > 0
        ? schedule.dailyMembers
        : specific || [];
    return { isActive: true, memberIds: members.map(normalizeMemberId) };
  }

  if (schedule.mode === 'mingguan') {
    if (!allowedWeeks.includes(weekOfMonth)) {
      return { isActive: false, memberIds: [] };
    }
    const dayMembers = schedule.weeklyAssignments[dayOfWeek] || [];
    const isActive =
      schedule.activeDays.includes(dayOfWeek) && dayMembers.length > 0;
    return {
      isActive,
      memberIds: isActive ? dayMembers.map(normalizeMemberId) : [],
    };
  }

  // 'custom' mode
  if (schedule.customDates.includes(dateStr)) {
    const specific = schedule.customDateAssignments[dateStr];
    const members =
      specific && specific.length > 0 ? specific : schedule.dailyMembers;
    return { isActive: true, memberIds: members.map(normalizeMemberId) };
  }

  return { isActive: false, memberIds: [] };
}

/**
 * Sanitizes and normalizes a PiketSchedule object before saving to or reading from Firestore
 * so all fields strictly satisfy Firestore security rules and legacy member IDs are normalized.
 */
export function sanitizeScheduleForDb(schedule: PiketSchedule): PiketSchedule {
  const validMode: ScheduleMode =
    schedule.mode === 'harian' ||
    schedule.mode === 'mingguan' ||
    schedule.mode === 'custom'
      ? schedule.mode
      : 'mingguan';

  const cleanWeekly: Record<number, string[]> = {};
  if (
    schedule.weeklyAssignments &&
    typeof schedule.weeklyAssignments === 'object'
  ) {
    for (const [k, v] of Object.entries(schedule.weeklyAssignments)) {
      const dayNum = Number(k);
      if (
        !Number.isNaN(dayNum) &&
        dayNum >= 0 &&
        dayNum <= 6 &&
        Array.isArray(v)
      ) {
        cleanWeekly[dayNum] = Array.from(
          new Set(
            v
              .filter(
                (id): id is string =>
                  typeof id === 'string' && id.trim().length > 0
              )
              .map((id) => normalizeMemberId(id.trim()))
          )
        );
      }
    }
  }

  const cleanCustomMap: Record<string, string[]> = {};
  if (
    schedule.customDateAssignments &&
    typeof schedule.customDateAssignments === 'object'
  ) {
    for (const [dt, v] of Object.entries(schedule.customDateAssignments)) {
      if (typeof dt === 'string' && dt.trim().length > 0 && Array.isArray(v)) {
        cleanCustomMap[dt.trim()] = Array.from(
          new Set(
            v
              .filter(
                (id): id is string =>
                  typeof id === 'string' && id.trim().length > 0
              )
              .map((id) => normalizeMemberId(id.trim()))
          )
        );
      }
    }
  }

  const cleanTasks = Array.isArray(schedule.tasks)
    ? schedule.tasks
        .filter(
          (t): t is string => typeof t === 'string' && t.trim().length > 0
        )
        .map((t) => t.trim())
        .slice(0, 50)
    : ['Menjaga ketertiban dan kebersihan pos piket'];

  const cleanWeeks =
    Array.isArray(schedule.activeWeeks) && schedule.activeWeeks.length > 0
      ? Array.from(
          new Set(
            schedule.activeWeeks
              .map(Number)
              .filter((w) => w >= 1 && w <= 4)
          )
        ).sort((a, b) => a - b)
      : [1, 2, 3, 4];

  const cleanDays = Array.isArray(schedule.activeDays)
    ? Array.from(
        new Set(
          schedule.activeDays
            .map(Number)
            .filter((d) => !Number.isNaN(d) && d >= 0 && d <= 6)
        )
      )
    : [1, 2, 3, 4, 5];

  const cleanDailyMembers = Array.isArray(schedule.dailyMembers)
    ? Array.from(
        new Set(
          schedule.dailyMembers
            .filter(
              (id): id is string =>
                typeof id === 'string' && id.trim().length > 0
            )
            .map((id) => normalizeMemberId(id.trim()))
        )
      ).slice(0, 200)
    : [];

  const cleanCustomDates = Array.isArray(schedule.customDates)
    ? Array.from(
        new Set(
          schedule.customDates
            .filter(
              (d): d is string => typeof d === 'string' && d.trim().length === 10
            )
            .map((d) => d.trim())
        )
      )
        .sort()
        .slice(0, 366)
    : [];

  return {
    id: String(schedule.id || `sch-${Date.now()}`).slice(0, 100),
    title:
      String(schedule.title || 'Jadwal Piket OSIS')
        .trim()
        .slice(0, 150) || 'Jadwal Piket OSIS',
    description: String(schedule.description || '')
      .trim()
      .slice(0, 500),
    location:
      String(schedule.location || 'Lingkungan Sekolah')
        .trim()
        .slice(0, 150) || 'Lingkungan Sekolah',
    startTime:
      String(schedule.startTime || '06:30')
        .trim()
        .slice(0, 20) || '06:30',
    endTime:
      String(schedule.endTime || '07:15')
        .trim()
        .slice(0, 20) || '07:15',
    mode: validMode,
    tasks:
      cleanTasks.length > 0
        ? cleanTasks
        : ['Menjaga ketertiban dan kebersihan pos piket'],
    activeWeeks: cleanWeeks.length > 0 ? cleanWeeks : [1, 2, 3, 4],
    activeDays: cleanDays,
    dailyMembers: cleanDailyMembers,
    weeklyAssignments: cleanWeekly,
    customDates: cleanCustomDates,
    customDateAssignments: cleanCustomMap,
  };
}

/**
 * Returns true if an unrecorded duty slot should automatically become Alfa (`tidak_piket`):
 * - Not a holiday for this schedule on `dateStr`, AND
 * - Either `dateStr < todayStr` (past day), OR (`dateStr === todayStr` and `currentTimeHHMM > schedule.endTime`).
 */
export function isAutoAlfaSlot(
  dateStr: string,
  schedule: Pick<PiketSchedule, 'title' | 'endTime'>,
  autoAlfaContext: AutoAlfaContext | undefined,
  attendanceRecords: AttendanceRecord[]
): boolean {
  if (!autoAlfaContext) return false;
  if (autoAlfaContext.isTestingMode) return false;
  if (getHolidayForScheduleOnDate(dateStr, schedule.title, attendanceRecords)) {
    return false;
  }

  // Honor Developer Violation Database Reset cutoff so cleared past Auto-Alfa stays at 0
  const violationCutoff = getViolationResetCutoff(attendanceRecords);
  if (violationCutoff) {
    if (dateStr < violationCutoff.resetDate) {
      return false;
    }
    if (dateStr === violationCutoff.resetDate) {
      const endHHMM = (schedule.endTime || '23:59').slice(0, 5);
      if (endHHMM <= violationCutoff.resetTimeHHMM) {
        return false;
      }
    }
  }

  if (dateStr < autoAlfaContext.todayStr) {
    return true;
  }
  if (dateStr === autoAlfaContext.todayStr) {
    const nowHHMM = (autoAlfaContext.currentTimeHHMM || '00:00').slice(0, 5);
    const endHHMM = (schedule.endTime || '23:59').slice(0, 5);
    return nowHHMM > endHHMM;
  }
  return false;
}

/**
 * Resolves all active schedules for a given date, applying any temporary swaps,
 * attaching attendance records, and automatically marking unrecorded ended/past shifts as Alfa.
 */
export function resolveSchedulesForDate(
  dateStr: string,
  schedules: PiketSchedule[],
  members: OsisMember[],
  swaps: ScheduleSwap[],
  attendanceRecords: AttendanceRecord[],
  autoAlfaContext?: AutoAlfaContext
): ResolvedScheduleForDate[] {
  const memberMap = new Map<string, OsisMember>();
  for (const m of members) {
    memberMap.set(m.id, m);
  }

  const dt = parseDateString(dateStr);
  const dayOfWeek = dt.getDay();
  const result: ResolvedScheduleForDate[] = [];

  for (const schedule of schedules) {
    const { isActive, memberIds } = getBaseMemberIdsForScheduleOnDate(
      schedule,
      dateStr
    );
    if (!isActive) continue;

    const scheduleSwaps = swaps.filter(
      (s) => s.date === dateStr && s.scheduleId === schedule.id
    );
    const autoAlfaActive = isAutoAlfaSlot(
      dateStr,
      schedule,
      autoAlfaContext,
      attendanceRecords
    );

    const dutyMembers: ResolvedDutyMember[] = [];

    for (const baseMemberId of memberIds) {
      const activeSwap = scheduleSwaps.find(
        (s) =>
          normalizeMemberId(s.originalMemberId) ===
          normalizeMemberId(baseMemberId)
      );
      const effectiveMemberId = activeSwap
        ? normalizeMemberId(activeSwap.replacementMemberId)
        : normalizeMemberId(baseMemberId);
      const memberObj = memberMap.get(effectiveMemberId);
      if (!memberObj) continue;

      const originalMemberObj = activeSwap
        ? memberMap.get(normalizeMemberId(activeSwap.originalMemberId))
        : undefined;

      const attRecord =
        attendanceRecords.find(
          (r) =>
            r.date === dateStr &&
            r.scheduleId === schedule.id &&
            normalizeMemberId(r.memberId) === effectiveMemberId
        ) || null;

      const isAutoAlfa = !attRecord && autoAlfaActive;
      const effectiveStatus: AttendanceStatus = attRecord
        ? attRecord.status
        : isAutoAlfa
        ? 'tidak_piket'
        : 'belum_absen';

      dutyMembers.push({
        member: memberObj,
        isSwapped: Boolean(activeSwap),
        swappedFromMember: originalMemberObj,
        swapReason: activeSwap?.reason,
        swapId: activeSwap?.id,
        attendance: attRecord,
        effectiveStatus,
        isAutoAlfa,
      });
    }

    result.push({
      schedule,
      date: dateStr,
      dayOfWeek,
      weekOfMonth: getWeekOfMonth(dateStr),
      dutyMembers,
    });
  }

  // Sort schedules by startTime
  result.sort((a, b) =>
    a.schedule.startTime.localeCompare(b.schedule.startTime)
  );
  return result;
}

/**
 * Generates an array of YYYY-MM-DD strings between startDate and endDate (inclusive).
 */
export function getDateRangeStrings(
  startDate: string,
  endDate: string
): string[] {
  const dates: string[] = [];
  let curr = parseDateString(startDate);
  const end = parseDateString(endDate);
  if (curr > end) return dates;

  while (curr <= end) {
    dates.push(formatDateString(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/**
 * Gets the Monday-to-Sunday date range for the week containing `referenceDateStr`.
 */
export function getWeekRange(referenceDateStr: string): {
  startDate: string;
  endDate: string;
} {
  const dt = parseDateString(referenceDateStr);
  const day = dt.getDay();
  // Convert so Monday = 0, ..., Sunday = 6
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: formatDateString(monday),
    endDate: formatDateString(sunday),
  };
}

/**
 * Gets the first and last day of the month for `yearMonth` ("YYYY-MM").
 */
export function getMonthRange(yearMonth: string): {
  startDate: string;
  endDate: string;
} {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDay = new Date(y, (m || 1) - 1, 1, 12, 0, 0);
  const lastDay = new Date(y, m || 1, 0, 12, 0, 0);
  return {
    startDate: formatDateString(firstDay),
    endDate: formatDateString(lastDay),
  };
}

/**
 * Permanently changes a member assignment inside a schedule (Ganti Jadwal Permanen).
 */
export function replaceMemberInSchedule(
  schedule: PiketSchedule,
  targetDayOrDate: number | string,
  oldMemberId: string,
  newMemberId: string
): PiketSchedule {
  const normOld = normalizeMemberId(oldMemberId);
  const normNew = normalizeMemberId(newMemberId);

  if (schedule.mode === 'harian') {
    const nextDaily = schedule.dailyMembers.map((id) =>
      normalizeMemberId(id) === normOld ? normNew : normalizeMemberId(id)
    );
    if (!nextDaily.includes(normNew)) {
      nextDaily.push(normNew);
    }
    return {
      ...schedule,
      dailyMembers: Array.from(new Set(nextDaily)),
    };
  }

  if (schedule.mode === 'mingguan' && typeof targetDayOrDate === 'number') {
    const currentList = schedule.weeklyAssignments[targetDayOrDate] || [];
    const replaced = currentList.map((id) =>
      normalizeMemberId(id) === normOld ? normNew : normalizeMemberId(id)
    );
    if (!replaced.includes(normNew)) {
      replaced.push(normNew);
    }
    return {
      ...schedule,
      weeklyAssignments: {
        ...schedule.weeklyAssignments,
        [targetDayOrDate]: Array.from(new Set(replaced)),
      },
    };
  }

  if (schedule.mode === 'custom' && typeof targetDayOrDate === 'string') {
    const currentList =
      schedule.customDateAssignments[targetDayOrDate] ||
      schedule.dailyMembers ||
      [];
    const replaced = currentList.map((id) =>
      normalizeMemberId(id) === normOld ? normNew : normalizeMemberId(id)
    );
    if (!replaced.includes(normNew)) {
      replaced.push(normNew);
    }
    return {
      ...schedule,
      customDateAssignments: {
        ...schedule.customDateAssignments,
        [targetDayOrDate]: Array.from(new Set(replaced)),
      },
    };
  }

  return schedule;
}

/**
 * Calculates weekly or monthly attendance recap across a date range,
 * optionally filtered by scheduleId.
 */
export function calculatePeriodRecap(
  startDate: string,
  endDate: string,
  schedules: PiketSchedule[],
  members: OsisMember[],
  swaps: ScheduleSwap[],
  attendanceRecords: AttendanceRecord[],
  filterScheduleId: string = 'all',
  autoAlfaContext?: AutoAlfaContext
): PeriodRecapSummary {
  const dates = getDateRangeStrings(startDate, endDate);
  const activeSchedules =
    filterScheduleId === 'all'
      ? schedules
      : schedules.filter((s) => s.id === filterScheduleId);

  const statsByMember = new Map<
    string,
    {
      totalScheduled: number;
      hadir: number;
      terlambat: number;
      izin: number;
      sakit: number;
      tidakPiket: number;
      belumAbsen: number;
    }
  >();

  for (const m of members) {
    statsByMember.set(m.id, {
      totalScheduled: 0,
      hadir: 0,
      terlambat: 0,
      izin: 0,
      sakit: 0,
      tidakPiket: 0,
      belumAbsen: 0,
    });
  }

  let totalDutySlots = 0;
  let totalHadir = 0;
  let totalTerlambat = 0;
  let totalIzin = 0;
  let totalSakit = 0;
  let totalTidakPiket = 0;
  let totalBelumAbsen = 0;

  for (const d of dates) {
    const resolvedList = resolveSchedulesForDate(
      d,
      activeSchedules,
      members,
      swaps,
      attendanceRecords,
      autoAlfaContext
    );
    for (const res of resolvedList) {
      const posHoliday = getHolidayForScheduleOnDate(
        d,
        res.schedule.title,
        attendanceRecords
      );
      if (posHoliday) {
        continue;
      }
      for (const dm of res.dutyMembers) {
        const entry = statsByMember.get(dm.member.id);
        if (!entry) continue;
        entry.totalScheduled += 1;
        totalDutySlots += 1;

        switch (dm.effectiveStatus) {
          case 'hadir':
            entry.hadir += 1;
            totalHadir += 1;
            break;
          case 'terlambat':
            entry.terlambat += 1;
            totalTerlambat += 1;
            break;
          case 'izin':
            entry.izin += 1;
            totalIzin += 1;
            break;
          case 'sakit':
            entry.sakit += 1;
            totalSakit += 1;
            break;
          case 'tidak_piket':
            entry.tidakPiket += 1;
            totalTidakPiket += 1;
            break;
          default:
            entry.belumAbsen += 1;
            totalBelumAbsen += 1;
            break;
        }
      }
    }
  }

  const memberRows: MemberRecapRow[] = members.map((member) => {
    const st = statsByMember.get(member.id)!;
    const evaluatedSlots = st.totalScheduled - st.belumAbsen;
    const denominator = evaluatedSlots > 0 ? evaluatedSlots : st.totalScheduled;
    const attended = st.hadir + st.terlambat;
    const attendanceRate =
      denominator > 0 ? Math.round((attended / denominator) * 100) : 0;

    let disciplineLabel = 'Belum Dijadwalkan';
    if (st.totalScheduled > 0) {
      if (evaluatedSlots === 0) {
        disciplineLabel = 'Menunggu Jadwal';
      } else if (attendanceRate >= 90 && st.tidakPiket === 0) {
        disciplineLabel = 'Sangat Disiplin';
      } else if (attendanceRate >= 75) {
        disciplineLabel = 'Disiplin';
      } else if (attendanceRate >= 50) {
        disciplineLabel = 'Cukup';
      } else {
        disciplineLabel = 'Perlu Pembinaan';
      }
    }

    return {
      member,
      totalScheduled: st.totalScheduled,
      hadir: st.hadir,
      terlambat: st.terlambat,
      izin: st.izin,
      sakit: st.sakit,
      tidakPiket: st.tidakPiket,
      belumAbsen: st.belumAbsen,
      attendanceRate,
      disciplineLabel,
    };
  });

  // Sort by highest scheduled and attendance rate
  memberRows.sort((a, b) => {
    if (b.totalScheduled !== a.totalScheduled) {
      return b.totalScheduled - a.totalScheduled;
    }
    return b.attendanceRate - a.attendanceRate;
  });

  const evaluatedTotal = totalDutySlots - totalBelumAbsen;
  const overallDenominator = evaluatedTotal > 0 ? evaluatedTotal : totalDutySlots;
  const overallAttendanceRate =
    overallDenominator > 0
      ? Math.round(((totalHadir + totalTerlambat) / overallDenominator) * 100)
      : 0;

  return {
    startDate,
    endDate,
    totalDutySlots,
    totalHadir,
    totalTerlambat,
    totalIzin,
    totalSakit,
    totalTidakPiket,
    totalBelumAbsen,
    overallAttendanceRate,
    memberRows,
  };
}

export interface ShiftCheckInProgress {
  totalMembers: number;
  checkedInCount: number; // hadir + terlambat
  hadirCount: number;
  terlambatCount: number;
  excusedCount: number; // izin + sakit
  absentCount: number; // tidak_piket
  pendingCount: number; // belum_absen
  recordedCount: number; // totalMembers - pendingCount
  checkedInPercentage: number; // 0 - 100
  excusedPercentage: number; // 0 - 100
  absentPercentage: number; // 0 - 100
  recordedPercentage: number; // 0 - 100
}

/**
 * Calculates check-in progress metrics for a list of duty members on a shift or across shifts.
 */
export function calculateShiftCheckInProgress(
  dutyMembers: ResolvedDutyMember[]
): ShiftCheckInProgress {
  const totalMembers = dutyMembers.length;
  let hadirCount = 0;
  let terlambatCount = 0;
  let excusedCount = 0;
  let absentCount = 0;
  let pendingCount = 0;

  for (const dm of dutyMembers) {
    if (dm.effectiveStatus === 'hadir') hadirCount += 1;
    else if (dm.effectiveStatus === 'terlambat') terlambatCount += 1;
    else if (dm.effectiveStatus === 'izin' || dm.effectiveStatus === 'sakit')
      excusedCount += 1;
    else if (dm.effectiveStatus === 'tidak_piket') absentCount += 1;
    else pendingCount += 1;
  }

  const checkedInCount = hadirCount + terlambatCount;
  const recordedCount = totalMembers - pendingCount;

  const checkedInPercentage =
    totalMembers > 0 ? Math.round((checkedInCount / totalMembers) * 100) : 0;
  const excusedPercentage =
    totalMembers > 0 ? Math.round((excusedCount / totalMembers) * 100) : 0;
  const absentPercentage =
    totalMembers > 0 ? Math.round((absentCount / totalMembers) * 100) : 0;
  const recordedPercentage =
    totalMembers > 0 ? Math.round((recordedCount / totalMembers) * 100) : 0;

  return {
    totalMembers,
    checkedInCount,
    hadirCount,
    terlambatCount,
    excusedCount,
    absentCount,
    pendingCount,
    recordedCount,
    checkedInPercentage,
    excusedPercentage,
    absentPercentage,
    recordedPercentage,
  };
}

/**
 * Finds the current active shift based on `currentTimeHHMM` (e.g., "07:05") or
 * selects the most relevant shift from `schedules`.
 */
export function findCurrentActiveShift(
  schedules: ResolvedScheduleForDate[],
  currentTimeHHMM: string,
  scheduleFilter = 'all'
): {
  activeShift: ResolvedScheduleForDate | null;
  isLiveInTimeWindow: boolean;
} {
  if (schedules.length === 0) {
    return { activeShift: null, isLiveInTimeWindow: false };
  }

  if (scheduleFilter !== 'all') {
    const filtered = schedules.find((s) => s.schedule.id === scheduleFilter);
    if (filtered) {
      const hhmm = currentTimeHHMM.slice(0, 5);
      const isLive =
        hhmm >= filtered.schedule.startTime &&
        hhmm <= filtered.schedule.endTime;
      return { activeShift: filtered, isLiveInTimeWindow: isLive };
    }
  }

  const hhmm = currentTimeHHMM.slice(0, 5);
  // 1. Check if any shift's time window contains currentTimeHHMM
  const liveMatch = schedules.find(
    (s) => hhmm >= s.schedule.startTime && hhmm <= s.schedule.endTime
  );
  if (liveMatch) {
    return { activeShift: liveMatch, isLiveInTimeWindow: true };
  }

  // 2. Otherwise find the next upcoming shift today
  const upcomingMatch = schedules.find((s) => s.schedule.startTime > hhmm);
  if (upcomingMatch) {
    return { activeShift: upcomingMatch, isLiveInTimeWindow: false };
  }

  // 3. Fallback to the latest shift of the day
  return {
    activeShift: schedules[schedules.length - 1],
    isLiveInTimeWindow: false,
  };
}

export interface ShiftTimelineStatus {
  state: 'live' | 'upcoming' | 'completed' | 'empty';
  headline: string;
  subline: string;
  targetSchedule: ResolvedScheduleForDate | null;
}

/**
 * Computes a human-friendly operational timeline summary for the displayed day's shifts
 * based on `currentTimeHHMM` (e.g. "07:15").
 */
export function getShiftTimelineStatus(
  schedules: ResolvedScheduleForDate[],
  currentTimeHHMM: string,
  isShowingToday: boolean
): ShiftTimelineStatus {
  if (schedules.length === 0) {
    return {
      state: 'empty',
      headline: 'Tidak Ada Jadwal Aktif',
      subline: 'Hari libur piket atau di luar jadwal.',
      targetSchedule: null,
    };
  }

  if (!isShowingToday) {
    return {
      state: 'upcoming',
      headline: `${schedules.length} Pos Piket Terjadwal`,
      subline: schedules
        .map((s) => `${s.schedule.title} (${s.schedule.startTime})`)
        .join(' · '),
      targetSchedule: schedules[0],
    };
  }

  const hhmm = currentTimeHHMM.slice(0, 5);
  const liveShift = schedules.find(
    (s) => hhmm >= s.schedule.startTime && hhmm <= s.schedule.endTime
  );
  if (liveShift) {
    return {
      state: 'live',
      headline: `Sedang Berlangsung: ${liveShift.schedule.title}`,
      subline: `Pukul ${liveShift.schedule.startTime} – ${liveShift.schedule.endTime} WIB · ${liveShift.schedule.location}`,
      targetSchedule: liveShift,
    };
  }

  const nextShift = schedules.find((s) => s.schedule.startTime > hhmm);
  if (nextShift) {
    return {
      state: 'upcoming',
      headline: `Pos Berikutnya: ${nextShift.schedule.title}`,
      subline: `Mulai pukul ${nextShift.schedule.startTime} – ${nextShift.schedule.endTime} WIB · ${nextShift.schedule.location}`,
      targetSchedule: nextShift,
    };
  }

  const lastShift = schedules[schedules.length - 1];
  return {
    state: 'completed',
    headline: 'Seluruh Sesi Piket Hari Ini Telah Selesai',
    subline: `${schedules.length} pos piket telah terlaksana hingga pukul ${lastShift.schedule.endTime} WIB`,
    targetSchedule: lastShift,
  };
}

export const MONDAY_FIRST_DAYS: number[] = [1, 2, 3, 4, 5, 6, 0];

/**
 * Formats an array of active day numbers (0 = Minggu .. 6 = Sabtu) into a readable Indonesian label.
 */
export function formatActiveDaysLabel(activeDays?: number[]): string {
  const raw =
    activeDays && activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5];
  const unique = Array.from(new Set(raw));
  const ordered = MONDAY_FIRST_DAYS.filter((d) => unique.includes(d));

  if (ordered.length === 0) return 'Belum ada hari aktif';
  if (ordered.length === 7) return 'Setiap Hari (Senin–Minggu)';
  if (
    ordered.length === 5 &&
    ordered.every((d, i) => d === [1, 2, 3, 4, 5][i])
  ) {
    return 'Senin – Jumat';
  }
  if (
    ordered.length === 6 &&
    ordered.every((d, i) => d === [1, 2, 3, 4, 5, 6][i])
  ) {
    return 'Senin – Sabtu';
  }
  return ordered.map((d) => DAY_NAMES_ID[d]).join(', ');
}

export const DAY_NOTE_SCHEDULE_ID = '__DAY_NOTE__';
export const DAY_NOTE_MEMBER_ID = '__NOTE__';

export const DAY_ATTENDANCE_NOTE_PRESETS: string[] = [
  'Libur Nasional / Tanggal Merah',
  'Libur Sekolah / Cuti Bersama',
  'Kegiatan Classmeeting / Acara Sekolah',
  'Sedang Ujian (UTS / UAS / US)',
  'Rapat Dewan Guru / Pulang Cepat',
  'Cuaca Hujan Deras / Kondisional',
];

export const MEMBER_ATTENDANCE_NOTE_PRESETS: string[] = [
  'Libur / Bebas Piket',
  'Dispensasi Kegiatan OSIS / MPK',
  'Izin Lomba / Delegasi Sekolah',
  'Izin Urusan Keluarga',
  'Sakit (Istirahat UKS / Rumah)',
  'Sedang Mengikuti Ujian Susulan',
];

export interface DayAttendanceNoteInfo {
  id: string;
  date: string;
  scheduleId: string;
  note: string;
  isHoliday: boolean;
  recordedBy: string;
}

/**
 * Retrieves a day-level or schedule-level general note/holiday remark (e.g. "Libur Nasional")
 * stored inside attendanceRecords.
 */
export function getDayAttendanceNote(
  dateStr: string,
  attendanceRecords: AttendanceRecord[],
  scheduleId: string = DAY_NOTE_SCHEDULE_ID
): DayAttendanceNoteInfo | null {
  const found = attendanceRecords.find(
    (r) =>
      r.date === dateStr &&
      r.scheduleId === scheduleId &&
      r.memberId === DAY_NOTE_MEMBER_ID
  );
  if (!found || !found.note || !found.note.trim()) {
    return null;
  }
  return {
    id: found.id,
    date: found.date,
    scheduleId: found.scheduleId,
    note: found.note.trim(),
    isHoliday: found.checkInTime === 'LIBUR',
    recordedBy: found.recordedBy,
  };
}

/**
 * Builds a valid AttendanceRecord payload for storing a day-level or pos-level Keterangan (e.g. Libur)
 * in Firestore's `attendance` collection while satisfying strict security rules.
 */
export function createDayAttendanceNoteRecord(
  dateStr: string,
  note: string,
  isHoliday: boolean,
  recordedBy: string,
  scheduleId: string = DAY_NOTE_SCHEDULE_ID
): AttendanceRecord {
  return {
    id: `att-${dateStr}-${scheduleId}-${DAY_NOTE_MEMBER_ID}`,
    date: dateStr,
    scheduleId,
    memberId: DAY_NOTE_MEMBER_ID,
    status: 'izin',
    checkInTime: isHoliday ? 'LIBUR' : 'INFO',
    note: note.trim().slice(0, 500),
    recordedBy: (recordedBy || 'Admin Pengurus OSIS').slice(0, 120),
  };
}

export interface MemberPersonalScheduleEntry {
  scheduleId: string;
  title: string;
  location: string;
  timeRange: string;
  weekNum: number;
  days: number[];
  customDates?: string[];
}

/**
 * Resolves all 4-week cycle and custom-day duty assignments for a specific member.
 */
export function getMemberPersonalSchedules(
  memberId: string,
  allSchedules: PiketSchedule[]
): MemberPersonalScheduleEntry[] {
  const normTarget = normalizeMemberId(memberId);
  const list: MemberPersonalScheduleEntry[] = [];

  for (const sch of allSchedules) {
    const weekNum = sch.activeWeeks?.[0] || 1;
    const dailyNorm = sch.dailyMembers.map(normalizeMemberId);
    const activeOrderedDays = MONDAY_FIRST_DAYS.filter((d) =>
      (sch.activeDays && sch.activeDays.length > 0
        ? sch.activeDays
        : [1, 2, 3, 4, 5]
      ).includes(d)
    );

    if (sch.mode === 'harian' && dailyNorm.includes(normTarget)) {
      list.push({
        scheduleId: sch.id,
        title: sch.title,
        location: sch.location,
        timeRange: `${sch.startTime} – ${sch.endTime}`,
        weekNum,
        days:
          activeOrderedDays.length < 7
            ? activeOrderedDays
            : [1, 2, 3, 4, 5],
      });
    } else if (sch.mode === 'mingguan') {
      const matchedDays: number[] = [];
      for (const d of MONDAY_FIRST_DAYS) {
        if (
          sch.activeDays &&
          sch.activeDays.length > 0 &&
          !sch.activeDays.includes(d)
        ) {
          continue;
        }
        const ids = (sch.weeklyAssignments[d] || []).map(normalizeMemberId);
        if (ids.includes(normTarget)) matchedDays.push(d);
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
    } else if (sch.mode === 'custom') {
      const matchedCustomDates = (sch.customDates || []).filter((dt) => {
        const specific = sch.customDateAssignments?.[dt];
        const ids = (
          specific && specific.length > 0 ? specific : sch.dailyMembers
        ).map(normalizeMemberId);
        return ids.includes(normTarget);
      });
      if (matchedCustomDates.length > 0) {
        const customDayNums = Array.from(
          new Set(matchedCustomDates.map((dt) => parseDateString(dt).getDay()))
        );
        list.push({
          scheduleId: sch.id,
          title: sch.title,
          location: sch.location,
          timeRange: `${sch.startTime} – ${sch.endTime}`,
          weekNum,
          days: customDayNums,
          customDates: matchedCustomDates,
        });
      }
    }
  }

  return list.sort((a, b) => a.weekNum - b.weekNum);
}

export type ScheduleDateEditState = 'past' | 'today' | 'future';

export interface ScheduleDateEditStatus {
  canEdit: boolean;
  state: ScheduleDateEditState;
  label: string;
  reason: string;
}

/**
 * Enforces that neither public users nor admins can edit/submit attendance
 * for dates that have already passed (< todayStr) or have not arrived yet (> todayStr).
 */
export function getScheduleDateEditStatus(
  targetDateStr: string,
  todayStr: string,
  isTestingMode = false
): ScheduleDateEditStatus {
  const state: ScheduleDateEditState =
    targetDateStr < todayStr
      ? 'past'
      : targetDateStr > todayStr
      ? 'future'
      : 'today';

  if (isTestingMode) {
    return {
      canEdit: true,
      state,
      label: 'Mode Uji Coba (Tanpa Batasan Waktu)',
      reason:
        'Mode Uji Coba aktif — absensi, verifikasi, dan perubahan jadwal dibuka untuk semua tanggal tanpa batasan waktu.',
    };
  }

  if (state === 'past') {
    return {
      canEdit: false,
      state: 'past',
      label: 'Jadwal Sudah Berlalu',
      reason:
        'Jadwal yang sudah berlalu bersifat arsip dan tidak dapat diedit oleh admin maupun pengguna.',
    };
  }
  if (state === 'future') {
    return {
      canEdit: false,
      state: 'future',
      label: 'Belum Waktunya Jadwal',
      reason:
        'Jadwal belum waktunya dilaksanakan. Absensi dan verifikasi hanya dapat dilakukan pada hari H.',
    };
  }
  return {
    canEdit: true,
    state: 'today',
    label: 'Hari Ini (Aktif)',
    reason: 'Absensi dan verifikasi aktif untuk jadwal hari ini.',
  };
}

export type PosRuleCategory = 'gerbang' | 'shalat' | 'warsis' | 'umum';

export interface PosRuleSessionOption {
  id: string;
  label: string;
  timeLabel?: string;
}

export interface PosRuleInfo {
  category: PosRuleCategory;
  shortBadge: string;
  ruleSummary: string;
  maxToleranceTime?: string; // e.g. "06:45" for Jaga Gerbang
  requiredSessions?: PosRuleSessionOption[]; // e.g. 2x for Shalat & Warsis
}

export const GERBANG_MAX_TOLERANCE_TIME = '06:45';

export const OFFICIAL_POS_TIME_WINDOWS: Record<
  Exclude<PosRuleCategory, 'umum'>,
  { startTime: string; endTime: string }
> = {
  gerbang: { startTime: '06:00', endTime: '09:15' },
  warsis: { startTime: '09:15', endTime: '14:15' },
  shalat: { startTime: '11:45', endTime: '16:00' },
};

/**
 * Returns structured attendance rule & tolerance information for a schedule pos:
 * - Jaga Gerbang: Jam absen 06:00–09:15 WIB; toleransi maks. 06:45 WIB (>06:45 = Terlambat)
 * - Absensi Shalat: Jam absen 11:45–16:00 WIB; wajib 2x jaga (Dzuhur & Ashar); 1x = Terlambat
 * - Piket Warsis: Jam absen 09:15–14:15 WIB; wajib 2x jaga (Istirahat 1: 09:15 & Istirahat 2: 11:45); 1x = Terlambat
 */
export function getPosRuleInfo(scheduleTitle: string): PosRuleInfo {
  const lower = (scheduleTitle || '').toLowerCase();

  if (lower.includes('gerbang')) {
    return {
      category: 'gerbang',
      shortBadge: 'Absen 06:00–09:15 · Maks. 06:45',
      ruleSummary:
        'Jam absen 06:00–09:15 WIB. Toleransi tepat waktu maksimal pukul 06:45 WIB (melebihi 06:45 otomatis Terlambat).',
      maxToleranceTime: GERBANG_MAX_TOLERANCE_TIME,
    };
  }

  if (lower.includes('shalat') || lower.includes('sholat')) {
    return {
      category: 'shalat',
      shortBadge: 'Absen 11:45–16:00 · Wajib 2×',
      ruleSummary:
        'Jam absen 11:45–16:00 WIB. Wajib 2× jaga (Dzuhur & Ashar). Jika hanya 1× jaga maka dihitung Terlambat.',
      requiredSessions: [
        { id: 'dzuhur', label: 'Shalat Dzuhur' },
        { id: 'ashar', label: 'Shalat Ashar' },
      ],
    };
  }

  if (lower.includes('warsis') || lower.includes('wasis')) {
    return {
      category: 'warsis',
      shortBadge: 'Absen 09:15–14:15 · Wajib 2×',
      ruleSummary:
        'Jam absen 09:15–14:15 WIB. Wajib 2× jaga: Istirahat Pertama (09:15) & Istirahat Kedua (11:45). Hanya 1× dihitung Terlambat.',
      requiredSessions: [
        { id: 'istirahat1', label: 'Istirahat Pertama', timeLabel: '09:15 WIB' },
        { id: 'istirahat2', label: 'Istirahat Kedua', timeLabel: '11:45 WIB' },
      ],
    };
  }

  return {
    category: 'umum',
    shortBadge: 'Sesuai Jam Shift',
    ruleSummary: 'Hadir tepat waktu sesuai jam absen piket yang ditentukan.',
  };
}

export type AttendanceWindowState = 'before' | 'open' | 'closed';

export interface PosAttendanceWindowStatus {
  isOpen: boolean;
  state: AttendanceWindowState;
  startTime: string;
  endTime: string;
  windowLabel: string;
  message: string;
}

/**
 * Evaluates whether public self-attendance is currently open for a schedule based on its startTime and endTime.
 */
export function getPosAttendanceWindowStatus(
  schedule: Pick<PiketSchedule, 'title' | 'startTime' | 'endTime'>,
  currentTimeHHMM: string,
  isTestingMode = false
): PosAttendanceWindowStatus {
  const hhmm = (currentTimeHHMM || '07:00').slice(0, 5);
  const startTime = (schedule.startTime || '06:00').slice(0, 5);
  const endTime = (schedule.endTime || '16:00').slice(0, 5);
  const windowLabel = `${startTime} – ${endTime} WIB`;

  if (isTestingMode) {
    return {
      isOpen: true,
      state: 'open',
      startTime,
      endTime,
      windowLabel,
      message: `Mode Uji Coba aktif — absensi ${schedule.title} dibuka 24 jam tanpa batasan waktu.`,
    };
  }

  if (hhmm < startTime) {
    return {
      isOpen: false,
      state: 'before',
      startTime,
      endTime,
      windowLabel,
      message: `Absensi ${schedule.title} belum dibuka. Jadwal absen pukul ${windowLabel}.`,
    };
  }

  if (hhmm > endTime) {
    return {
      isOpen: false,
      state: 'closed',
      startTime,
      endTime,
      windowLabel,
      message: `Waktu absensi ${schedule.title} (${windowLabel}) telah berakhir.`,
    };
  }

  return {
    isOpen: true,
    state: 'open',
    startTime,
    endTime,
    windowLabel,
    message: `Absensi dibuka (${windowLabel}).`,
  };
}

export type PublicAttendanceChoice = 'hadir' | 'terlambat' | 'izin' | 'alfa';

export interface PublicAttendanceEvalInput {
  scheduleTitle: string;
  choice: PublicAttendanceChoice;
  currentTimeHHMM: string; // "HH:mm"
  selectedSessions?: string[]; // e.g. ['dzuhur', 'ashar'] or ['istirahat1']
  izinReason?: string;
  ignoreTimeRestrictions?: boolean;
}

export interface PublicAttendanceEvalResult {
  valid: boolean;
  error?: string;
  status: AttendanceStatus;
  checkInTime: string;
  note: string;
  autoDowngradedToLate: boolean;
}

/**
 * Evaluates a public self-attendance submission against pos rules:
 * - Gerbang: Hadir after 06:45 -> Terlambat
 * - Shalat: 2 sessions (Dzuhur + Ashar) required -> 1 session = Terlambat
 * - Warsis: 2 sessions (Istirahat 1 09:15 + Istirahat 2 12:30) required -> 1 session = Terlambat
 * - Izin: requires non-empty keterangan/alasan
 * - Alfa: maps to 'tidak_piket'
 */
export function evaluatePublicAttendanceSubmission(
  input: PublicAttendanceEvalInput
): PublicAttendanceEvalResult {
  const rule = getPosRuleInfo(input.scheduleTitle);
  const hhmm = (input.currentTimeHHMM || '07:00').slice(0, 5);

  if (input.choice === 'izin') {
    const cleanReason = (input.izinReason || '').trim();
    if (!cleanReason) {
      return {
        valid: false,
        error: 'Keterangan / alasan izin wajib diisi.',
        status: 'izin',
        checkInTime: '-',
        note: '',
        autoDowngradedToLate: false,
      };
    }
    return {
      valid: true,
      status: 'izin',
      checkInTime: '-',
      note: cleanReason.slice(0, 400),
      autoDowngradedToLate: false,
    };
  }

  if (input.choice === 'alfa') {
    return {
      valid: true,
      status: 'tidak_piket',
      checkInTime: '-',
      note: 'Alfa (tidak melaksanakan piket)',
      autoDowngradedToLate: false,
    };
  }

  // Multi-session pos (Shalat & Warsis)
  if (rule.requiredSessions && rule.requiredSessions.length > 0) {
    const validIds = new Set(rule.requiredSessions.map((s) => s.id));
    const chosen = Array.from(
      new Set((input.selectedSessions || []).filter((id) => validIds.has(id)))
    );

    if (chosen.length === 0) {
      return {
        valid: false,
        error: `Pilih minimal 1 sesi jaga (${rule.requiredSessions
          .map((s) => s.label)
          .join(' / ')}).`,
        status: 'belum_absen',
        checkInTime: '-',
        note: '',
        autoDowngradedToLate: false,
      };
    }

    const chosenLabels = rule.requiredSessions
      .filter((s) => chosen.includes(s.id))
      .map((s) => (s.timeLabel ? `${s.label} (${s.timeLabel})` : s.label));

    const isComplete = chosen.length >= rule.requiredSessions.length;

    if (!isComplete) {
      return {
        valid: true,
        status: 'terlambat',
        checkInTime: hhmm,
        note: `Baru jaga 1× (${chosenLabels.join(', ')}) — wajib 2×`,
        autoDowngradedToLate: input.choice === 'hadir',
      };
    }

    if (input.choice === 'terlambat') {
      return {
        valid: true,
        status: 'terlambat',
        checkInTime: hhmm,
        note: `Terlambat · Sesi 2× (${chosenLabels.join(' & ')})`,
        autoDowngradedToLate: false,
      };
    }

    return {
      valid: true,
      status: 'hadir',
      checkInTime: hhmm,
      note: `Lengkap 2× (${chosenLabels.join(' & ')})`,
      autoDowngradedToLate: false,
    };
  }

  // Jaga Gerbang tolerance check (max 06:45 WIB; bypassed in Mode Uji Coba)
  if (rule.maxToleranceTime && input.choice === 'hadir') {
    if (!input.ignoreTimeRestrictions && hhmm > rule.maxToleranceTime) {
      return {
        valid: true,
        status: 'terlambat',
        checkInTime: hhmm,
        note: `Melebihi toleransi jaga gerbang ${rule.maxToleranceTime} WIB (absen ${hhmm} WIB)`,
        autoDowngradedToLate: true,
      };
    }
    return {
      valid: true,
      status: 'hadir',
      checkInTime: hhmm,
      note: input.ignoreTimeRestrictions
        ? `Hadir (Mode Uji Coba — absen pukul ${hhmm} WIB)`
        : `Hadir tepat waktu (<= ${rule.maxToleranceTime} WIB)`,
      autoDowngradedToLate: false,
    };
  }

  if (input.choice === 'terlambat') {
    const extraNote = (input.izinReason || '').trim();
    return {
      valid: true,
      status: 'terlambat',
      checkInTime: hhmm,
      note: extraNote || `Terlambat (absen pukul ${hhmm} WIB)`,
      autoDowngradedToLate: false,
    };
  }

  return {
    valid: true,
    status: 'hadir',
    checkInTime: hhmm,
    note: `Hadir (absen pukul ${hhmm} WIB)`,
    autoDowngradedToLate: false,
  };
}

/**
 * Extracts previously checked session IDs (dzuhur/ashar or istirahat1/istirahat2) from an existing attendance note
 * so officers returning to log their 2nd session keep their 1st session pre-checked.
 */
export function parseCompletedSessionsFromNote(
  scheduleTitle: string,
  note?: string
): string[] {
  const rule = getPosRuleInfo(scheduleTitle);
  if (!rule.requiredSessions || !note) return [];
  const lower = note.toLowerCase();
  const matched: string[] = [];

  if (rule.category === 'shalat') {
    if (lower.includes('dzuhur') || lower.includes('duhur')) {
      matched.push('dzuhur');
    }
    if (lower.includes('ashar') || lower.includes('asar')) {
      matched.push('ashar');
    }
  } else if (rule.category === 'warsis') {
    if (
      lower.includes('pertama') ||
      lower.includes('09:15') ||
      lower.includes('istirahat 1')
    ) {
      matched.push('istirahat1');
    }
    if (
      lower.includes('kedua') ||
      lower.includes('11:45') ||
      lower.includes('12:30') ||
      lower.includes('istirahat 2')
    ) {
      matched.push('istirahat2');
    }
  }

  return matched;
}

export const PUBLIC_SELF_ATTENDANCE_RECORDER = 'Absen Publik';

export function isPublicSelfAttendance(
  record: AttendanceRecord | null
): boolean {
  if (!record) return false;
  return record.recordedBy.toLowerCase().startsWith('absen publik');
}

export function isAttendanceVerifiedByAdmin(
  record: AttendanceRecord | null
): boolean {
  if (!record) return false;
  return !isPublicSelfAttendance(record);
}

export const LIE_REASON_PRESETS: string[] = [
  'tidak ada di lokasi piket',
  'datang melewati batas waktu piket',
  'hanya jaga 1× sesi padahal isi hadir',
  'tidak melaksanakan tugas piket',
  'alasan izin tidak sesuai kenyataan',
];

export interface ParsedLieAttendanceInfo {
  isLie: boolean;
  lieReason: string;
  selfClaim: string;
  headline: string;
}

/**
 * Formats what the officer originally submitted themselves (for small sub-caption when admin marks "Dia bohong").
 */
export function formatSelfAttendanceClaim(
  record: AttendanceRecord | null
): string {
  if (!record || record.status === 'belum_absen') return '';
  // If already a lie record, preserve its previously captured selfClaim
  const parsed = parseLieAttendanceRecord(record);
  if (parsed.isLie && parsed.selfClaim) {
    return parsed.selfClaim;
  }

  const label = STATUS_LABELS_ID[record.status];
  if (record.status === 'izin' || record.status === 'sakit') {
    const cleanNote = (record.note || '').trim();
    return cleanNote ? `${label} — ${cleanNote.slice(0, 120)}` : label;
  }
  if (record.checkInTime && record.checkInTime !== '-') {
    return `${label} (${record.checkInTime} WIB)`;
  }
  return label;
}

/**
 * Builds the structured human-readable note stored in Firestore when Admin flags a dishonest self-attendance:
 * Format: "Dia bohong <alasan> [Absen sendiri: <klaim_sendiri>]"
 */
export function buildLieAttendanceNote(
  lieReason: string,
  selfClaim?: string
): string {
  const cleanReason =
    (lieReason || '')
      .trim()
      .replace(/^dia\s+bohong\s*[:\-–—]?\s*/i, '') ||
    'tidak sesuai fakta piket di lapangan';
  const cleanClaim = (selfClaim || '').trim();
  const full = cleanClaim
    ? `Dia bohong ${cleanReason} [Absen sendiri: ${cleanClaim}]`
    : `Dia bohong ${cleanReason}`;
  return full.slice(0, 500);
}

/**
 * Parses an AttendanceRecord to extract structured "Dia bohong <alasan>" & small self-claim sub-caption.
 * Backward-compatible with legacy "Absensi Palsu" records.
 */
export function parseLieAttendanceRecord(
  record: AttendanceRecord | null
): ParsedLieAttendanceInfo {
  if (!record || !record.note) {
    return { isLie: false, lieReason: '', selfClaim: '', headline: '' };
  }
  const raw = record.note.trim();

  // New structured format: "Dia bohong <alasan> [Absen sendiri: <klaim>]"
  const newMatch = raw.match(
    /^dia\s+bohong\s+(.+?)(?:\s*\[absen sendiri:\s*(.+?)\])?$/i
  );
  if (newMatch) {
    const reason = (newMatch[1] || '').trim();
    const selfClaim = (newMatch[2] || '').trim();
    return {
      isLie: true,
      lieReason: reason,
      selfClaim,
      headline: `Dia bohong ${reason}`,
    };
  }

  // Legacy fallback: "... (Absensi Palsu — klaim Hadir): alasan"
  if (raw.toLowerCase().includes('absensi palsu')) {
    const claimMatch = raw.match(/klaim\s+([^)\]]+)/i);
    const reasonSplit = raw.split('):');
    const legacyReason =
      reasonSplit.length > 1 && reasonSplit[1].trim()
        ? reasonSplit[1].trim()
        : 'tidak sesuai kehadiran di lokasi piket';
    const selfClaim = claimMatch ? claimMatch[1].trim() : '';
    return {
      isLie: true,
      lieReason: legacyReason,
      selfClaim,
      headline: `Dia bohong ${legacyReason}`,
    };
  }

  return { isLie: false, lieReason: '', selfClaim: '', headline: '' };
}

export function isFakeAttendanceRecord(
  record: AttendanceRecord | null
): boolean {
  return parseLieAttendanceRecord(record).isLie;
}

export function formatAdminVerifierName(displayName?: string): string {
  const clean = (displayName || 'Admin OSIS').trim();
  return `Verifikasi Admin: ${clean}`.slice(0, 120);
}

/**
 * Builds a clear Indonesian verification/correction note for admin actions,
 * including "Dia bohong <alasan>" with preserved self-attendance claim.
 */
export function buildAdminVerificationNote(
  newStatus: AttendanceStatus,
  previousStatus: AttendanceStatus,
  isFakeAttendance: boolean,
  customNote?: string,
  selfClaimOverride?: string
): string {
  const trimmedCustom = (customNote || '').trim();

  if (isFakeAttendance) {
    const fallbackReason =
      newStatus === 'tidak_piket'
        ? 'tidak melaksanakan piket di lokasi'
        : newStatus === 'terlambat'
        ? 'datang terlambat dari jam piket'
        : 'absensi tidak sesuai fakta di lapangan';
    const effectiveClaim =
      (selfClaimOverride || '').trim() ||
      (previousStatus !== 'belum_absen' ? STATUS_LABELS_ID[previousStatus] : '');
    return buildLieAttendanceNote(
      trimmedCustom || fallbackReason,
      effectiveClaim
    );
  }

  if (trimmedCustom) {
    return trimmedCustom;
  }

  if (newStatus === 'hadir') return 'Terverifikasi hadir';
  if (newStatus === 'terlambat') return 'Terverifikasi terlambat';
  if (newStatus === 'tidak_piket') return 'Alfa (tidak piket)';
  return '';
}

// =========================================================================
// PER-CATEGORY DATE-RANGE HOLIDAY RULES ("Libur Piket")
// Stored inside Firestore `attendance` collection within strict schema rules
// =========================================================================
export const HOLIDAY_RANGE_MEMBER_ID = '__HOLIDAY_RANGE__';
export const HOLIDAY_CATEGORY_PREFIX = '__HOLIDAY_CAT__:';

export type HolidayCategory = 'all' | 'gerbang' | 'warsis' | 'shalat';

export const HOLIDAY_CATEGORY_LABELS: Record<HolidayCategory, string> = {
  all: 'Semua Kategori Piket',
  gerbang: 'Jaga Gerbang',
  warsis: 'Piket Warsis',
  shalat: 'Absensi Shalat',
};

export interface HolidayRangeRule {
  id: string;
  category: HolidayCategory;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  recordedBy: string;
}

/**
 * Builds a valid Firestore AttendanceRecord payload representing a category-scoped holiday date range.
 */
export function createHolidayRangeRecord(
  category: HolidayCategory,
  startDate: string,
  endDate: string,
  reason: string,
  recordedBy: string,
  customId?: string
): AttendanceRecord {
  const cleanStart = startDate.slice(0, 10);
  const cleanEnd = endDate >= cleanStart ? endDate.slice(0, 10) : cleanStart;
  const suffix = String(Date.now()).slice(-6);
  const id = (
    customId || `holiday-${category}-${cleanStart}-${cleanEnd}-${suffix}`
  ).slice(0, 120);

  return {
    id,
    date: cleanStart,
    scheduleId: `${HOLIDAY_CATEGORY_PREFIX}${category}`,
    memberId: HOLIDAY_RANGE_MEMBER_ID,
    status: 'izin',
    checkInTime: cleanEnd,
    note: reason.trim().slice(0, 500),
    recordedBy: (recordedBy || 'Verifikasi Admin: Admin OSIS').slice(0, 120),
  };
}

/**
 * Extracts all saved HolidayRangeRule records from attendanceRecords, sorted by startDate ascending.
 */
export function getHolidayRangeRules(
  attendanceRecords: AttendanceRecord[]
): HolidayRangeRule[] {
  const rules: HolidayRangeRule[] = [];
  for (const r of attendanceRecords) {
    if (
      r.memberId !== HOLIDAY_RANGE_MEMBER_ID ||
      !r.scheduleId.startsWith(HOLIDAY_CATEGORY_PREFIX)
    ) {
      continue;
    }
    const rawCat = r.scheduleId.slice(HOLIDAY_CATEGORY_PREFIX.length);
    const category: HolidayCategory =
      rawCat === 'gerbang' || rawCat === 'warsis' || rawCat === 'shalat'
        ? rawCat
        : 'all';
    const startDate = r.date.slice(0, 10);
    const endDate =
      r.checkInTime && /^\d{4}-\d{2}-\d{2}$/.test(r.checkInTime)
        ? r.checkInTime
        : startDate;
    if (!r.note || !r.note.trim()) continue;
    rules.push({
      id: r.id,
      category,
      startDate,
      endDate,
      reason: r.note.trim(),
      recordedBy: r.recordedBy,
    });
  }

  return rules.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      a.endDate.localeCompare(b.endDate) ||
      a.category.localeCompare(b.category)
  );
}

/**
 * Returns all HolidayRangeRules active on `dateStr` (where startDate <= dateStr <= endDate).
 */
export function getActiveHolidaysForDate(
  dateStr: string,
  attendanceRecords: AttendanceRecord[]
): HolidayRangeRule[] {
  return getHolidayRangeRules(attendanceRecords).filter(
    (h) => dateStr >= h.startDate && dateStr <= h.endDate
  );
}

/**
 * Checks whether a specific schedule (by title) is on holiday on `dateStr`.
 * Matches category-specific holiday ranges, 'all' holiday ranges, or legacy single-day holiday notes.
 */
export function getHolidayForScheduleOnDate(
  dateStr: string,
  scheduleTitle: string,
  attendanceRecords: AttendanceRecord[]
): HolidayRangeRule | null {
  const posCat = getPosRuleInfo(scheduleTitle).category;
  const activeOnDate = getActiveHolidaysForDate(dateStr, attendanceRecords);

  // Prefer category-specific match first, then 'all'
  const specific = activeOnDate.find((h) => h.category === posCat);
  if (specific) return specific;

  const allMatch = activeOnDate.find((h) => h.category === 'all');
  if (allMatch) return allMatch;

  // Backward compatibility with legacy single-day DAY_NOTE_SCHEDULE_ID holiday
  const legacyDayNote = getDayAttendanceNote(
    dateStr,
    attendanceRecords,
    DAY_NOTE_SCHEDULE_ID
  );
  if (legacyDayNote && legacyDayNote.isHoliday) {
    return {
      id: legacyDayNote.id,
      category: 'all',
      startDate: dateStr,
      endDate: dateStr,
      reason: legacyDayNote.note,
      recordedBy: legacyDayNote.recordedBy,
    };
  }

  return null;
}

/**
 * Formats a YYYY-MM-DD date range concisely in Indonesian, e.g. "19 – 22 Nov 2026" or "19 Nov 2026".
 */
export function formatShortDateRangeId(
  startDate: string,
  endDate: string
): string {
  const monthsShort = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  const s = parseDateString(startDate);
  const e = parseDateString(endDate);
  const sDay = s.getDate();
  const sMon = monthsShort[s.getMonth()];
  const sYear = s.getFullYear();

  if (startDate === endDate) {
    return `${sDay} ${sMon} ${sYear}`;
  }

  const eDay = e.getDate();
  const eMon = monthsShort[e.getMonth()];
  const eYear = e.getFullYear();

  if (sYear === eYear && s.getMonth() === e.getMonth()) {
    return `${sDay} – ${eDay} ${sMon} ${sYear}`;
  }
  if (sYear === eYear) {
    return `${sDay} ${sMon} – ${eDay} ${eMon} ${sYear}`;
  }
  return `${sDay} ${sMon} ${sYear} – ${eDay} ${eMon} ${eYear}`;
}

// =========================================================================
// VIOLATION LEADERBOARD ("Leaderboard Pelanggaran")
// Alfa = 2 poin · Terlambat = 1 poin · Reset Mingguan (Senin) & Bulanan (Tgl 1)
// =========================================================================
export const VIOLATION_POINTS_ALFA = 2;
export const VIOLATION_POINTS_TERLAMBAT = 1;

export type ViolationLeaderboardPeriod = 'mingguan' | 'bulanan';

export interface ViolationLeaderboardEntry {
  rank: number;
  member: OsisMember;
  alfaCount: number;
  autoAlfaCount: number;
  terlambatCount: number;
  points: number;
}

export interface ViolationLeaderboardResult {
  periodType: ViolationLeaderboardPeriod;
  startDate: string;
  endDate: string;
  periodLabel: string;
  resetNote: string;
  totalViolators: number;
  totalPoints: number;
  entries: ViolationLeaderboardEntry[];
}

/**
 * Calculates the Violation Leaderboard for the active weekly (Mon–Sun, resets every Monday)
 * or monthly (1st–last day, resets every 1st of month) period.
 * Scoring: Alfa = 2 points (including automatic Alfa for missed shifts), Terlambat = 1 point.
 */
export function calculateViolationLeaderboard(
  periodType: ViolationLeaderboardPeriod,
  referenceDateStr: string,
  schedules: PiketSchedule[],
  members: OsisMember[],
  swaps: ScheduleSwap[],
  attendanceRecords: AttendanceRecord[],
  autoAlfaContext: AutoAlfaContext
): ViolationLeaderboardResult {
  const range =
    periodType === 'mingguan'
      ? getWeekRange(referenceDateStr)
      : getMonthRange(referenceDateStr.slice(0, 7));

  // Only evaluate up to todayStr in normal mode so future dates never generate violations;
  // in Mode Uji Coba, allow explicit violations recorded on any date in the active period.
  const effectiveEndDate =
    !autoAlfaContext.isTestingMode && range.endDate > autoAlfaContext.todayStr
      ? autoAlfaContext.todayStr
      : range.endDate;

  const dates =
    range.startDate <= effectiveEndDate
      ? getDateRangeStrings(range.startDate, effectiveEndDate)
      : [];

  const memberMap = new Map<string, OsisMember>();
  for (const m of members) memberMap.set(m.id, m);

  const counts = new Map<
    string,
    { alfaCount: number; autoAlfaCount: number; terlambatCount: number }
  >();

  for (const d of dates) {
    const resolvedList = resolveSchedulesForDate(
      d,
      schedules,
      members,
      swaps,
      attendanceRecords,
      autoAlfaContext
    );

    for (const res of resolvedList) {
      if (
        getHolidayForScheduleOnDate(d, res.schedule.title, attendanceRecords)
      ) {
        continue;
      }

      for (const dm of res.dutyMembers) {
        if (
          dm.effectiveStatus !== 'tidak_piket' &&
          dm.effectiveStatus !== 'terlambat'
        ) {
          continue;
        }
        const curr = counts.get(dm.member.id) || {
          alfaCount: 0,
          autoAlfaCount: 0,
          terlambatCount: 0,
        };
        if (dm.effectiveStatus === 'tidak_piket') {
          curr.alfaCount += 1;
          if (dm.isAutoAlfa) curr.autoAlfaCount += 1;
        } else if (dm.effectiveStatus === 'terlambat') {
          curr.terlambatCount += 1;
        }
        counts.set(dm.member.id, curr);
      }
    }
  }

  const rawEntries: Omit<ViolationLeaderboardEntry, 'rank'>[] = [];
  for (const [memberId, st] of counts.entries()) {
    const member = memberMap.get(memberId);
    if (!member) continue;
    const points =
      st.alfaCount * VIOLATION_POINTS_ALFA +
      st.terlambatCount * VIOLATION_POINTS_TERLAMBAT;
    if (points <= 0) continue;
    rawEntries.push({
      member,
      alfaCount: st.alfaCount,
      autoAlfaCount: st.autoAlfaCount,
      terlambatCount: st.terlambatCount,
      points,
    });
  }

  rawEntries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.alfaCount !== a.alfaCount) return b.alfaCount - a.alfaCount;
    if (b.terlambatCount !== a.terlambatCount) {
      return b.terlambatCount - a.terlambatCount;
    }
    return a.member.name.localeCompare(b.member.name, 'id');
  });

  const entries: ViolationLeaderboardEntry[] = rawEntries.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);

  return {
    periodType,
    startDate: range.startDate,
    endDate: range.endDate,
    periodLabel: formatShortDateRangeId(range.startDate, range.endDate),
    resetNote:
      periodType === 'mingguan'
        ? 'Reset otomatis setiap hari Senin'
        : 'Reset otomatis setiap tanggal 1',
    totalViolators: entries.length,
    totalPoints,
    entries,
  };
}

// =========================================================================
// APP FEATURE SETTINGS (Persisted in Firestore `attendance` collection)
// =========================================================================
export const APP_SETTING_SCHEDULE_ID = '__APP_SETTING__';
export const LEADERBOARD_SETTING_MEMBER_ID = '__LEADERBOARD_ENABLED__';
export const LEADERBOARD_SETTING_RECORD_ID = 'setting-leaderboard-enabled';
export const TESTING_MODE_MEMBER_ID = '__TESTING_MODE_ENABLED__';
export const TESTING_MODE_RECORD_ID = 'setting-testing-mode-enabled';
export const VIOLATION_RESET_MEMBER_ID = '__VIOLATION_RESET_CUTOFF__';
export const VIOLATION_RESET_RECORD_ID = 'setting-violation-reset-cutoff';

/**
 * Identifies internal metadata documents stored in the `attendance` collection
 * (day notes, holiday range rules, app settings) so they are excluded from member logs.
 */
export function isSystemMetadataAttendanceRecord(
  record: AttendanceRecord
): boolean {
  return (
    record.memberId === DAY_NOTE_MEMBER_ID ||
    record.memberId === HOLIDAY_RANGE_MEMBER_ID ||
    record.memberId === LEADERBOARD_SETTING_MEMBER_ID ||
    record.memberId === TESTING_MODE_MEMBER_ID ||
    record.memberId === VIOLATION_RESET_MEMBER_ID ||
    record.scheduleId === APP_SETTING_SCHEDULE_ID ||
    record.scheduleId === DAY_NOTE_SCHEDULE_ID ||
    record.scheduleId.startsWith(HOLIDAY_CATEGORY_PREFIX)
  );
}

/**
 * Returns whether an AttendanceRecord represents a disciplinary violation
 * (Alfa / tidak_piket, Terlambat, or flagged "Dia bohong").
 */
export function isViolationAttendanceRecord(
  record: AttendanceRecord | null
): boolean {
  if (!record || isSystemMetadataAttendanceRecord(record)) return false;
  return (
    record.status === 'tidak_piket' ||
    record.status === 'terlambat' ||
    isFakeAttendanceRecord(record)
  );
}

/**
 * Only the Developer role is permitted to delete or reset violation data.
 * Regular Admin accounts and public officers (petugas) cannot delete violation records.
 */
export function canDeleteViolationData(
  account: AppAccount | null | undefined
): boolean {
  return Boolean(account && account.role === 'developer');
}

/**
 * Checks whether a public user (petugas) may overwrite an existing attendance record.
 * Blocks erasing/changing existing violation records (except legitimate 1x -> 2x completion
 * for unverified Warsis / Shalat multi-session check-ins).
 */
export function canPublicEditAttendanceRecord(
  existing: AttendanceRecord | null,
  scheduleTitle: string
): { allowed: boolean; reason?: string } {
  if (!existing) return { allowed: true };

  if (isAttendanceVerifiedByAdmin(existing)) {
    return {
      allowed: false,
      reason:
        'Status absensi sudah diverifikasi oleh Admin dan tidak dapat diubah secara publik.',
    };
  }

  if (isViolationAttendanceRecord(existing)) {
    const posRule = getPosRuleInfo(scheduleTitle);
    const isPendingSecondSession =
      Boolean(posRule.requiredSessions && posRule.requiredSessions.length >= 2) &&
      existing.status === 'terlambat' &&
      !isFakeAttendanceRecord(existing) &&
      existing.note.toLowerCase().includes('baru jaga 1×');

    if (isPendingSecondSession) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason:
        'Data pelanggaran (Terlambat / Alfa) dikunci demi keamanan dan tidak dapat dihapus atau diubah oleh petugas.',
    };
  }

  return { allowed: true };
}

/**
 * Checks whether an authenticated Admin/Developer account can modify an existing record
 * to `targetStatus` / `targetIsFake`.
 * - Developer: full access.
 * - Admin: may confirm/verify or escalate a violation (e.g. Terlambat -> Alfa / Dia Bohong),
 *   but CANNOT downgrade/erase an existing violation into Hadir, Izin, Sakit, or Belum Absen.
 */
export function canAccountModifyViolationRecord(
  account: AppAccount | null | undefined,
  existing: AttendanceRecord | null,
  targetStatus: AttendanceStatus,
  targetIsFake = false
): { allowed: boolean; reason?: string } {
  if (canDeleteViolationData(account)) {
    return { allowed: true };
  }

  if (existing && isViolationAttendanceRecord(existing)) {
    const targetRemainsViolation =
      targetStatus === 'tidak_piket' ||
      targetStatus === 'terlambat' ||
      targetIsFake;

    if (!targetRemainsViolation) {
      return {
        allowed: false,
        reason:
          'Data pelanggaran dilindungi. Admin tidak dapat menghapus atau mengubah pelanggaran menjadi Hadir/Izin (khusus Developer).',
      };
    }
  }

  return { allowed: true };
}

/**
 * Returns IDs of all explicit member violation records stored in `attendanceRecords`.
 */
export function getViolationRecordIdsToClear(
  attendanceRecords: AttendanceRecord[]
): string[] {
  return attendanceRecords
    .filter((r) => isViolationAttendanceRecord(r))
    .map((r) => r.id);
}

export interface ViolationResetCutoff {
  resetDate: string; // YYYY-MM-DD
  resetTimeHHMM: string; // HH:mm
  recordedBy: string;
}

/**
 * Reads the persisted Developer Violation Database Reset cutoff (if any).
 */
export function getViolationResetCutoff(
  attendanceRecords: AttendanceRecord[]
): ViolationResetCutoff | null {
  const setting = attendanceRecords.find(
    (r) =>
      r.id === VIOLATION_RESET_RECORD_ID ||
      (r.scheduleId === APP_SETTING_SCHEDULE_ID &&
        r.memberId === VIOLATION_RESET_MEMBER_ID)
  );
  if (!setting || !/^\d{4}-\d{2}-\d{2}$/.test(setting.date)) {
    return null;
  }
  const timeMatch = /^\d{2}:\d{2}$/.test(setting.checkInTime)
    ? setting.checkInTime
    : '23:59';
  return {
    resetDate: setting.date,
    resetTimeHHMM: timeMatch,
    recordedBy: setting.recordedBy,
  };
}

/**
 * Builds a valid Firestore AttendanceRecord storing the Developer Violation Reset cutoff timestamp.
 */
export function createViolationResetCutoffRecord(
  resetDate: string,
  resetTimeHHMM: string,
  recordedBy: string
): AttendanceRecord {
  const cleanDate = resetDate.slice(0, 10);
  const cleanTime = /^\d{2}:\d{2}$/.test(resetTimeHHMM.slice(0, 5))
    ? resetTimeHHMM.slice(0, 5)
    : '23:59';
  return {
    id: VIOLATION_RESET_RECORD_ID,
    date: cleanDate,
    scheduleId: APP_SETTING_SCHEDULE_ID,
    memberId: VIOLATION_RESET_MEMBER_ID,
    status: 'hadir',
    checkInTime: cleanTime,
    note: `Reset database pelanggaran pada ${cleanDate} ${cleanTime} WIB`,
    recordedBy: (recordedBy || 'Verifikasi Admin: Developer Utama').slice(0, 120),
  };
}

/**
 * Returns whether the public Violation Leaderboard feature is currently enabled.
 * Defaults to `true` when no explicit setting document exists yet.
 */
export function isLeaderboardFeatureEnabled(
  attendanceRecords: AttendanceRecord[]
): boolean {
  const setting = attendanceRecords.find(
    (r) =>
      r.id === LEADERBOARD_SETTING_RECORD_ID ||
      (r.scheduleId === APP_SETTING_SCHEDULE_ID &&
        r.memberId === LEADERBOARD_SETTING_MEMBER_ID)
  );
  if (!setting) return true;
  if (setting.note.trim().toLowerCase() === 'false') return false;
  if (setting.note.trim().toLowerCase() === 'true') return true;
  return setting.status !== 'tidak_piket';
}

/**
 * Builds a valid Firestore AttendanceRecord payload representing the Leaderboard enabled/disabled toggle.
 */
export function createLeaderboardSettingRecord(
  enabled: boolean,
  recordedBy: string
): AttendanceRecord {
  return {
    id: LEADERBOARD_SETTING_RECORD_ID,
    date: '2000-01-01',
    scheduleId: APP_SETTING_SCHEDULE_ID,
    memberId: LEADERBOARD_SETTING_MEMBER_ID,
    status: enabled ? 'hadir' : 'tidak_piket',
    checkInTime: '-',
    note: enabled ? 'true' : 'false',
    recordedBy: (recordedBy || 'Verifikasi Admin: Admin OSIS').slice(0, 120),
  };
}

/**
 * Returns whether "Mode Uji Coba" (no time/date restrictions) is currently enabled.
 * Defaults to `false` (normal strict time rules active).
 */
export function isTestingModeEnabled(
  attendanceRecords: AttendanceRecord[]
): boolean {
  const setting = attendanceRecords.find(
    (r) =>
      r.id === TESTING_MODE_RECORD_ID ||
      (r.scheduleId === APP_SETTING_SCHEDULE_ID &&
        r.memberId === TESTING_MODE_MEMBER_ID)
  );
  if (!setting) return false;
  return setting.note.trim().toLowerCase() === 'true';
}

/**
 * Builds a valid Firestore AttendanceRecord payload representing the Mode Uji Coba toggle.
 */
export function createTestingModeSettingRecord(
  enabled: boolean,
  recordedBy: string
): AttendanceRecord {
  return {
    id: TESTING_MODE_RECORD_ID,
    date: '2000-01-01',
    scheduleId: APP_SETTING_SCHEDULE_ID,
    memberId: TESTING_MODE_MEMBER_ID,
    status: enabled ? 'hadir' : 'izin',
    checkInTime: '-',
    note: enabled ? 'true' : 'false',
    recordedBy: (recordedBy || 'Verifikasi Admin: Admin OSIS').slice(0, 120),
  };
}





