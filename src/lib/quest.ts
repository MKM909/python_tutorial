export type QuestLevelId =
  | 'join'
  | 'setup'
  | 'learn-basics'
  | 'rebuild-app'
  | 'understand-app'
  | 'group-mission'
  | 'presentation-pack';

export type SupportSectionId =
  | 'hint-ladder'
  | 'checkpoint-questions'
  | 'group-roles'
  | 'troubleshooting'
  | 'presentation-helper'
  | 'sample-data-pack'
  | 'completion-receipt';

export type QuestLevel = {
  id: QuestLevelId;
  level: number;
  title: string;
  studentGoal: string;
  tasks: string[];
  badge?: string;
  supportSections: SupportSectionId[];
};

export const questLevels: QuestLevel[] = [
  {
    id: 'join',
    level: 0,
    title: 'Join The Quest',
    studentGoal: 'Save your name, group, and progress code before touching any code.',
    tasks: ['Enter your name.', 'Choose your group.', 'Copy your progress code somewhere safe.'],
    supportSections: [],
  },
  {
    id: 'setup',
    level: 1,
    title: 'Setup Your Tools',
    studentGoal: 'Install the tools needed to run a Python CLI project.',
    tasks: ['Install Python.', 'Install VS Code.', 'Open the starter folder in VS Code.'],
    badge: 'Setup Ready',
    supportSections: ['troubleshooting'],
  },
  {
    id: 'learn-basics',
    level: 2,
    title: 'Learn The Basics',
    studentGoal: 'Learn what Python is, how the budget tracker helps people, and the syntax needed to build it.',
    tasks: ['Understand Python instructions.', 'Learn money-in and money-out records.', 'Practice tiny syntax blocks.', 'Connect each idea to the starter kit.'],
    badge: 'Python Warmup',
    supportSections: ['hint-ladder'],
  },
  {
    id: 'rebuild-app',
    level: 3,
    title: 'Rebuild The App',
    studentGoal: 'Arrange the scattered snippets into a working main.py file.',
    tasks: ['Open the correct starter folder.', 'Create main.py.', 'Paste snippets in small groups.', 'Run and test the base tracker.'],
    badge: 'Base App Runs',
    supportSections: ['hint-ladder', 'sample-data-pack'],
  },
  {
    id: 'understand-app',
    level: 4,
    title: 'Understand The App',
    studentGoal: 'Answer simple checkpoints so you know what you are editing.',
    tasks: ['Identify where transactions are stored.', 'Identify where balance is calculated.', 'Explain the menu loop.'],
    badge: 'Checkpoint Passed',
    supportSections: ['checkpoint-questions'],
  },
  {
    id: 'group-mission',
    level: 5,
    title: 'Group Mission',
    studentGoal: 'Add your group unique features without making everyone project look the same.',
    tasks: ['Download your group feature PDF.', 'Choose at least five features.', 'Test each feature after adding it.'],
    badge: 'Group Mission Started',
    supportSections: ['group-roles', 'hint-ladder'],
  },
  {
    id: 'presentation-pack',
    level: 6,
    title: 'Presentation Pack',
    studentGoal: 'Prepare a clean demo and make sure every member can explain something.',
    tasks: ['Load sample data.', 'Prepare demo steps.', 'Export your completion receipt.'],
    badge: 'Demo Ready',
    supportSections: ['presentation-helper', 'completion-receipt'],
  },
];

export const supportSections: Record<SupportSectionId, { title: string; description: string }> = {
  'hint-ladder': {
    title: 'Hint Ladder',
    description: 'Each hard task gives a concept hint, a location hint, then a small example pattern.',
  },
  'checkpoint-questions': {
    title: 'Checkpoint Questions',
    description: 'Short questions confirm students understand the base app before they unlock group features.',
  },
  'group-roles': {
    title: 'Group Roles',
    description: 'Suggested roles help the work spread across arranger, tester, feature builder, documenter, and presenter.',
  },
  troubleshooting: {
    title: 'Troubleshooting',
    description: 'Common fixes for Python install, wrong folder, indentation errors, file not found, and app closing.',
  },
  'presentation-helper': {
    title: 'Presentation Helper',
    description: 'A simple demo script helps each group explain what they built and why it matters.',
  },
  'sample-data-pack': {
    title: 'Sample Data Pack',
    description: 'Example income and expense records make demos realistic without wasting class time.',
  },
  'completion-receipt': {
    title: 'Completion Receipt',
    description: 'Students can export a receipt showing their group, completed levels, features, and timestamp.',
  },
};
