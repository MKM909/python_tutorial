import { beforeEach, describe, expect, it } from 'vitest';
import { createProgressRecord } from './progress';
import { createLocalProgressRepository } from './progressRepository';

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
});
