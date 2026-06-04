import type { QuestLevelId } from './quest';

export const SETUP_STEP_IDS = [
  'install-python',
  'install-vscode',
  'install-extension',
  'open-starter-kit',
  'run-first-file',
] as const;

export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

export const LEARN_STEP_IDS = [
  'what-is-python',
  'budget-tracker-idea',
  'values-print',
  'variables',
  'input',
  'money-math',
  'records-lists',
  'choices-menu',
  'functions-files',
] as const;

export type LearnStepId = (typeof LEARN_STEP_IDS)[number];

export const REBUILD_STEP_IDS = [
  'open-starter-folder',
  'create-main',
  'inspect-snippets',
  'paste-data-helpers',
  'paste-entry-actions',
  'paste-view-actions',
  'paste-menu-start',
  'check-order',
  'run-menu',
  'test-save',
] as const;

export type RebuildStepId = (typeof REBUILD_STEP_IDS)[number];

export const UNDERSTAND_STEP_IDS = [
  'data-file-shape',
  'safe-loading',
  'add-records',
  'view-transactions',
  'balance-math',
  'menu-loop',
  'save-and-exit',
] as const;

export type UnderstandStepId = (typeof UNDERSTAND_STEP_IDS)[number];

export const BADGE_IDS = {
  setupReady: 'setup-ready',
  pythonWarmup: 'python-warmup',
  baseAppRuns: 'base-app-runs',
  checkpointPassed: 'checkpoint-passed',
  groupMissionStarted: 'group-mission-started',
  demoReady: 'demo-ready',
} as const;

export type BadgeId = (typeof BADGE_IDS)[keyof typeof BADGE_IDS];

export type ProgressRecord = {
  progressCode: string;
  name: string;
  groupId: number;
  linkedUids: string[];
  completedSteps: QuestLevelId[];
  checkpointAnswers: Record<string, string>;
  checkpointScore: number;
  totalCheckpoints: number;
  badges: BadgeId[];
  downloads: string[];
  unlockedDownloads: string[];
  setupStepIndex: number;
  setupCompletedSteps: SetupStepId[];
  learnStepIndex: number;
  learnCompletedSteps: LearnStepId[];
  rebuildStepIndex: number;
  rebuildCompletedSteps: RebuildStepId[];
  understandStepIndex: number;
  understandCompletedSteps: UnderstandStepId[];
  createdAt: string;
  updatedAt: string;
};

export type QuestState = {
  badges: BadgeId[];
  isGroupMissionUnlocked: boolean;
  unlockedDownloads: string[];
  completionPercent: number;
};

const QUEST_LEVEL_ORDER: QuestLevelId[] = [
  'join',
  'setup',
  'learn-basics',
  'rebuild-app',
  'understand-app',
  'group-mission',
  'presentation-pack',
];

export function generateProgressCode(groupId: number, randomNumber = () => Math.floor(1000 + Math.random() * 9000)): string {
  const raw = randomNumber();
  const codeNumber = Math.max(0, Math.min(9999, Math.trunc(raw))).toString().padStart(4, '0');
  return `G${groupId}-${codeNumber}`;
}

export function createProgressRecord(input: {
  name: string;
  groupId: number;
  uid: string;
  now?: string;
  randomNumber?: () => number;
}): ProgressRecord {
  const timestamp = input.now ?? new Date().toISOString();
  return {
    progressCode: generateProgressCode(input.groupId, input.randomNumber),
    name: input.name.trim(),
    groupId: input.groupId,
    linkedUids: [input.uid],
    completedSteps: [],
    checkpointAnswers: {},
    checkpointScore: 0,
    totalCheckpoints: 5,
    badges: [],
    downloads: [],
    unlockedDownloads: ['starter-kit'],
    setupStepIndex: 0,
    setupCompletedSteps: [],
    learnStepIndex: 0,
    learnCompletedSteps: [],
    rebuildStepIndex: 0,
    rebuildCompletedSteps: [],
    understandStepIndex: 0,
    understandCompletedSteps: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeProgressRecord(record: ProgressRecord): ProgressRecord {
  const setupStepIndex =
    Number.isInteger(record.setupStepIndex) && record.setupStepIndex >= 0
      ? Math.min(record.setupStepIndex, SETUP_STEP_IDS.length - 1)
      : 0;
  const setupCompletedSteps = Array.isArray(record.setupCompletedSteps)
    ? record.setupCompletedSteps.filter((step): step is SetupStepId =>
        SETUP_STEP_IDS.includes(step as SetupStepId),
      )
    : [];
  const learnStepIndex =
    Number.isInteger(record.learnStepIndex) && record.learnStepIndex >= 0
      ? Math.min(record.learnStepIndex, LEARN_STEP_IDS.length - 1)
      : 0;
  const learnCompletedSteps = Array.isArray(record.learnCompletedSteps)
    ? record.learnCompletedSteps.filter((step): step is LearnStepId =>
        LEARN_STEP_IDS.includes(step as LearnStepId),
      )
    : [];
  const rebuildStepIndex =
    Number.isInteger(record.rebuildStepIndex) && record.rebuildStepIndex >= 0
      ? Math.min(record.rebuildStepIndex, REBUILD_STEP_IDS.length - 1)
      : 0;
  const rebuildCompletedSteps = Array.isArray(record.rebuildCompletedSteps)
    ? record.rebuildCompletedSteps.filter((step): step is RebuildStepId =>
        REBUILD_STEP_IDS.includes(step as RebuildStepId),
      )
    : [];
  const understandStepIndex =
    Number.isInteger(record.understandStepIndex) && record.understandStepIndex >= 0
      ? Math.min(record.understandStepIndex, UNDERSTAND_STEP_IDS.length - 1)
      : 0;
  const understandCompletedSteps = Array.isArray(record.understandCompletedSteps)
    ? record.understandCompletedSteps.filter((step): step is UnderstandStepId =>
        UNDERSTAND_STEP_IDS.includes(step as UnderstandStepId),
      )
    : [];

  return {
    ...record,
    setupStepIndex,
    setupCompletedSteps: Array.from(new Set(setupCompletedSteps)),
    learnStepIndex,
    learnCompletedSteps: Array.from(new Set(learnCompletedSteps)),
    rebuildStepIndex,
    rebuildCompletedSteps: Array.from(new Set(rebuildCompletedSteps)),
    understandStepIndex,
    understandCompletedSteps: Array.from(new Set(understandCompletedSteps)),
  };
}

export function calculateQuestState(input: {
  completedSteps: QuestLevelId[];
  checkpointScore: number;
  totalCheckpoints: number;
  downloads: string[];
}): QuestState {
  const completed = new Set(input.completedSteps);
  const badges: BadgeId[] = [];

  if (completed.has('setup')) badges.push(BADGE_IDS.setupReady);
  if (completed.has('learn-basics')) badges.push(BADGE_IDS.pythonWarmup);
  if (completed.has('rebuild-app')) badges.push(BADGE_IDS.baseAppRuns);

  const passedCheckpoints = input.totalCheckpoints > 0 && input.checkpointScore >= input.totalCheckpoints;
  if (passedCheckpoints) badges.push(BADGE_IDS.checkpointPassed);
  if (completed.has('group-mission')) badges.push(BADGE_IDS.groupMissionStarted);
  if (completed.has('presentation-pack')) badges.push(BADGE_IDS.demoReady);

  const unlockedDownloads = new Set<string>(['starter-kit', ...input.downloads]);
  if (passedCheckpoints && completed.has('understand-app')) {
    unlockedDownloads.add('group-feature-pack');
  }

  return {
    badges,
    isGroupMissionUnlocked: unlockedDownloads.has('group-feature-pack'),
    unlockedDownloads: Array.from(unlockedDownloads),
    completionPercent: Math.round((completed.size / 7) * 100),
  };
}

export function markStepComplete(record: ProgressRecord, step: QuestLevelId, now = new Date().toISOString()): ProgressRecord {
  const completedSteps = record.completedSteps.includes(step) ? record.completedSteps : [...record.completedSteps, step];
  const nextState = calculateQuestState({
    completedSteps,
    checkpointScore: record.checkpointScore,
    totalCheckpoints: record.totalCheckpoints,
    downloads: record.downloads,
  });

  return {
    ...record,
    completedSteps,
    badges: nextState.badges,
    unlockedDownloads: nextState.unlockedDownloads,
    updatedAt: now,
  };
}

export function resetCourseSection(
  record: ProgressRecord,
  step: QuestLevelId,
  now = new Date().toISOString(),
): ProgressRecord {
  const normalized = normalizeProgressRecord(record);
  const resetIndex = QUEST_LEVEL_ORDER.indexOf(step);
  if (resetIndex <= 0) return normalized;

  const completedSteps = normalized.completedSteps.filter((completedStep) => {
    const completedIndex = QUEST_LEVEL_ORDER.indexOf(completedStep);
    return completedIndex >= 0 && completedIndex < resetIndex;
  });
  const shouldReset = (levelId: QuestLevelId) => {
    const levelIndex = QUEST_LEVEL_ORDER.indexOf(levelId);
    return levelIndex >= resetIndex;
  };
  const checkpointScore = shouldReset('understand-app') ? 0 : normalized.checkpointScore;
  const nextState = calculateQuestState({
    completedSteps,
    checkpointScore,
    totalCheckpoints: normalized.totalCheckpoints,
    downloads: normalized.downloads,
  });

  return {
    ...normalized,
    completedSteps,
    checkpointScore,
    badges: nextState.badges,
    unlockedDownloads: nextState.unlockedDownloads,
    setupStepIndex: shouldReset('setup') ? 0 : normalized.setupStepIndex,
    setupCompletedSteps: shouldReset('setup') ? [] : normalized.setupCompletedSteps,
    learnStepIndex: shouldReset('learn-basics') ? 0 : normalized.learnStepIndex,
    learnCompletedSteps: shouldReset('learn-basics') ? [] : normalized.learnCompletedSteps,
    rebuildStepIndex: shouldReset('rebuild-app') ? 0 : normalized.rebuildStepIndex,
    rebuildCompletedSteps: shouldReset('rebuild-app') ? [] : normalized.rebuildCompletedSteps,
    understandStepIndex: shouldReset('understand-app') ? 0 : normalized.understandStepIndex,
    understandCompletedSteps: shouldReset('understand-app') ? [] : normalized.understandCompletedSteps,
    updatedAt: now,
  };
}

export function setSetupStep(record: ProgressRecord, stepIndex: number, now = new Date().toISOString()): ProgressRecord {
  return {
    ...normalizeProgressRecord(record),
    setupStepIndex: Math.max(0, Math.min(SETUP_STEP_IDS.length - 1, Math.trunc(stepIndex))),
    updatedAt: now,
  };
}

export function markSetupStepComplete(
  record: ProgressRecord,
  stepId: SetupStepId,
  now = new Date().toISOString(),
): ProgressRecord {
  const normalized = normalizeProgressRecord(record);
  const currentIndex = SETUP_STEP_IDS.indexOf(stepId);
  const completedSteps = new Set(normalized.setupCompletedSteps);
  completedSteps.add(stepId);
  const setupCompletedSteps = Array.from(completedSteps);
  const nextRecord = {
    ...normalized,
    setupCompletedSteps,
    setupStepIndex: Math.min(currentIndex + 1, SETUP_STEP_IDS.length - 1),
    updatedAt: now,
  };

  if (SETUP_STEP_IDS.every((id) => completedSteps.has(id))) {
    return markStepComplete(nextRecord, 'setup', now);
  }

  return nextRecord;
}

export function setLearnStep(record: ProgressRecord, stepIndex: number, now = new Date().toISOString()): ProgressRecord {
  return {
    ...normalizeProgressRecord(record),
    learnStepIndex: Math.max(0, Math.min(LEARN_STEP_IDS.length - 1, Math.trunc(stepIndex))),
    updatedAt: now,
  };
}

export function markLearnStepComplete(
  record: ProgressRecord,
  stepId: LearnStepId,
  now = new Date().toISOString(),
): ProgressRecord {
  const normalized = normalizeProgressRecord(record);
  const currentIndex = LEARN_STEP_IDS.indexOf(stepId);
  const completedSteps = new Set(normalized.learnCompletedSteps);
  completedSteps.add(stepId);
  const learnCompletedSteps = Array.from(completedSteps);
  const nextRecord = {
    ...normalized,
    learnCompletedSteps,
    learnStepIndex: Math.min(currentIndex + 1, LEARN_STEP_IDS.length - 1),
    updatedAt: now,
  };

  if (LEARN_STEP_IDS.every((id) => completedSteps.has(id))) {
    return markStepComplete(nextRecord, 'learn-basics', now);
  }

  return nextRecord;
}

export function setRebuildStep(record: ProgressRecord, stepIndex: number, now = new Date().toISOString()): ProgressRecord {
  return {
    ...normalizeProgressRecord(record),
    rebuildStepIndex: Math.max(0, Math.min(REBUILD_STEP_IDS.length - 1, Math.trunc(stepIndex))),
    updatedAt: now,
  };
}

export function markRebuildStepComplete(
  record: ProgressRecord,
  stepId: RebuildStepId,
  now = new Date().toISOString(),
): ProgressRecord {
  const normalized = normalizeProgressRecord(record);
  const currentIndex = REBUILD_STEP_IDS.indexOf(stepId);
  const completedSteps = new Set(normalized.rebuildCompletedSteps);
  completedSteps.add(stepId);
  const rebuildCompletedSteps = Array.from(completedSteps);
  const nextRecord = {
    ...normalized,
    rebuildCompletedSteps,
    rebuildStepIndex: Math.min(currentIndex + 1, REBUILD_STEP_IDS.length - 1),
    updatedAt: now,
  };

  if (REBUILD_STEP_IDS.every((id) => completedSteps.has(id))) {
    return markStepComplete(nextRecord, 'rebuild-app', now);
  }

  return nextRecord;
}

export function setUnderstandStep(record: ProgressRecord, stepIndex: number, now = new Date().toISOString()): ProgressRecord {
  return {
    ...normalizeProgressRecord(record),
    understandStepIndex: Math.max(0, Math.min(UNDERSTAND_STEP_IDS.length - 1, Math.trunc(stepIndex))),
    updatedAt: now,
  };
}

export function markUnderstandStepComplete(
  record: ProgressRecord,
  stepId: UnderstandStepId,
  now = new Date().toISOString(),
): ProgressRecord {
  const normalized = normalizeProgressRecord(record);
  const currentIndex = UNDERSTAND_STEP_IDS.indexOf(stepId);
  const completedSteps = new Set(normalized.understandCompletedSteps);
  completedSteps.add(stepId);
  const understandCompletedSteps = Array.from(completedSteps);
  const nextRecord = {
    ...normalized,
    understandCompletedSteps,
    understandStepIndex: Math.min(currentIndex + 1, UNDERSTAND_STEP_IDS.length - 1),
    updatedAt: now,
  };

  if (UNDERSTAND_STEP_IDS.every((id) => completedSteps.has(id))) {
    return markStepComplete(
      {
        ...nextRecord,
        checkpointScore: nextRecord.totalCheckpoints,
      },
      'understand-app',
      now,
    );
  }

  return nextRecord;
}
