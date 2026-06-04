import { describe, expect, it } from 'vitest';
import { questLevels } from './quest';

describe('quest levels', () => {
  it('keeps the learning curve in the intended order', () => {
    expect(questLevels.map((level) => level.id)).toEqual([
      'join',
      'setup',
      'learn-basics',
      'rebuild-app',
      'understand-app',
      'group-mission',
      'presentation-pack',
    ]);
  });

  it('includes the seven support ideas as concrete portal sections', () => {
    const supportSections = questLevels.flatMap((level) => level.supportSections);

    expect(supportSections).toEqual(
      expect.arrayContaining([
        'hint-ladder',
        'checkpoint-questions',
        'group-roles',
        'troubleshooting',
        'presentation-helper',
        'sample-data-pack',
        'completion-receipt',
      ]),
    );
  });
});
