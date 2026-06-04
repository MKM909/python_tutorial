import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInAnonymously } from 'firebase/auth';
import { collection, doc, getDoc, increment, setDoc, updateDoc } from 'firebase/firestore';
import { createFirestoreProgressRepository } from './firebaseClient';
import { createProgressRecord } from './progress';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(),
  increment: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

describe('Firebase progress repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links the current anonymous user when progress is recovered by code', async () => {
    const progressRef = { collection: 'progress', id: 'G3-1234' };
    const record = createProgressRecord({
      name: 'New Device Student',
      groupId: 3,
      uid: 'old-device',
      now: '2026-06-03T12:00:00.000Z',
      randomNumber: () => 1234,
    });

    vi.mocked(signInAnonymously).mockResolvedValue({ user: { uid: 'new-device' } } as never);
    vi.mocked(doc).mockReturnValue(progressRef as never);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => record,
    } as never);

    const repository = createFirestoreProgressRepository({
      app: {},
      auth: { currentUser: null },
      db: {},
    } as never);

    const recovered = await repository.getByCode('g3-1234');

    expect(doc).toHaveBeenCalledWith({}, 'progress', 'G3-1234');
    expect(setDoc).toHaveBeenCalledWith(
      progressRef,
      {
        linkedUids: ['old-device', 'new-device'],
        updatedAt: expect.any(String),
      },
      { merge: true },
    );
    expect(recovered?.linkedUids).toEqual(['old-device', 'new-device']);
  });

  it('uses the authenticated anonymous uid as the notification sender', async () => {
    const sender = createProgressRecord({
      name: 'Class Rep',
      groupId: 1,
      uid: 'local-preview-user',
      now: '2026-06-04T10:00:00.000Z',
      randomNumber: () => 1234,
    });
    const memberRef = { collection: 'members', id: 'recipient-uid' };
    const notificationsCollection = { collection: 'notifications' };
    const notificationRef = { id: 'notice-1' };
    const incrementValue = { fieldValue: 'increment-1' };

    vi.mocked(signInAnonymously).mockResolvedValue({ user: { uid: 'sender-uid' } } as never);
    vi.mocked(doc).mockReturnValueOnce(memberRef as never).mockReturnValueOnce(notificationRef as never);
    vi.mocked(collection).mockReturnValue(notificationsCollection as never);
    vi.mocked(increment).mockReturnValue(incrementValue as never);

    const repository = createFirestoreProgressRepository({
      app: {},
      auth: { currentUser: null },
      db: {},
    } as never);

    await repository.nudgeGroupMember(1, 'recipient-uid', sender);

    expect(updateDoc).toHaveBeenCalledWith(memberRef, {
      nudgeCount: incrementValue,
      updatedAt: expect.any(String),
    });
    expect(collection).toHaveBeenCalledWith(
      {},
      'groupBoards',
      '1',
      'members',
      'recipient-uid',
      'notifications',
    );
    expect(setDoc).toHaveBeenCalledWith(
      notificationRef,
      expect.objectContaining({
        recipientId: 'recipient-uid',
        senderId: 'sender-uid',
        senderName: 'Class Rep',
      }),
    );
  });
});
