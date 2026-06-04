import { describe, expect, it } from 'vitest';
import {
  BADGE_IDS,
  LEARN_STEP_IDS,
  REBUILD_STEP_IDS,
  SETUP_STEP_IDS,
  UNDERSTAND_STEP_IDS,
  calculateQuestState,
  createProgressRecord,
  generateProgressCode,
  markRebuildStepComplete,
  resetCourseSection,
  type ProgressRecord,
} from './progress';

describe('progress logic', () => {
  it('generates readable progress codes with group prefix', () => {
    const code = generateProgressCode(7, () => 4821);

    expect(code).toBe('G7-4821');
  });

  it('creates a starter progress record with locked group mission', () => {
    const record = createProgressRecord({
      name: 'Ada Student',
      groupId: 3,
      uid: 'anon-123',
      now: '2026-06-03T12:00:00.000Z',
      randomNumber: () => 1099,
    });

    expect(record.progressCode).toBe('G3-1099');
    expect(record.completedSteps).toEqual([]);
    expect(record.linkedUids).toEqual(['anon-123']);
    expect(record.unlockedDownloads).toEqual(['starter-kit']);
  });

  it('unlocks group mission and awards meaningful badges after checkpoint success', () => {
    const state = calculateQuestState({
      completedSteps: ['setup', 'learn-basics', 'rebuild-app', 'understand-app'],
      checkpointScore: 5,
      totalCheckpoints: 5,
      downloads: ['starter-kit'],
    });

    expect(state.isGroupMissionUnlocked).toBe(true);
    expect(state.badges).toContain(BADGE_IDS.baseAppRuns);
    expect(state.badges).toContain(BADGE_IDS.checkpointPassed);
    expect(state.unlockedDownloads).toContain('group-feature-pack');
  });

  it('tracks rebuild substeps and completes the rebuild level after the last one', () => {
    const record = createProgressRecord({
      name: 'Ada Student',
      groupId: 1,
      uid: 'anon-123',
      now: '2026-06-03T12:00:00.000Z',
      randomNumber: () => 1234,
    });

    const rebuilt = REBUILD_STEP_IDS.reduce(
      (current, stepId) => markRebuildStepComplete(current, stepId, '2026-06-03T12:30:00.000Z'),
      record,
    );

    expect(rebuilt.rebuildCompletedSteps).toEqual(REBUILD_STEP_IDS);
    expect(rebuilt.rebuildStepIndex).toBe(REBUILD_STEP_IDS.length - 1);
    expect(rebuilt.completedSteps).toContain('rebuild-app');
    expect(rebuilt.badges).toContain(BADGE_IDS.baseAppRuns);
  });

  it('resets a completed course section and later sections for a safe retake', () => {
    const record: ProgressRecord = {
      ...createProgressRecord({
        name: 'Ada Student',
        groupId: 1,
        uid: 'anon-123',
        now: '2026-06-03T12:00:00.000Z',
        randomNumber: () => 1234,
      }),
      completedSteps: ['join', 'setup', 'learn-basics', 'rebuild-app', 'understand-app', 'group-mission'],
      setupCompletedSteps: Array.from(SETUP_STEP_IDS),
      learnCompletedSteps: Array.from(LEARN_STEP_IDS),
      rebuildCompletedSteps: Array.from(REBUILD_STEP_IDS),
      understandCompletedSteps: Array.from(UNDERSTAND_STEP_IDS),
      checkpointScore: 5,
      unlockedDownloads: ['starter-kit', 'group-feature-pack'],
    };

    const reset = resetCourseSection(record, 'learn-basics', '2026-06-03T13:00:00.000Z');

    expect(reset.completedSteps).toEqual(['join', 'setup']);
    expect(reset.learnCompletedSteps).toEqual([]);
    expect(reset.rebuildCompletedSteps).toEqual([]);
    expect(reset.understandCompletedSteps).toEqual([]);
    expect(reset.checkpointScore).toBe(0);
    expect(reset.unlockedDownloads).not.toContain('group-feature-pack');
  });
});
