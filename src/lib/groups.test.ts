import { describe, expect, it } from 'vitest';
import { getGroupFeaturePdfFilename, getGroupStarterKitFilename, groupFeaturePacks } from './groups';

describe('group feature packs', () => {
  it('defines exactly 14 unique beginner-friendly group missions', () => {
    expect(groupFeaturePacks).toHaveLength(14);
    expect(new Set(groupFeaturePacks.map((group) => group.id)).size).toBe(14);
    expect(new Set(groupFeaturePacks.map((group) => group.title)).size).toBe(14);
  });

  it('gives every group at least five concrete feature tasks', () => {
    for (const group of groupFeaturePacks) {
      expect(group.features.length).toBeGreaterThanOrEqual(5);
      expect(group.features.every((feature) => feature.trim().length > 12)).toBe(true);
    }
  });

  it('uses group-specific material filenames so students download their own pack', () => {
    expect(getGroupStarterKitFilename(8)).toBe('group-8-budget-tracker-starter-kit.zip');
    expect(getGroupFeaturePdfFilename(8)).toBe('group-8-feature-pack.pdf');
  });
});
