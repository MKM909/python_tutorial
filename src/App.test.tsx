import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createLocalProgressRepository } from './lib/progressRepository';
import {
  createProgressRecord,
  LEARN_STEP_IDS,
  REBUILD_STEP_IDS,
  type LearnStepId,
  type RebuildStepId,
  type UnderstandStepId,
} from './lib/progress';
import type { QuestLevelId } from './lib/quest';

describe('Budget Tracker Quest portal', () => {
  beforeEach(() => {
    localStorage.clear();
    document.getElementById('budget-quest-brython-core-preload')?.remove();
    document.getElementById('budget-quest-brython-stdlib-preload')?.remove();
    window.history.pushState({}, '', '/');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  function joinQuest(name = 'Ada Student', group = '1') {
    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: name } });
    fireEvent.change(screen.getByLabelText(/group/i), { target: { value: group } });
    fireEvent.click(screen.getByRole('button', { name: /start my quest/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy progress code/i }));
    fireEvent.click(screen.getByRole('button', { name: /close registration dialog/i }));
  }

  function closeCompletionDialogIfOpen() {
    const closeButton = screen.queryByRole('button', { name: /close completion celebration/i });
    if (closeButton) fireEvent.click(closeButton);
  }

  function completeSetupStepper(options: { keepDialog?: boolean } = {}) {
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: /i did this/i }));
    }
    if (!options.keepDialog) closeCompletionDialogIfOpen();
  }

  function completeLearnStepper() {
    const correctAnswers = [
      /a language for giving the computer step-by-step instructions/i,
      /money that enters, money that leaves, and what remains/i,
      /text because it is inside quotes/i,
      /a name that stores a value/i,
      /waits for what the user types/i,
      /changes typed money into a number/i,
      /many saved transactions/i,
      /choose which function to run/i,
      /keeps a group of steps together/i,
    ];
    const challengeAnswers = ['print', '-', 'print', '=', 'input', 'float', 'append', 'if', 'def'];

    for (let index = 0; index < correctAnswers.length; index += 1) {
      while (!screen.queryByRole('radio', { name: correctAnswers[index] })) {
        const missingCodeInputs = screen.queryAllByLabelText(/missing code/i);
        if (missingCodeInputs.length > 0) {
          missingCodeInputs.forEach((missingCodeInput) => {
            fireEvent.change(missingCodeInput, { target: { value: challengeAnswers[index] } });
          });
          fireEvent.click(screen.getByRole('button', { name: /check blank/i }));
        }
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      }
      fireEvent.click(screen.getByRole('radio', { name: correctAnswers[index] }));
      fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
      fireEvent.click(screen.getByRole('button', { name: /i understand this/i }));
    }
    closeCompletionDialogIfOpen();
  }

  function finishCurrentRebuildStep() {
    let continueButton = screen.queryByRole('button', { name: /continue/i });
    while (continueButton) {
      fireEvent.click(continueButton);
      continueButton = screen.queryByRole('button', { name: /continue/i });
    }
    fireEvent.click(screen.getByRole('button', { name: /i did this/i }));
  }

  function completeRebuildStepper() {
    for (let index = 0; index < REBUILD_STEP_IDS.length; index += 1) {
      finishCurrentRebuildStep();
    }
    closeCompletionDialogIfOpen();
  }

  function completeUnderstandStepper() {
    const correctAnswers = [
      /many income records and many expense records can be stored separately/i,
      /start cleanly instead of crashing/i,
      /new record into data\["income"\]/i,
      /each saved record one by one/i,
      /totals income, totals expenses, then subtracts/i,
      /choose actions again until save and exit/i,
      /writes the current data dictionary into budget_data\.json/i,
    ];
    const challengeAnswers = ['"income"', 'FileNotFoundError', 'append', 'for', 'sum', 'elif', 'json.dumps'];

    for (let index = 0; index < correctAnswers.length; index += 1) {
      while (!screen.queryByRole('radio', { name: correctAnswers[index] })) {
        const missingCodeInputs = screen.queryAllByLabelText(/missing code/i);
        if (missingCodeInputs.length > 0) {
          missingCodeInputs.forEach((missingCodeInput) => {
            fireEvent.change(missingCodeInput, { target: { value: challengeAnswers[index] } });
          });
          fireEvent.click(screen.getByRole('button', { name: /check blank/i }));
        }
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      }
      fireEvent.click(screen.getByRole('radio', { name: correctAnswers[index] }));
      fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
      fireEvent.click(screen.getByRole('button', { name: /i get this part/i }));
    }
    closeCompletionDialogIfOpen();
  }

  function seedProgress(
    overrides: {
      completedSteps?: QuestLevelId[];
      learnStepIndex?: number;
      learnCompletedSteps?: LearnStepId[];
      rebuildStepIndex?: number;
      rebuildCompletedSteps?: RebuildStepId[];
      understandStepIndex?: number;
      understandCompletedSteps?: UnderstandStepId[];
    } = {},
  ) {
    const record = {
      ...createProgressRecord({
        name: 'Input Student',
        groupId: 1,
        uid: 'test-uid',
        now: '2026-06-03T00:00:00.000Z',
        randomNumber: () => 1234,
      }),
      ...overrides,
    };
    localStorage.setItem('budget-quest-progress:G1-1234', JSON.stringify(record));
    localStorage.setItem('budget-quest-active-progress-code', 'G1-1234');
    return record;
  }

  function seedLearnStep(stepIndex: number, learnCompletedSteps: LearnStepId[] = []) {
    seedProgress({
      completedSteps: ['join', 'setup'],
      learnStepIndex: stepIndex,
      learnCompletedSteps,
    });
  }

  it('starts with a beginner-friendly join screen', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /budget tracker quest/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/student name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/group/i)).toBeInTheDocument();
  });

  it('requires students to copy their progress code before entering the quest dashboard', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Ada Student' } });
    fireEvent.change(screen.getByLabelText(/group/i), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /start my quest/i }));

    expect(screen.getByRole('dialog', { name: /registered successfully/i })).toBeInTheDocument();
    const progressCode = screen.getByText(/^G8-/).textContent ?? '';
    const closeButton = screen.getByRole('button', { name: /close registration dialog/i });

    expect(closeButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /copy progress code/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(progressCode);
    expect(await screen.findByText(/code copied/i)).toBeInTheDocument();
    expect(closeButton).toBeEnabled();

    fireEvent.click(closeButton);

    expect(screen.getByText(/Ada Student/i)).toBeInTheDocument();
    expect(screen.getByText(progressCode)).toBeInTheDocument();
    expect(screen.getByText(/Needs Wants Savings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download group starter kit/i })).toHaveAttribute(
      'href',
      '/downloads/group-8-budget-tracker-starter-kit.zip',
    );
    expect(screen.queryByRole('link', { name: /download base starter kit/i })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/overview');
    expect(screen.getByText(/join the quest/i).closest('.level-card')).toHaveClass('complete');
  });

  it('keeps group feature downloads locked until checkpoints are passed', () => {
    render(<App />);

    joinQuest('Ada Student', '2');

    expect(screen.getByText(/locked until checkpoint/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /setup/i }));
    completeSetupStepper();
    fireEvent.click(screen.getByRole('link', { name: /learn basics/i }));
    completeLearnStepper();
    fireEvent.click(screen.getByRole('link', { name: /rebuild app/i }));
    completeRebuildStepper();
    fireEvent.click(screen.getByRole('link', { name: /understand app/i }));
    completeUnderstandStepper();
    fireEvent.click(screen.getByRole('link', { name: /overview/i }));

    expect(screen.getByRole('link', { name: /download group feature pdf/i })).toBeInTheDocument();
  });

  it('moves students between separate quest pages from the sidebar', async () => {
    render(<App />);

    joinQuest();

    expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /learn basics/i })).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(screen.getByRole('link', { name: /setup/i }));
    expect(window.location.pathname).toBe('/setup');
    expect(await screen.findByRole('heading', { name: /setup your tools/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /learn basics/i }));
    expect(window.location.pathname).toBe('/setup');

    completeSetupStepper();
    fireEvent.click(screen.getByRole('link', { name: /learn basics/i }));
    expect(window.location.pathname).toBe('/learn-basics');
    expect(await screen.findByRole('heading', { name: /learn the basics/i })).toBeInTheDocument();
  });

  it('shows the group mission in dev preview before the whole group is ready', async () => {
    render(<App />);

    joinQuest('Preview Student', '1');
    fireEvent.click(screen.getByRole('link', { name: /group mission/i }));

    expect(window.location.pathname).toBe('/group-mission');
    expect(await screen.findByText(/dev preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Savings Goals/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /1\. Choose one feature/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText(/Feature build training/i)).toBeInTheDocument();
    expect(screen.getByText(/What you might be thinking/i)).toBeInTheDocument();
    expect(screen.getByText(/Where this goes in main.py/i)).toBeInTheDocument();
    expect(screen.getByText(/Driver/i)).toBeInTheDocument();
    expect(screen.getByText(/Tiny win/i)).toBeInTheDocument();
    expect(screen.getByText(/say the feature in one sentence/i)).toBeInTheDocument();
    expect(screen.getByText(/Part 1 of 5/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /Read the feature sheet/i })).toBeInTheDocument();
    expect(screen.getByText(/copy this shape into your real project/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('region', { name: /Python practice runner/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('region', { name: /complete this code exercise/i })).toBeInTheDocument();
  });

  it('shows group progress and lets members nudge each other', async () => {
    render(<App />);

    joinQuest();
    const peer = createProgressRecord({
      name: 'Peer Student',
      groupId: 1,
      uid: 'peer-uid',
      now: '2026-06-04T10:00:00.000Z',
      randomNumber: () => 2222,
    });
    await createLocalProgressRepository().save(peer);

    fireEvent.click(screen.getByRole('button', { name: /open group room/i }));

    expect(window.location.pathname).toBe('/group');
    expect(await screen.findByRole('heading', { name: /group 1 squad check/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Ada Student/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Peer Student/i)).toBeInTheDocument();
    const peerCard = screen.getByText(/Peer Student/i).closest('article') as HTMLElement;
    expect(within(peerCard).getByText(/0 nudges/i)).toBeInTheDocument();

    fireEvent.click(within(peerCard).getByRole('button', { name: /nudge/i }));

    expect(await screen.findByText(/1 nudges/i)).toBeInTheDocument();
  });

  it('does not let a student nudge their own group card', async () => {
    render(<App />);

    joinQuest('Self Check', '1');
    fireEvent.click(screen.getByRole('button', { name: /open group room/i }));

    expect(await screen.findByRole('heading', { name: /group 1 squad check/i })).toBeInTheDocument();
    expect(await screen.findByText(/This is you/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^nudge$/i })).not.toBeInTheDocument();
  });

  it('offers progress code fields to browser password managers', async () => {
    const store = vi.fn().mockResolvedValue(undefined);
    const passwordCredential = vi.fn((credential) => credential);

    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { store },
    });
    Object.defineProperty(window, 'PasswordCredential', {
      configurable: true,
      value: passwordCredential,
    });

    render(<App />);

    expect(screen.getByLabelText(/already have a progress code/i)).toHaveAttribute('autocomplete', 'current-password');
    joinQuest('Saved Credential Student', '2');

    await waitFor(() => {
      expect(passwordCredential).toHaveBeenCalledWith({
        id: 'Saved Credential Student',
        name: 'Saved Credential Student',
        password: expect.stringMatching(/^G2-/),
      });
    });
    expect(store).toHaveBeenCalled();
  });

  it('shows pending group nudges in a notification center and popup on return', async () => {
    const recipient = seedProgress({
      completedSteps: ['join', 'setup', 'learn-basics'],
    });
    const sender = createProgressRecord({
      name: 'Class Rep',
      groupId: 1,
      uid: 'class-rep',
      now: '2026-06-04T10:00:00.000Z',
      randomNumber: () => 9999,
    });
    const repository = createLocalProgressRepository();
    await repository.save(sender);
    await repository.nudgeGroupMember(1, recipient.progressCode, sender);

    render(<App />);

    const nudgePopup = await screen.findByRole('dialog', { name: /pending group nudges/i });
    expect(nudgePopup).toBeInTheDocument();
    expect(screen.getByText(/Class Rep nudged you/i)).toBeInTheDocument();

    fireEvent.click(within(nudgePopup).getByRole('button', { name: /open notifications/i }));

    const notificationCenter = screen.getByRole('region', { name: /notifications/i });
    expect(notificationCenter).toBeInTheDocument();
    expect(within(notificationCenter).getByText('Class Rep')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));

    expect(await screen.findByText(/No pending nudges/i)).toBeInTheDocument();
  });

  it('recovers saved progress using a progress code', async () => {
    const firstRender = render(<App />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Saved Student' } });
    fireEvent.change(screen.getByLabelText(/group/i), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /start my quest/i }));

    const code = screen.getByText(/^G4-/).textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: /copy progress code/i }));
    fireEvent.click(screen.getByRole('button', { name: /close registration dialog/i }));
    firstRender.unmount();
    cleanup();
    localStorage.removeItem('budget-quest-active-progress-code');

    render(<App />);
    fireEvent.change(screen.getByLabelText(/already have a progress code/i), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: /continue with code/i }));

    expect(await screen.findByText(/Saved Student/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Search And Filter/i).length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe('/overview');
  });

  it('persists the current setup substep after refresh', async () => {
    const firstRender = render(<App />);

    joinQuest();
    fireEvent.click(screen.getByRole('link', { name: /setup/i }));

    expect(await screen.findByRole('button', { name: /1\. Python command works/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    fireEvent.click(screen.getByRole('button', { name: /i did this/i }));
    expect(await screen.findByRole('button', { name: /2\. VS Code opens/i })).toHaveAttribute('aria-current', 'step');

    firstRender.unmount();
    cleanup();
    window.history.pushState({}, '', '/setup');
    render(<App />);

    expect(await screen.findByRole('button', { name: /2\. VS Code opens/i })).toHaveAttribute('aria-current', 'step');
  });

  it('automatically completes setup after the final setup substep', async () => {
    render(<App />);

    joinQuest();
    fireEvent.click(screen.getByRole('link', { name: /setup/i }));
    completeSetupStepper({ keepDialog: true });

    const celebrationDialog = await screen.findByRole('dialog', { name: /setup complete/i });
    expect(celebrationDialog).toBeInTheDocument();
    fireEvent.click(within(celebrationDialog).getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('link', { name: /overview/i }));
    expect(screen.getByText(/install tools/i).closest('.roadmap-card')).toHaveClass('complete');
  });

  it('teaches Python basics through a persisted stepper and summary popup', async () => {
    seedProgress({ completedSteps: ['join', 'setup'] });
    window.history.pushState({}, '', '/learn-basics');
    const firstRender = render(<App />);

    expect(await screen.findByRole('button', { name: /1\. What Python is/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText(/No Python knowledge needed/i)).toBeInTheDocument();
    expect(screen.getByText(/Part 1 of 7/i)).toBeInTheDocument();
    expect(document.getElementById('budget-quest-brython-core-preload')).toHaveAttribute('rel', 'preload');
    expect(document.getElementById('budget-quest-brython-stdlib-preload')).toHaveAttribute('rel', 'preload');
    expect(screen.queryByText(/print\("Hello, budget tracker"\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/What is Python in this course/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/Part 2 of 7/i)).toBeInTheDocument();
    expect(screen.getByText(/Human idea/i)).toBeInTheDocument();
    expect(screen.getAllByText(/print\("Hello, budget tracker"\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Python is a language for giving a computer clear instructions/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/practice python code/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /run this code exercise/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/Part 3 of 7/i)).toBeInTheDocument();
    expect(screen.getByText(/mini code lab/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/practice python code/i)).toHaveValue('print("Hello, budget tracker")');
    expect(screen.getByRole('region', { name: /run this code exercise/i })).toContainElement(
      screen.getByLabelText(/practice python code/i),
    );
    expect(screen.getByRole('list', { name: /python editor line numbers/i })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /run python/i })).toBeInTheDocument();
    const initialTerminalOutput = screen.getByText(/output will appear here/i);
    expect(initialTerminalOutput).toBeInTheDocument();
    expect(initialTerminalOutput.closest('.terminal-line')).toHaveTextContent(/>\s*Output will appear here/i);
    const pythonTerminal = screen.getByRole('region', { name: /python terminal/i });
    const pythonLab = screen.getByLabelText(/practice python code/i).closest('.python-runner-lab');
    expect(screen.queryByText(/^Practice Python code$/i)).not.toBeInTheDocument();
    expect(pythonLab).toContainElement(pythonTerminal);
    expect(pythonTerminal.querySelector('.python-terminal-top')).not.toHaveTextContent(/terminal|output/i);
    const runPythonButton = screen.getByRole('button', { name: /run python/i });
    expect(runPythonButton).toHaveTextContent('');
    expect(pythonTerminal.querySelector('.terminal-window-dots')).not.toBeInTheDocument();
    expect(pythonTerminal).toContainElement(runPythonButton);
    expect(pythonTerminal).toContainElement(screen.getByRole('button', { name: /reset python/i }));
    expect(screen.queryByLabelText(/sample input/i)).not.toBeInTheDocument();

    const practiceEditor = screen.getByLabelText(/practice python code/i) as HTMLTextAreaElement;
    fireEvent.change(practiceEditor, { target: { value: 'if True:' } });
    practiceEditor.selectionStart = 'if True:'.length;
    practiceEditor.selectionEnd = 'if True:'.length;
    fireEvent.keyDown(practiceEditor, { key: 'Enter', code: 'Enter' });
    expect(practiceEditor).toHaveValue('if True:\n    ');
    fireEvent.change(practiceEditor, { target: { value: 'while True:\n    pass' } });
    fireEvent.click(screen.getByRole('button', { name: /run python/i }));
    const foreverLoopError = screen.getByText(/This looks like a forever loop/i);
    expect(foreverLoopError).toBeInTheDocument();
    expect(foreverLoopError.closest('.terminal-line')).toHaveClass('error');
    fireEvent.change(practiceEditor, { target: { value: 'print("Clean run")' } });
    fireEvent.click(runPythonButton);
    expect(screen.queryByText(/This looks like a forever loop/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Ran successfully/i).closest('.terminal-line')).toHaveTextContent(
      />\s*Ran successfully/,
    );

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/Part 4 of 7/i)).toBeInTheDocument();
    expect(screen.getByText(/Tell Python to show something in the terminal/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /complete this code exercise/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/Part 5 of 7/i)).toBeInTheDocument();
    const codeExercise = screen.getByRole('region', { name: /complete this code exercise/i });
    expect(codeExercise).toBeInTheDocument();
    expect(screen.queryByText(/fill the blank/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Which function shows text in the terminal/i)).toBeInTheDocument();
    const missingCodeInput = screen.getByLabelText(/missing code/i);
    expect(missingCodeInput.closest('.inline-code-line')).toBeInTheDocument();
    expect(codeExercise.querySelector('.code-challenge-copy')).not.toBeInTheDocument();
    expect(codeExercise.querySelector('.inline-code-token.string')).toHaveTextContent('"Hello, budget tracker"');
    expect(codeExercise.querySelector('.inline-code-line-numbers')).toHaveClass('pinned-gutter');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    fireEvent.change(missingCodeInput, { target: { value: 'print()' } });
    fireEvent.click(within(codeExercise).getByRole('button', { name: /run python/i }));
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    expect(screen.getByText(/only type the missing part/i)).toBeInTheDocument();
    fireEvent.change(missingCodeInput, { target: { value: 'print' } });
    fireEvent.click(within(codeExercise).getByRole('button', { name: /run python/i }));
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/Part 6 of 7/i)).toBeInTheDocument();
    expect(screen.getByText(/Try it in your head/i)).toBeInTheDocument();
    expect(screen.getByText(/What should appear in the terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/Where this appears in the budget tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/This first print line is practice for menu text/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/Part 7 of 7/i)).toBeInTheDocument();
    expect(screen.getByText(/What is Python in this course/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i understand this/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /a language for giving the computer step-by-step instructions/i }));
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
    expect(screen.getByText(/Correct - Python is the instruction language/i)).toBeInTheDocument();
    expect(screen.getByTitle(/what programming means/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /summary/i }));

    expect(screen.getByRole('dialog', { name: /python beginner rescue guide/i })).toBeInTheDocument();
    expect(screen.getByText(/A budget tracker is a small money notebook/i)).toBeInTheDocument();
    expect(screen.getByText(/Python syntax survival kit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close summary/i }));
    fireEvent.click(screen.getByRole('button', { name: /i understand this/i }));
    expect(await screen.findByRole('button', { name: /2\. What the tracker does/i })).toHaveAttribute(
      'aria-current',
      'step',
    );

    firstRender.unmount();
    cleanup();
    window.history.pushState({}, '', '/learn-basics');
    render(<App />);

    expect(await screen.findByRole('button', { name: /2\. What the tracker does/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
  }, 15000);

  it('keeps input practice inside the terminal instead of a separate sample box', async () => {
    seedLearnStep(4, ['what-is-python', 'budget-tracker-idea', 'values-print', 'variables']);
    window.history.pushState({}, '', '/learn-basics');

    render(<App />);

    expect(await screen.findByRole('button', { name: /5\. Asking the user/i })).toHaveAttribute(
      'aria-current',
      'step',
    );

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.queryByLabelText(/sample input/i)).not.toBeInTheDocument();
    expect(screen.getByText(/output will appear here/i).closest('.terminal-line')).toHaveTextContent(
      />\s*Output will appear here/i,
    );
    expect(screen.queryByLabelText(/terminal input for Enter income source/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /run python/i }));
    const terminalInput = screen.getByLabelText(/terminal input for Enter income source/i);
    expect(terminalInput).toHaveClass('terminal-inline-input');
    expect(terminalInput).toHaveStyle({ width: '11ch' });
    expect(terminalInput.closest('.terminal-line')).toHaveClass('prompt');
    expect(terminalInput.closest('.terminal-line')).toHaveTextContent(/>\s*Enter income source:/i);
    expect(terminalInput).toHaveValue('Allowance');
    fireEvent.keyDown(terminalInput, { key: 'Enter', code: 'Enter' });
    expect(screen.getByText(/Allowance/i).closest('.terminal-line')).toHaveClass('output');
  });

  it('automatically completes learn basics after the final learning substep', async () => {
    seedProgress({
      completedSteps: ['join', 'setup'],
      learnStepIndex: LEARN_STEP_IDS.length - 1,
      learnCompletedSteps: Array.from(LEARN_STEP_IDS.slice(0, -1)),
    });
    window.history.pushState({}, '', '/learn-basics');
    render(<App />);

    expect(await screen.findByRole('button', { name: /9\. Functions and files/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    while (!screen.queryByRole('radio', { name: /keeps a group of steps together/i })) {
      const missingCodeInputs = screen.queryAllByLabelText(/missing code/i);
      if (missingCodeInputs.length > 0) {
        missingCodeInputs.forEach((missingCodeInput) => {
          fireEvent.change(missingCodeInput, { target: { value: 'def' } });
        });
        fireEvent.click(screen.getByRole('button', { name: /check blank/i }));
      }
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    }
    fireEvent.click(screen.getByRole('radio', { name: /keeps a group of steps together/i }));
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /i understand this/i }));

    expect(await screen.findByText(/learning complete/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /overview/i }));
    expect(screen.getByText(/watch basics/i).closest('.roadmap-card')).toHaveClass('complete');
  });

  it('guides groups through rebuilding the app with a persisted snippet workbench', async () => {
    seedProgress({ completedSteps: ['join', 'setup', 'learn-basics'] });
    window.history.pushState({}, '', '/rebuild-app');
    const firstRender = render(<App />);

    expect(await screen.findByRole('button', { name: /1\. Open starter folder/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText(/Build main.py one safe piece at a time/i)).toBeInTheDocument();
    expect(screen.getByText(/Part 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Open the correct folder first/i)).toBeInTheDocument();
    expect(screen.getByTitle(/VS Code: open a folder/i)).toBeInTheDocument();
    expect(screen.queryByText(/01_header.py/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NameError: load_data is not defined/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Part 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Run check/i)).toBeInTheDocument();
    expect(screen.getByText(/This proves you are not working inside the zip/i)).toBeInTheDocument();
    expect(screen.queryByText(/01_header.py/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NameError: load_data is not defined/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /i did this/i }));
    expect(await screen.findByRole('button', { name: /2\. Create main.py/i })).toHaveAttribute(
      'aria-current',
      'step',
    );

    finishCurrentRebuildStep();
    expect(await screen.findByRole('button', { name: /3\. Read snippet order/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText(/Part 1 of 3/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Part 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/01_header.py/i)).toBeInTheDocument();
    expect(screen.getByText(/09_start_app.py/i)).toBeInTheDocument();
    expect(screen.queryByText(/NameError: load_data is not defined/i)).not.toBeInTheDocument();

    finishCurrentRebuildStep();
    finishCurrentRebuildStep();
    finishCurrentRebuildStep();
    finishCurrentRebuildStep();
    finishCurrentRebuildStep();

    expect(await screen.findByRole('button', { name: /8\. Check the flow/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Part 3 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Part 4 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/NameError: load_data is not defined/i)).toBeInTheDocument();

    firstRender.unmount();
    cleanup();
    window.history.pushState({}, '', '/rebuild-app');
    render(<App />);

    expect(await screen.findByRole('button', { name: /8\. Check the flow/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('walks students through understanding the finished app with gated code practice', async () => {
    seedProgress({ completedSteps: ['join', 'setup', 'learn-basics', 'rebuild-app'] });
    window.history.pushState({}, '', '/understand-app');
    const firstRender = render(<App />);

    expect(await screen.findByRole('button', { name: /1\. Data file shape/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.queryByRole('heading', { name: /what to finish here/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Trace the base app like a story/i)).toBeInTheDocument();
    expect(screen.getByText(/Part 1 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/budget_data\.json/i)).toBeInTheDocument();
    expect(screen.getByText(/What to notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Where students get confused/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /many income records/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Part 2 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/return \{"income": \[\], "expenses": \[\]\}/i)).toBeInTheDocument();
    expect(screen.getAllByText(/starter file/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/In the real file/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Part 3 of 5/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/practice python code/i)).toHaveValue(
      'data = {"income": [], "expenses": []}\nprint(data["income"])\nprint(data["expenses"])',
    );
    fireEvent.click(screen.getByRole('button', { name: /run python/i }));
    expect(screen.getByText(/ran successfully/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Part 4 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /complete this code exercise/i })).toBeInTheDocument();
    expect(screen.getByText(/Which quoted key stores money coming in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/missing code/i), { target: { value: 'income' } });
    fireEvent.click(screen.getByRole('button', { name: /run python/i }));
    expect(screen.getByText(/wrap it in quotes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/missing code/i), { target: { value: '"income"' } });
    fireEvent.click(screen.getByRole('button', { name: /run python/i }));
    expect(screen.getByText(/Correct - income is the key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Part 5 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i get this part/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /many income records and many expense records can be stored separately/i }));
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
    expect(screen.getByText(/Correct - the tracker is two neat lists/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i get this part/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /i get this part/i }));

    expect(await screen.findByRole('button', { name: /2\. Safe loading/i })).toHaveAttribute(
      'aria-current',
      'step',
    );

    firstRender.unmount();
    cleanup();
    window.history.pushState({}, '', '/understand-app');
    render(<App />);

    expect(await screen.findByRole('button', { name: /2\. Safe loading/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('turns the presentation tab into a rehearsal room with retake controls', async () => {
    seedProgress({
      completedSteps: ['join', 'setup', 'learn-basics', 'rebuild-app', 'understand-app', 'group-mission'],
    });
    window.history.pushState({}, '', '/presentation');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /presentation pack/i })).toBeInTheDocument();
    expect(screen.getByText(/presentation rehearsal room/i)).toBeInTheDocument();
    expect(screen.getByText(/Roadmap recap/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo script/i)).toBeInTheDocument();
    expect(screen.getByText(/Each member says/i)).toBeInTheDocument();
    expect(screen.getByText(/Show the feature from the menu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retake learn the basics/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mark presentation pack complete/i }));

    const celebrationDialog = await screen.findByRole('dialog', { name: /presentation pack complete/i });
    expect(celebrationDialog).toBeInTheDocument();
    expect(within(celebrationDialog).getByRole('button', { name: /retake presentation pack/i })).toBeInTheDocument();
    fireEvent.click(within(celebrationDialog).getByRole('button', { name: /continue/i }));

    fireEvent.click(screen.getByRole('button', { name: /retake learn the basics/i }));

    expect(window.location.pathname).toBe('/learn-basics');
    expect(await screen.findByRole('button', { name: /1\. What Python is/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('shows a celebratory dialog when a course section is completed', async () => {
    render(<App />);

    joinQuest('Ada Student', '4');
    fireEvent.click(screen.getByRole('link', { name: /setup/i }));
    completeSetupStepper({ keepDialog: true });

    const celebrationDialog = await screen.findByRole('dialog', { name: /setup complete/i });
    expect(celebrationDialog).toBeInTheDocument();
    expect(within(celebrationDialog).getByRole('button', { name: /retake setup/i })).toBeInTheDocument();
  });

  it('keeps the presentation tab locked until group mission is complete', async () => {
    seedProgress({
      completedSteps: ['join', 'setup', 'learn-basics', 'rebuild-app', 'understand-app'],
    });
    window.history.pushState({}, '', '/presentation');
    render(<App />);

    const lockedHeading = await screen.findByRole('heading', { name: /presentation is not open yet/i });
    expect(lockedHeading).toBeInTheDocument();
    const lockedPanel = lockedHeading.closest('.locked-quest-page') as HTMLElement;
    expect(within(lockedPanel).getByText(/Finish Group Mission first/i)).toBeInTheDocument();
    expect(screen.queryByText(/presentation rehearsal room/i)).not.toBeInTheDocument();
  });
});
