import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  calculatePeriodRecap,
  findDateForWeekAndDay,
  formatWeekCycleLabel,
  getBaseMemberIdsForScheduleOnDate,
  getMonthRange,
  getWeekOfMonth,
  getWeekRange,
  replaceMemberInSchedule,
  resolveSchedulesForDate,
  type AttendanceRecord,
  type OsisMember,
  type PiketSchedule,
  type ScheduleSwap,
} from './piketLogic';

const sampleMembers: OsisMember[] = [
  {
    id: 'm1',
    name: 'Nabila Putri',
    kelas: 'XI MIPA 1',
    jabatan: 'BPH - Sekretaris Umum',
    phone: '081234567801',
    active: true,
  },
  {
    id: 'm2',
    name: 'Dimas Aditya',
    kelas: 'XI IPS 2',
    jabatan: 'Sekbid 5 - Kepemimpinan',
    phone: '081234567802',
    active: true,
  },
  {
    id: 'm3',
    name: 'Fajar Nugroho',
    kelas: 'X MIPA 3',
    jabatan: 'Sekbid 3 - Bela Negara',
    phone: '081234567803',
    active: true,
  },
];

const weeklySchedule: PiketSchedule = {
  id: 'sch-weekly',
  title: 'Piket Sekretariat OSIS',
  description: 'Jaga kebersihan dan administrasi ruang OSIS',
  location: 'Ruang Sekretariat OSIS',
  startTime: '06:30',
  endTime: '07:15',
  mode: 'mingguan',
  tasks: ['Menyapu ruang OSIS', 'Mencatat surat masuk'],
  activeDays: [1, 2, 3, 4, 5],
  dailyMembers: [],
  weeklyAssignments: {
    1: ['m1'],
    2: ['m2'],
    3: ['m1', 'm2'], // Rabu (2026-11-11 is Wednesday)
    4: ['m3'],
    5: ['m1', 'm3'],
  },
  customDates: [],
  customDateAssignments: {},
};

const dailySchedule: PiketSchedule = {
  id: 'sch-daily',
  title: 'Piket Gerbang & Ketertiban Pagi',
  description: 'Pemeriksaan atribut dan kerapihan siswa di gerbang utama',
  location: 'Gerbang Utama Sekolah',
  startTime: '06:15',
  endTime: '07:00',
  mode: 'harian',
  tasks: ['Cek atribut dasi & topi', 'Sambut siswa pagi'],
  activeDays: [1, 2, 3, 4, 5],
  dailyMembers: ['m3'],
  weeklyAssignments: {},
  customDates: [],
  customDateAssignments: {},
};

const customSchedule: PiketSchedule = {
  id: 'sch-custom',
  title: 'Piket Persiapan Classmeeting',
  description: 'Piket khusus logistik perlombaan',
  location: 'Aula Utama',
  startTime: '14:00',
  endTime: '15:30',
  mode: 'custom',
  tasks: ['Cek sound system', 'Siapkan meja registrasi'],
  activeDays: [],
  dailyMembers: ['m2'],
  weeklyAssignments: {},
  customDates: ['2026-11-11', '2026-11-12'],
  customDateAssignments: {
    '2026-11-11': ['m2', 'm3'],
    '2026-11-12': ['m1'],
  },
};

test('resolves multiple schedules on a single day (harian, mingguan, custom)', () => {
  // 2026-11-11 is Wednesday (dayOfWeek = 3)
  const resolved = resolveSchedulesForDate(
    '2026-11-11',
    [weeklySchedule, dailySchedule, customSchedule],
    sampleMembers,
    [],
    []
  );

  assert.equal(resolved.length, 3);
  // Sorted by startTime: 06:15 (daily), 06:30 (weekly), 14:00 (custom)
  assert.equal(resolved[0].schedule.id, 'sch-daily');
  assert.equal(resolved[1].schedule.id, 'sch-weekly');
  assert.equal(resolved[2].schedule.id, 'sch-custom');

  assert.equal(resolved[1].dutyMembers.length, 2);
  assert.equal(resolved[1].dutyMembers[0].member.id, 'm1');
  assert.equal(resolved[1].dutyMembers[1].member.id, 'm2');
});

test('checks next day schedule accurately via addDays', () => {
  const nextDate = addDays('2026-11-11', 1);
  assert.equal(nextDate, '2026-11-12'); // Thursday (dayOfWeek = 4)

  const baseWeekly = getBaseMemberIdsForScheduleOnDate(weeklySchedule, nextDate);
  assert.equal(baseWeekly.isActive, true);
  assert.deepEqual(baseWeekly.memberIds, ['m3']);

  const baseCustom = getBaseMemberIdsForScheduleOnDate(customSchedule, nextDate);
  assert.equal(baseCustom.isActive, true);
  assert.deepEqual(baseCustom.memberIds, ['m1']);
});

test('applies temporary schedule swap and attaches attendance status', () => {
  const swaps: ScheduleSwap[] = [
    {
      id: 'sw-1',
      date: '2026-11-11',
      scheduleId: 'sch-weekly',
      originalMemberId: 'm1',
      replacementMemberId: 'm3',
      reason: 'Izin rapat komite sekolah',
      createdAt: '2026-11-11T06:00:00Z',
    },
  ];

  const attendance: AttendanceRecord[] = [
    {
      id: 'att-1',
      date: '2026-11-11',
      scheduleId: 'sch-weekly',
      memberId: 'm3',
      status: 'hadir',
      checkInTime: '06:25',
      note: 'Hadir menggantikan Nabila',
      recordedBy: 'Admin OSIS',
    },
    {
      id: 'att-2',
      date: '2026-11-11',
      scheduleId: 'sch-weekly',
      memberId: 'm2',
      status: 'izin',
      checkInTime: '-',
      note: 'Dispensasi lomba basket',
      recordedBy: 'Admin OSIS',
    },
  ];

  const resolved = resolveSchedulesForDate(
    '2026-11-11',
    [weeklySchedule],
    sampleMembers,
    swaps,
    attendance
  );

  assert.equal(resolved.length, 1);
  const duty = resolved[0].dutyMembers;
  assert.equal(duty[0].member.id, 'm3');
  assert.equal(duty[0].isSwapped, true);
  assert.equal(duty[0].swappedFromMember?.id, 'm1');
  assert.equal(duty[0].effectiveStatus, 'hadir');
  assert.equal(duty[1].member.id, 'm2');
  assert.equal(duty[1].effectiveStatus, 'izin');
});

test('permanently replaces member in schedule', () => {
  const updated = replaceMemberInSchedule(weeklySchedule, 3, 'm2', 'm3');
  assert.deepEqual(updated.weeklyAssignments[3], ['m1', 'm3']);
});

test('calculates weekly and monthly attendance recaps accurately', () => {
  const weekRange = getWeekRange('2026-11-11');
  assert.equal(weekRange.startDate, '2026-11-09');
  assert.equal(weekRange.endDate, '2026-11-15');

  const monthRange = getMonthRange('2026-11');
  assert.equal(monthRange.startDate, '2026-11-01');
  assert.equal(monthRange.endDate, '2026-11-30');

  const records: AttendanceRecord[] = [
    {
      id: 'r1',
      date: '2026-11-09',
      scheduleId: 'sch-weekly',
      memberId: 'm1',
      status: 'hadir',
      checkInTime: '06:28',
      note: '',
      recordedBy: 'BPH',
    },
    {
      id: 'r2',
      date: '2026-11-11',
      scheduleId: 'sch-weekly',
      memberId: 'm1',
      status: 'hadir',
      checkInTime: '06:24',
      note: '',
      recordedBy: 'BPH',
    },
    {
      id: 'r3',
      date: '2026-11-11',
      scheduleId: 'sch-weekly',
      memberId: 'm2',
      status: 'tidak_piket',
      checkInTime: '-',
      note: 'Tanpa keterangan',
      recordedBy: 'BPH',
    },
  ];

  const recap = calculatePeriodRecap(
    '2026-11-09',
    '2026-11-13',
    [weeklySchedule],
    sampleMembers,
    [],
    records
  );

  assert.equal(recap.totalHadir, 2);
  assert.equal(recap.totalTidakPiket, 1);

  const m1Row = recap.memberRows.find((r) => r.member.id === 'm1');
  assert.ok(m1Row);
  assert.equal(m1Row.hadir, 2);
  assert.equal(m1Row.attendanceRate, 100);
});

test('resolves schedules with same day of week but different week cycle (Minggu 1 - Minggu 4)', () => {
  assert.equal(getWeekOfMonth('2026-11-04'), 1); // Minggu 1 (Rabu)
  assert.equal(getWeekOfMonth('2026-11-11'), 2); // Minggu 2 (Rabu)
  assert.equal(getWeekOfMonth('2026-11-18'), 3); // Minggu 3 (Rabu)
  assert.equal(getWeekOfMonth('2026-11-25'), 4); // Minggu 4 (Rabu)

  assert.equal(formatWeekCycleLabel([1, 2, 3, 4]), 'Setiap Minggu');
  assert.equal(formatWeekCycleLabel([1, 3]), 'Minggu 1, 3');
  assert.equal(formatWeekCycleLabel([2]), 'Minggu 2');

  const wednesdayWeek1And3: PiketSchedule = {
    ...weeklySchedule,
    id: 'sch-wed-1-3',
    title: 'Piket Sekretariat Regu A (Minggu 1 & 3)',
    activeWeeks: [1, 3],
    weeklyAssignments: { 3: ['m1'] },
  };

  const wednesdayWeek2And4: PiketSchedule = {
    ...weeklySchedule,
    id: 'sch-wed-2-4',
    title: 'Piket Sekretariat Regu B (Minggu 2 & 4)',
    activeWeeks: [2, 4],
    weeklyAssignments: { 3: ['m2'] },
  };

  // On 2026-11-11 (Wednesday, Minggu 2), only Regu B (Minggu 2 & 4) runs
  const resolvedWeek2 = resolveSchedulesForDate(
    '2026-11-11',
    [wednesdayWeek1And3, wednesdayWeek2And4],
    sampleMembers,
    [],
    []
  );
  assert.equal(resolvedWeek2.length, 1);
  assert.equal(resolvedWeek2[0].schedule.id, 'sch-wed-2-4');
  assert.equal(resolvedWeek2[0].dutyMembers[0].member.id, 'm2');

  // On 2026-11-18 (Wednesday, Minggu 3), only Regu A (Minggu 1 & 3) runs
  const resolvedWeek3 = resolveSchedulesForDate(
    '2026-11-18',
    [wednesdayWeek1And3, wednesdayWeek2And4],
    sampleMembers,
    [],
    []
  );
  assert.equal(resolvedWeek3.length, 1);
  assert.equal(resolvedWeek3[0].schedule.id, 'sch-wed-1-3');
  assert.equal(resolvedWeek3[0].dutyMembers[0].member.id, 'm1');
});

test('findDateForWeekAndDay accurately maps Minggu 1-4 and Hari Senin-Jumat', () => {
  // November 2026:
  // Minggu 1 (Nov 1-7): Senin = Nov 2, Rabu = Nov 4, Jumat = Nov 6
  assert.equal(findDateForWeekAndDay('2026-11-11', 1, 1), '2026-11-02');
  assert.equal(findDateForWeekAndDay('2026-11-11', 1, 3), '2026-11-04');
  assert.equal(findDateForWeekAndDay('2026-11-11', 1, 5), '2026-11-06');

  // Minggu 2 (Nov 8-14): Rabu = Nov 11
  assert.equal(findDateForWeekAndDay('2026-11-11', 2, 3), '2026-11-11');

  // Minggu 3 (Nov 15-21): Rabu = Nov 18
  assert.equal(findDateForWeekAndDay('2026-11-11', 3, 3), '2026-11-18');

  // Minggu 4 (Nov 22-28): Rabu = Nov 25
  assert.equal(findDateForWeekAndDay('2026-11-11', 4, 3), '2026-11-25');
});

test('getTimeOfDayGreeting and getDefaultDisplayDateForHour switch between Pagi/Siang/Sore (Today) and Malam (Tomorrow)', async () => {
  const { getTimeOfDayGreeting, getDefaultDisplayDateForHour } = await import(
    './piketLogic'
  );

  // Pagi (06:00)
  const pagi = getTimeOfDayGreeting(6);
  assert.equal(pagi.period, 'pagi');
  assert.equal(pagi.greeting, 'Selamat Pagi');
  assert.equal(pagi.isNightMode, false);
  assert.equal(getDefaultDisplayDateForHour('2026-11-11', 6), '2026-11-11');

  // Siang (12:00)
  const siang = getTimeOfDayGreeting(12);
  assert.equal(siang.period, 'siang');
  assert.equal(siang.greeting, 'Selamat Siang');
  assert.equal(siang.isNightMode, false);
  assert.equal(getDefaultDisplayDateForHour('2026-11-11', 12), '2026-11-11');

  // Sore (16:00)
  const sore = getTimeOfDayGreeting(16);
  assert.equal(sore.period, 'sore');
  assert.equal(sore.greeting, 'Selamat Sore');
  assert.equal(sore.isNightMode, false);
  assert.equal(getDefaultDisplayDateForHour('2026-11-11', 16), '2026-11-11');

  // Malam (19:00 and 01:00) -> switches default display to Besok ('2026-11-12')
  const malam19 = getTimeOfDayGreeting(19);
  assert.equal(malam19.period, 'malam');
  assert.equal(malam19.greeting, 'Selamat Malam');
  assert.equal(malam19.isNightMode, true);
  assert.equal(getDefaultDisplayDateForHour('2026-11-11', 19), '2026-11-12');

  const malam01 = getTimeOfDayGreeting(1);
  assert.equal(malam01.period, 'malam');
  assert.equal(malam01.greeting, 'Selamat Malam');
  assert.equal(malam01.isNightMode, true);
  assert.equal(getDefaultDisplayDateForHour('2026-11-11', 1), '2026-11-12');
});

test('developer account is permanent/undeletable and can authenticate and manage admin accounts', async () => {
  const {
    PERMANENT_DEVELOPER_ACCOUNT,
    authenticateAccount,
    canDeleteAccount,
    canManageAdminAccounts,
  } = await import('./piketLogic');

  const sampleAdmin = {
    id: 'acc-admin-1',
    username: 'sekretaris',
    password: 'osis2026',
    displayName: 'Sekretaris OSIS',
    role: 'admin' as const,
    isProtected: false,
    createdAt: '2026-11-11T07:00:00.000Z',
  };

  // Developer can always authenticate even if list only has sampleAdmin
  const devAuth = authenticateAccount(
    [sampleAdmin],
    'developer',
    'devosis123'
  );
  assert.ok(devAuth);
  assert.equal(devAuth.role, 'developer');
  assert.equal(canDeleteAccount(PERMANENT_DEVELOPER_ACCOUNT), false);
  assert.equal(canManageAdminAccounts(devAuth), true);

  // Admin can authenticate, can be deleted by developer, but cannot manage admin accounts
  const adminAuth = authenticateAccount(
    [sampleAdmin],
    'sekretaris',
    'osis2026'
  );
  assert.ok(adminAuth);
  assert.equal(adminAuth.role, 'admin');
  assert.equal(canDeleteAccount(sampleAdmin), true);
  assert.equal(canManageAdminAccounts(adminAuth), false);

  // Wrong password fails
  assert.equal(
    authenticateAccount([sampleAdmin], 'developer', 'wrongpass'),
    null
  );
});

test('labels all 32 full-name members as OSIS and remaining 26 members as MPK with Rida unified under Faridathun Nurul Khasanah (XI-A)', async () => {
  const { INITIAL_OSIS_MEMBERS, createInitialSchedules } = await import(
    '../data/initialData'
  );
  const { getMemberOrgLabel, normalizeMemberId } = await import('./piketLogic');

  const osisList = INITIAL_OSIS_MEMBERS.filter(
    (m) => getMemberOrgLabel(m) === 'OSIS'
  );
  const mpkList = INITIAL_OSIS_MEMBERS.filter(
    (m) => getMemberOrgLabel(m) === 'MPK'
  );

  assert.equal(osisList.length, 32);
  assert.equal(mpkList.length, 26);

  // Rida in Jaga Gerbang Minggu 2 is unified with Faridathun Nurul Khasanah (XI-A, OSIS)
  assert.equal(normalizeMemberId('osis-rida'), 'osis-faridathun');
  const faridathun = INITIAL_OSIS_MEMBERS.find(
    (m) => m.id === 'osis-faridathun'
  );
  assert.ok(faridathun);
  assert.equal(faridathun.name, 'Faridathun Nurul Khasanah');
  assert.equal(faridathun.kelas, 'XI-A');
  assert.equal(getMemberOrgLabel(faridathun), 'OSIS');

  const dwi = INITIAL_OSIS_MEMBERS.find((m) => m.id === 'osis-dwi');
  const dwiAyu = INITIAL_OSIS_MEMBERS.find((m) => m.id === 'osis-dwi-ayu');

  assert.ok(dwi);
  assert.equal(dwi.name, 'Dwi');
  assert.equal(dwi.kelas, 'X-F');
  assert.equal(getMemberOrgLabel(dwi), 'MPK');

  assert.ok(dwiAyu);
  assert.equal(dwiAyu.name, 'Dwi Ayu Khairunnissa Alqodri');
  assert.equal(dwiAyu.kelas, 'X-A');
  assert.equal(getMemberOrgLabel(dwiAyu), 'OSIS');

  const schedules = createInitialSchedules('2026-11-11');
  const gerbangM2 = schedules.find((s) => s.id === 'sch-gerbang-m2');
  assert.ok(gerbangM2);
  assert.equal(gerbangM2.dailyMembers[0], 'osis-faridathun');

  const shalatM2 = schedules.find((s) => s.id === 'sch-shalat-m2');
  assert.ok(shalatM2);
  assert.equal(shalatM2.weeklyAssignments[3].includes('osis-dwi-ayu'), true);
  assert.equal(shalatM2.weeklyAssignments[3].includes('osis-dwi'), true);
});



