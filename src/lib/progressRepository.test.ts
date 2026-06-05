import { beforeEach, describe, expect, it } from 'vitest';
import { SETUP_STEP_IDS, createProgressRecord, markSetupStepComplete } from './progress';
import {
  createLocalProgressRepository,
  createMirroredProgressRepository,
  type ProgressRepository,
} from './progressRepository';

describe('progress repository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and recovers a progress record by progress code', async () => {
    const repository = createLocalProgressRepository();
    const record = createProgressRecord({
      name: 'Ada Student',
      groupId: 5,
      uid: 'anon-local',
      now: '2026-06-03T12:00:00.000Z',
      randomNumber: () => 7284,
    });

    await repository.save(record);
    const recovered = await repository.getByCode('G5-7284');

    expect(recovered?.name).toBe('Ada Student');
    expect(recovered?.groupId).toBe(5);
  });

  it('returns null for an unknown progress code', async () => {
    const repository = createLocalProgressRepository();

    await expect(repository.getByCode('G9-0000')).resolves.toBeNull();
  });

  it('stores nudges as unread notifications for the recipient', async () => {
    const repository = createLocalProgressRepository();
    const sender = createProgressRecord({
      name: 'Ada Student',
      groupId: 1,
      uid: 'sender',
      now: '2026-06-03T12:00:00.000Z',
      randomNumber: () => 1111,
    });
    const recipient = createProgressRecord({
      name: 'Bola Student',
      groupId: 1,
      uid: 'recipient',
      now: '2026-06-03T12:00:00.000Z',
      randomNumber: () => 2222,
    });

    await repository.save(sender);
    await repository.save(recipient);
    await repository.nudgeGroupMember(1, recipient.progressCode, sender);

    const notifications = await repository.listNotifications(recipient);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      groupId: 1,
      readAt: null,
      recipientId: 'G1-2222',
      senderId: 'G1-1111',
      senderName: 'Ada Student',
    });

    await repository.markNotificationsRead(recipient);

    expect(await repository.listNotifications(recipient)).toHaveLength(0);
  });

  it('mirrors remote saves locally so refresh can recover if Firestore is unavailable', async () => {
    const fallbackStorage = localStorage;
    const fallback = createLocalProgressRepository(fallbackStorage);
    const failingPrimary: ProgressRepository = {
      save: async () => {
        throw new Error('offline');
      },
      getByCode: async () => {
        throw new Error('offline');
      },
      listGroupMembers: async () => {
        throw new Error('offline');
      },
      listNotifications: async () => {
        throw new Error('offline');
      },
      markNotificationsRead: async () => {
        throw new Error('offline');
      },
      nudgeGroupMember: async () => {
        throw new Error('offline');
      },
    };
    const repository = createMirroredProgressRepository(failingPrimary, fallback);
    const record = createProgressRecord({
      name: 'Refresh Student',
      groupId: 3,
      uid: 'anon-local',
      now: '2026-06-03T12:00:00.000Z',
      randomNumber: () => 3333,
    });

    await repository.save(record);

    const recovered = await repository.getByCode('G3-3333');
    expect(recovered?.name).toBe('Refresh Student');
    expect(recovered?.progressCode).toBe('G3-3333');
  });

  it('keeps the local record when Firestore returns an older progress snapshot', async () => {
    const fallback = createLocalProgressRepository(localStorage);
    const remoteRecord = createProgressRecord({
      name: 'Stale Remote',
      groupId: 4,
      uid: 'remote',
      now: '2026-06-03T12:00:00.000Z',
      randomNumber: () => 4444,
    });
    const localRecord = SETUP_STEP_IDS.reduce((record, step) => markSetupStepComplete(record, step), remoteRecord);
    const savedToPrimary: Array<typeof localRecord> = [];
    const primary: ProgressRepository = {
      save: async (record) => {
        savedToPrimary.push(record);
        return record;
      },
      getByCode: async () => remoteRecord,
      listGroupMembers: async () => [],
      listNotifications: async () => [],
      markNotificationsRead: async () => undefined,
      nudgeGroupMember: async () => undefined,
    };
    await fallback.save(localRecord);

    const repository = createMirroredProgressRepository(primary, fallback);
    const recovered = await repository.getByCode('G4-4444');

    expect(recovered?.completedSteps).toContain('setup');
    expect(recovered?.setupCompletedSteps).toHaveLength(5);
    expect(savedToPrimary.at(-1)?.completedSteps).toContain('setup');
  });
});
