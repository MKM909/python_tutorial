import type { FirebaseApp } from 'firebase/app';
import { initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getAuth, signInAnonymously } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { collection, doc, getDoc, getDocs, getFirestore, increment, setDoc, updateDoc } from 'firebase/firestore';
import type { ProgressRecord } from './progress';
import type { GroupNotification, ProgressRepository } from './progressRepository';
import { normalizeProgressCode, toGroupMemberProgress } from './progressRepository';

export type FirebaseRuntime = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

export function hasFirebaseConfig(): boolean {
  return Boolean(
    import.meta.env.MODE !== 'test' &&
      import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID,
  );
}

export function createFirebaseRuntime(): FirebaseRuntime {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

export async function ensureAnonymousUser(auth: Auth): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

export function createFirestoreProgressRepository(runtime: FirebaseRuntime): ProgressRepository {
  return {
    async save(record) {
      const uid = await ensureAnonymousUser(runtime.auth);
      const progressCode = normalizeProgressCode(record.progressCode);
      const linkedUids = record.linkedUids.includes(uid) ? record.linkedUids : [...record.linkedUids, uid];
      const savedRecord = {
        ...record,
        progressCode,
        linkedUids,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(runtime.db, 'progress', progressCode), savedRecord);
      await setDoc(
        doc(runtime.db, 'groupBoards', String(record.groupId), 'members', uid),
        toGroupMemberProgress(savedRecord, uid),
        { merge: true },
      );
      return savedRecord;
    },
    async getByCode(progressCode) {
      const uid = await ensureAnonymousUser(runtime.auth);
      const normalizedCode = normalizeProgressCode(progressCode);
      const progressRef = doc(runtime.db, 'progress', normalizedCode);
      const snapshot = await getDoc(progressRef);
      if (!snapshot.exists()) return null;
      const record = snapshot.data() as ProgressRecord;
      const linkedUids = record.linkedUids.includes(uid) ? record.linkedUids : [...record.linkedUids, uid];

      if (linkedUids.length !== record.linkedUids.length) {
        await setDoc(
          progressRef,
          {
            linkedUids,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      return {
        ...record,
        linkedUids,
      };
    },
    async listGroupMembers(groupId) {
      await ensureAnonymousUser(runtime.auth);
      const snapshot = await getDocs(collection(runtime.db, 'groupBoards', String(groupId), 'members'));
      return snapshot.docs
        .map((member) => member.data() as ReturnType<typeof toGroupMemberProgress>)
        .sort((first, second) => second.completionPercent - first.completionPercent);
    },
    async listNotifications(record) {
      const uid = await ensureAnonymousUser(runtime.auth);
      const snapshot = await getDocs(
        collection(runtime.db, 'groupBoards', String(record.groupId), 'members', uid, 'notifications'),
      );
      return snapshot.docs
        .map((notification) => notification.data() as GroupNotification)
        .filter((notification) => notification.readAt === null)
        .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    },
    async markNotificationsRead(record) {
      const uid = await ensureAnonymousUser(runtime.auth);
      const timestamp = new Date().toISOString();
      const snapshot = await getDocs(
        collection(runtime.db, 'groupBoards', String(record.groupId), 'members', uid, 'notifications'),
      );
      await Promise.all(
        snapshot.docs.map((notification) =>
          updateDoc(notification.ref, {
            readAt: timestamp,
          }),
        ),
      );
    },
    async nudgeGroupMember(groupId, memberId, sender) {
      const uid = await ensureAnonymousUser(runtime.auth);
      await updateDoc(doc(runtime.db, 'groupBoards', String(groupId), 'members', memberId), {
        nudgeCount: increment(1),
        updatedAt: new Date().toISOString(),
      });

      if (!sender) return;

      const timestamp = new Date().toISOString();
      const notificationRef = doc(
        collection(runtime.db, 'groupBoards', String(groupId), 'members', memberId, 'notifications'),
      );
      await setDoc(notificationRef, {
        id: notificationRef.id,
        groupId,
        recipientId: memberId,
        senderId: uid,
        senderName: sender.name || 'A group member',
        message: `${sender.name || 'A group member'} nudged you to check your next quest step.`,
        createdAt: timestamp,
        readAt: null,
      } satisfies GroupNotification);
    },
  };
}
