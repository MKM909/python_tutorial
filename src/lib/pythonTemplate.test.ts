import { describe, expect, it } from 'vitest';
import { buildPythonStarterFiles } from './pythonTemplate';

describe('python starter kit', () => {
  it('creates beginner snippets and a complete reference solution', () => {
    const files = buildPythonStarterFiles();
    const names = files.map((file) => file.path);

    expect(names).toContain('reference/main.py');
    expect(names).toContain('snippets/01_header.py');
    expect(names).toContain('README_NUDGE.md');
    expect(files.filter((file) => file.path.startsWith('snippets/')).length).toBeGreaterThanOrEqual(8);
  });

  it('keeps the reference solution focused on expected CLI budget tracker basics', () => {
    const files = buildPythonStarterFiles();
    const main = files.find((file) => file.path === 'reference/main.py')?.content ?? '';

    expect(main).toContain('def add_income');
    expect(main).toContain('def add_expense');
    expect(main).toContain('def view_balance');
    expect(main).toContain('def save_data');
    expect(main).toContain('def main_menu');
  });
});
