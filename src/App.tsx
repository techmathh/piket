/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Settings, ShieldCheck, LogOut, Lock } from 'lucide-react';
import {
  PERMANENT_DEVELOPER_ACCOUNT,
  addDays,
  canDeleteAccount,
  canManageAdminAccounts,
  formatDateString,
  getDefaultDisplayDateForHour,
  replaceMemberInSchedule,
  resolveSchedulesForDate,
  type AppAccount,
  type AttendanceRecord,
  type AttendanceStatus,
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
  saveAccountToDb,
  deleteAccountFromDb,
  seedOfficialSchedulesToDb,
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
      const key = e.key.toUpperCase();
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // F12
      if (e.key === 'F12') {
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

    const triggerInitialSeedIfNeeded = (forceHarmonize = false) => {
      if (hasSeededRef.current && !forceHarmonize) return;
      hasSeededRef.current = true;
      const initialSchedules = createInitialSchedules(todayStr);
      seedOfficialSchedulesToDb(INITIAL_OSIS_MEMBERS, initialSchedules).catch(
        (err) => {
          console.error('Failed to seed official schedules:', err);
        }
      );
    };

    try {
      const harmonizedVersion = localStorage.getItem('sipiket_harmonized_v9');
      if (harmonizedVersion !== 'true') {
        localStorage.setItem('sipiket_harmonized_v9', 'true');
        triggerInitialSeedIfNeeded(true);
      }
    } catch {
      // ignore storage errors
    }

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
          const canonical = canonicalMap.get(raw.id);
          list.push(
            canonical
              ? {
                  ...raw,
                  name: canonical.name,
                  kelas: canonical.kelas,
                  jabatan: canonical.jabatan,
                }
              : raw
          );
        });
        for (const reqId of ['osis-dwi', 'osis-dwi-ayu']) {
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
          list.push(docSnap.data() as PiketSchedule);
        });
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));
        setSchedules(list);
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

  // Resolve active schedules for selectedDate and nextPreviewDate
  const resolvedTodaySchedules = resolveSchedulesForDate(
    selectedDate,
    schedules,
    members,
    swaps,
    attendanceRecords
  );

  const resolvedNextDaySchedules = resolveSchedulesForDate(
    nextPreviewDate,
    schedules,
    members,
    swaps,
    attendanceRecords
  );

  // Firestore Handlers
  const handleRecordAttendance = async (
    date: string,
    scheduleId: string,
    memberId: string,
    status: AttendanceStatus,
    note?: string
  ) => {
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

    const recorderName =
      loggedInAccount?.displayName || 'Admin Pengurus OSIS';

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
          note: note !== undefined ? note : existing.note,
          recordedBy: recorderName,
        }
      : {
          id: `att-${date}-${scheduleId}-${memberId}`,
          date,
          scheduleId,
          memberId,
          status,
          checkInTime,
          note: note || '',
          recordedBy: recorderName,
        };

    await saveAttendanceToDb(recordPayload, Boolean(existing));

    const memberObj = members.find((m) => m.id === memberId);
    if (memberObj) {
      showToast(`Presensi ${memberObj.name} berhasil disimpan ke database.`);
    }
  };

  const handleMarkAllPresent = async (date: string, scheduleId: string) => {
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

    const recorderName =
      loggedInAccount?.displayName || 'Admin Pengurus OSIS';

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
              status: 'hadir',
              checkInTime:
                existing.checkInTime !== '-'
                  ? existing.checkInTime
                  : checkInTime,
              recordedBy: recorderName,
            }
          : {
              id: `att-${date}-${scheduleId}-${dm.member.id}`,
              date,
              scheduleId,
              memberId: dm.member.id,
              status: 'hadir',
              checkInTime,
              note: 'Hadir tepat waktu',
              recordedBy: recorderName,
            };
      }
    );

    await saveBatchAttendanceToDb(batchPayload);
    showToast(
      `Semua petugas pada ${targetResolved.schedule.title} ditandai Hadir.`
    );
  };

  const handleAddSchedule = async (newSchedule: PiketSchedule) => {
    await saveScheduleToDb(newSchedule, false);
    showToast(`Jadwal "${newSchedule.title}" berhasil disimpan ke database.`);
  };

  const handleUpdateSchedule = async (updatedSchedule: PiketSchedule) => {
    await saveScheduleToDb(updatedSchedule, true);
    showToast(`Jadwal "${updatedSchedule.title}" berhasil diperbarui.`);
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    await deleteScheduleFromDb(scheduleId);
    showToast('Jadwal piket berhasil dihapus dari database.');
  };

  const handleSaveTemporarySwap = async (swap: ScheduleSwap) => {
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
    const updated = replaceMemberInSchedule(
      targetSchedule,
      targetDayOrDate,
      oldMemberId,
      newMemberId
    );
    await saveScheduleToDb(updated, true);
    showToast('Perubahan jadwal piket permanen berhasil disimpan.');
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
    <div className="min-h-screen flex flex-col bg-[#FFF9F2] text-stone-800">
      {/* Top Navigation Bar is ONLY rendered when logged into the Admin Panel.
          When on the Display view (activeTab === 'display'), no navbar or page buttons are shown. */}
      {isAdminView && loggedInAccount && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-white border-b-2 border-[#F3E3D0] sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <a
                href="#admin-attendance"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('admin_attendance');
                }}
                className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 font-display"
              >
                SiPiket OSIS
              </a>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                  isDeveloper
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-sky-100 text-sky-900 border-sky-300'
                }`}
              >
                {isDeveloper ? (
                  <Lock className="w-3 h-3 text-amber-700" />
                ) : (
                  <ShieldCheck className="w-3 h-3 text-sky-700" />
                )}
                <span>{loggedInAccount.displayName}</span>
                <span className="font-mono text-[10px] opacity-75">
                  ({loggedInAccount.role.toUpperCase()})
                </span>
              </span>
            </div>

            <nav
              aria-label="Navigasi Admin Panel"
              className="hidden lg:flex items-center gap-5 text-sm font-bold text-stone-600"
            >
              <a
                href="#admin-attendance"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('admin_attendance');
                }}
                className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                  activeTab === 'admin_attendance'
                    ? 'text-orange-600 underline underline-offset-8 decoration-2 decoration-orange-500'
                    : 'hover:text-stone-900'
                }`}
              >
                Admin Presensi
              </a>
              <a
                href="#schedules"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('schedules');
                }}
                className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                  activeTab === 'schedules'
                    ? 'text-orange-600 underline underline-offset-8 decoration-2 decoration-orange-500'
                    : 'hover:text-stone-900'
                }`}
              >
                Kelola Jadwal
              </a>
              <a
                href="#members"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('members');
                }}
                className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                  activeTab === 'members'
                    ? 'text-orange-600 underline underline-offset-8 decoration-2 decoration-orange-500'
                    : 'hover:text-stone-900'
                }`}
              >
                Anggota Piket
              </a>
              <a
                href="#recap"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('recap');
                }}
                className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                  activeTab === 'recap'
                    ? 'text-orange-600 underline underline-offset-8 decoration-2 decoration-orange-500'
                    : 'hover:text-stone-900'
                }`}
              >
                Rekap Laporan
              </a>
              {isDeveloper && (
                <a
                  href="#accounts"
                  data-testid="nav-kelola-akun"
                  onClick={(e) => {
                    e.preventDefault();
                    switchTab('accounts');
                  }}
                  className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                    activeTab === 'accounts'
                      ? 'text-orange-600 underline underline-offset-8 decoration-2 decoration-orange-500'
                      : 'hover:text-stone-900'
                  }`}
                >
                  Kelola Akun Admin
                </a>
              )}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => switchTab('display')}
                className="btn-3d-secondary px-3 sm:px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0"
              >
                Lihat Display
              </button>
              <button
                type="button"
                data-testid="btn-logout-admin"
                onClick={handleLogout}
                className="px-3 py-2 text-xs font-bold rounded-xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1.5 transition-colors"
                title="Keluar dari Admin Panel"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </header>

          {/* Mobile & Tablet Navigation Bar for Admin Panel */}
          <nav
            aria-label="Navigasi Mobile Admin"
            className="lg:hidden flex items-center gap-1.5 bg-white border-b-2 border-[#F3E3D0] px-3 py-2 overflow-x-auto"
          >
            <button
              type="button"
              onClick={() => switchTab('admin_attendance')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap ${
                activeTab === 'admin_attendance'
                  ? 'bg-orange-500 text-white'
                  : 'text-stone-600 hover:bg-orange-50'
              }`}
            >
              Presensi
            </button>
            <button
              type="button"
              onClick={() => switchTab('schedules')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap ${
                activeTab === 'schedules'
                  ? 'bg-orange-500 text-white'
                  : 'text-stone-600 hover:bg-orange-50'
              }`}
            >
              Jadwal
            </button>
            <button
              type="button"
              onClick={() => switchTab('members')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap ${
                activeTab === 'members'
                  ? 'bg-orange-500 text-white'
                  : 'text-stone-600 hover:bg-orange-50'
              }`}
            >
              Anggota
            </button>
            <button
              type="button"
              onClick={() => switchTab('recap')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap ${
                activeTab === 'recap'
                  ? 'bg-orange-500 text-white'
                  : 'text-stone-600 hover:bg-orange-50'
              }`}
            >
              Rekap
            </button>
            {isDeveloper && (
              <button
                type="button"
                onClick={() => switchTab('accounts')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap ${
                  activeTab === 'accounts'
                    ? 'bg-orange-500 text-white'
                    : 'text-stone-600 hover:bg-orange-50'
                }`}
              >
                Kelola Akun
              </button>
            )}
          </nav>
        </>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        {feedbackBanner && (
          <div
            role="status"
            className="px-4 py-3 bg-stone-900 text-amber-50 text-xs font-bold rounded-2xl border-2 border-stone-700 shadow-[0_4px_0_0_#1C1917] flex items-center justify-between"
          >
            <span>{feedbackBanner}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-amber-300 hover:text-white ml-4 text-xs"
            >
              Tutup
            </button>
          </div>
        )}

        {!isAdminView && (
          <PublicDisplayBoard
            todayStr={todayStr}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            nextPreviewDate={nextPreviewDate}
            onSelectNextPreviewDate={setNextPreviewDate}
            todaySchedules={resolvedTodaySchedules}
            nextDaySchedules={resolvedNextDaySchedules}
            allSchedules={schedules}
            members={members}
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
            onRecordAttendance={handleRecordAttendance}
            onMarkAllPresent={handleMarkAllPresent}
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
            schedules={schedules}
            members={members}
            swaps={swaps}
            attendanceRecords={attendanceRecords}
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

      {/* Subtle Floating Icon Trigger in Bottom-Right Corner when on Display View
          (Icon-only, zero text buttons to other pages on the Display Board) */}
      {!isAdminView && (
        <button
          type="button"
          onClick={() => switchTab('admin_attendance')}
          aria-label="Login Admin Panel OSIS"
          title="Login Admin Panel OSIS"
          data-testid="open-admin-panel-btn"
          className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-2xl bg-white/80 hover:bg-white border-2 border-[#E7D5C0] shadow-[0_3px_0_0_#D8C0A6] flex items-center justify-center text-stone-500 hover:text-orange-600 transition-all opacity-50 hover:opacity-100"
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
