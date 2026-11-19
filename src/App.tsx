/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Settings, ShieldCheck, LogOut, Lock } from 'lucide-react';
import {
  DAY_NOTE_MEMBER_ID,
  DAY_NOTE_SCHEDULE_ID,
  HOLIDAY_CATEGORY_LABELS,
  PERMANENT_DEVELOPER_ACCOUNT,
  PUBLIC_SELF_ATTENDANCE_RECORDER,
  STATUS_LABELS_ID,
  addDays,
  canDeleteAccount,
  canManageAdminAccounts,
  createDayAttendanceNoteRecord,
  createHolidayRangeRecord,
  createLeaderboardSettingRecord,
  formatAdminVerifierName,
  formatDateString,
  formatShortDateRangeId,
  getDefaultDisplayDateForHour,
  getHolidayForScheduleOnDate,
  getPosAttendanceWindowStatus,
  getScheduleDateEditStatus,
  isAttendanceVerifiedByAdmin,
  isLeaderboardFeatureEnabled,
  LEADERBOARD_SETTING_RECORD_ID,
  replaceMemberInSchedule,
  resolveSchedulesForDate,
  sanitizeScheduleForDb,
  type AppAccount,
  type AttendanceRecord,
  type AttendanceStatus,
  type HolidayCategory,
  type OsisMember,
  type PiketSchedule,
  type ScheduleSwap,
} from './utils/piketLogic';
import {
  INITIAL_OSIS_MEMBERS,
  createInitialSchedules,
} from './data/initialData';
import {
  db,
  collection,
  onSnapshot,
  OperationType,
  handleFirestoreError,
  testFirestoreConnection,
  saveMemberToDb,
  deleteMemberFromDb,
  saveScheduleToDb,
  deleteScheduleFromDb,
  saveSwapToDb,
  deleteSwapFromDb,
  saveAttendanceToDb,
  saveBatchAttendanceToDb,
  deleteAttendanceFromDb,
  saveAccountToDb,
  deleteAccountFromDb,
  seedOfficialSchedulesToDb,
  syncOfficialScheduleTimeWindowsIfLegacy,
} from './firebase';
import { PublicDisplayBoard } from './components/PublicDisplayBoard';
import { LiveDisplayAndAttendance } from './components/LiveDisplayAndAttendance';
import { ScheduleManager } from './components/ScheduleManager';
import { MemberManager } from './components/MemberManager';
import { RecapReport } from './components/RecapReport';
import { SwapScheduleModal } from './components/SwapScheduleModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { DeveloperAccountManager } from './components/DeveloperAccountManager';

type ActiveTab =
  | 'display'
  | 'admin_attendance'
  | 'schedules'
  | 'members'
  | 'recap'
  | 'accounts';

function parseHashToTab(hash: string): ActiveTab {
  const clean = hash.replace(/^#/, '').toLowerCase();
  if (clean === 'admin' || clean === 'admin-attendance') {
    return 'admin_attendance';
  }
  if (clean === 'schedules' || clean === 'jadwal') return 'schedules';
  if (clean === 'members' || clean === 'anggota') return 'members';
  if (clean === 'recap' || clean === 'rekap') return 'recap';
  if (clean === 'accounts' || clean === 'akun') return 'accounts';
  return 'display';
}

const AUTH_SESSION_KEY = 'sipiket_auth_account_v1';

export default function App() {
  const todayStr = formatDateString(new Date());
  const initialDisplayDate = getDefaultDisplayDateForHour(
    todayStr,
    new Date().getHours()
  );

  const [currentTimeHHMM, setCurrentTimeHHMM] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  });

  useEffect(() => {
    const syncClock = () => {
      const now = new Date();
      setCurrentTimeHHMM(
        `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}`
      );
    };
    const timer = window.setInterval(syncClock, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Logged-in account state (persisted in sessionStorage for current browser session)
  const [loggedInAccount, setLoggedInAccount] = useState<AppAccount | null>(
    () => {
      try {
        const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
        if (raw) {
          return JSON.parse(raw) as AppAccount;
        }
      } catch {
        // ignore storage errors
      }
      return null;
    }
  );

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [pendingAdminTab, setPendingAdminTab] =
    useState<ActiveTab>('admin_attendance');

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const requested =
      typeof window !== 'undefined'
        ? parseHashToTab(window.location.hash)
        : 'display';
    if (requested !== 'display' && !loggedInAccount) {
      return 'display';
    }
    return requested;
  });

  const [selectedDate, setSelectedDate] = useState<string>(initialDisplayDate);
  const [nextPreviewDate, setNextPreviewDate] = useState<string>(
    addDays(initialDisplayDate, 1)
  );

  // Pre-populated with the 3 official OSIS schedules (Piket Warsis, Jaga Gerbang, Absensi Shalat)
  // and synced to Firebase Firestore
  const [members, setMembers] = useState<OsisMember[]>(() =>
    [...INITIAL_OSIS_MEMBERS].sort((a, b) => a.name.localeCompare(b.name))
  );
  const [schedules, setSchedules] = useState<PiketSchedule[]>(() =>
    createInitialSchedules(todayStr)
  );
  const [swaps, setSwaps] = useState<ScheduleSwap[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [accounts, setAccounts] = useState<AppAccount[]>([
    PERMANENT_DEVELOPER_ACCOUNT,
  ]);
  const hasSeededRef = useRef(false);
  const hasSyncedTimeWindowsRef = useRef(false);

  // Modal state for Swap / Change Schedule
  const [swapModalState, setSwapModalState] = useState<{
    isOpen: boolean;
    date: string;
    scheduleId: string;
    originalMemberId?: string;
  }>({
    isOpen: false,
    date: todayStr,
    scheduleId: '',
  });

  // Toast feedback message
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const switchTab = (tab: ActiveTab) => {
    if (tab !== 'display' && !loggedInAccount) {
      setPendingAdminTab(tab);
      setIsLoginModalOpen(true);
      return;
    }
    if (tab === 'accounts' && !canManageAdminAccounts(loggedInAccount)) {
      setActiveTab('admin_attendance');
      return;
    }
    setActiveTab(tab);
    const hashMap: Record<ActiveTab, string> = {
      display: '#display',
      admin_attendance: '#admin-attendance',
      schedules: '#schedules',
      members: '#members',
      recap: '#recap',
      accounts: '#accounts',
    };
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', hashMap[tab]);
    }
  };

  // Sync URL hash for direct navigation (gated by login)
  useEffect(() => {
    const onHashChange = () => {
      const requested = parseHashToTab(window.location.hash);
      if (requested !== 'display' && !loggedInAccount) {
        setPendingAdminTab(requested);
        setIsLoginModalOpen(true);
        setActiveTab('display');
        window.history.replaceState(null, '', '#display');
        return;
      }
      setActiveTab(requested);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [loggedInAccount]);

  // Anti-Inspect protection: disable right-click context menu & DevTools / View-Source shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const rawKey = typeof e.key === 'string' ? e.key : '';
      const key = rawKey.toUpperCase();
      const isCtrlOrCmd = Boolean(e.ctrlKey || e.metaKey);

      // F12
      if (rawKey === 'F12' || key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl+Shift+I / J / C / K or Cmd+Option+I / J / C
      if (
        isCtrlOrCmd &&
        (e.shiftKey || e.altKey) &&
        (key === 'I' || key === 'J' || key === 'C' || key === 'K')
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl+U / Cmd+U (View Source)
      if (isCtrlOrCmd && key === 'U') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Subscribe to real-time Firestore collections and auto-seed the 3 imported OSIS schedules + permanent developer account
  useEffect(() => {
    try {
      localStorage.removeItem('sipiket_osis_state_v2');
      localStorage.removeItem('sipiket_osis_state_v1');
    } catch {
      // ignore storage errors
    }

    testFirestoreConnection();

    const triggerInitialSeedIfNeeded = () => {
      if (hasSeededRef.current) return;
      hasSeededRef.current = true;
      const initialSchedules = createInitialSchedules(todayStr);
      seedOfficialSchedulesToDb(INITIAL_OSIS_MEMBERS, initialSchedules).catch(
        (err) => {
          console.error('Failed to seed official schedules:', err);
        }
      );
    };

    const unsubMembers = onSnapshot(
      collection(db, 'members'),
      (snap) => {
        if (snap.empty) {
          triggerInitialSeedIfNeeded();
          return;
        }
        const canonicalMap = new Map(
          INITIAL_OSIS_MEMBERS.map((m) => [m.id, m])
        );
        const list: OsisMember[] = [];
        snap.forEach((docSnap) => {
          const raw = docSnap.data() as OsisMember;
          // Skip legacy split IDs now unified under osis-azka, osis-surya, & osis-faridathun
          if (
            raw.id === 'osis-shahnan' ||
            raw.id === 'osis-andes' ||
            raw.id === 'osis-rida'
          ) {
            return;
          }
          list.push(raw);
        });
        for (const reqId of ['osis-dwi', 'osis-dwi-ayu', 'osis-faridathun']) {
          if (!list.some((m) => m.id === reqId)) {
            const reqMember = canonicalMap.get(reqId);
            if (reqMember) list.push(reqMember);
          }
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setMembers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'members')
    );

    const unsubSchedules = onSnapshot(
      collection(db, 'schedules'),
      (snap) => {
        if (snap.empty) {
          triggerInitialSeedIfNeeded();
          return;
        }
        const list: PiketSchedule[] = [];
        snap.forEach((docSnap) => {
          list.push(sanitizeScheduleForDb(docSnap.data() as PiketSchedule));
        });
        list.sort(
          (a, b) =>
            a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
        );
        setSchedules(list);
        if (!hasSyncedTimeWindowsRef.current) {
          hasSyncedTimeWindowsRef.current = true;
          syncOfficialScheduleTimeWindowsIfLegacy(list).catch(() => {
            // ignore background sync error
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
    );

    const unsubSwaps = onSnapshot(
      collection(db, 'swaps'),
      (snap) => {
        const list: ScheduleSwap[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as ScheduleSwap);
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        setSwaps(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'swaps')
    );

    const unsubAttendance = onSnapshot(
      collection(db, 'attendance'),
      (snap) => {
        const list: AttendanceRecord[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as AttendanceRecord);
        });
        setAttendanceRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
    );

    const unsubAccounts = onSnapshot(
      collection(db, 'accounts'),
      (snap) => {
        const list: AppAccount[] = [];
        let hasDeveloper = false;
        snap.forEach((docSnap) => {
          const data = docSnap.data() as AppAccount;
          if (
            data.id === PERMANENT_DEVELOPER_ACCOUNT.id ||
            data.role === 'developer'
          ) {
            hasDeveloper = true;
            list.push({
              ...PERMANENT_DEVELOPER_ACCOUNT,
              ...data,
              id: PERMANENT_DEVELOPER_ACCOUNT.id,
              role: 'developer',
              isProtected: true,
            });
          } else {
            list.push(data);
          }
        });

        if (!hasDeveloper) {
          list.unshift(PERMANENT_DEVELOPER_ACCOUNT);
          saveAccountToDb(PERMANENT_DEVELOPER_ACCOUNT, false).catch((err) => {
            console.error('Failed to seed permanent developer account:', err);
          });
        }
        setAccounts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'accounts')
    );

    return () => {
      unsubMembers();
      unsubSchedules();
      unsubSwaps();
      unsubAttendance();
      unsubAccounts();
    };
  }, [todayStr]);

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleLoginSuccess = (account: AppAccount) => {
    setLoggedInAccount(account);
    try {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(account));
    } catch {
      // ignore storage errors
    }
    setIsLoginModalOpen(false);
    const targetTab =
      pendingAdminTab === 'display' ? 'admin_attendance' : pendingAdminTab;
    setActiveTab(targetTab);
    const hashMap: Record<ActiveTab, string> = {
      display: '#display',
      admin_attendance: '#admin-attendance',
      schedules: '#schedules',
      members: '#members',
      recap: '#recap',
      accounts: '#accounts',
    };
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', hashMap[targetTab]);
    }
    showToast(
      `Selamat datang, ${account.displayName} (${
        account.role === 'developer' ? 'Developer Utama' : 'Admin OSIS'
      }).`
    );
  };

  const handleLogout = () => {
    setLoggedInAccount(null);
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // ignore storage errors
    }
    setActiveTab('display');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#display');
    }
    showToast('Anda telah keluar dari Admin Panel.');
  };

  // Resolve active schedules for selectedDate and nextPreviewDate (with automatic Alfa after schedule end / past dates)
  const autoAlfaContext = { todayStr, currentTimeHHMM };

  const resolvedTodaySchedules = resolveSchedulesForDate(
    selectedDate,
    schedules,
    members,
    swaps,
    attendanceRecords,
    autoAlfaContext
  );

  const resolvedNextDaySchedules = resolveSchedulesForDate(
    nextPreviewDate,
    schedules,
    members,
    swaps,
    attendanceRecords,
    autoAlfaContext
  );

  // Public Self-Attendance Handler (No Login Required, Strictly Today Only)
  const handlePublicRecordAttendance = async (
    date: string,
    scheduleId: string,
    memberId: string,
    status: AttendanceStatus,
    checkInTime: string,
    note: string
  ) => {
    const editStatus = getScheduleDateEditStatus(date, todayStr);
    if (!editStatus.canEdit) {
      showToast(editStatus.reason);
      return;
    }

    const targetSchedule = schedules.find((s) => s.id === scheduleId);
    if (targetSchedule) {
      const activeHoliday = getHolidayForScheduleOnDate(
        date,
        targetSchedule.title,
        attendanceRecords
      );
      if (activeHoliday) {
        showToast(
          `${targetSchedule.title} sedang libur piket (${activeHoliday.reason}).`
        );
        return;
      }

      const now = new Date();
      const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const windowStatus = getPosAttendanceWindowStatus(targetSchedule, nowHHMM);
      if (!windowStatus.isOpen) {
        showToast(windowStatus.message);
        return;
      }
    }

    const existing = attendanceRecords.find(
      (r) =>
        r.date === date &&
        r.scheduleId === scheduleId &&
        r.memberId === memberId
    );

    if (existing && isAttendanceVerifiedByAdmin(existing)) {
      showToast(
        'Status absensi sudah diverifikasi oleh Admin dan tidak dapat diubah secara publik.'
      );
      return;
    }

    const recordPayload: AttendanceRecord = {
      id: existing ? existing.id : `att-${date}-${scheduleId}-${memberId}`,
      date,
      scheduleId,
      memberId,
      status,
      checkInTime: (checkInTime || '-').slice(0, 20),
      note: (note || '').trim().slice(0, 500),
      recordedBy: PUBLIC_SELF_ATTENDANCE_RECORDER,
    };

    await saveAttendanceToDb(recordPayload, Boolean(existing));

    const memberObj = members.find((m) => m.id === memberId);
    if (memberObj) {
      showToast(
        `Absensi ${memberObj.name} (${STATUS_LABELS_ID[status]}) tercatat. Menunggu verifikasi Admin.`
      );
    }
  };

  // Admin Verification & Attendance Correction Handler (Strictly Today Only)
  const handleRecordAttendance = async (
    date: string,
    scheduleId: string,
    memberId: string,
    status: AttendanceStatus,
    note?: string
  ) => {
    const editStatus = getScheduleDateEditStatus(date, todayStr);
    if (!editStatus.canEdit) {
      showToast(editStatus.reason);
      return;
    }

    const now = new Date();
    const checkInTime =
      status === 'hadir' || status === 'terlambat'
        ? `${String(now.getHours()).padStart(2, '0')}:${String(
            now.getMinutes()
          ).padStart(2, '0')}`
        : '-';

    const existing = attendanceRecords.find(
      (r) =>
        r.date === date &&
        r.scheduleId === scheduleId &&
        r.memberId === memberId
    );

    const recorderName = formatAdminVerifierName(loggedInAccount?.displayName);

    const recordPayload: AttendanceRecord = existing
      ? {
          ...existing,
          status,
          checkInTime:
            status === 'hadir' || status === 'terlambat'
              ? existing.checkInTime !== '-'
                ? existing.checkInTime
                : checkInTime
              : '-',
          note: (note !== undefined ? note : existing.note).slice(0, 500),
          recordedBy: recorderName,
        }
      : {
          id: `att-${date}-${scheduleId}-${memberId}`,
          date,
          scheduleId,
          memberId,
          status,
          checkInTime,
          note: (note || '').slice(0, 500),
          recordedBy: recorderName,
        };

    await saveAttendanceToDb(recordPayload, Boolean(existing));

    const memberObj = members.find((m) => m.id === memberId);
    if (memberObj) {
      showToast(
        `Verifikasi ${memberObj.name} (${STATUS_LABELS_ID[status]}) tersimpan.`
      );
    }
  };

  // Admin Cancel / Clear Attendance Handler (Strictly Today Only — prevents accidental click)
  const handleClearAttendance = async (
    date: string,
    scheduleId: string,
    memberId: string
  ) => {
    const editStatus = getScheduleDateEditStatus(date, todayStr);
    if (!editStatus.canEdit) {
      showToast(editStatus.reason);
      return;
    }

    const existing = attendanceRecords.find(
      (r) =>
        r.date === date &&
        r.scheduleId === scheduleId &&
        r.memberId === memberId
    );
    if (!existing) return;

    await deleteAttendanceFromDb(existing.id);

    const memberObj = members.find((m) => m.id === memberId);
    showToast(
      memberObj
        ? `Tanda absen ${memberObj.name} dibatalkan.`
        : 'Tanda absen berhasil dibatalkan.'
    );
  };

  // Admin Toggle for Violation Leaderboard Visibility (Synced via Firestore)
  const isLeaderboardEnabled = isLeaderboardFeatureEnabled(attendanceRecords);

  const handleToggleLeaderboardEnabled = async (nextEnabled: boolean) => {
    const recorderName = formatAdminVerifierName(loggedInAccount?.displayName);
    const hasExisting = attendanceRecords.some(
      (r) => r.id === LEADERBOARD_SETTING_RECORD_ID
    );
    const payload = createLeaderboardSettingRecord(nextEnabled, recorderName);
    await saveAttendanceToDb(payload, hasExisting);
    showToast(
      nextEnabled
        ? 'Fitur Leaderboard Pelanggaran diaktifkan untuk semua pengguna.'
        : 'Fitur Leaderboard Pelanggaran dinonaktifkan dari tampilan pengguna.'
    );
  };

  const handleMarkAllPresent = async (date: string, scheduleId: string) => {
    const editStatus = getScheduleDateEditStatus(date, todayStr);
    if (!editStatus.canEdit) {
      showToast(editStatus.reason);
      return;
    }

    const targetResolved = resolveSchedulesForDate(
      date,
      schedules.filter((s) => s.id === scheduleId),
      members,
      swaps,
      attendanceRecords
    )[0];

    if (!targetResolved || targetResolved.dutyMembers.length === 0) return;

    const now = new Date();
    const checkInTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const recorderName = formatAdminVerifierName(loggedInAccount?.displayName);

    const batchPayload: AttendanceRecord[] = targetResolved.dutyMembers.map(
      (dm) => {
        const existing = attendanceRecords.find(
          (r) =>
            r.date === date &&
            r.scheduleId === scheduleId &&
            r.memberId === dm.member.id
        );
        return existing
          ? {
              ...existing,
              status: existing.status === 'belum_absen' ? 'hadir' : existing.status,
              checkInTime:
                existing.status === 'hadir' ||
                existing.status === 'terlambat' ||
                existing.status === 'belum_absen'
                  ? existing.checkInTime !== '-'
                    ? existing.checkInTime
                    : checkInTime
                  : existing.checkInTime,
              recordedBy: recorderName,
            }
          : {
              id: `att-${date}-${scheduleId}-${dm.member.id}`,
              date,
              scheduleId,
              memberId: dm.member.id,
              status: 'hadir',
              checkInTime,
              note: 'Terverifikasi hadir',
              recordedBy: recorderName,
            };
      }
    );

    await saveBatchAttendanceToDb(batchPayload);
    showToast(
      `Semua petugas pada ${targetResolved.schedule.title} telah diverifikasi.`
    );
  };

  const handleSaveDayOrShiftNote = async (
    date: string,
    note: string,
    isHoliday: boolean,
    applyToAllMembers: boolean,
    targetScheduleId: string = DAY_NOTE_SCHEDULE_ID
  ) => {
    const editStatus = getScheduleDateEditStatus(date, todayStr);
    if (!editStatus.canEdit) {
      showToast(editStatus.reason);
      return;
    }

    const recorderName = formatAdminVerifierName(loggedInAccount?.displayName);
    const noteRecord = createDayAttendanceNoteRecord(
      date,
      note,
      isHoliday,
      recorderName,
      targetScheduleId
    );

    const batchPayload: AttendanceRecord[] = [noteRecord];

    if (applyToAllMembers) {
      const targetSchedulesList =
        targetScheduleId === DAY_NOTE_SCHEDULE_ID
          ? schedules
          : schedules.filter((s) => s.id === targetScheduleId);
      const resolvedList = resolveSchedulesForDate(
        date,
        targetSchedulesList,
        members,
        swaps,
        attendanceRecords
      );
      for (const res of resolvedList) {
        for (const dm of res.dutyMembers) {
          batchPayload.push({
            id: `att-${date}-${res.schedule.id}-${dm.member.id}`,
            date,
            scheduleId: res.schedule.id,
            memberId: dm.member.id,
            status: 'izin',
            checkInTime: '-',
            note: note.trim(),
            recordedBy: recorderName,
          });
        }
      }
    }

    await saveBatchAttendanceToDb(batchPayload);
    showToast(
      applyToAllMembers
        ? `Keterangan "${note}" disimpan & diterapkan ke seluruh petugas.`
        : `Keterangan "${note}" berhasil disimpan.`
    );
  };

  const handleClearDayOrShiftNote = async (
    date: string,
    targetScheduleId: string = DAY_NOTE_SCHEDULE_ID
  ) => {
    const editStatus = getScheduleDateEditStatus(date, todayStr);
    if (!editStatus.canEdit) {
      showToast(editStatus.reason);
      return;
    }

    const existing = attendanceRecords.find(
      (r) =>
        r.date === date &&
        r.scheduleId === targetScheduleId &&
        r.memberId === DAY_NOTE_MEMBER_ID
    );
    if (existing) {
      await deleteAttendanceFromDb(existing.id);
      showToast('Keterangan daftar hadir berhasil dihapus.');
    }
  };

  // Per-Category Date-Range Holiday ("Libur Piket") Handlers
  const handleSaveHolidayRange = async (
    category: HolidayCategory,
    startDate: string,
    endDate: string,
    reason: string
  ) => {
    const cleanReason = reason.trim();
    if (!cleanReason) {
      showToast('Alasan libur piket wajib diisi.');
      return;
    }
    if (startDate < todayStr) {
      showToast('Tanggal mulai libur piket tidak boleh di hari yang sudah berlalu.');
      return;
    }
    if (endDate < startDate) {
      showToast('Tanggal selesai libur harus sama atau setelah tanggal mulai.');
      return;
    }

    const recorderName = formatAdminVerifierName(loggedInAccount?.displayName);
    const holidayRecord = createHolidayRangeRecord(
      category,
      startDate,
      endDate,
      cleanReason,
      recorderName
    );
    await saveAttendanceToDb(holidayRecord, false);
    showToast(
      `Libur ${HOLIDAY_CATEGORY_LABELS[category]} (${formatShortDateRangeId(
        startDate,
        endDate
      )}) berhasil disimpan.`
    );
  };

  const handleDeleteHolidayRange = async (holidayId: string) => {
    await deleteAttendanceFromDb(holidayId);
    showToast('Jadwal libur piket berhasil dihapus.');
  };

  const handleAddSchedule = async (newSchedule: PiketSchedule) => {
    const clean = sanitizeScheduleForDb(newSchedule);
    setSchedules((prev) =>
      [...prev.filter((s) => s.id !== clean.id), clean].sort(
        (a, b) =>
          a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
      )
    );
    await saveScheduleToDb(clean, false);
    showToast(
      `Jadwal "${clean.title}" berhasil disimpan ke database & disinkronkan ke semua perangkat.`
    );
  };

  const handleUpdateSchedule = async (updatedSchedule: PiketSchedule) => {
    const clean = sanitizeScheduleForDb(updatedSchedule);
    setSchedules((prev) =>
      prev
        .map((s) => (s.id === clean.id ? clean : s))
        .sort(
          (a, b) =>
            a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
        )
    );
    await saveScheduleToDb(clean, true);
    showToast(
      `Jadwal "${clean.title}" berhasil diperbarui & tersimpan untuk semua perangkat.`
    );
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    await deleteScheduleFromDb(scheduleId);
    showToast('Jadwal piket berhasil dihapus dari database.');
  };

  const handleSaveTemporarySwap = async (swap: ScheduleSwap) => {
    const editStatus = getScheduleDateEditStatus(swap.date, todayStr);
    if (!editStatus.canEdit) {
      showToast(editStatus.reason);
      return;
    }
    const duplicate = swaps.find(
      (s) =>
        s.date === swap.date &&
        s.scheduleId === swap.scheduleId &&
        s.originalMemberId === swap.originalMemberId
    );
    if (duplicate && duplicate.id !== swap.id) {
      await deleteSwapFromDb(duplicate.id);
    }
    await saveSwapToDb(swap);
    showToast('Pertukaran jadwal piket sementara berhasil disimpan.');
  };

  const handleSavePermanentReplace = async (
    scheduleId: string,
    targetDayOrDate: number | string,
    oldMemberId: string,
    newMemberId: string
  ) => {
    const targetSchedule = schedules.find((s) => s.id === scheduleId);
    if (!targetSchedule) return;
    const updated = sanitizeScheduleForDb(
      replaceMemberInSchedule(
        targetSchedule,
        targetDayOrDate,
        oldMemberId,
        newMemberId
      )
    );
    setSchedules((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    await saveScheduleToDb(updated, true);
    showToast(
      'Perubahan jadwal piket permanen berhasil disimpan ke semua perangkat.'
    );
  };

  const handleDeleteSwap = async (swapId: string) => {
    await deleteSwapFromDb(swapId);
    showToast('Pergantian jadwal dibatalkan.');
  };

  const handleAddMember = async (
    member: OsisMember,
    assignScheduleId?: string,
    assignDay?: number
  ) => {
    await saveMemberToDb(member, false);

    if (assignScheduleId) {
      const targetSch = schedules.find((s) => s.id === assignScheduleId);
      if (targetSch) {
        if (targetSch.mode === 'harian' || targetSch.mode === 'custom') {
          await saveScheduleToDb(
            {
              ...targetSch,
              dailyMembers: Array.from(
                new Set([...targetSch.dailyMembers, member.id])
              ),
            },
            true
          );
        } else {
          const day = assignDay ?? 1;
          const existingDayList = targetSch.weeklyAssignments[day] || [];
          await saveScheduleToDb(
            {
              ...targetSch,
              activeDays: Array.from(
                new Set([...targetSch.activeDays, day])
              ).sort(),
              weeklyAssignments: {
                ...targetSch.weeklyAssignments,
                [day]: Array.from(new Set([...existingDayList, member.id])),
              },
            },
            true
          );
        }
      }
    }
    showToast(`Pengurus baru "${member.name}" berhasil disimpan ke database.`);
  };

  const handleUpdateMember = async (updatedMember: OsisMember) => {
    await saveMemberToDb(updatedMember, true);
    showToast(`Data "${updatedMember.name}" berhasil diperbarui.`);
  };

  const handleDeleteMember = async (memberId: string) => {
    await deleteMemberFromDb(memberId);
    showToast('Data anggota berhasil dihapus dari database.');
  };

  // Developer Account Management Handlers
  const handleAddAdminAccount = async (newAccount: AppAccount) => {
    if (!canManageAdminAccounts(loggedInAccount)) return;
    await saveAccountToDb(newAccount, false);
    showToast(
      `Akun Admin "${newAccount.displayName}" (@${newAccount.username}) berhasil ditambahkan ke Firebase.`
    );
  };

  const handleUpdateAdminAccount = async (updatedAccount: AppAccount) => {
    if (!canManageAdminAccounts(loggedInAccount)) return;
    await saveAccountToDb(updatedAccount, true);
    showToast(
      `Akun Admin "${updatedAccount.displayName}" berhasil diperbarui.`
    );
  };

  const handleDeleteAdminAccount = async (accountId: string) => {
    if (!canManageAdminAccounts(loggedInAccount)) return;
    const target = accounts.find((a) => a.id === accountId);
    if (!target || !canDeleteAccount(target)) {
      showToast('Akun Developer Utama bersifat permanen dan tidak bisa dihapus.');
      return;
    }
    await deleteAccountFromDb(target);
    showToast(`Akun Admin "@${target.username}" berhasil dihapus.`);
  };

  const isAdminView = activeTab !== 'display' && Boolean(loggedInAccount);
  const isDeveloper = canManageAdminAccounts(loggedInAccount);

  return (
    <div className="min-h-screen flex flex-col text-slate-900 bg-spatial-3d">
      {/* Simplified, Clean Admin Navigation Bar with subtle 3D elevation */}
      {isAdminView && loggedInAccount && (
        <>
          <header className="flex items-center justify-between gap-4 px-4 sm:px-6 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] sticky top-0 z-30">
            <div className="flex items-center gap-6 min-w-0">
              <a
                href="#admin-attendance"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('admin_attendance');
                }}
                className="text-base font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
              >
                SiPiket Admin
              </a>

              <nav
                aria-label="Navigasi Admin Panel"
                className="hidden md:flex items-center gap-1 text-sm"
              >
                {(
                  [
                    { id: 'admin_attendance', label: 'Verifikasi' },
                    { id: 'schedules', label: 'Jadwal' },
                    { id: 'members', label: 'Anggota' },
                    { id: 'recap', label: 'Rekap' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      activeTab === item.id
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {isDeveloper && (
                  <button
                    type="button"
                    data-testid="nav-kelola-akun"
                    onClick={() => switchTab('accounts')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      activeTab === 'accounts'
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    Kelola Akun
                  </button>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                {isDeveloper ? (
                  <Lock className="w-3.5 h-3.5 text-stone-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
                )}
                <span>{loggedInAccount.displayName}</span>
              </span>

              <button
                type="button"
                onClick={() => switchTab('display')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 whitespace-nowrap transition-colors"
              >
                Display Publik
              </button>
              <button
                type="button"
                data-testid="btn-logout-admin"
                onClick={handleLogout}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-stone-600 inline-flex items-center gap-1.5 transition-colors"
                title="Keluar dari Admin Panel"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </header>

          {/* Compact Mobile Navigation for Admin Panel */}
          <nav
            aria-label="Navigasi Mobile Admin"
            className="md:hidden flex items-center gap-1 bg-white border-b border-stone-200 px-3 py-2 overflow-x-auto"
          >
            {(
              [
                { id: 'admin_attendance', label: 'Verifikasi' },
                { id: 'schedules', label: 'Jadwal' },
                { id: 'members', label: 'Anggota' },
                { id: 'recap', label: 'Rekap' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                  activeTab === item.id
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {item.label}
              </button>
            ))}
            {isDeveloper && (
              <button
                type="button"
                onClick={() => switchTab('accounts')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                  activeTab === 'accounts'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Akun
              </button>
            )}
          </nav>
        </>
      )}

      {/* Main Content Container */}
      <main
        className={`flex-1 w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 ${
          isAdminView ? 'max-w-5xl' : 'max-w-[1360px]'
        }`}
      >
        {feedbackBanner && (
          <div
            role="status"
            className="px-4 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-xl flex items-center justify-between"
          >
            <span>{feedbackBanner}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-stone-300 hover:text-white ml-4 text-xs font-semibold"
            >
              Tutup
            </button>
          </div>
        )}

        {!isAdminView && (
          <PublicDisplayBoard
            todayStr={todayStr}
            currentTimeHHMM={currentTimeHHMM}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            nextPreviewDate={nextPreviewDate}
            onSelectNextPreviewDate={setNextPreviewDate}
            todaySchedules={resolvedTodaySchedules}
            nextDaySchedules={resolvedNextDaySchedules}
            allSchedules={schedules}
            members={members}
            swaps={swaps}
            attendanceRecords={attendanceRecords}
            isLeaderboardEnabled={isLeaderboardEnabled}
            onPublicRecordAttendance={handlePublicRecordAttendance}
          />
        )}

        {isAdminView && activeTab === 'admin_attendance' && (
          <LiveDisplayAndAttendance
            todayStr={todayStr}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            nextPreviewDate={nextPreviewDate}
            onSelectNextPreviewDate={setNextPreviewDate}
            todaySchedules={resolvedTodaySchedules}
            nextDaySchedules={resolvedNextDaySchedules}
            allSchedules={schedules}
            members={members}
            attendanceRecords={attendanceRecords}
            isLeaderboardEnabled={isLeaderboardEnabled}
            onToggleLeaderboardEnabled={handleToggleLeaderboardEnabled}
            onRecordAttendance={handleRecordAttendance}
            onClearAttendance={handleClearAttendance}
            onMarkAllPresent={handleMarkAllPresent}
            onSaveDayOrShiftNote={handleSaveDayOrShiftNote}
            onClearDayOrShiftNote={handleClearDayOrShiftNote}
            onSaveHolidayRange={handleSaveHolidayRange}
            onDeleteHolidayRange={handleDeleteHolidayRange}
            onOpenSwapModal={(date, scheduleId, originalMemberId) =>
              setSwapModalState({
                isOpen: true,
                date,
                scheduleId,
                originalMemberId,
              })
            }
            onOpenNewScheduleModal={() => switchTab('schedules')}
            onOpenMembersTab={() => switchTab('members')}
          />
        )}

        {isAdminView && activeTab === 'schedules' && (
          <ScheduleManager
            todayStr={todayStr}
            selectedDate={selectedDate}
            schedules={schedules}
            members={members}
            swaps={swaps}
            onAddSchedule={handleAddSchedule}
            onUpdateSchedule={handleUpdateSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onDeleteSwap={handleDeleteSwap}
            onOpenSwapModal={(date, scheduleId, originalMemberId) =>
              setSwapModalState({
                isOpen: true,
                date,
                scheduleId,
                originalMemberId,
              })
            }
          />
        )}

        {isAdminView && activeTab === 'members' && (
          <MemberManager
            members={members}
            schedules={schedules}
            onAddMember={handleAddMember}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
          />
        )}

        {isAdminView && activeTab === 'recap' && (
          <RecapReport
            todayStr={todayStr}
            currentTimeHHMM={currentTimeHHMM}
            schedules={schedules}
            members={members}
            swaps={swaps}
            attendanceRecords={attendanceRecords}
            isLeaderboardEnabled={isLeaderboardEnabled}
            onToggleLeaderboardEnabled={handleToggleLeaderboardEnabled}
          />
        )}

        {isAdminView && activeTab === 'accounts' && loggedInAccount && (
          <DeveloperAccountManager
            currentAccount={loggedInAccount}
            accounts={accounts}
            onAddAdminAccount={handleAddAdminAccount}
            onUpdateAccount={handleUpdateAdminAccount}
            onDeleteAdminAccount={(acc) => handleDeleteAdminAccount(acc.id)}
          />
        )}
      </main>

      {/* Subtle Floating 3D Icon Trigger in Bottom-Right Corner when on Display View */}
      {!isAdminView && (
        <button
          type="button"
          onClick={() => switchTab('admin_attendance')}
          aria-label="Login Admin Panel OSIS"
          title="Login Admin Panel OSIS"
          data-testid="open-admin-panel-btn"
          className="btn-3d-secondary fixed bottom-4 right-4 z-40 w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      {/* Admin / Developer Login Modal */}
      {isLoginModalOpen && (
        <AdminLoginModal
          accounts={accounts}
          onClose={() => setIsLoginModalOpen(false)}
          onSuccessLogin={handleLoginSuccess}
        />
      )}

      {/* Swap / Change Schedule Modal */}
      {swapModalState.isOpen && (
        <SwapScheduleModal
          todayStr={todayStr}
          initialDate={swapModalState.date}
          initialScheduleId={swapModalState.scheduleId}
          initialOriginalMemberId={swapModalState.originalMemberId}
          schedules={schedules}
          members={members}
          onClose={() =>
            setSwapModalState((prev) => ({ ...prev, isOpen: false }))
          }
          onSaveTemporarySwap={handleSaveTemporarySwap}
          onSavePermanentReplace={handleSavePermanentReplace}
        />
      )}
    </div>
  );
}
