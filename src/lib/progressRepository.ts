import type { ProgressRecord } from './progress';
import { calculateQuestState, normalizeProgressRecord } from './progress';
import { questLevels } from './quest';

const STORAGE_PREFIX = 'budget-quest-progress:';
const NUDGE_PREFIX = 'budget-quest-nudge:';
const NOTIFICATION_PREFIX = 'budget-quest-notifications:';

export type GroupMemberProgress = {
  id: string;
  name: string;
  groupId: number;
  completionPercent: number;
  completedSteps: number;
  readyForGroupMission: boolean;
  totalSteps: number;
  lastStepTitle: string;
  badgeCount: number;
  nudgeCount: number;
  updatedAt: string;
};

export type GroupNotification = {
  id: string;
  groupId: number;
  recipientId: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

const groupMissionRequiredSteps = ['join', 'setup', 'learn-basics', 'rebuild-app', 'understand-app'] as const;

export type ProgressRepository = {
  save(record: ProgressRecord): Promise<ProgressRecord>;
  getByCode(progressCode: string): Promise<ProgressRecord | null>;
  listGroupMembers(groupId: number): Promise<GroupMemberProgress[]>;
  listNotifications(record: ProgressRecord): Promise<GroupNotification[]>;
  markNotificationsRead(record: ProgressRecord): Promise<void>;
  nudgeGroupMember(groupId: number, memberId: string, sender?: ProgressRecord): Promise<void>;
};

type MirroredRepositoryOptions = {
  onError?: (error: unknown) => void;
};

export function normalizeProgressCode(code: string): string {
  return code.trim().toUpperCase();
}

function notificationStorageKey(groupId: number, memberId: string): string {
  return `${NOTIFICATION_PREFIX}${groupId}:${normalizeProgressCode(memberId)}`;
}

function readStoredNotifications(storage: Storage, groupId: number, memberId: string): GroupNotification[] {
  const raw = storage.getItem(notificationStorageKey(groupId, memberId));
  if (!raw) return [];

  try {
    const notifications = JSON.parse(raw) as GroupNotification[];
    return Array.isArray(notifications) ? notifications : [];
  } catch {
    return [];
  }
}

function writeStoredNotifications(
  storage: Storage,
  groupId: number,
  memberId: string,
  notifications: GroupNotification[],
) {
  storage.setItem(notificationStorageKey(groupId, memberId), JSON.stringify(notifications));
}

function progressDepth(record: ProgressRecord): number {
  const normalized = normalizeProgressRecord(record);
  return (
    normalized.completedSteps.length * 1000 +
    normalized.setupCompletedSteps.length * 100 +
    normalized.learnCompletedSteps.length * 10 +
    normalized.rebuildCompletedSteps.length * 10 +
    normalized.understandCompletedSteps.length * 10
  );
}

function chooseNewestUsefulRecord(
  primaryRecord: ProgressRecord | null,
  fallbackRecord: ProgressRecord | null,
): ProgressRecord | null {
  if (!primaryRecord) return fallbackRecord;
  if (!fallbackRecord) return primaryRecord;

  const primaryDepth = progressDepth(primaryRecord);
  const fallbackDepth = progressDepth(fallbackRecord);
  if (fallbackDepth > primaryDepth) return fallbackRecord;
  if (primaryDepth > fallbackDepth) return primaryRecord;

  const primaryTime = Date.parse(primaryRecord.updatedAt);
  const fallbackTime = Date.parse(fallbackRecord.updatedAt);
  return fallbackTime > primaryTime ? fallbackRecord : primaryRecord;
}

export function toGroupMemberProgress(
  record: ProgressRecord,
  id = normalizeProgressCode(record.progressCode),
  nudgeCount = 0,
): GroupMemberProgress {
  const normalized = normalizeProgressRecord(record);
  const questState = calculateQuestState({
    completedSteps: normalized.completedSteps,
    checkpointScore: normalized.checkpointScore,
    totalCheckpoints: normalized.totalCheckpoints,
    downloads: normalized.downloads,
  });
  const lastCompletedLevel = [...questLevels].reverse().find((level) => normalized.completedSteps.includes(level.id));

  return {
    id,
    name: normalized.name || 'Student',
    groupId: normalized.groupId,
    completionPercent: questState.completionPercent,
    completedSteps: normalized.completedSteps.length,
    readyForGroupMission: groupMissionRequiredSteps.every((step) => normalized.completedSteps.includes(step)),
    totalSteps: questLevels.length,
    lastStepTitle: lastCompletedLevel?.title ?? 'Not started',
    badgeCount: questState.badges.length,
    nudgeCount,
    updatedAt: normalized.updatedAt,
  };
}

export function createLocalProgressRepository(storage: Storage = window.localStorage): ProgressRepository {
  return {
    async save(record) {
      const normalized = normalizeProgressRecord(record);
      storage.setItem(`${STORAGE_PREFIX}${normalizeProgressCode(normalized.progressCode)}`, JSON.stringify(normalized));
      return normalized;
    },
    async getByCode(progressCode) {
      const raw = storage.getItem(`${STORAGE_PREFIX}${normalizeProgressCode(progressCode)}`);
      if (!raw) return null;
      return normalizeProgressRecord(JSON.parse(raw) as ProgressRecord);
    },
    async listGroupMembers(groupId) {
      const members: GroupMemberProgress[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(STORAGE_PREFIX)) continue;
        const raw = storage.getItem(key);
        if (!raw) continue;
        const record = JSON.parse(raw) as ProgressRecord;
        if (record.groupId !== groupId) continue;
        const memberId = normalizeProgressCode(record.progressCode);
        const nudgeCount = Number(storage.getItem(`${NUDGE_PREFIX}${groupId}:${memberId}`) ?? 0);
        members.push(toGroupMemberProgress(record, memberId, nudgeCount));
      }
      return members.sort((first, second) => second.completionPercent - first.completionPercent);
    },
    async listNotifications(record) {
      return readStoredNotifications(storage, record.groupId, record.progressCode)
        .filter((notification) => notification.readAt === null)
        .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    },
    async markNotificationsRead(record) {
      const timestamp = new Date().toISOString();
      const notifications = readStoredNotifications(storage, record.groupId, record.progressCode);
      writeStoredNotifications(
        storage,
        record.groupId,
        record.progressCode,
        notifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? timestamp,
        })),
      );
    },
    async nudgeGroupMember(groupId, memberId, sender) {
      const key = `${NUDGE_PREFIX}${groupId}:${memberId}`;
      const nextCount = Number(storage.getItem(key) ?? 0) + 1;
      storage.setItem(key, String(nextCount));

      if (!sender) return;

      const recipientId = normalizeProgressCode(memberId);
      const senderId = normalizeProgressCode(sender.progressCode);
      const timestamp = new Date().toISOString();
      const notifications = readStoredNotifications(storage, groupId, recipientId);
      writeStoredNotifications(storage, groupId, recipientId, [
        {
          id: `${timestamp}-${senderId}-${nextCount}`,
          groupId,
          recipientId,
          senderId,
          senderName: sender.name || 'A group member',
          message: `${sender.name || 'A group member'} nudged you to check your next quest step.`,
          createdAt: timestamp,
          readAt: null,
        },
        ...notifications,
      ]);
    },
  };
}

export function createMirroredProgressRepository(
  primary: ProgressRepository,
  fallback: ProgressRepository,
  options: MirroredRepositoryOptions = {},
): ProgressRepository {
  const report = (error: unknown) => options.onError?.(error);

  return {
    async save(record) {
      const fallbackRecord = await fallback.save(record);
      try {
        const primaryRecord = await primary.save(record);
        await fallback.save(primaryRecord);
        return primaryRecord;
      } catch (error) {
        report(error);
        return fallbackRecord;
      }
    },
    async getByCode(progressCode) {
      const fallbackRecord = await fallback.getByCode(progressCode);
      let primaryRecord: ProgressRecord | null = null;

      try {
        primaryRecord = await primary.getByCode(progressCode);
      } catch (error) {
        report(error);
      }

      const preferredRecord = chooseNewestUsefulRecord(primaryRecord, fallbackRecord);
      if (!preferredRecord) return null;

      await fallback.save(preferredRecord);

      if (fallbackRecord && preferredRecord === fallbackRecord) {
        try {
          const savedPrimaryRecord = await primary.save(fallbackRecord);
          await fallback.save(savedPrimaryRecord);
          return savedPrimaryRecord;
        } catch (error) {
          report(error);
        }
      }

      return preferredRecord;
    },
    async listGroupMembers(groupId) {
      try {
        return await primary.listGroupMembers(groupId);
      } catch (error) {
        report(error);
        return fallback.listGroupMembers(groupId);
      }
    },
    async listNotifications(record) {
      try {
        return await primary.listNotifications(record);
      } catch (error) {
        report(error);
        return fallback.listNotifications(record);
      }
    },
    async markNotificationsRead(record) {
      await fallback.markNotificationsRead(record);
      try {
        await primary.markNotificationsRead(record);
      } catch (error) {
        report(error);
      }
    },
    async nudgeGroupMember(groupId, memberId, sender) {
      await fallback.nudgeGroupMember(groupId, memberId, sender);
      try {
        await primary.nudgeGroupMember(groupId, memberId, sender);
      } catch (error) {
        report(error);
      }
    },
  };
}
