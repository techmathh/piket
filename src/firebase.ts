import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  getDocsFromServer,
  writeBatch,
} from 'firebase/firestore';
import {
  PERMANENT_DEVELOPER_ACCOUNT,
  canDeleteAccount,
  sanitizeScheduleForDb,
  type AppAccount,
  type AttendanceRecord,
  type OsisMember,
  type PiketSchedule,
  type ScheduleSwap,
} from './utils/piketLogic';

const metaEnv =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env || {};

const firebaseConfig = {
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || 'digital-web-7s7sz',
  appId:
    metaEnv.VITE_FIREBASE_APP_ID ||
    '1:600016534856:web:da2b5c85ad03a59e58477d',
  apiKey:
    metaEnv.VITE_FIREBASE_API_KEY ||
    'AIzaSyAvo1cYV60p8ID9RJKvQxkdPGimqUs4A6s',
  authDomain:
    metaEnv.VITE_FIREBASE_AUTH_DOMAIN ||
    'digital-web-7s7sz.firebaseapp.com',
  firestoreDatabaseId:
    metaEnv.VITE_FIREBASE_DATABASE_ID ||
    'ai-studio-osispikettracker-91d7bbc8-4846-4163-8084-06211ffadcdd',
  storageBucket:
    metaEnv.VITE_FIREBASE_STORAGE_BUCKET ||
    'digital-web-7s7sz.firebasestorage.app',
  messagingSenderId:
    metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '600016534856',
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'members', '_connection_check_'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type User };

// Firestore CRUD Operations for SiPiket OSIS
export async function saveMemberToDb(
  member: OsisMember,
  isUpdate = false
): Promise<void> {
  const path = `members/${member.id}`;
  try {
    const cleanMember: OsisMember = {
      id: String(member.id),
      name: String(member.name).slice(0, 120),
      kelas: String(member.kelas).slice(0, 60),
      jabatan: String(member.jabatan).slice(0, 120),
      phone: String(member.phone || '-').slice(0, 50),
      active: Boolean(member.active),
    };
    await setDoc(doc(db, 'members', cleanMember.id), cleanMember);
  } catch (err) {
    handleFirestoreError(
      err,
      isUpdate ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteMemberFromDb(memberId: string): Promise<void> {
  const path = `members/${memberId}`;
  try {
    await deleteDoc(doc(db, 'members', memberId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveScheduleToDb(
  schedule: PiketSchedule,
  isUpdate = false
): Promise<void> {
  const cleanSchedule = sanitizeScheduleForDb(schedule);
  const path = `schedules/${cleanSchedule.id}`;
  try {
    await setDoc(doc(db, 'schedules', cleanSchedule.id), cleanSchedule);
  } catch (err) {
    handleFirestoreError(
      err,
      isUpdate ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteScheduleFromDb(scheduleId: string): Promise<void> {
  const path = `schedules/${scheduleId}`;
  try {
    await deleteDoc(doc(db, 'schedules', scheduleId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveSwapToDb(swap: ScheduleSwap): Promise<void> {
  const path = `swaps/${swap.id}`;
  try {
    const cleanSwap: ScheduleSwap = {
      id: String(swap.id),
      date: String(swap.date).slice(0, 10),
      scheduleId: String(swap.scheduleId),
      originalMemberId: String(swap.originalMemberId),
      replacementMemberId: String(swap.replacementMemberId),
      reason: String(swap.reason || '').slice(0, 300),
      createdAt: String(swap.createdAt || new Date().toISOString()).slice(0, 60),
    };
    await setDoc(doc(db, 'swaps', cleanSwap.id), cleanSwap);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteSwapFromDb(swapId: string): Promise<void> {
  const path = `swaps/${swapId}`;
  try {
    await deleteDoc(doc(db, 'swaps', swapId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveAttendanceToDb(
  record: AttendanceRecord,
  isUpdate = false
): Promise<void> {
  const path = `attendance/${record.id}`;
  try {
    const cleanRecord: AttendanceRecord = {
      id: String(record.id),
      date: String(record.date).slice(0, 10),
      scheduleId: String(record.scheduleId),
      memberId: String(record.memberId),
      status: record.status,
      checkInTime: String(record.checkInTime || '-').slice(0, 20),
      note: String(record.note || '').slice(0, 500),
      recordedBy: String(record.recordedBy || 'Pengurus OSIS').slice(0, 120),
    };
    await setDoc(doc(db, 'attendance', cleanRecord.id), cleanRecord);
  } catch (err) {
    handleFirestoreError(
      err,
      isUpdate ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function saveBatchAttendanceToDb(
  records: AttendanceRecord[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const record of records) {
      const cleanRecord: AttendanceRecord = {
        id: String(record.id),
        date: String(record.date).slice(0, 10),
        scheduleId: String(record.scheduleId),
        memberId: String(record.memberId),
        status: record.status,
        checkInTime: String(record.checkInTime || '-').slice(0, 20),
        note: String(record.note || '').slice(0, 500),
        recordedBy: String(record.recordedBy || 'Pengurus OSIS').slice(0, 120),
      };
      batch.set(doc(db, 'attendance', cleanRecord.id), cleanRecord);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'attendance');
  }
}

export async function deleteAttendanceFromDb(
  attendanceId: string
): Promise<void> {
  const path = `attendance/${attendanceId}`;
  try {
    await deleteDoc(doc(db, 'attendance', attendanceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveAccountToDb(
  account: AppAccount,
  isUpdate = false
): Promise<void> {
  const path = `accounts/${account.id}`;
  try {
    const isDevAccount =
      account.id === PERMANENT_DEVELOPER_ACCOUNT.id ||
      account.role === 'developer';
    const cleanAccount: AppAccount = {
      id: String(account.id).slice(0, 100),
      username: String(account.username).trim().toLowerCase().slice(0, 60),
      password: String(account.password).slice(0, 120),
      displayName: String(account.displayName).trim().slice(0, 120),
      role: isDevAccount ? 'developer' : 'admin',
      isProtected: isDevAccount ? true : Boolean(account.isProtected),
      createdAt: String(account.createdAt || new Date().toISOString()).slice(
        0,
        60
      ),
    };
    await setDoc(doc(db, 'accounts', cleanAccount.id), cleanAccount);
  } catch (err) {
    handleFirestoreError(
      err,
      isUpdate ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteAccountFromDb(account: AppAccount): Promise<void> {
  if (!canDeleteAccount(account)) {
    throw new Error(
      'Akun Developer khusus bersifat permanen dan tidak dapat dihapus.'
    );
  }
  const path = `accounts/${account.id}`;
  try {
    await deleteDoc(doc(db, 'accounts', account.id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function seedOfficialSchedulesToDb(
  members: OsisMember[],
  schedules: PiketSchedule[]
): Promise<void> {
  try {
    const [membersSnap, schedulesSnap, devAccountSnap] = await Promise.all([
      getDocsFromServer(collection(db, 'members')),
      getDocsFromServer(collection(db, 'schedules')),
      getDocFromServer(doc(db, 'accounts', PERMANENT_DEVELOPER_ACCOUNT.id)),
    ]);

    const batch = writeBatch(db);
    let hasWrites = false;

    if (!devAccountSnap.exists()) {
      batch.set(
        doc(db, 'accounts', PERMANENT_DEVELOPER_ACCOUNT.id),
        PERMANENT_DEVELOPER_ACCOUNT
      );
      hasWrites = true;
    }

    // Only seed members if the server truly has 0 member documents
    if (membersSnap.empty) {
      for (const m of members) {
        const cleanMember: OsisMember = {
          id: String(m.id),
          name: String(m.name).slice(0, 120),
          kelas: String(m.kelas).slice(0, 60),
          jabatan: String(m.jabatan).slice(0, 120),
          phone: String(m.phone || '-').slice(0, 50),
          active: Boolean(m.active),
        };
        batch.set(doc(db, 'members', cleanMember.id), cleanMember);
      }
      hasWrites = true;
    }

    // CRITICAL: Only seed schedules if the server truly has 0 schedule documents.
    // NEVER overwrite existing schedules on the server when another device connects!
    if (schedulesSnap.empty) {
      for (const s of schedules) {
        const cleanSchedule = sanitizeScheduleForDb(s);
        batch.set(doc(db, 'schedules', cleanSchedule.id), cleanSchedule);
      }
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seed_official_schedules');
  }
}

export { collection, onSnapshot };


