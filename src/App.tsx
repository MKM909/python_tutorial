import {
  BadgeCheck,
  Bell,
  BellRing,
  BookOpenCheck,
  Bug,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileText,
  GraduationCap,
  Lightbulb,
  Lock,
  Menu,
  Play,
  PlayCircle,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, type UIEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getGroupFeaturePack, getGroupFeaturePdfFilename, getGroupStarterKitFilename, groupFeaturePacks } from './lib/groups';
import {
  type LearnStepId,
  LEARN_STEP_IDS,
  type RebuildStepId,
  REBUILD_STEP_IDS,
  type ProgressRecord,
  type QuestState,
  type SetupStepId,
  SETUP_STEP_IDS,
  calculateQuestState,
  createProgressRecord,
  markLearnStepComplete,
  markRebuildStepComplete,
  markSetupStepComplete,
  markUnderstandStepComplete,
  markStepComplete,
  resetCourseSection,
  setLearnStep,
  setRebuildStep,
  setSetupStep,
  setUnderstandStep,
  type UnderstandStepId,
  UNDERSTAND_STEP_IDS,
} from './lib/progress';
import { createFirebaseRuntime, createFirestoreProgressRepository, hasFirebaseConfig } from './lib/firebaseClient';
import {
  type GroupMemberProgress,
  type GroupNotification,
  createLocalProgressRepository,
  normalizeProgressCode,
} from './lib/progressRepository';
import { type QuestLevel, type QuestLevelId, questLevels, supportSections } from './lib/quest';

type QuestPageId =
  | 'overview'
  | 'setup'
  | 'learn-basics'
  | 'rebuild-app'
  | 'understand-app'
  | 'group-room'
  | 'group-mission'
  | 'presentation';

type QuestPage = {
  id: QuestPageId;
  path: string;
  label: string;
  icon: LucideIcon;
  levelId?: QuestLevelId;
};

const questPages: QuestPage[] = [
  { id: 'overview', path: '/overview', label: 'Overview', icon: ClipboardList },
  { id: 'setup', path: '/setup', label: 'Setup', icon: Download, levelId: 'setup' },
  { id: 'learn-basics', path: '/learn-basics', label: 'Learn Basics', icon: GraduationCap, levelId: 'learn-basics' },
  { id: 'rebuild-app', path: '/rebuild-app', label: 'Rebuild App', icon: Bug, levelId: 'rebuild-app' },
  { id: 'understand-app', path: '/understand-app', label: 'Understand App', icon: BookOpenCheck, levelId: 'understand-app' },
  { id: 'group-mission', path: '/group-mission', label: 'Group Mission', icon: Sparkles, levelId: 'group-mission' },
  { id: 'presentation', path: '/presentation', label: 'Presentation', icon: ReceiptText, levelId: 'presentation-pack' },
];

const groupRoomPage: QuestPage = { id: 'group-room', path: '/group', label: 'Group Room', icon: Users };
const allQuestPages = [...questPages, groupRoomPage];

const pageByLevelId: Partial<Record<QuestLevelId, QuestPageId>> = {
  setup: 'setup',
  'learn-basics': 'learn-basics',
  'rebuild-app': 'rebuild-app',
  'understand-app': 'understand-app',
  'group-mission': 'group-mission',
  'presentation-pack': 'presentation',
};

const groupMissionRequiredSteps: QuestLevelId[] = ['join', 'setup', 'learn-basics', 'rebuild-app', 'understand-app'];
const DEV_UNLOCK_PRESENTATION_FOR_TESTING = true;

type GroupMissionAccess = {
  allGroupReady: boolean;
  canOpen: boolean;
  currentStudentReady: boolean;
  devPreview: boolean;
  readyCount: number;
  totalCount: number;
  waitingNames: string[];
};

type PageLockMap = Partial<Record<QuestPageId, string>>;

function hasFinishedBeforeGroupMission(progress: ProgressRecord) {
  return groupMissionRequiredSteps.every((step) => progress.completedSteps.includes(step));
}

function buildGroupMissionAccess(
  progress: ProgressRecord,
  members: GroupMemberProgress[],
  loading: boolean,
): GroupMissionAccess {
  const currentStudentReady = hasFinishedBeforeGroupMission(progress);
  const readyMembers = members.filter((member) => member.readyForGroupMission);
  const waitingNames =
    members.length > 0
      ? members.filter((member) => !member.readyForGroupMission).map((member) => member.name)
      : currentStudentReady
        ? []
        : [progress.name];
  const allGroupReady = !loading && members.length > 0 && currentStudentReady && readyMembers.length === members.length;
  const devPreview = import.meta.env.DEV && !allGroupReady;

  return {
    allGroupReady,
    canOpen: allGroupReady || devPreview,
    currentStudentReady,
    devPreview,
    readyCount: members.length > 0 ? readyMembers.length : currentStudentReady ? 1 : 0,
    totalCount: members.length > 0 ? members.length : 1,
    waitingNames,
  };
}

function buildPageLocks(progress: ProgressRecord, groupMissionAccess: GroupMissionAccess): PageLockMap {
  const locks: PageLockMap = {};

  if (!progress.completedSteps.includes('setup')) {
    locks['learn-basics'] = 'Finish Setup first.';
  }
  if (!progress.completedSteps.includes('learn-basics')) {
    locks['rebuild-app'] = 'Finish Learn Basics first.';
  }
  if (!progress.completedSteps.includes('rebuild-app')) {
    locks['understand-app'] = 'Finish Rebuild App first.';
  }
  if (!groupMissionAccess.canOpen) {
    locks['group-mission'] = 'Everyone in your group must finish the earlier levels first.';
  }
  if (!DEV_UNLOCK_PRESENTATION_FOR_TESTING && !progress.completedSteps.includes('group-mission')) {
    locks.presentation = 'Finish Group Mission first.';
  }

  return locks;
}

const tutorialResources = [
  {
    title: 'Install Python',
    description: 'Download Python first. During install, tick Add Python to PATH.',
    href: 'https://www.python.org/downloads/',
    action: 'Open Python Download',
  },
  {
    title: 'Install VS Code',
    description: 'This is where you will arrange snippets and run main.py.',
    href: 'https://code.visualstudio.com/Download',
    action: 'Open VS Code Download',
  },
  {
    title: 'Python in VS Code',
    description: 'Official guide for running Python files inside VS Code.',
    href: 'https://code.visualstudio.com/docs/languages/python',
    action: 'Open VS Code Guide',
  },
];

const videos = [
  {
    title: 'Python for Beginners',
    embed: 'https://www.youtube.com/embed/eWRfhZUzrAc',
  },
  {
    title: 'Python in 1 Hour',
    embed: 'https://www.youtube.com/embed/kqtD5dpn9C8',
  },
  {
    title: 'Corey Schafer Python Playlist',
    embed: 'https://www.youtube.com/embed/_uQrJ0TkZlc',
  },
];

const ACTIVE_PROGRESS_CODE_KEY = 'budget-quest-active-progress-code';

type SetupStep = {
  id: SetupStepId;
  title: string;
  checkpoint: string;
  task: string;
  steps: string[];
  videoTitle: string;
  videoEmbed: string;
  actionHref?: string;
  actionLabel?: string;
  stuckTip: string;
};

type LearnStep = {
  id: LearnStepId;
  title: string;
  checkpoint: string;
  visual: {
    title: string;
    nodes: string[];
    note: string;
  };
  snippetName: string;
  snippet: string;
  studentHook: string;
  explain: string;
  decode: Array<{
    label: string;
    meaning: string;
  }>;
  mission: {
    title: string;
    body: string;
    example: string;
  };
  predict: {
    prompt: string;
    output: string;
    note: string;
  };
  projectBridge: {
    title: string;
    body: string;
    fileHint: string;
  };
  quiz: {
    prompt: string;
    options: Array<{
      id: string;
      label: string;
      correct: boolean;
    }>;
    correctMessage: string;
    wrongMessage: string;
  };
  videoTitle: string;
  videoEmbed: string;
  stuckTip: string;
};

type RebuildStep = {
  id: RebuildStepId;
  title: string;
  checkpoint: string;
  parts: RebuildPartId[];
  goal: string;
  actions: string[];
  snippetFiles: string[];
  coachNote: string;
  runCheck: string;
  proof: string;
  videoTitle: string;
  videoEmbed: string;
  commonMistakes: string[];
  stuckTip: string;
};

type RebuildPartId = 'task' | 'map' | 'check' | 'errors';

type RunnableLessonExample = {
  code: string;
  stdin?: string;
};

type UnderstandStep = {
  id: UnderstandStepId;
  title: string;
  checkpoint: string;
  starterFile: string;
  bigIdea: string;
  plainEnglish: string;
  walkthrough: string[];
  confusionTip: string;
  visual: {
    title: string;
    nodes: string[];
    note: string;
  };
  realCode: string;
  decode: Array<{
    label: string;
    meaning: string;
  }>;
  practice: RunnableLessonExample;
  quiz: {
    prompt: string;
    options: Array<{
      id: string;
      label: string;
      correct: boolean;
    }>;
    correctMessage: string;
    wrongMessage: string;
  };
  challenge: LearnCodeChallenge;
  videoTitle: string;
  videoEmbed: string;
  stuckTip: string;
};

type LearnCodeChallenge = {
  prompt: string;
  answer: string;
  hint: string;
  success: string;
  buildCode: (answer: string) => string;
  stdin?: string;
};

const setupSteps: SetupStep[] = [
  {
    id: 'install-python',
    title: 'Install Python',
    checkpoint: 'Python command works',
    task: 'Download Python and tick Add Python to PATH during install.',
    steps: ['Open the Python download page.', 'Download the latest stable Windows installer.', 'Run it and tick Add Python to PATH.', 'Open Command Prompt and type python --version.'],
    videoTitle: 'Official VS Code Python setup: install Python',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=23',
    actionHref: 'https://www.python.org/downloads/',
    actionLabel: 'Open Python Download',
    stuckTip: 'If python is not recognized, reinstall Python and tick Add Python to PATH on the first installer screen.',
  },
  {
    id: 'install-vscode',
    title: 'Install VS Code',
    checkpoint: 'VS Code opens',
    task: 'Install the editor you will use to arrange and run the project.',
    steps: ['Open the VS Code download page.', 'Install the Windows version.', 'Launch VS Code once after installation.', 'Keep it open for the next step.'],
    videoTitle: 'Official VS Code Python setup: editor overview',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=0',
    actionHref: 'https://code.visualstudio.com/Download',
    actionLabel: 'Open VS Code Download',
    stuckTip: 'If you see Visual Studio instead of Visual Studio Code, choose the app with the blue ribbon icon named Visual Studio Code.',
  },
  {
    id: 'install-extension',
    title: 'Install Python Extension',
    checkpoint: 'Python extension installed',
    task: 'Add the Microsoft Python extension so VS Code understands .py files.',
    steps: ['Click the Extensions icon in VS Code.', 'Search for Python.', 'Install the Python extension by Microsoft.', 'When asked, select your installed Python interpreter.'],
    videoTitle: 'Official VS Code Python setup: Python extension',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=91',
    actionHref: 'https://marketplace.visualstudio.com/items?itemName=ms-python.python',
    actionLabel: 'Open Extension Page',
    stuckTip: 'If VS Code cannot find Python, use Ctrl+Shift+P, search Python: Select Interpreter, then choose the newest Python version.',
  },
  {
    id: 'open-starter-kit',
    title: 'Open Starter Kit',
    checkpoint: 'Starter folder visible',
    task: 'Download and extract the starter kit, then open the folder in VS Code.',
    steps: ['Download your group starter kit.', 'Right-click the zip and extract it.', 'In VS Code, choose File then Open Folder.', 'Select the extracted budget tracker starter folder.'],
    videoTitle: 'Official VS Code Python setup: workspace and environment',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=149',
    actionHref: '/downloads/group-starter-kit.zip',
    actionLabel: 'Download Group Starter Kit',
    stuckTip: 'Open the folder itself, not one file inside it. You should see snippets, sample_data, and README_NUDGE.md in the explorer.',
  },
  {
    id: 'run-first-file',
    title: 'Run The App',
    checkpoint: 'Menu appears in terminal',
    task: 'Run Python from VS Code so the group knows the tools are working.',
    steps: ['Open reference/main.py for a quick tool test.', 'Click the play button at the top right.', 'Wait for the terminal panel to open.', 'Confirm the budget tracker menu appears.'],
    videoTitle: 'Official VS Code Python setup: run Python files',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=290',
    actionHref: 'https://code.visualstudio.com/docs/python/python-quick-start',
    actionLabel: 'Open VS Code Quick Start',
    stuckTip: 'If the terminal opens but nothing runs, right-click main.py and choose Run Python File in Terminal.',
  },
];

const legacyLearnSteps = [
  {
    id: 'values-variables',
    title: 'Values and variables',
    checkpoint: 'Values and variables',
    snippetName: '01_header.py',
    snippet: `import json

DATA_FILE = "budget_data.json"`,
    studentHook: 'This is the small top part that tells Python which tool to bring in and where the budget records will live.',
    explain:
      'A value is the actual thing, like "budget_data.json". A variable is the name pointing to that thing. In this project, DATA_FILE is a shortcut so the rest of the app can say "use the budget file" without typing the file name again and again.',
    decode: [
      {
        label: 'import json',
        meaning: 'Bring in Python support for reading and writing JSON files. JSON is how the app stores the budget list.',
      },
      {
        label: 'DATA_FILE',
        meaning: 'This variable is a label for the save file. This line gives the save file a nickname.',
      },
      {
        label: '"budget_data.json"',
        meaning: 'The actual file name. The quotes mean Python should treat it as text.',
      },
    ],
    mission: {
      title: 'Mini mission: rename it in your head',
      body: 'Imagine your class rep keeps group dues in one notebook. DATA_FILE is just the notebook label.',
      example: `dues_file = "group_dues.json"
print(dues_file)`,
    },
    quiz: {
      prompt: 'In the starter kit, what is budget_data.json?',
      options: [
        { id: 'save-file', label: 'The file where the app saves income and expenses', correct: true },
        { id: 'student-name', label: 'The name of the student using the app', correct: false },
        { id: 'python-app', label: 'The Python app itself', correct: false },
      ],
      correctMessage: 'Correct - that file is the notebook where the tracker keeps saved records.',
      wrongMessage: 'Almost. Look at DATA_FILE again. It points to a file name, not a student or a menu.',
    },
    videoTitle: 'Variables and print',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=214',
    stuckTip: 'Think of a variable like a labeled box. The label is the variable name, and the thing inside is the value.',
  },
  {
    id: 'input-conversion',
    title: 'Input and type conversion',
    checkpoint: 'Input and type conversion',
    snippetName: '04_add_income.py and 05_add_expense.py',
    snippet: `source = input("Enter income source: ")
amount = float(input("Enter income amount: "))

data["income"].append({
    "source": source,
    "amount": amount
})`,
    studentHook: 'This is where the tracker asks the user questions, turns money into a number, and adds the answer to the budget list.',
    explain:
      'input() always gives Python text, even when the user types 5000. The budget tracker needs math, so float() changes that typed text into a number with decimals. Then append() adds the new record to the income list.',
    decode: [
      {
        label: 'input("Enter income source: ")',
        meaning: 'Ask the user a question and wait for what they type.',
      },
      {
        label: 'float(...)',
        meaning: 'Convert typed money into a number so Python can add and subtract it.',
      },
      {
        label: 'append({...})',
        meaning: 'Attach a new income record to the end of the income list.',
      },
    ],
    mission: {
      title: 'Mini mission: airtime example',
      body: 'If someone tracks airtime, the category is text, but the amount must become a number before calculations.',
      example: `category = input("What did you buy? ")
amount = float(input("How much? "))
print(category, amount)`,
    },
    quiz: {
      prompt: 'Why does the starter kit wrap input() with float() for money?',
      options: [
        { id: 'text-number', label: 'float() turns typed money into a number Python can calculate', correct: true },
        { id: 'prettier-text', label: 'float() makes the text look cleaner in the terminal', correct: false },
        { id: 'save-auto', label: 'float() automatically saves the data to JSON', correct: false },
      ],
      correctMessage: 'Correct - input is text first, float changes money into a number for calculations.',
      wrongMessage: 'Not quite. The key issue is math: Python cannot properly total money while it is still text.',
    },
    videoTitle: 'Input and type conversion',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=473',
    stuckTip: 'input() always gives text first. If you need math, convert it with int() or float() before calculating.',
  },
  {
    id: 'conditions',
    title: 'Choices and conditions',
    checkpoint: 'Choices and conditions',
    snippetName: '08_main_menu.py',
    snippet: `choice = input("Choose an option: ")

if choice == "1":
    add_income(data)
elif choice == "2":
    add_expense(data)
else:
    print("Invalid option. Try again.")`,
    studentHook: 'This is the part that listens to the menu number and sends the user to the right action.',
    explain:
      'Conditions are Python questions. if checks the first question. elif means "if not that, what about this one?" else catches everything that did not match. The menu uses this so one screen can lead to many actions.',
    decode: [
      {
        label: 'choice == "1"',
        meaning: 'Ask whether the user typed 1. The double equals means compare, not store.',
      },
      {
        label: 'add_income(data)',
        meaning: 'Run the income function and give it the current budget records.',
      },
      {
        label: 'else',
        meaning: 'Handle wrong entries like 9, abc, or an empty response.',
      },
    ],
    mission: {
      title: 'Mini mission: cafeteria menu',
      body: 'Think of it like choosing rice, beans, or snacks. The number decides which counter you go to.',
      example: `choice = input("1. Rice  2. Beans: ")
if choice == "1":
    print("Rice selected")`,
    },
    quiz: {
      prompt: 'What does choice == "1" mean inside the menu?',
      options: [
        { id: 'picked-income', label: 'The user picked Add income', correct: true },
        { id: 'make-choice', label: 'Python should change choice to 1', correct: false },
        { id: 'save-choice', label: 'The app should save and exit immediately', correct: false },
      ],
      correctMessage: 'Correct - the condition checks the menu choice before running add_income(data).',
      wrongMessage: 'Close, but == is a question. It checks what the user typed; it does not change the value.',
    },
    videoTitle: 'If statements and decisions',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=1502',
    stuckTip: 'Read conditions like questions: if choice == "1" means "is the user choice 1?"',
  },
  {
    id: 'lists-loops',
    title: 'Lists and loops',
    checkpoint: 'Lists and loops',
    snippetName: '06_view_transactions.py and 07_view_balance.py',
    snippet: `for item in data["income"]:
    print(f"- {item['source']}: {item['amount']}")

total_income = sum(
    item["amount"] for item in data["income"]
)`,
    studentHook: 'This is how the tracker goes through many saved records without writing print again and again.',
    explain:
      'A list is a container for many similar things. data["income"] is a list of income records. A for loop visits each record one by one. sum() can also loop through each amount and add them together.',
    decode: [
      {
        label: 'for item in data["income"]',
        meaning: 'Visit every income record. During each round, call the current record item.',
      },
      {
        label: "item['source']",
        meaning: 'Read the source field from the current income record.',
      },
      {
        label: 'sum(...)',
        meaning: 'Add all the selected amounts to get the total income.',
      },
    ],
    mission: {
      title: 'Mini mission: transport list',
      body: 'If you have three transport expenses, a loop lets Python read each one without you copying code three times.',
      example: `transport = [200, 300, 500]
for fare in transport:
    print(fare)`,
    },
    quiz: {
      prompt: 'What does the for loop do in view_transactions?',
      options: [
        { id: 'visit-records', label: "for item in data['income'] visits every saved income record", correct: true },
        { id: 'delete-records', label: 'It deletes every income record after printing', correct: false },
        { id: 'ask-input', label: 'It asks the user to enter a new income source', correct: false },
      ],
      correctMessage: 'Correct - the loop visits each record so the app can display it.',
      wrongMessage: 'Not this one. A for loop is for visiting items. It does not delete or ask questions by itself.',
    },
    videoTitle: 'Lists and loops',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=2476',
    stuckTip: 'A list is like a row of records. A loop lets Python visit each record one after another.',
  },
  {
    id: 'functions-flow',
    title: 'Functions and app flow',
    checkpoint: 'Functions and app flow',
    snippetName: '02_load_data.py, 03_save_data.py, and 09_start_app.py',
    snippet: `def save_data(data):
    with open(DATA_FILE, "w") as file:
        json.dump(data, file, indent=4)

main_menu()`,
    studentHook: 'This is the project flow: define reusable jobs first, then call main_menu() to start the whole app.',
    explain:
      'A function is a named job. def save_data(data) prepares a job for later. Calling main_menu() at the bottom is like pressing start. The menu then calls other functions when the user chooses actions.',
    decode: [
      {
        label: 'def save_data(data):',
        meaning: 'Create a reusable function that knows how to save the current budget records.',
      },
      {
        label: 'with open(DATA_FILE, "w")',
        meaning: 'Open the save file in write mode so new data can replace the old saved version.',
      },
      {
        label: 'main_menu()',
        meaning: 'Start the app by running the menu function.',
      },
    ],
    mission: {
      title: 'Mini mission: group work roles',
      body: 'One person collects dues, one person records names, one person announces balance. Functions are like those separate roles.',
      example: `def greet():
    print("Welcome")

greet()`,
    },
    quiz: {
      prompt: 'Why is main_menu() placed at the bottom of the arranged app?',
      options: [
        { id: 'starts-app', label: 'main_menu() starts the app because it calls the menu function', correct: true },
        { id: 'defines-menu', label: 'main_menu() defines the menu function for the first time', correct: false },
        { id: 'json-only', label: 'main_menu() converts the budget file to JSON', correct: false },
      ],
      correctMessage: 'Correct - after all functions exist, main_menu() starts the interactive menu.',
      wrongMessage: 'Almost. def creates a function. Calling main_menu() runs the function.',
    },
    videoTitle: 'Functions and project flow',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=3300',
    stuckTip: 'A function is like a reusable instruction card. Name it once, then call it whenever that job is needed.',
  },
];

const learnSteps: LearnStep[] = [
  {
    id: 'what-is-python',
    title: 'What Python is',
    checkpoint: 'What Python is',
    visual: {
      title: 'Programming is a conversation',
      nodes: ['Human idea', 'Python instruction', 'Computer action'],
      note: 'You write a clear instruction. Python helps the computer follow it.',
    },
    snippetName: 'No Python knowledge needed',
    snippet: `print("Hello, budget tracker")`,
    studentHook:
      'Start here: Python is not magic. It is a language for giving a computer small, clear instructions one line at a time.',
    explain:
      'Python is a language for giving a computer clear instructions. In this first line, print means "show this on the screen." The words inside quotes are the message.',
    decode: [
      { label: 'print', meaning: 'Tell Python to show something in the terminal.' },
      { label: '("...")', meaning: 'The brackets hold what print should show.' },
      { label: '"Hello"', meaning: 'Quotes mean this is text, not a calculation.' },
    ],
    mission: {
      title: 'Tiny practice: say hello',
      body: 'If Python can print a message, it can later print a menu, a balance, and saved transactions.',
      example: `print("My first Python project")`,
    },
    predict: {
      prompt: 'What should appear in the terminal?',
      output: 'Hello, budget tracker',
      note: 'Python prints only the words inside the quotes. The quotes themselves do not show.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'This first print line is practice for menu text, balance messages, and error messages in the CLI app.',
      fileHint: 'You will see print() inside the menu, balance, and transaction-view snippets.',
    },
    quiz: {
      prompt: 'What is Python in this course?',
      options: [
        { id: 'instruction-language', label: 'A language for giving the computer step-by-step instructions', correct: true },
        { id: 'phone-app', label: 'A phone app for checking account balance', correct: false },
        { id: 'school-subject', label: 'Only a school subject with no real use', correct: false },
      ],
      correctMessage: 'Correct - Python is the instruction language we will use to build the tracker.',
      wrongMessage: 'Not quite. In this project, Python is the language we use to tell the computer what to do.',
    },
    videoTitle: 'What programming means',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=0',
    stuckTip: 'Do not worry about memorizing syntax yet. Just remember: Python follows instructions from top to bottom.',
  },
  {
    id: 'budget-tracker-idea',
    title: 'What the tracker does',
    checkpoint: 'What the tracker does',
    visual: {
      title: 'The money story',
      nodes: ['Money in', 'Money out', 'Balance left'],
      note: 'A budget tracker helps people see where money came from and where it went.',
    },
    snippetName: 'The project in plain English',
    snippet: `income = 5000
expenses = 1200
balance = income - expenses`,
    studentHook:
      'A budget tracker is a small money notebook. It records money that comes in, money that goes out, and what is left.',
    explain:
      'This project is useful because students spend money on transport, food, airtime, printing, dues, and many small things. The tracker helps users stop guessing and actually see their spending.',
    decode: [
      { label: 'income', meaning: 'Money that enters, like allowance, salary, or contribution.' },
      { label: 'expenses', meaning: 'Money that leaves, like transport, food, or data subscription.' },
      { label: 'balance', meaning: 'What remains after subtracting expenses from income.' },
    ],
    mission: {
      title: 'Tiny practice: school spending',
      body: 'Think of one day in school. Money enters, then transport or food removes part of it.',
      example: `allowance = 3000
food = 800
print(allowance - food)`,
    },
    predict: {
      prompt: 'What number should Python print?',
      output: '2200',
      note: 'Python subtracts food from allowance, so the remaining balance is 2200.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'The whole project is built around this same money story: add income, add expenses, then show what remains.',
      fileHint: 'This idea appears in add_income, add_expense, and view_balance.',
    },
    quiz: {
      prompt: 'What does a budget tracker watch?',
      options: [
        { id: 'money-flow', label: 'Money that enters, money that leaves, and what remains', correct: true },
        { id: 'only-code', label: 'Only the Python code inside the project folder', correct: false },
        { id: 'only-names', label: 'Only the names of students in the group', correct: false },
      ],
      correctMessage: 'Correct - the tracker follows money in, money out, and the balance left.',
      wrongMessage: 'Almost. A budget tracker is about money movement, not just code or names.',
    },
    videoTitle: 'Budget tracker project idea',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=40',
    stuckTip: 'Think of it like a notebook with three questions: how much came in, how much went out, and what is left?',
  },
  {
    id: 'values-print',
    title: 'Text, numbers, and print',
    checkpoint: 'Text, numbers, and print',
    visual: {
      title: 'Python sees different kinds of values',
      nodes: ['"Food"', '1500', 'print'],
      note: 'Text wears quotes. Numbers can be used for maths.',
    },
    snippetName: 'First syntax rules',
    snippet: `print("Transport")
print(500)`,
    studentHook:
      'Python needs you to be clear. Words like Transport should be inside quotes. Numbers like 500 can stay without quotes.',
    explain:
      'Syntax is just the grammar of code. In Python, quotes show text. Brackets give something to a command. print shows output in the terminal.',
    decode: [
      { label: '"Transport"', meaning: 'This is text because it is wrapped in quotes.' },
      { label: '500', meaning: 'This is a number. Python can add or subtract it.' },
      { label: 'print(...)', meaning: 'Show the value inside the brackets.' },
    ],
    mission: {
      title: 'Tiny practice: show a spending label',
      body: 'The budget tracker will print menus, balances, and transaction details.',
      example: `print("Food")
print(1500)`,
    },
    predict: {
      prompt: 'Which line is text and which line is a number?',
      output: 'Food is text. 1500 is a number.',
      note: 'Quotes protect words as text. Bare numbers can be used for maths.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'The app uses text for labels like Food or Transport, and numbers for money amounts.',
      fileHint: 'This matters anywhere the app prints categories, sources, and amounts.',
    },
    quiz: {
      prompt: 'What kind of value is "Transport"?',
      options: [
        { id: 'quoted-text', label: 'Text because it is inside quotes', correct: true },
        { id: 'money-number', label: 'A number Python can subtract directly', correct: false },
        { id: 'function-name', label: 'The name of a function', correct: false },
      ],
      correctMessage: 'Correct - quotes tell Python this is text.',
      wrongMessage: 'Not yet. Text in Python usually sits inside quotes.',
    },
    videoTitle: 'Text numbers and print',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=185',
    stuckTip: 'When you see quotes, think text. When you see a bare number like 500, think maths is possible.',
  },
  {
    id: 'variables',
    title: 'Variables',
    checkpoint: 'Variables',
    visual: {
      title: 'A variable is a label',
      nodes: ['category', 'Food', 'amount'],
      note: 'The name points to a value so you can reuse it later.',
    },
    snippetName: 'Give values names',
    snippet: `category = "Food"
amount = 1500
print(amount)`,
    studentHook:
      'A variable is a name that stores a value. It is like writing "food money: 1500" in a notebook.',
    explain:
      'The equals sign stores a value in a name. After amount = 1500, Python remembers that amount means 1500 until you change it.',
    decode: [
      { label: 'category', meaning: 'A variable name. It points to a text value.' },
      { label: '=', meaning: 'Store the value on the right inside the name on the left.' },
      { label: 'amount', meaning: 'A variable name. It points to a number value.' },
    ],
    mission: {
      title: 'Tiny practice: label your money',
      body: 'The tracker needs names like amount, source, category, and balance so the code stays readable.',
      example: `transport = 700
print(transport)`,
    },
    predict: {
      prompt: 'What should print(transport) show?',
      output: '700',
      note: 'transport is the label. Python looks inside the label and prints the stored value.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'Variables help the starter kit remember the current source, category, amount, and balance while the app runs.',
      fileHint: 'Look for names like amount, source, category, income, expenses, and balance.',
    },
    quiz: {
      prompt: 'What is a variable?',
      options: [
        { id: 'value-name', label: 'A name that stores a value', correct: true },
        { id: 'only-number', label: 'Only a number with no name', correct: false },
        { id: 'error-message', label: 'A message Python shows when code fails', correct: false },
      ],
      correctMessage: 'Correct - a variable is a name that stores something useful.',
      wrongMessage: 'Almost. A variable is a name, not just the value itself.',
    },
    videoTitle: 'Variables for beginners',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=214',
    stuckTip: 'Read amount = 1500 as "amount now means 1500."',
  },
  {
    id: 'input',
    title: 'Asking the user',
    checkpoint: 'Asking the user',
    visual: {
      title: 'Input is a question',
      nodes: ['Ask', 'Student types', 'Store answer'],
      note: 'The app becomes interactive when the user can type into it.',
    },
    snippetName: 'input()',
    snippet: `source = input("Enter income source: ")
print(source)`,
    studentHook:
      'A CLI app talks through the terminal. input() asks a question and waits until the user types an answer.',
    explain:
      'The text inside input() is the question. The answer is stored in a variable. In the budget tracker, this is how the app asks for income source, expense category, description, and amount.',
    decode: [
      { label: 'input(...)', meaning: 'Ask the user a question in the terminal.' },
      { label: 'source =', meaning: 'Store the answer inside the source variable.' },
      { label: 'print(source)', meaning: 'Show what the user typed.' },
    ],
    mission: {
      title: 'Tiny practice: ask for a category',
      body: 'If someone bought lunch, the app can ask for the category instead of guessing.',
      example: `category = input("What did you buy? ")
print(category)`,
    },
    predict: {
      prompt: 'If the user types Food, what does print(category) show?',
      output: 'Food',
      note: 'input() waits, receives the typed answer, then the variable keeps that answer.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'The tracker uses input() whenever it needs the user to type income source, expense category, description, or amount.',
      fileHint: 'You will see input() mostly in the add income, add expense, and menu snippets.',
    },
    quiz: {
      prompt: 'What does input() do?',
      options: [
        { id: 'waits-user', label: 'input() waits for what the user types', correct: true },
        { id: 'adds-money', label: 'input() automatically adds money to the balance', correct: false },
        { id: 'saves-file', label: 'input() saves the budget file by itself', correct: false },
      ],
      correctMessage: 'Correct - input() waits for the user and gives Python the typed answer.',
      wrongMessage: 'Not yet. input() asks and receives. Other code must calculate or save.',
    },
    videoTitle: 'Input for beginners',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=473',
    stuckTip: 'When you see input(), imagine the program pausing and waiting for the student to type.',
  },
  {
    id: 'money-math',
    title: 'Money math',
    checkpoint: 'Money math',
    visual: {
      title: 'Typed money must become a number',
      nodes: ['"1500"', 'float()', '1500.0'],
      note: 'Money typed in the terminal starts as text. Convert it before maths.',
    },
    snippetName: 'float() and balance',
    snippet: `amount = float(input("Enter amount: "))
balance = income - expenses`,
    studentHook:
      'Python treats typed answers as text first. For money, text is not enough. The tracker converts typed money before calculating.',
    explain:
      'float() changes something like "1500" into 1500.0, a number Python can use for addition and subtraction. This is important for totals and balance.',
    decode: [
      { label: 'float(...)', meaning: 'Convert typed money into a number.' },
      { label: 'income - expenses', meaning: 'Subtract money out from money in.' },
      { label: 'balance', meaning: 'Store the result so the app can print it.' },
    ],
    mission: {
      title: 'Tiny practice: food balance',
      body: 'Calculate what remains after spending from an allowance.',
      example: `allowance = 3000
food = 800
balance = allowance - food`,
    },
    predict: {
      prompt: 'What value will balance keep?',
      output: '2200',
      note: 'Because both values are numbers, Python can subtract them safely.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'This is the idea behind totals: the app converts typed money, adds income, adds expenses, then calculates balance.',
      fileHint: 'This shows up in add income, add expense, and view balance.',
    },
    quiz: {
      prompt: 'Why does the tracker use float() for money?',
      options: [
        { id: 'money-number', label: 'float() changes typed money into a number', correct: true },
        { id: 'text-style', label: 'float() makes text look bold', correct: false },
        { id: 'menu-start', label: 'float() starts the menu', correct: false },
      ],
      correctMessage: 'Correct - money must be a number before Python can total it.',
      wrongMessage: 'Not quite. float() is for number conversion, especially money with decimals.',
    },
    videoTitle: 'Numbers and conversion',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=612',
    stuckTip: 'If the app needs maths, the value should be a number, not quoted text.',
  },
  {
    id: 'records-lists',
    title: 'Records and lists',
    checkpoint: 'Records and lists',
    visual: {
      title: 'A list holds many records',
      nodes: ['Food 1500', 'Transport 700', 'Airtime 500'],
      note: 'The tracker saves many transactions, not just one.',
    },
    snippetName: 'Lists and transaction records',
    snippet: `expenses = []
expenses.append({
    "category": "Food",
    "amount": 1500
})`,
    studentHook:
      'One expense is not enough. A tracker needs many records. A list lets Python keep many related items together.',
    explain:
      '[] means an empty list. append() adds a new item to that list. The braces create a small record with labels like category and amount.',
    decode: [
      { label: 'expenses = []', meaning: 'Start with an empty list of expenses.' },
      { label: 'append(...)', meaning: 'Add one new transaction to the list.' },
      { label: '{"amount": 1500}', meaning: 'A record with a label and value.' },
    ],
    mission: {
      title: 'Tiny practice: add one expense',
      body: 'Imagine recording food money after class.',
      example: `expenses = []
expenses.append({"category": "Food"})`,
    },
    predict: {
      prompt: 'What does append do here?',
      output: 'It puts one Food record into the expenses list.',
      note: 'append does not replace the whole list. It adds a new item to the end.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'The app needs lists because users will add many income and expense records, not just one.',
      fileHint: 'You will see lists and append() in the add income and add expense snippets.',
    },
    quiz: {
      prompt: 'Why does the tracker use a list?',
      options: [
        { id: 'many-transactions', label: 'A list can hold many saved transactions', correct: true },
        { id: 'one-letter', label: 'A list can only hold one letter', correct: false },
        { id: 'screen-color', label: 'A list changes the terminal color', correct: false },
      ],
      correctMessage: 'Correct - a list keeps many transaction records together.',
      wrongMessage: 'Almost. A list is for storing many items in one place.',
    },
    videoTitle: 'Lists and records',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=2476',
    stuckTip: 'Think of a list like pages in a notebook: one page can hold many transaction entries.',
  },
  {
    id: 'choices-menu',
    title: 'Menu choices',
    checkpoint: 'Menu choices',
    visual: {
      title: 'A menu chooses a route',
      nodes: ['User types 1', 'if checks', 'add_income runs'],
      note: 'The app waits for a menu number, then runs the matching action.',
    },
    snippetName: 'if, elif, else',
    snippet: `if choice == "1":
    add_income(data)
elif choice == "2":
    add_expense(data)
else:
    print("Invalid option")`,
    studentHook:
      'The budget tracker menu is like a small decision tree. The number the user types decides what the app does next.',
    explain:
      'if asks the first question. elif asks another question if the first one failed. else catches anything that did not match.',
    decode: [
      { label: 'choice == "1"', meaning: 'Ask whether the user typed 1.' },
      { label: 'add_income(data)', meaning: 'Run the income function.' },
      { label: 'else', meaning: 'Handle wrong choices.' },
    ],
    mission: {
      title: 'Tiny practice: cafeteria choice',
      body: 'The idea is the same as choosing rice or beans from a menu.',
      example: `if choice == "1":
    print("Rice selected")`,
    },
    predict: {
      prompt: 'If choice is "1", what happens?',
      output: 'Python prints Rice selected.',
      note: 'The condition is true, so Python runs the indented line under it.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'The menu uses if and elif to decide whether to add income, add expense, view records, view balance, or exit.',
      fileHint: 'This is the main idea inside the menu snippet.',
    },
    quiz: {
      prompt: 'What do if and elif do in the menu?',
      options: [
        { id: 'choose-function', label: 'if and elif choose which function to run', correct: true },
        { id: 'save-json', label: 'if and elif save the JSON file automatically', correct: false },
        { id: 'make-list', label: 'if and elif create the expense list', correct: false },
      ],
      correctMessage: 'Correct - the menu uses conditions to choose the next function.',
      wrongMessage: 'Not quite. Conditions choose a path. Saving and lists happen somewhere else.',
    },
    videoTitle: 'If statements and menu choices',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=1502',
    stuckTip: 'Read choice == "1" like a question: "Did the user type 1?"',
  },
  {
    id: 'functions-files',
    title: 'Functions and files',
    checkpoint: 'Functions and files',
    visual: {
      title: 'Small jobs become one app',
      nodes: ['load', 'menu', 'save'],
      note: 'The starter kit is many small jobs arranged into one working project.',
    },
    snippetName: 'Starter kit flow',
    snippet: `def save_data(data):
    print("Data saved")

main_menu()`,
    studentHook:
      'Now the starter kit will make more sense. A function is a named group of steps. The app defines the jobs, then main_menu() starts everything.',
    explain:
      'Functions keep code organized. One function loads data, one adds income, one adds expense, one saves, and main_menu() connects them through the menu.',
    decode: [
      { label: 'def save_data(data):', meaning: 'Define a reusable job called save_data.' },
      { label: 'main_menu()', meaning: 'Call the menu function to start the app.' },
      { label: 'budget_data.json', meaning: 'The file where saved income and expenses live.' },
    ],
    mission: {
      title: 'Tiny practice: name one job',
      body: 'Functions are like assigning roles in group work: one person records, one person tests, one person presents.',
      example: `def greet():
    print("Welcome")

greet()`,
    },
    predict: {
      prompt: 'Why does Welcome print only after greet()?',
      output: 'def prepares the job. greet() runs the job.',
      note: 'A function does not run just because it exists. It runs when you call it.',
    },
    projectBridge: {
      title: 'Where this appears in the budget tracker',
      body: 'The final app is made of small functions: load data, save data, add income, add expense, view balance, and show the menu.',
      fileHint: 'This helps students arrange the snippets into the right order before calling main_menu().',
    },
    quiz: {
      prompt: 'What does a function help us do?',
      options: [
        { id: 'group-steps', label: 'A function keeps a group of steps together', correct: true },
        { id: 'random-error', label: 'A function makes random errors disappear', correct: false },
        { id: 'phone-data', label: 'A function buys mobile data for the user', correct: false },
      ],
      correctMessage: 'Correct - a function gives a name to a group of steps so we can reuse it.',
      wrongMessage: 'Almost. Functions organize code. They do not magically fix errors or buy data.',
    },
    videoTitle: 'Functions and files',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=3300',
    stuckTip: 'Read def as "I am defining a job." Read main_menu() as "run that job now."',
  },
];

const runnableLessonExamples: Record<LearnStepId, RunnableLessonExample> = {
  'what-is-python': {
    code: `print("Hello, budget tracker")`,
  },
  'budget-tracker-idea': {
    code: `income = 5000
expenses = 1200
balance = income - expenses
print(balance)`,
  },
  'values-print': {
    code: `print("Food")
print(1500)`,
  },
  variables: {
    code: `category = "Food"
amount = 1500
print(category)
print(amount)`,
  },
  input: {
    code: `source = input("Enter income source: ")
print(source)`,
    stdin: 'Allowance',
  },
  'money-math': {
    code: `income = 5000
expenses = float(input("Enter expenses: "))
balance = income - expenses
print(balance)`,
    stdin: '1200',
  },
  'records-lists': {
    code: `expenses = []
expenses.append({
    "category": "Food",
    "amount": 1500
})
print(expenses)`,
  },
  'choices-menu': {
    code: `choice = input("Choose 1 or 2: ")

if choice == "1":
    print("Add income selected")
elif choice == "2":
    print("Add expense selected")
else:
    print("Invalid option")`,
    stdin: '1',
  },
  'functions-files': {
    code: `def save_data(data):
    print("Data saved")

def main_menu():
    print("Budget menu ready")

main_menu()`,
  },
};

const learnCodeChallenges: Record<LearnStepId, LearnCodeChallenge> = {
  'what-is-python': {
    prompt: 'Which function shows text in the terminal?',
    answer: 'print',
    hint: 'Use the same function from the first tiny line. It starts with p.',
    success: 'Correct - print() shows text in the terminal.',
    buildCode: (answer) => `${answer || '____'}("Hello, budget tracker")`,
  },
  'budget-tracker-idea': {
    prompt: 'Which operator removes expenses from income?',
    answer: '-',
    hint: 'Balance is income minus expenses. Type the minus symbol.',
    success: 'Correct - the minus operator finds what is left.',
    buildCode: (answer) => `income = 5000
expenses = 1200
balance = income ${answer || '____'} expenses
print(balance)`,
  },
  'values-print': {
    prompt: 'Which function should show Food and 1500?',
    answer: 'print',
    hint: 'The function for showing output is print.',
    success: 'Correct - print() can show text and numbers.',
    buildCode: (answer) => `${answer || '____'}("Food")
print(1500)`,
  },
  variables: {
    prompt: 'Which symbol stores a value inside a variable name?',
    answer: '=',
    hint: 'Read it as "amount now means 1500." Type the equals symbol.',
    success: 'Correct - equals stores a value in a variable.',
    buildCode: (answer) => `amount ${answer || '____'} 1500
print(amount)`,
  },
  input: {
    prompt: 'Which function waits for the user to type?',
    answer: 'input',
    hint: 'The app asks questions with input().',
    success: 'Correct - input() collects what the user types.',
    stdin: 'Allowance',
    buildCode: (answer) => `source = ${answer || '____'}("Enter income source: ")
print(source)`,
  },
  'money-math': {
    prompt: 'Which function turns typed money into a number?',
    answer: 'float',
    hint: 'Money typed in the terminal starts as text. Convert it with float().',
    success: 'Correct - float() converts typed money for maths.',
    stdin: '1200',
    buildCode: (answer) => `income = 5000
expenses = ${answer || '____'}(input("Enter expenses: "))
print(income - expenses)`,
  },
  'records-lists': {
    prompt: 'Which list method adds one transaction record?',
    answer: 'append',
    hint: 'A list grows by calling append().',
    success: 'Correct - append() adds a new item to the list.',
    buildCode: (answer) => `expenses = []
expenses.${answer || '____'}({"category": "Food", "amount": 1500})
print(expenses)`,
  },
  'choices-menu': {
    prompt: 'Which keyword starts the first menu condition?',
    answer: 'if',
    hint: 'The first question in a decision starts with if.',
    success: 'Correct - if starts the first condition.',
    buildCode: (answer) => `choice = "1"

${answer || '____'} choice == "1":
    print("Add income selected")
else:
    print("Invalid option")`,
  },
  'functions-files': {
    prompt: 'Which keyword defines a named job?',
    answer: 'def',
    hint: 'Functions begin with def, then the function name.',
    success: 'Correct - def creates a function.',
    buildCode: (answer) => `${answer || '____'} greet():
    print("Welcome")

greet()`,
  },
};

const understandSteps: UnderstandStep[] = [
  {
    id: 'data-file-shape',
    title: 'The app notebook',
    checkpoint: 'Data file shape',
    starterFile: 'budget_data.json',
    bigIdea: 'The whole tracker keeps one data notebook with two shelves: income and expenses.',
    plainEnglish:
      'Before adding features, students must know where money records live. The base app is not magic. It is one dictionary called data, and inside it are two lists.',
    walkthrough: [
      'A dictionary uses labels, called keys, to name where values live.',
      'The key "income" points to a list. That list can hold many income records.',
      'The key "expenses" points to a different list. That list can hold many spending records.',
      'Every feature your group adds later should respect this shape instead of inventing random names.',
    ],
    confusionTip:
      'The square brackets are not decoration. [] means an empty list, ready to receive many records later.',
    visual: {
      title: 'One notebook, two lists',
      nodes: ['data', 'income', 'expenses'],
      note: 'Income records go into income. Spending records go into expenses.',
    },
    realCode: `return {"income": [], "expenses": []}`,
    decode: [
      { label: 'data', meaning: 'The main notebook the app passes around.' },
      { label: '"income": []', meaning: 'A list where money-in records are kept.' },
      { label: '"expenses": []', meaning: 'A list where money-out records are kept.' },
    ],
    practice: {
      code: `data = {"income": [], "expenses": []}
print(data["income"])
print(data["expenses"])`,
    },
    quiz: {
      prompt: 'Why does the tracker keep income and expenses in separate lists?',
      options: [
        {
          id: 'separate-lists',
          label: 'So many income records and many expense records can be stored separately',
          correct: true,
        },
        { id: 'make-color', label: 'So Python can change the terminal colour', correct: false },
        { id: 'one-record-only', label: 'So the app can store only one transaction', correct: false },
      ],
      correctMessage: 'Correct - the tracker is two neat lists inside one data notebook.',
      wrongMessage: 'Not yet. Think of income and expenses as two different pages inside the same notebook.',
    },
    challenge: {
      prompt: 'Which quoted key stores money coming in?',
      answer: '"income"',
      hint: 'Keep the quotes. Python dictionary keys are text here, so type "income".',
      success: 'Correct - income is the key for money coming into the tracker.',
      buildCode: (answer) => `data = {${answer || '____'}: [], "expenses": []}
print(data["income"])`,
    },
    videoTitle: 'Python dictionaries and lists for beginners',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=2476',
    stuckTip: 'If this feels strange, say it as English: data has income, and data has expenses.',
  },
  {
    id: 'safe-loading',
    title: 'Start without crashing',
    checkpoint: 'Safe loading',
    starterFile: 'snippets/02_load_data.py',
    bigIdea: 'load_data() opens old records if they exist, but starts an empty notebook if this is the first run.',
    plainEnglish:
      'A first-time user will not already have budget_data.json. The app must not panic. It should politely create empty lists and continue.',
    walkthrough: [
      'Python first enters the try block and attempts to open the save file.',
      'If the file exists, json.load(file) changes the saved JSON text back into Python data.',
      'If the file does not exist, FileNotFoundError happens.',
      'The except block catches that problem and returns a fresh empty tracker shape.',
    ],
    confusionTip:
      'try and except are not for hiding errors forever. They are for handling a problem you already expect, like a missing save file on day one.',
    visual: {
      title: 'First run vs returning user',
      nodes: ['try file', 'old data', 'empty data'],
      note: 'The except block is the rescue plan for a missing file.',
    },
    realCode: `def load_data():
    try:
        with open(DATA_FILE, "r") as file:
            return json.load(file)
    except FileNotFoundError:
        return {"income": [], "expenses": []}`,
    decode: [
      { label: 'try', meaning: 'Attempt the file-opening job.' },
      { label: 'json.load(file)', meaning: 'Convert saved JSON text back into Python data.' },
      { label: 'FileNotFoundError', meaning: 'The error raised when the save file does not exist yet.' },
    ],
    practice: {
      code: `def load_data(file_found):
    if file_found:
        return {"income": [{"source": "Allowance", "amount": 5000}], "expenses": []}
    return {"income": [], "expenses": []}

data = load_data(False)
print(data)`,
    },
    quiz: {
      prompt: 'Why does load_data() return empty lists when the file is missing?',
      options: [
        { id: 'clean-start', label: 'So the app can start cleanly instead of crashing', correct: true },
        { id: 'hide-money', label: 'So the app can delete all the student money', correct: false },
        { id: 'skip-menu', label: 'So the menu never opens', correct: false },
      ],
      correctMessage: 'Correct - a missing file should not stop a first-time user.',
      wrongMessage: 'Almost. This part protects beginners from a missing save file error.',
    },
    challenge: {
      prompt: 'Which error name means the save file is missing?',
      answer: 'FileNotFoundError',
      hint: 'Look at the real snippet. The error name starts with File and ends with Error.',
      success: 'Correct - FileNotFoundError is the missing-file rescue path.',
      buildCode: (answer) => `def load_data(file_found):
    try:
        if not file_found:
            raise ${answer || '____'}()
        return {"income": [{"amount": 5000}], "expenses": []}
    except ${answer || '____'}:
        return {"income": [], "expenses": []}

print(load_data(False))`,
    },
    videoTitle: 'Python try except explained',
    videoEmbed: 'https://www.youtube.com/embed/NIWwJbo-9_8',
    stuckTip: 'Think of except as "if that problem happens, do this safer thing."',
  },
  {
    id: 'add-records',
    title: 'Add money records',
    checkpoint: 'Add records',
    starterFile: 'snippets/04_add_income.py and snippets/05_add_expense.py',
    bigIdea: 'Adding income or expenses means asking questions, converting money, then appending one new record.',
    plainEnglish:
      'This is the part students will recognize during demo. The app asks where money came from or where it went, then stores that answer inside the correct list.',
    walkthrough: [
      'source = input(...) asks the user where the money came from.',
      'amount = float(input(...)) asks for money and converts it into a number.',
      'The braces create one small record with labels like source and amount.',
      'append() pushes that new record into the income list without deleting old records.',
    ],
    confusionTip:
      'A common mistake is thinking append prints the record. It does not. append stores the record inside the list.',
    visual: {
      title: 'Ask, convert, append',
      nodes: ['input()', 'float()', 'append()'],
      note: 'Those three small ideas create one saved transaction.',
    },
    realCode: `source = input("Enter income source: ")
amount = float(input("Enter income amount: "))
data["income"].append({"source": source, "amount": amount})`,
    decode: [
      { label: 'input()', meaning: 'Ask the user a question in the terminal.' },
      { label: 'float(...)', meaning: 'Turn typed money into a number Python can calculate.' },
      { label: 'append(...)', meaning: 'Add one new record to the end of a list.' },
    ],
    practice: {
      stdin: 'Allowance\n5000',
      code: `data = {"income": [], "expenses": []}
source = input("Enter income source: ")
amount = float(input("Enter income amount: "))
data["income"].append({"source": source, "amount": amount})
print(data["income"])`,
    },
    quiz: {
      prompt: 'What happens after add_income gets the source and amount?',
      options: [
        { id: 'append-income', label: 'It appends a new record into data["income"]', correct: true },
        { id: 'print-only', label: 'It only prints the source and forgets it', correct: false },
        { id: 'expense-list', label: 'It stores the income inside data["expenses"]', correct: false },
      ],
      correctMessage: 'Correct - add_income creates a small income record and keeps it.',
      wrongMessage: 'Not quite. The important action is append: one new record joins the income list.',
    },
    challenge: {
      prompt: 'Which list method adds the new income record?',
      answer: 'append',
      hint: 'The method is called on a list with a dot. It starts with a.',
      success: 'Correct - append() adds one new record without replacing the old list.',
      stdin: 'Allowance\n5000',
      buildCode: (answer) => `data = {"income": [], "expenses": []}
source = input("Enter income source: ")
amount = float(input("Enter income amount: "))
data["income"].${answer || '____'}({"source": source, "amount": amount})
print(data["income"])`,
    },
    videoTitle: 'Python input and lists',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=473',
    stuckTip: 'If the line is long, split it in your head: make record, then add record to the list.',
  },
  {
    id: 'view-transactions',
    title: 'Read saved records',
    checkpoint: 'View transactions',
    starterFile: 'snippets/06_view_transactions.py',
    bigIdea: 'view_transactions() loops through saved records and prints them so the user can inspect their money history.',
    plainEnglish:
      'A tracker is useful because it remembers more than one thing. This step explains how the app reads each old record one after another.',
    walkthrough: [
      'data["income"] gives Python the list of income records.',
      'for item in data["income"] means visit one record, then the next, until the list is finished.',
      'item["source"] and item["amount"] read fields from the current record.',
      'The expense loop does the same job for spending records.',
    ],
    confusionTip:
      'The word item is just a temporary name. It means "the current record I am looking at inside the loop."',
    visual: {
      title: 'Loop through the notebook',
      nodes: ['first record', 'next record', 'print result'],
      note: 'A for loop visits every item in a list without writing the same print line many times.',
    },
    realCode: `for item in data["income"]:
    print(f"Income - Source: {item['source']}, Amount: {item['amount']}")

for item in data["expenses"]:
    print(f"Expense - Category: {item['category']}, Amount: {item['amount']}")`,
    decode: [
      { label: 'for item in ...', meaning: 'Visit each saved record one by one.' },
      { label: 'item["amount"]', meaning: 'Read the amount field from the current record.' },
      { label: 'f"..."', meaning: 'Build a neat sentence using values from the record.' },
    ],
    practice: {
      code: `data = {
    "income": [{"source": "Allowance", "amount": 5000}],
    "expenses": [{"category": "Food", "description": "Lunch", "amount": 1200}]
}

for item in data["expenses"]:
    print(item["category"], item["amount"])`,
    },
    quiz: {
      prompt: 'What does the for loop do in view_transactions()?',
      options: [
        { id: 'each-record', label: 'It visits each saved record one by one', correct: true },
        { id: 'delete-record', label: 'It deletes every saved record', correct: false },
        { id: 'ask-money', label: 'It asks the user for a new amount', correct: false },
      ],
      correctMessage: 'Correct - the loop walks through the saved list and prints each item.',
      wrongMessage: 'Close. This loop is for reading and displaying, not for deleting or asking.',
    },
    challenge: {
      prompt: 'Which keyword starts the loop through saved expenses?',
      answer: 'for',
      hint: 'The loop keyword has three letters and reads like: for every item...',
      success: 'Correct - for starts the loop that visits every saved record.',
      buildCode: (answer) => `data = {"expenses": [{"category": "Food", "amount": 1200}]}

${answer || '____'} item in data["expenses"]:
    print(item["category"])
    print(item["amount"])`,
    },
    videoTitle: 'Python for loops',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=2476',
    stuckTip: 'Read for item in expenses as "for every expense record, do the next indented thing."',
  },
  {
    id: 'balance-math',
    title: 'Calculate what remains',
    checkpoint: 'Balance math',
    starterFile: 'snippets/07_view_balance.py',
    bigIdea: 'view_balance() totals money in, totals money out, then subtracts to find what remains.',
    plainEnglish:
      'This is the easiest part to present: income minus expenses equals balance. The only new thing is that Python uses sum() to total all records in a list.',
    walkthrough: [
      'sum(item["amount"] for item in data["income"]) picks the amount from every income record.',
      'The expenses line does the same thing for money spent.',
      'balance = total_income - total_expenses stores what remains.',
      'The print lines turn the calculation into something a user can read.',
    ],
    confusionTip:
      'The long sum line is still one idea: collect every amount, then add them together.',
    visual: {
      title: 'Income minus expenses',
      nodes: ['total income', 'total expenses', 'balance'],
      note: 'The balance is what remains after spending.',
    },
    realCode: `total_income = sum(item["amount"] for item in data["income"])
total_expenses = sum(item["amount"] for item in data["expenses"])
balance = total_income - total_expenses`,
    decode: [
      { label: 'sum(...)', meaning: 'Add all matching amounts together.' },
      { label: 'item["amount"]', meaning: 'Pick only the money value from each record.' },
      { label: 'income - expenses', meaning: 'Subtract spending from money received.' },
    ],
    practice: {
      code: `data = {
    "income": [{"amount": 5000}, {"amount": 2000}],
    "expenses": [{"amount": 1200}, {"amount": 800}]
}
total_income = sum(item["amount"] for item in data["income"])
total_expenses = sum(item["amount"] for item in data["expenses"])
balance = total_income - total_expenses
print(balance)`,
    },
    quiz: {
      prompt: 'How does view_balance() calculate the current balance?',
      options: [
        {
          id: 'subtract-expenses',
          label: 'It totals income, totals expenses, then subtracts expenses from income',
          correct: true,
        },
        { id: 'append-balance', label: 'It appends balance into the income list', correct: false },
        { id: 'choice-balance', label: 'It waits for menu choice 5 before doing any maths', correct: false },
      ],
      correctMessage: 'Correct - balance is the money left after subtracting expenses.',
      wrongMessage: 'Not yet. Focus on the three maths steps: total income, total expenses, subtract.',
    },
    challenge: {
      prompt: 'Which function totals all the amounts?',
      answer: 'sum',
      hint: 'It is the same word you use in maths class when adding values together.',
      success: 'Correct - sum() adds the amounts from the saved records.',
      buildCode: (answer) => `data = {
    "income": [{"amount": 5000}, {"amount": 2000}],
    "expenses": [{"amount": 1200}]
}
total_income = ${answer || '____'}(item["amount"] for item in data["income"])
print(total_income)`,
    },
    videoTitle: 'Python sum and simple calculations',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=612',
    stuckTip: 'In presentation, say it simply: the app adds all income, adds all expenses, then subtracts.',
  },
  {
    id: 'menu-loop',
    title: 'Control the app menu',
    checkpoint: 'Menu loop',
    starterFile: 'snippets/08_main_menu.py',
    bigIdea: 'main_menu() is the traffic controller. It keeps showing choices and sends the user to the right function.',
    plainEnglish:
      'The menu is what makes the project feel like an app, not random code. The user chooses a number, and if/elif decides which function should run.',
    walkthrough: [
      'while True keeps the menu alive so the user can do more than one thing.',
      'choice = input(...) pauses and waits for the user to type a menu number.',
      'if choice == "1" checks the first possible route.',
      'elif checks another route only if the earlier route did not match.',
      'break stops the loop when the user saves and exits.',
    ],
    confusionTip:
      'The menu numbers are text because input() returns text. That is why the code checks "1", not 1.',
    visual: {
      title: 'Choice becomes action',
      nodes: ['choice = input()', 'if / elif', 'run function'],
      note: 'The loop keeps the app alive until the user chooses Save and exit.',
    },
    realCode: `while True:
    choice = input("Choose an option: ")

    if choice == "1":
        add_income(data)
    elif choice == "5":
        save_data(data)
        break`,
    decode: [
      { label: 'while True', meaning: 'Keep repeating the menu until something breaks the loop.' },
      { label: 'choice == "1"', meaning: 'Check whether the user typed menu option 1.' },
      { label: 'break', meaning: 'Stop the loop after saving and exiting.' },
    ],
    practice: {
      code: `choices = ["4", "5"]

for choice in choices:
    if choice == "4":
        print("View balance selected")
    elif choice == "5":
        print("Save and exit selected")`,
    },
    quiz: {
      prompt: 'Why is the real menu inside a loop?',
      options: [
        { id: 'repeat-until-exit', label: 'So the user can choose actions again until Save and exit', correct: true },
        { id: 'one-choice', label: 'So the app closes after one wrong choice', correct: false },
        { id: 'auto-income', label: 'So income is added without asking the user', correct: false },
      ],
      correctMessage: 'Correct - the loop keeps the app usable until the user exits.',
      wrongMessage: 'Almost. The loop is there so the menu can come back again and again.',
    },
    challenge: {
      prompt: 'Which keyword checks the next menu choice after if?',
      answer: 'elif',
      hint: 'It is short for "else if". It checks another option.',
      success: 'Correct - elif lets the menu check the next possible choice.',
      buildCode: (answer) => `choice = "5"

if choice == "1":
    print("Add income")
${answer || '____'} choice == "5":
    print("Save and exit")
else:
    print("Invalid option")`,
    },
    videoTitle: 'Python if statements and loops',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=1502',
    stuckTip: 'Think of main_menu() as the class rep: it asks what should happen next and sends people to the correct role.',
  },
  {
    id: 'save-and-exit',
    title: 'Save before closing',
    checkpoint: 'Save and exit',
    starterFile: 'snippets/03_save_data.py and snippets/09_start_app.py',
    bigIdea: 'save_data() writes the current notebook into budget_data.json so records are still there next time.',
    plainEnglish:
      'This is the difference between a toy and a useful tracker. If the app does not save, every transaction disappears after closing the terminal.',
    walkthrough: [
      'open(DATA_FILE, "w") opens budget_data.json in write mode.',
      'json.dump(data, file, indent=4) writes the current Python dictionary into that file.',
      'indent=4 makes the saved file readable instead of one cramped line.',
      'main_menu() at the bottom starts the app only after all functions have been defined.',
    ],
    confusionTip:
      'json.dump writes to a file. json.dumps with an s returns text. The real app uses dump because it saves to budget_data.json.',
    visual: {
      title: 'Memory becomes a file',
      nodes: ['data dictionary', 'json.dump()', 'budget_data.json'],
      note: 'The app starts with main_menu(), then saves when the user chooses exit.',
    },
    realCode: `def save_data(data):
    with open(DATA_FILE, "w") as file:
        json.dump(data, file, indent=4)

main_menu()`,
    decode: [
      { label: 'open(..., "w")', meaning: 'Open the save file for writing.' },
      { label: 'json.dump(data, file)', meaning: 'Write Python data as JSON text.' },
      { label: 'main_menu()', meaning: 'Start the whole app after all functions have been defined.' },
    ],
    practice: {
      code: `import json

data = {"income": [{"source": "Allowance", "amount": 5000}], "expenses": []}
saved_text = json.dumps(data, indent=4)
print(saved_text)`,
    },
    quiz: {
      prompt: 'What does save_data() do before the app closes?',
      options: [
        { id: 'write-json', label: 'It writes the current data dictionary into budget_data.json', correct: true },
        { id: 'forget-data', label: 'It clears the data dictionary and forgets all records', correct: false },
        { id: 'open-menu', label: 'It opens VS Code for the user', correct: false },
      ],
      correctMessage: 'Correct - saving turns the current Python data into a file for next time.',
      wrongMessage: 'Not quite. save_data() protects the records by writing them into the JSON file.',
    },
    challenge: {
      prompt: 'Which JSON helper turns data into saveable text in this practice?',
      answer: 'json.dumps',
      hint: 'Use the helper with an s at the end because this practice prints text instead of writing a file.',
      success: 'Correct - json.dumps turns Python data into JSON text for this mini practice.',
      buildCode: (answer) => `import json

data = {"income": [{"amount": 5000}], "expenses": []}
saved_text = ${answer || '____'}(data, indent=4)
print(saved_text)`,
    },
    videoTitle: 'Python JSON files',
    videoEmbed: 'https://www.youtube.com/embed/9N6a-VLBa2I',
    stuckTip: 'If your group adds a new field later, remember: saving must include that field inside the data dictionary.',
  },
];

const rebuildSteps: RebuildStep[] = [
  {
    id: 'open-starter-folder',
    title: 'Open the correct folder first',
    checkpoint: 'Open starter folder',
    parts: ['task', 'check'],
    goal: 'Make sure VS Code is looking at the extracted starter folder, not the zip file and not only the snippets folder.',
    actions: [
      'Find your downloaded group starter kit zip.',
      'Right-click it and extract it first.',
      'Open VS Code, choose File > Open Folder, then select the extracted budget tracker folder.',
      'Check the left Explorer panel. You should see snippets, sample_data, README_NUDGE.md, and your group feature file.',
    ],
    snippetFiles: [],
    coachNote: 'If VS Code opens the wrong folder, every other step becomes confusing. This is the foundation step.',
    runCheck: 'Explorer shows snippets, sample_data, README_NUDGE.md, and your group feature pack.',
    proof: 'This proves you are not working inside the zip and not inside only one small subfolder.',
    videoTitle: 'VS Code: open a folder',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=149',
    commonMistakes: [
      'Opening the zip file directly instead of extracting it.',
      'Opening the snippets folder itself instead of the whole starter folder.',
      'Creating main.py in Downloads instead of inside the project folder.',
    ],
    stuckTip: 'If the Explorer panel only shows a few small Python files, go one level back and open the whole extracted starter folder.',
  },
  {
    id: 'create-main',
    title: 'Create an empty main.py first',
    checkpoint: 'Create main.py',
    parts: ['task', 'check'],
    goal: 'Create one blank file named main.py beside the snippets folder. This is the file that will become the working budget tracker.',
    actions: [
      'In the VS Code Explorer, click the New File icon.',
      'Type main.py exactly. Use lowercase letters and include .py at the end.',
      'Press Enter, then click the new file so the editor is blank and ready.',
      'Do not paste anything yet. First confirm the file is in the same area as snippets.',
    ],
    snippetFiles: [],
    coachNote: 'main.py is like the new exercise book where all the scattered pieces will be copied into one clean answer.',
    runCheck: 'main.py exists in the starter folder.',
    proof: 'VS Code should show main.py, snippets, sample_data, and README_NUDGE.md in the file explorer.',
    videoTitle: 'VS Code: create and manage files',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=180',
    commonMistakes: [
      'Naming the file main.py.txt by accident.',
      'Creating main.py inside snippets.',
      'Typing Main.py with a capital M, then getting confused later.',
    ],
    stuckTip: 'If you only see the files inside snippets, go back and open the whole starter folder.',
  },
  {
    id: 'inspect-snippets',
    title: 'Read the jigsaw labels',
    checkpoint: 'Read snippet order',
    parts: ['task', 'map', 'check'],
    goal: 'Before pasting, look at the snippet names so the file order makes sense. The numbers are the map.',
    actions: [
      'Open the snippets folder.',
      'Read the file names from 01 to 09 without editing them.',
      'Notice that the first files prepare data, the middle files add actions, and the last files start the menu.',
      'Keep this order visible while you paste into main.py.',
    ],
    snippetFiles: ['01_header.py', '02_load_data.py', '03_save_data.py', '04_add_income.py', '05_add_expense.py', '06_view_transactions.py', '07_view_balance.py', '08_main_menu.py', '09_start_app.py'],
    coachNote: 'Think of this as arranging group presentation slides. Slide 8 cannot explain the menu if slides 1 to 7 are missing.',
    runCheck: 'You can explain what 01, 02, 03, 04, 05, 06, 07, 08, and 09 roughly do.',
    proof: 'This proves you are not blindly copying. You understand the project has setup, actions, views, menu, then start.',
    videoTitle: 'VS Code Explorer: find and open project files',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=210',
    commonMistakes: [
      'Sorting or renaming the files.',
      'Opening only one snippet and forgetting the rest.',
      'Copying from the reference solution before trying the jigsaw.',
    ],
    stuckTip: 'If the names feel strange, focus only on the numbers first. The project is built from 01 down to 09.',
  },
  {
    id: 'paste-data-helpers',
    title: 'Paste the setup and data helpers',
    checkpoint: 'Paste data helpers',
    parts: ['task', 'map', 'check'],
    goal: 'Copy the first three snippets into main.py. These lines bring in JSON, load saved records, and save records back to the file.',
    actions: [
      'Open 01_header.py, copy everything, and paste it at the top of main.py.',
      'Open 02_load_data.py, copy everything, and paste it below the header.',
      'Open 03_save_data.py, copy everything, and paste it below load_data.',
      'Keep one blank line between function blocks so the code is easier to read.',
    ],
    snippetFiles: ['01_header.py', '02_load_data.py', '03_save_data.py'],
    coachNote: 'These snippets are the storage engine. The app needs them before it can remember income and expenses.',
    runCheck: 'main.py begins with import json and includes def load_data(data) or def load_data plus def save_data.',
    proof: 'This proves the app knows where saved budget records live before the menu asks for anything.',
    videoTitle: 'Python: files and JSON idea',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=2510',
    commonMistakes: [
      'Pasting 03_save_data.py before 02_load_data.py.',
      'Deleting indentation inside a def block.',
      'Leaving out the DATA_FILE line.',
    ],
    stuckTip: 'If JSON sounds big, treat it like a notebook file. load_data reads the notebook; save_data writes back into it.',
  },
  {
    id: 'paste-entry-actions',
    title: 'Paste the income and expense actions',
    checkpoint: 'Paste income and expense',
    parts: ['task', 'map', 'check'],
    goal: 'Add the two functions that ask the user for money coming in and money going out.',
    actions: [
      'Open 04_add_income.py and paste it below save_data.',
      'Open 05_add_expense.py and paste it below add_income.',
      'Do not remove input() or float(). input() asks; float() turns typed money into a number.',
      'Check that every line inside each function is indented.',
    ],
    snippetFiles: ['04_add_income.py', '05_add_expense.py'],
    coachNote: 'This is where the app starts feeling alive because it asks questions and stores the answers.',
    runCheck: 'main.py now has def add_income(data) and def add_expense(data).',
    proof: 'This proves the tracker can collect both sides of a budget: money entering and money leaving.',
    videoTitle: 'Python input and numbers',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=473',
    commonMistakes: [
      'Typing float as flout or leaving out brackets.',
      'Breaking indentation after copying.',
      'Changing the dictionary keys, then later view functions cannot find them.',
    ],
    stuckTip: 'If the code asks for amount, remember that typed input starts as text. That is why money uses float().',
  },
  {
    id: 'paste-view-actions',
    title: 'Paste the viewing actions',
    checkpoint: 'Paste view tools',
    parts: ['task', 'map', 'check'],
    goal: 'Add the functions that show saved transactions and calculate the remaining balance.',
    actions: [
      'Open 06_view_transactions.py and paste it below add_expense.',
      'Open 07_view_balance.py and paste it below view_transactions.',
      'Look for loops that go through income and expenses.',
      'Look for sum or total lines that calculate balance.',
    ],
    snippetFiles: ['06_view_transactions.py', '07_view_balance.py'],
    coachNote: 'These are the report functions. Without them, the app can collect money records but cannot explain them back to the user.',
    runCheck: 'main.py now has def view_transactions(data) and def view_balance(data).',
    proof: 'This proves the app can show what has been saved and calculate what remains.',
    videoTitle: 'Python lists and loops',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=1360',
    commonMistakes: [
      'Putting view_balance before the add functions is fine, but do not put it inside another function.',
      'Deleting quotation marks around dictionary keys.',
      'Changing income to incomes in one place and breaking the matching key.',
    ],
    stuckTip: 'If the balance looks wrong, check whether the same key names are used everywhere: income, expenses, amount.',
  },
  {
    id: 'paste-menu-start',
    title: 'Paste the menu and start line',
    checkpoint: 'Paste menu and start',
    parts: ['task', 'map', 'check'],
    goal: 'Add the part that lets a user choose actions, then add the final line that starts the program.',
    actions: [
      'Open 08_main_menu.py and paste it below the view functions.',
      'Open 09_start_app.py and paste it as the final line of main.py.',
      'Check that main_menu() is at the bottom, outside every def block.',
      'Read the menu choices and match each number to a function above it.',
    ],
    snippetFiles: ['08_main_menu.py', '09_start_app.py'],
    coachNote: 'The menu is the reception desk. The start line is the person opening the door.',
    runCheck: 'main.py ends with main_menu().',
    proof: 'This proves Python has already seen all helper functions before the menu starts calling them.',
    videoTitle: 'Python if statements and functions',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=1740',
    commonMistakes: [
      'Pasting main_menu() above the function definitions.',
      'Indenting main_menu() so it accidentally sits inside another function.',
      'Changing menu numbers without updating the matching condition.',
    ],
    stuckTip: 'If nothing happens when you run the file, check that main_menu() is not indented and is still the last line.',
  },
  {
    id: 'check-order',
    title: 'Check the flow',
    checkpoint: 'Check the flow',
    parts: ['task', 'map', 'check', 'errors'],
    goal: 'Read main.py from top to bottom like a story: prepare tools, define jobs, show menu, start app.',
    actions: [
      'Confirm load_data appears before main_menu.',
      'Confirm add_income and add_expense appear before the menu calls them.',
      'Confirm 09_start_app.py is last.',
    ],
    snippetFiles: ['01_header.py', '02_load_data.py', '03_save_data.py', '04_add_income.py', '05_add_expense.py', '06_view_transactions.py', '07_view_balance.py', '08_main_menu.py', '09_start_app.py'],
    coachNote: 'Python reads from top to bottom. If a name is used before it is defined, Python will complain.',
    runCheck: 'No function should be called before it has been defined.',
    proof: 'If a function name appears inside main_menu, its def line should be above main_menu.',
    videoTitle: 'Python functions and reading order',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=2060',
    commonMistakes: [
      'Calling main_menu before defining load_data.',
      'Putting one def block inside another by accident.',
      'Missing a colon after def, if, elif, else, or while.',
    ],
    stuckTip: 'NameError usually means Python reached a name before it knew what that name meant.',
  },
  {
    id: 'run-menu',
    title: 'Run the menu',
    checkpoint: 'Run the menu',
    parts: ['task', 'check', 'errors'],
    goal: 'Run the base app and make sure the terminal shows the Budget Tracker menu.',
    actions: [
      'Open the terminal in VS Code.',
      'Run python main.py.',
      'Look for Add income, Add expense, View transactions, View balance, and Save and exit.',
    ],
    snippetFiles: ['09_start_app.py'],
    coachNote: 'Running is not the final step. It is the first honest test that the copied file is actually connected.',
    runCheck: 'python main.py',
    proof: 'The terminal should show the numbered budget tracker menu.',
    videoTitle: 'VS Code: run Python in the terminal',
    videoEmbed: 'https://www.youtube.com/embed/D2cwvpJSBX4?start=290',
    commonMistakes: [
      'Running from the wrong terminal folder.',
      'Clicking Run while a different file is open.',
      'Seeing python not recognized and continuing instead of returning to Setup.',
    ],
    stuckTip: 'If python is not recognized, return to Setup. If main.py is not found, make sure the terminal is inside the starter folder.',
  },
  {
    id: 'test-save',
    title: 'Test saving',
    checkpoint: 'Test saving',
    parts: ['task', 'check', 'errors'],
    goal: 'Add one income and one expense, save, then run the app again to confirm the records are still there.',
    actions: [
      'Choose Add income and enter a small test amount.',
      'Choose Add expense and enter a small test amount.',
      'Choose Save and exit, then run python main.py again.',
    ],
    snippetFiles: ['03_save_data.py', '06_view_transactions.py', '07_view_balance.py'],
    coachNote: 'A budget tracker is only useful if records survive after the app closes.',
    runCheck: 'View transactions after restarting.',
    proof: 'The records should still appear because budget_data.json saved them.',
    videoTitle: 'Python file saving concept',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=2510',
    commonMistakes: [
      'Closing the terminal without choosing the save option.',
      'Testing with empty values, then thinking the app did not work.',
      'Deleting budget_data.json while checking files.',
    ],
    stuckTip: 'If records disappear, check that save_data(data) runs before the app exits.',
  },
];

const rebuildSnippetPlan = [
  ['01_header.py', 'Bring in json and name the save file.'],
  ['02_load_data.py', 'Read old records or create empty lists.'],
  ['03_save_data.py', 'Write the current records back to the JSON file.'],
  ['04_add_income.py', 'Ask for income source and amount.'],
  ['05_add_expense.py', 'Ask for expense category, description, and amount.'],
  ['06_view_transactions.py', 'Print every saved income and expense.'],
  ['07_view_balance.py', 'Add totals and show the remaining balance.'],
  ['08_main_menu.py', 'Let the user choose what the app should do.'],
  ['09_start_app.py', 'Call main_menu() to start everything.'],
] as const;

const rebuildErrorFixes = [
  ['NameError: load_data is not defined', 'Move 02_load_data.py above the menu snippet.'],
  ['IndentationError', 'Check that lines inside def, if, elif, else, for, and while are indented the same way.'],
  ['File not found', 'Make sure the terminal is opened inside the starter folder that contains main.py.'],
] as const;

const levelIcons: Record<string, JSX.Element> = {
  join: <Save aria-hidden="true" />,
  setup: <Download aria-hidden="true" />,
  'learn-basics': <GraduationCap aria-hidden="true" />,
  'rebuild-app': <BookOpenCheck aria-hidden="true" />,
  'understand-app': <ClipboardList aria-hidden="true" />,
  'group-mission': <Sparkles aria-hidden="true" />,
  'presentation-pack': <ReceiptText aria-hidden="true" />,
};

const roadmapCopy: Record<QuestLevelId, { title: string; hint: string }> = {
  join: { title: 'Save code', hint: 'Keep your quest code.' },
  setup: { title: 'Install tools', hint: 'Python and VS Code.' },
  'learn-basics': { title: 'Watch basics', hint: 'Only the useful parts.' },
  'rebuild-app': { title: 'Run main.py', hint: 'Arrange the snippets.' },
  'understand-app': { title: 'Pass checks', hint: 'Know what each part does.' },
  'group-mission': { title: 'Add features', hint: 'Build your group extras.' },
  'presentation-pack': { title: 'Demo it', hint: 'Show the working app.' },
};

type PasswordCredentialConstructor = new (data: {
  id: string;
  name?: string;
  password: string;
}) => Credential;

async function storeProgressCodeCredential(progress: ProgressRecord) {
  const credentialWindow = window as Window & {
    PasswordCredential?: PasswordCredentialConstructor;
  };

  if (!credentialWindow.PasswordCredential || !navigator.credentials?.store) return;

  try {
    const credential = new credentialWindow.PasswordCredential({
      id: progress.name || progress.progressCode,
      name: progress.name || 'Budget Tracker Quest',
      password: progress.progressCode,
    });
    await navigator.credentials.store(credential);
  } catch {
    // Password managers are optional. The quest should continue even if the browser declines.
  }
}

function App() {
  const [studentName, setStudentName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(1);
  const [progress, setProgress] = useState<ProgressRecord | null>(null);
  const [continueCode, setContinueCode] = useState('');
  const [continueError, setContinueError] = useState('');
  const [currentPage, setCurrentPage] = useState<QuestPageId>(() => pageFromPath(window.location.pathname));
  const [isRestoringProgress, setIsRestoringProgress] = useState(() =>
    Boolean(window.localStorage.getItem(ACTIVE_PROGRESS_CODE_KEY)),
  );
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [registrationCopied, setRegistrationCopied] = useState(false);
  const [navCodeCopied, setNavCodeCopied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMemberProgress[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [notifications, setNotifications] = useState<GroupNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showNudgePopup, setShowNudgePopup] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  const repository = useMemo(() => {
    if (hasFirebaseConfig()) {
      return createFirestoreProgressRepository(createFirebaseRuntime());
    }
    return createLocalProgressRepository();
  }, []);

  useEffect(() => {
    function handlePopState() {
      setCurrentPage(pageFromPath(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const activeCode = window.localStorage.getItem(ACTIVE_PROGRESS_CODE_KEY);
    if (!activeCode) {
      setIsRestoringProgress(false);
      return;
    }

    let ignore = false;
    repository
      .getByCode(activeCode)
      .then((recovered) => {
        if (ignore || !recovered) return;
        const recoveredWithJoin = recovered.completedSteps.includes('join')
          ? recovered
          : markStepComplete(recovered, 'join');
        setProgress(recoveredWithJoin);
        if (recoveredWithJoin !== recovered) {
          void repository.save(recoveredWithJoin).then(syncSavedIdentity);
        }
      })
      .finally(() => {
        if (!ignore) setIsRestoringProgress(false);
      });

    return () => {
      ignore = true;
    };
  }, [repository]);

  const selectedPack = useMemo(
    () => getGroupFeaturePack(progress?.groupId ?? selectedGroup),
    [progress?.groupId, selectedGroup],
  );

  const questState = useMemo(() => {
    if (!progress) return null;
    return calculateQuestState({
      completedSteps: progress.completedSteps,
      checkpointScore: progress.checkpointScore,
      totalCheckpoints: progress.totalCheckpoints,
      downloads: progress.downloads,
    });
  }, [progress]);

  const groupMissionAccess = useMemo(() => {
    if (!progress) return null;
    return buildGroupMissionAccess(progress, groupMembers, groupLoading);
  }, [groupLoading, groupMembers, progress]);

  const pageLocks = useMemo(() => {
    if (!progress || !groupMissionAccess) return {};
    return buildPageLocks(progress, groupMissionAccess);
  }, [groupMissionAccess, progress]);

  function syncSavedIdentity(savedRecord: ProgressRecord) {
    setProgress((current) => {
      if (!current || current.progressCode !== savedRecord.progressCode) return current;
      return {
        ...current,
        linkedUids: savedRecord.linkedUids,
      };
    });
  }

  useEffect(() => {
    if (!progress) {
      setNotifications([]);
      setShowNudgePopup(false);
      return;
    }

    let ignore = false;
    setNotificationError('');
    repository
      .listNotifications(progress)
      .then((items) => {
        if (ignore) return;
        setNotifications(items);
        setShowNudgePopup(items.length > 0);
      })
      .catch(() => {
        if (!ignore) setNotificationError('Could not load group nudges yet.');
      });

    return () => {
      ignore = true;
    };
  }, [progress?.groupId, progress?.progressCode, repository]);

  useEffect(() => {
    if (!progress || (currentPage !== 'group-room' && currentPage !== 'group-mission')) return;

    let ignore = false;
    setGroupLoading(true);
    setGroupError('');
    repository
      .listGroupMembers(progress.groupId)
      .then((members) => {
        if (!ignore) setGroupMembers(members);
      })
      .catch(() => {
        if (!ignore) setGroupError('Could not load the group room yet.');
      })
      .finally(() => {
        if (!ignore) setGroupLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [currentPage, progress, repository]);

  function navigateTo(pageId: QuestPageId) {
    if (pageLocks[pageId]) return;

    const page = allQuestPages.find((item) => item.id === pageId) ?? questPages[0];
    if (window.location.pathname !== page.path) {
      window.history.pushState({}, '', page.path);
    }
    setCurrentPage(page.id);
    setDrawerOpen(false);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function startQuest() {
    const record = createProgressRecord({
      name: studentName.trim() || 'Student',
      groupId: selectedGroup,
      uid: 'local-preview-user',
    });
    const joinedRecord = markStepComplete(record, 'join');

    window.localStorage.setItem(ACTIVE_PROGRESS_CODE_KEY, joinedRecord.progressCode);
    setProgress(joinedRecord);
    setRegistrationCopied(false);
    setShowRegistrationDialog(true);
    void repository.save(joinedRecord).then(syncSavedIdentity);
  }

  async function continueQuest() {
    const recovered = await repository.getByCode(continueCode);
    if (!recovered) {
      setContinueError('Progress code not found on this device yet.');
      return;
    }

    const recoveredWithJoin = recovered.completedSteps.includes('join')
      ? recovered
      : markStepComplete(recovered, 'join');

    setContinueError('');
    window.localStorage.setItem(ACTIVE_PROGRESS_CODE_KEY, recoveredWithJoin.progressCode);
    setProgress(recoveredWithJoin);
    if (recoveredWithJoin !== recovered) {
      void repository.save(recoveredWithJoin).then(syncSavedIdentity);
    }
    navigateTo('overview');
  }

  async function copyRegistrationCode() {
    if (!progress) return;

    setRegistrationCopied(true);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(progress.progressCode);
    }
    await storeProgressCodeCredential(progress);
  }

  async function copyNavProgressCode() {
    if (!progress) return;

    setNavCodeCopied(true);
    window.setTimeout(() => setNavCodeCopied(false), 1200);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(progress.progressCode);
    }
  }

  async function nudgeGroupMember(memberId: string) {
    if (!progress) return;

    await repository.nudgeGroupMember(progress.groupId, memberId, progress);
    setGroupMembers(await repository.listGroupMembers(progress.groupId));
    setNotifications(await repository.listNotifications(progress));
  }

  function toggleNotifications() {
    setNotificationsOpen((open) => !open);
    setShowNudgePopup(false);
  }

  async function markAllNotificationsRead() {
    if (!progress) return;

    await repository.markNotificationsRead(progress);
    setNotifications([]);
    setShowNudgePopup(false);
  }

  function closeRegistrationDialog() {
    if (!registrationCopied) return;
    setShowRegistrationDialog(false);
    navigateTo('overview');
  }

  function completeLevel(level: QuestLevel) {
    if (!progress) return;

    const withCheckpoint =
      level.id === 'understand-app'
        ? {
            ...progress,
            checkpointScore: progress.totalCheckpoints,
          }
        : progress;

    const nextRecord = markStepComplete(withCheckpoint, level.id);
    setProgress(nextRecord);
    void repository.save(nextRecord).then(syncSavedIdentity);
  }

  function retakeLevel(level: QuestLevel) {
    if (!progress || level.id === 'join') return;

    const nextRecord = resetCourseSection(progress, level.id);
    saveProgressRecord(nextRecord);
    const pageId = pageByLevelId[level.id];
    if (pageId) navigateTo(pageId);
  }

  function saveProgressRecord(nextRecord: ProgressRecord) {
    window.localStorage.setItem(ACTIVE_PROGRESS_CODE_KEY, nextRecord.progressCode);
    setProgress(nextRecord);
    void repository.save(nextRecord).then(syncSavedIdentity);
  }

  function moveSetupStepper(stepIndex: number) {
    if (!progress) return;

    saveProgressRecord(setSetupStep(progress, stepIndex));
  }

  function completeSetupSubstep(stepId: SetupStepId) {
    if (!progress) return;

    saveProgressRecord(markSetupStepComplete(progress, stepId));
  }

  function moveLearnStepper(stepIndex: number) {
    if (!progress) return;

    saveProgressRecord(setLearnStep(progress, stepIndex));
  }

  function completeLearnSubstep(stepId: LearnStepId) {
    if (!progress) return;

    saveProgressRecord(markLearnStepComplete(progress, stepId));
  }

  function moveRebuildStepper(stepIndex: number) {
    if (!progress) return;

    saveProgressRecord(setRebuildStep(progress, stepIndex));
  }

  function completeRebuildSubstep(stepId: RebuildStepId) {
    if (!progress) return;

    saveProgressRecord(markRebuildStepComplete(progress, stepId));
  }

  function moveUnderstandStepper(stepIndex: number) {
    if (!progress) return;

    saveProgressRecord(setUnderstandStep(progress, stepIndex));
  }

  function completeUnderstandSubstep(stepId: UnderstandStepId) {
    if (!progress) return;

    saveProgressRecord(markUnderstandStepComplete(progress, stepId));
  }

  function exportReceipt() {
    if (!progress || !questState) return;

    const lines = [
      'Budget Tracker Quest Completion Receipt',
      `Name: ${progress.name}`,
      `Group: ${progress.groupId}`,
      `Progress code: ${progress.progressCode}`,
      `Completed levels: ${progress.completedSteps.length}/7`,
      `Badges: ${questState.badges.join(', ') || 'No badges yet'}`,
      `Feature pack: ${selectedPack.title}`,
      `Generated: ${new Date().toLocaleString()}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-quest-${progress.progressCode}-receipt.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isRestoringProgress) {
    return (
      <main className="app-shell">
        <section className="join-card">
          <p className="eyebrow">Loading</p>
          <h2>Opening your saved quest</h2>
          <p className="muted-copy">Your progress code is being restored on this device.</p>
        </section>
      </main>
    );
  }

  if (!progress || !questState || showRegistrationDialog) {
    return (
      <main className="app-shell">
        <JoinScreen
          continueCode={continueCode}
          continueError={continueError}
          onContinueCodeChange={setContinueCode}
          onContinueQuest={continueQuest}
          onSelectedGroupChange={setSelectedGroup}
          onStartQuest={startQuest}
          onStudentNameChange={setStudentName}
          selectedGroup={selectedGroup}
          studentName={studentName}
        />
        {progress && (
          <RegistrationDialog
            copied={registrationCopied}
            progress={progress}
            onClose={closeRegistrationDialog}
            onCopy={() => void copyRegistrationCode()}
          />
        )}
      </main>
    );
  }

  return (
    <main className="quest-shell">
      {drawerOpen && (
        <button
          aria-label="Close quest menu overlay"
          className="nav-drawer-overlay"
          type="button"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <QuestTopNav
        activePage={currentPage}
        completedSteps={progress.completedSteps}
        copied={navCodeCopied}
        drawerOpen={drawerOpen}
        lockedPages={pageLocks}
        notificationError={notificationError}
        notifications={notifications}
        notificationsOpen={notificationsOpen}
        progress={progress}
        onCopyCode={() => void copyNavProgressCode()}
        onMarkNotificationsRead={() => void markAllNotificationsRead()}
        onNavigate={navigateTo}
        onToggleNotifications={toggleNotifications}
        onToggleDrawer={() => setDrawerOpen((open) => !open)}
      />
      {showNudgePopup && notifications.length > 0 && (
        <PendingNudgePopup
          notifications={notifications}
          onClose={() => setShowNudgePopup(false)}
          onOpenNotifications={() => {
            setShowNudgePopup(false);
            setNotificationsOpen(true);
          }}
        />
      )}
      <div className="quest-body">
        <QuestSidebar
          activePage={currentPage}
          completedSteps={progress.completedSteps}
          lockedPages={pageLocks}
          onNavigate={navigateTo}
        />
        <section className="quest-content">{renderQuestPage()}</section>
      </div>
      <GroupRoomFab active={currentPage === 'group-room'} onNavigate={() => navigateTo('group-room')} />
    </main>
  );

  function renderQuestPage() {
    if (!progress || !questState || !groupMissionAccess) return null;

    const currentPageLock = pageLocks[currentPage];
    if (currentPageLock) {
      return <LockedQuestPage activePage={currentPage} reason={currentPageLock} onNavigate={navigateTo} />;
    }

    if (currentPage === 'overview') {
      return (
        <OverviewPage
          progress={progress}
          questState={questState}
          selectedPack={selectedPack}
          onExportReceipt={exportReceipt}
          onNavigate={navigateTo}
        />
      );
    }

    if (currentPage === 'setup') {
      return (
        <StepPage
          level={levelById('setup')}
          progress={progress}
          onComplete={completeLevel}
          onRetake={retakeLevel}
          intro="Install the tools before touching the starter files."
          showChecklist={false}
        >
          <SetupStepper
            progress={progress}
            onCompleteStep={completeSetupSubstep}
            onSelectStep={moveSetupStepper}
          />
          <DownloadsGrid
            progress={progress}
            questState={questState}
            selectedPack={selectedPack}
            onExportReceipt={exportReceipt}
          />
        </StepPage>
      );
    }

    if (currentPage === 'learn-basics') {
      return (
        <StepPage
          level={levelById('learn-basics')}
          progress={progress}
          onComplete={completeLevel}
          onRetake={retakeLevel}
          intro="Watch only the Python ideas this assignment uses."
          showChecklist={false}
        >
          <LearnBasicsStepper
            progress={progress}
            onCompleteStep={completeLearnSubstep}
            onSelectStep={moveLearnStepper}
          />
        </StepPage>
      );
    }

    if (currentPage === 'rebuild-app') {
      return (
        <StepPage
          level={levelById('rebuild-app')}
          progress={progress}
          onComplete={completeLevel}
          onRetake={retakeLevel}
          intro="Arrange the scattered snippets into one working CLI app."
          showChecklist={false}
        >
          <RebuildStepper
            progress={progress}
            onCompleteStep={completeRebuildSubstep}
            onSelectStep={moveRebuildStepper}
          />
          <DownloadsGrid
            progress={progress}
            questState={questState}
            selectedPack={selectedPack}
            onExportReceipt={exportReceipt}
          />
        </StepPage>
      );
    }

    if (currentPage === 'understand-app') {
      return (
        <StepPage
          level={levelById('understand-app')}
          progress={progress}
          onComplete={completeLevel}
          onRetake={retakeLevel}
          intro="Trace the finished app so you can explain it before adding group features."
          showChecklist={false}
        >
          <UnderstandAppStepper
            progress={progress}
            onCompleteStep={completeUnderstandSubstep}
            onSelectStep={moveUnderstandStepper}
          />
        </StepPage>
      );
    }

    if (currentPage === 'group-room') {
      return (
        <GroupRoomPage
          currentProgress={progress}
          error={groupError}
          loading={groupLoading}
          members={groupMembers}
          onNudge={(memberId) => void nudgeGroupMember(memberId)}
        />
      );
    }

    if (currentPage === 'group-mission') {
      return (
        <StepPage
          level={levelById('group-mission')}
          progress={progress}
          onComplete={completeLevel}
          onRetake={retakeLevel}
          intro="Add your group features after the base tracker is understood."
          showChecklist={false}
        >
          <GroupMissionPanel
            access={groupMissionAccess}
            loading={groupLoading}
            progress={progress}
            selectedPack={selectedPack}
            onCompleteMission={() => completeLevel(levelById('group-mission'))}
          />
        </StepPage>
      );
    }

    return (
      <StepPage
        level={levelById('presentation-pack')}
        progress={progress}
        onComplete={completeLevel}
        onRetake={retakeLevel}
        intro="Prepare a clean demo so every group member has something to explain."
        showChecklist={false}
      >
        <PresentationPrepPage
          progress={progress}
          questState={questState}
          selectedPack={selectedPack}
          onExportReceipt={exportReceipt}
          onCompletePresentation={() => completeLevel(levelById('presentation-pack'))}
          onRetakeLevel={retakeLevel}
        />
      </StepPage>
    );
  }
}

function JoinScreen(props: {
  continueCode: string;
  continueError: string;
  onContinueCodeChange: (value: string) => void;
  onContinueQuest: () => Promise<void>;
  onSelectedGroupChange: (value: number) => void;
  onStartQuest: () => void;
  onStudentNameChange: (value: string) => void;
  selectedGroup: number;
  studentName: string;
}) {
  return (
    <section className="join-layout">
      <div className="hero-panel">
        <div className="stamp">100 Level Info Tech</div>
        <h1>Budget Tracker Quest</h1>
        <p>
          A guided Python class project portal for students who are still learning what code,
          files, functions, and assignments are supposed to feel like.
        </p>
        <div className="hero-proof">
          <span>7 levels</span>
          <span>14 missions</span>
          <span>No leaderboard</span>
        </div>
        <img
          className="hero-image"
          src="/images/budget-quest-preview.png"
          alt="Preview of the budget tracker quest levels and progress code"
        />
      </div>

      <form
        className="join-card"
        onSubmit={(event) => {
          event.preventDefault();
          props.onStartQuest();
        }}
      >
        <div>
          <p className="eyebrow">Start Here</p>
          <h2>Join and save progress</h2>
          <p className="muted-copy">You will get a progress code. Keep it safe so you can continue later.</p>
        </div>

        <label>
          Student name
          <input
            autoComplete="username"
            name="username"
            value={props.studentName}
            onChange={(event) => props.onStudentNameChange(event.target.value)}
            placeholder="Enter your name"
          />
        </label>

        <label>
          Group
          <select value={props.selectedGroup} onChange={(event) => props.onSelectedGroupChange(Number(event.target.value))}>
            {groupFeaturePacks.map((group) => (
              <option key={group.id} value={group.id}>
                Group {group.id}: {group.title}
              </option>
            ))}
          </select>
        </label>

        <button className="brutal-button primary" type="submit">
          Start my quest
        </button>

        <div className="continue-box">
          <label>
            Already have a progress code?
            <input
              autoCapitalize="characters"
              autoComplete="current-password"
              name="password"
              spellCheck={false}
              type="password"
              value={props.continueCode}
              onChange={(event) => props.onContinueCodeChange(event.target.value.toUpperCase())}
              placeholder="Example: G7-4821"
            />
          </label>
          <button
            className="brutal-button secondary"
            type="button"
            disabled={!props.continueCode.trim()}
            onClick={() => void props.onContinueQuest()}
          >
            Continue with code
          </button>
          {props.continueError && <p className="error-text">{props.continueError}</p>}
        </div>
      </form>
    </section>
  );
}

function RegistrationDialog(props: {
  copied: boolean;
  progress: ProgressRecord;
  onClose: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="registration-title"
        aria-modal="true"
        className="registration-dialog"
        role="dialog"
      >
        <button
          aria-label="Close registration dialog"
          className="dialog-close"
          disabled={!props.copied}
          type="button"
          onClick={props.onClose}
        >
          <X aria-hidden="true" />
        </button>
        <p className="eyebrow">Registered Successfully</p>
        <h2 id="registration-title">Registered successfully</h2>
        <p className="muted-copy">Copy this progress code before entering the quest dashboard.</p>
        <div className="dialog-code-box">
          <span>{props.progress.name}</span>
          <strong>{props.progress.progressCode}</strong>
          <span>Group {props.progress.groupId}</span>
        </div>
        <button className="brutal-button primary copy-code-button" type="button" onClick={props.onCopy}>
          <Copy aria-hidden="true" />
          Copy progress code
        </button>
        <p className={`copy-status ${props.copied ? 'ready' : ''}`}>
          {props.copied ? 'Code copied. You can continue.' : 'The close button unlocks after you copy the code.'}
        </p>
      </section>
    </div>
  );
}

function QuestTopNav(props: {
  activePage: QuestPageId;
  completedSteps: QuestLevelId[];
  copied: boolean;
  drawerOpen: boolean;
  lockedPages: PageLockMap;
  notificationError: string;
  notifications: GroupNotification[];
  notificationsOpen: boolean;
  progress: ProgressRecord;
  onCopyCode: () => void;
  onMarkNotificationsRead: () => void;
  onNavigate: (page: QuestPageId) => void;
  onToggleNotifications: () => void;
  onToggleDrawer: () => void;
}) {
  const CopyStateIcon = props.copied ? Plus : Copy;
  const NotificationIcon = props.notifications.length > 0 ? BellRing : Bell;

  return (
    <header className="quest-top-nav">
      <button
        aria-expanded={props.drawerOpen}
        aria-label={props.drawerOpen ? 'Close quest menu' : 'Open quest menu'}
        className="drawer-toggle"
        type="button"
        onClick={props.onToggleDrawer}
      >
        {props.drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <div className="quest-title-slot">
        <h1>{props.progress.name}</h1>
      </div>
      <div className="quest-top-actions">
        <button
          aria-expanded={props.notificationsOpen}
          aria-label="Open notifications"
          className={`notification-button ${props.notifications.length > 0 ? 'has-unread' : ''}`}
          title={props.notifications.length > 0 ? `${props.notifications.length} pending nudges` : 'Notifications'}
          type="button"
          onClick={props.onToggleNotifications}
        >
          <NotificationIcon aria-hidden="true" />
          {props.notifications.length > 0 && <span>{props.notifications.length}</span>}
        </button>
        <div className="progress-chip">
          <div className="code-chip-row">
            <strong>{props.progress.progressCode}</strong>
            <button
              aria-label={props.copied ? 'Progress code copied' : 'Copy progress code'}
              className={`code-copy-button ${props.copied ? 'copied' : ''}`}
              title={props.copied ? 'Copied' : 'Copy progress code'}
              type="button"
              onClick={props.onCopyCode}
            >
              <CopyStateIcon aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {props.notificationsOpen && (
        <NotificationsCenter
          error={props.notificationError}
          notifications={props.notifications}
          onMarkRead={props.onMarkNotificationsRead}
        />
      )}
      {props.drawerOpen && (
        <div className="nav-drawer">
          <p className="eyebrow">Quest pages</p>
          <nav aria-label="Quest drawer pages">
            <QuestNavLinks
              activePage={props.activePage}
              completedSteps={props.completedSteps}
              lockedPages={props.lockedPages}
              onNavigate={props.onNavigate}
              variant="drawer"
            />
          </nav>
        </div>
      )}
    </header>
  );
}

function NotificationsCenter(props: {
  error: string;
  notifications: GroupNotification[];
  onMarkRead: () => void;
}) {
  return (
    <section aria-label="Notifications" className="notifications-center" role="region">
      <div className="notifications-center-top">
        <div>
          <p className="eyebrow">Group nudges</p>
          <h2>Notifications</h2>
        </div>
        <button
          className="mini-button secondary"
          disabled={props.notifications.length === 0}
          type="button"
          onClick={props.onMarkRead}
        >
          Mark all read
        </button>
      </div>
      {props.error && <p className="error-text">{props.error}</p>}
      {props.notifications.length === 0 ? (
        <p className="empty-notification-copy">No pending nudges</p>
      ) : (
        <div className="notification-list">
          {props.notifications.map((notification) => (
            <article className="notification-card" key={notification.id}>
              <div className="notification-card-icon">
                <Users aria-hidden="true" />
              </div>
              <div>
                <strong>{notification.senderName}</strong>
                <p>{notification.message}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PendingNudgePopup(props: {
  notifications: GroupNotification[];
  onClose: () => void;
  onOpenNotifications: () => void;
}) {
  const latest = props.notifications[0];
  const extraCount = props.notifications.length - 1;

  return (
    <section
      aria-labelledby="pending-nudges-title"
      aria-modal="false"
      className="pending-nudge-popup"
      role="dialog"
    >
      <button aria-label="Close pending nudge popup" className="popup-close-button" type="button" onClick={props.onClose}>
        <X aria-hidden="true" />
      </button>
      <div className="pending-nudge-icon">
        <BellRing aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">Group check-in</p>
        <h2 id="pending-nudges-title">Pending group nudges</h2>
        <p>
          {latest.message}
          {extraCount > 0 ? ` You have ${extraCount} more waiting.` : ''}
        </p>
      </div>
      <button className="mini-button primary" type="button" onClick={props.onOpenNotifications}>
        Open notifications
      </button>
    </section>
  );
}

function GroupRoomFab(props: { active: boolean; onNavigate: () => void }) {
  return (
    <button
      aria-label="Open group room"
      className={`group-room-fab ${props.active ? 'active' : ''}`}
      title="Group room"
      type="button"
      onClick={props.onNavigate}
    >
      <Users aria-hidden="true" />
    </button>
  );
}

function QuestSidebar(props: {
  activePage: QuestPageId;
  completedSteps: QuestLevelId[];
  lockedPages: PageLockMap;
  onNavigate: (page: QuestPageId) => void;
}) {
  return (
    <aside className="quest-sidebar" aria-label="Quest pages">
      <p className="sr-only">Quest pages</p>
      <nav>
        <QuestNavLinks
          activePage={props.activePage}
          completedSteps={props.completedSteps}
          lockedPages={props.lockedPages}
          onNavigate={props.onNavigate}
          variant="rail"
        />
      </nav>
    </aside>
  );
}

function QuestNavLinks(props: {
  activePage: QuestPageId;
  completedSteps: QuestLevelId[];
  lockedPages: PageLockMap;
  onNavigate: (page: QuestPageId) => void;
  variant: 'rail' | 'drawer';
}) {
  return (
    <>
      {questPages.map((page) => {
        const done = page.levelId ? props.completedSteps.includes(page.levelId) : false;
        const lockedReason = props.lockedPages[page.id];
        const locked = Boolean(lockedReason);
        const Icon = page.icon;
        return (
          <a
            aria-disabled={locked ? 'true' : undefined}
            aria-label={page.label}
            className={`sidebar-link ${props.variant === 'drawer' ? 'drawer-link' : ''} ${
              props.activePage === page.id ? 'active' : ''
            } ${locked ? 'locked' : ''}`}
            href={page.path}
            key={page.id}
            title={lockedReason ?? page.label}
            onClick={(event) => {
              event.preventDefault();
              if (locked) return;
              props.onNavigate(page.id);
            }}
          >
            <Icon aria-hidden="true" className="sidebar-icon" />
            <span className="sidebar-label">{page.label}</span>
            <span className="sidebar-tooltip" role="tooltip">
              {lockedReason ? `${page.label}: ${lockedReason}` : page.label}
            </span>
            {locked && <Lock aria-hidden="true" className="sidebar-locked" />}
            {done && <BadgeCheck aria-hidden="true" className="sidebar-complete" />}
          </a>
        );
      })}
    </>
  );
}

function LockedQuestPage(props: {
  activePage: QuestPageId;
  reason: string;
  onNavigate: (page: QuestPageId) => void;
}) {
  const page = questPages.find((item) => item.id === props.activePage);
  const Icon = page?.icon ?? Lock;

  return (
    <section className="locked-quest-page">
      <div className="locked-quest-icon">
        <Icon aria-hidden="true" />
      </div>
      <p className="eyebrow">Locked for now</p>
      <h1>{page?.label ?? 'Quest page'} is not open yet</h1>
      <p>{props.reason}</p>
      <button className="mini-button primary" type="button" onClick={() => props.onNavigate('overview')}>
        Back to overview
      </button>
    </section>
  );
}

function GroupRoomPage(props: {
  currentProgress: ProgressRecord;
  error: string;
  loading: boolean;
  members: GroupMemberProgress[];
  onNudge: (memberId: string) => void;
}) {
  const members = props.members.length > 0 ? props.members : [];

  return (
    <section className="group-room">
      <div className="group-room-hero">
        <div>
          <p className="eyebrow">Group Room</p>
          <h1>Group {props.currentProgress.groupId} squad check</h1>
          <p>See who is moving, who is stuck, and send a quick nudge before presentation day.</p>
        </div>
        <div className="group-room-icon">
          <Users aria-hidden="true" />
        </div>
      </div>

      {props.error && <p className="error-text">{props.error}</p>}
      {props.loading && <p className="copy-status">Loading group progress...</p>}

      {!props.loading && members.length === 0 ? (
        <article className="empty-group-card">
          <h2>No group members yet</h2>
          <p>When classmates join this same group and save progress, they will show up here.</p>
        </article>
      ) : (
        <div className="group-member-grid">
          {members.map((member) => {
            const isCurrentMember =
              member.id === normalizeProgressCode(props.currentProgress.progressCode) ||
              props.currentProgress.linkedUids.includes(member.id);

            return (
              <article className="group-member-card" key={member.id}>
                <div className="member-card-top">
                  <div>
                    <p className="eyebrow">{isCurrentMember ? 'You' : 'Member'}</p>
                    <h2>{member.name}</h2>
                  </div>
                  <strong>{member.completionPercent}%</strong>
                </div>
                <div className="progress-bar" aria-label={`${member.name} progress`}>
                  <span style={{ width: `${member.completionPercent}%` }} />
                </div>
                <div className="member-mini-stats">
                  <span>{member.completedSteps}/{member.totalSteps} levels</span>
                  <span>{member.badgeCount} badges</span>
                  <span>{member.nudgeCount} nudges</span>
                  {isCurrentMember && <span>This is you</span>}
                </div>
                <p className="muted-copy">Last stop: {member.lastStepTitle}</p>
                {!isCurrentMember && (
                  <button className="mini-button nudge-button" type="button" onClick={() => props.onNudge(member.id)}>
                    <Users aria-hidden="true" />
                    Nudge
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OverviewPage(props: {
  progress: ProgressRecord;
  questState: ReturnType<typeof calculateQuestState>;
  selectedPack: ReturnType<typeof getGroupFeaturePack>;
  onExportReceipt: () => void;
  onNavigate: (page: QuestPageId) => void;
}) {
  return (
    <>
      <h1 className="sr-only">Overview</h1>
      <OverviewSummaryCards
        progress={props.progress}
        questState={props.questState}
        selectedPack={props.selectedPack}
        onNavigate={props.onNavigate}
      />
      <section className="overview-board">
        <RoadmapLearningPath
          completedSteps={props.progress.completedSteps}
          onNavigate={props.onNavigate}
        />
      </section>

      <section className="downloads-section">
        <h2 className="sr-only">Downloads</h2>
        <DownloadsGrid
          progress={props.progress}
          questState={props.questState}
          selectedPack={props.selectedPack}
          onExportReceipt={props.onExportReceipt}
        />
      </section>
    </>
  );
}

function OverviewSummaryCards(props: {
  progress: ProgressRecord;
  questState: ReturnType<typeof calculateQuestState>;
  selectedPack: ReturnType<typeof getGroupFeaturePack>;
  onNavigate: (page: QuestPageId) => void;
}) {
  const nextLevel = questLevels.find((level) => !props.progress.completedSteps.includes(level.id));
  const nextPage = nextLevel ? pageByLevelId[nextLevel.id] : undefined;

  return (
    <section className="overview-cards" aria-label="Quest overview">
      <article className="dashboard-card mission-card">
        <p className="eyebrow">Your Mission</p>
        <h2>{props.selectedPack.title}</h2>
        <p>{props.selectedPack.overview}</p>
      </article>

      <article className="dashboard-card progress-card">
        <p className="eyebrow">Progress</p>
        <div className="big-percent">{props.questState.completionPercent}%</div>
        <div className="progress-bar" aria-label="Quest progress">
          <span style={{ width: `${props.questState.completionPercent}%` }} />
        </div>
        <div className="badge-grid">
          {props.questState.badges.length === 0 ? (
            <span className="badge empty">No badges yet</span>
          ) : (
            props.questState.badges.map((badge) => (
              <span className="badge" key={badge}>
                <BadgeCheck aria-hidden="true" />
                {badge.replaceAll('-', ' ')}
              </span>
            ))
          )}
        </div>
      </article>

      <article className="dashboard-card next-card">
        <p className="eyebrow">Next Step</p>
        <h2>{nextLevel ? nextLevel.title : 'Demo ready'}</h2>
        <p>{nextLevel ? nextLevel.studentGoal : 'All levels are complete. Export the receipt and rehearse the presentation.'}</p>
        {nextPage && (
          <button className="mini-button" type="button" onClick={() => props.onNavigate(nextPage)}>
            Start next level
          </button>
        )}
      </article>
    </section>
  );
}

function RoadmapLearningPath(props: {
  completedSteps: QuestLevelId[];
  onNavigate: (page: QuestPageId) => void;
}) {
  const nextLevel = questLevels.find((level) => !props.completedSteps.includes(level.id));

  return (
    <div className="roadmap-map" aria-label="Learning path roadmap">
      <svg className="roadmap-lines" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="8,68 22,28 38,70 54,34 70,69 86,31 88,76" />
      </svg>
      {questLevels.map((level, index) => {
        const done = props.completedSteps.includes(level.id);
        const current = nextLevel?.id === level.id;
        const pageId = pageByLevelId[level.id];
        const copy = roadmapCopy[level.id];
        const status = done ? 'Done' : current ? 'Next' : 'Todo';
        const content = (
          <>
            <span className="sr-only">{level.title}</span>
            <div className="roadmap-icon">{levelIcons[level.id]}</div>
            <span className="level-number">Level {level.level}</span>
            <h3>{copy.title}</h3>
            <span className={`roadmap-status ${done ? 'done' : current ? 'current' : ''}`}>{status}</span>
          </>
        );

        if (pageId) {
          return (
            <button
              className={`level-card roadmap-card roadmap-position-${index} ${done ? 'complete' : ''} ${
                current ? 'current' : ''
              }`}
              key={level.id}
              type="button"
              onClick={() => props.onNavigate(pageId)}
            >
              {content}
            </button>
          );
        }

        return (
          <article
            className={`level-card roadmap-card roadmap-position-${index} ${done ? 'complete' : ''} ${
              current ? 'current' : ''
            }`}
            key={level.id}
          >
            {content}
          </article>
        );
      })}
    </div>
  );
}

function LearningPathList(props: {
  completedSteps: QuestLevelId[];
  onNavigate: (page: QuestPageId) => void;
}) {
  return (
    <div className="level-list">
      {questLevels.map((level) => {
        const done = props.completedSteps.includes(level.id);
        const pageId = pageByLevelId[level.id];
        return (
          <article className={`level-card ${done ? 'complete' : ''}`} key={level.id}>
            <div className="level-icon">{levelIcons[level.id]}</div>
            <div>
              <div className="level-title-row">
                <span className="level-number">Level {level.level}</span>
                <span className={`status-pill ${done ? 'done' : ''}`}>{done ? 'Completed' : 'Not done'}</span>
              </div>
              <h3>{level.title}</h3>
              <p>{level.studentGoal}</p>
              <ul>
                {level.tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
              {!done && pageId && (
                <button className="mini-button" type="button" onClick={() => props.onNavigate(pageId)}>
                  Start this level
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StepPage(props: {
  children: React.ReactNode;
  intro: string;
  level: QuestLevel;
  progress: ProgressRecord;
  onComplete: (level: QuestLevel) => void;
  onRetake?: (level: QuestLevel) => void;
  showChecklist?: boolean;
}) {
  const done = props.progress.completedSteps.includes(props.level.id);
  const showChecklist = props.showChecklist ?? true;

  return (
    <>
      <section className={`step-hero step-hero-${props.level.id} ${done ? 'complete' : ''}`}>
        <div className="level-icon">{levelIcons[props.level.id]}</div>
        <div>
          <span className="level-number">Level {props.level.level}</span>
          <h1>{props.level.title}</h1>
          <p>{props.intro}</p>
        </div>
      </section>

      {done && props.onRetake && props.level.id !== 'join' && (
        <section className="completion-confirmation" aria-label={`${props.level.title} completion confirmation`}>
          <div className="completion-confirmation-icon">
            <BadgeCheck aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Confirmed complete</p>
            <h2>{props.level.title} complete</h2>
            <p>
              This section is saved on your progress code. You can retake it if the group wants to practise again or
              fix weak spots before presentation.
            </p>
          </div>
          <button
            aria-label={`Retake ${props.level.title}`}
            className="retake-icon-button"
            title={`Retake ${props.level.title}`}
            type="button"
            onClick={() => props.onRetake?.(props.level)}
          >
            <RotateCcw aria-hidden="true" />
            <span>Retake</span>
          </button>
        </section>
      )}

      {showChecklist && (
        <section className="quest-panel">
          <div className="section-heading">
            <p className="eyebrow">Checklist</p>
            <h2>What to finish here</h2>
          </div>
          <div className="task-strip">
            {props.level.tasks.map((task) => (
              <span key={task}>{task}</span>
            ))}
          </div>
          <button
            className="brutal-button primary"
            type="button"
            disabled={done}
            onClick={() => props.onComplete(props.level)}
          >
            {done ? 'Completed' : markCompleteLabel(props.level.id)}
          </button>
        </section>
      )}

      {props.children}
    </>
  );
}

const presentationRecapItems: Array<{
  levelId: QuestLevelId;
  learned: string;
  say: string;
}> = [
  {
    levelId: 'setup',
    learned: 'You installed the tools and proved Python can run on the laptop.',
    say: 'We prepared Python, VS Code, and the terminal before editing the project.',
  },
  {
    levelId: 'learn-basics',
    learned: 'You met print, variables, input, lists, dictionaries, if/elif, and functions.',
    say: 'We learned only the Python syntax needed for this budget tracker.',
  },
  {
    levelId: 'rebuild-app',
    learned: 'You assembled scattered snippets into one working main.py file.',
    say: 'We rebuilt the base app step by step instead of pasting code blindly.',
  },
  {
    levelId: 'understand-app',
    learned: 'You traced how data loads, records are added, totals are calculated, and the menu repeats.',
    say: 'We can explain where the app stores data and how the menu controls the functions.',
  },
  {
    levelId: 'group-mission',
    learned: 'You added a group feature and tested it from the CLI menu.',
    say: 'We added our group feature, connected it to the menu, and tested it with simple values.',
  },
];

const presentationScriptCards = [
  {
    title: 'Problem',
    line: 'A budget tracker helps someone see money coming in, money going out, and what remains.',
  },
  {
    title: 'Base app',
    line: 'Show add income, add expense, view summary, and save before explaining the new feature.',
  },
  {
    title: 'Group feature',
    line: 'Show the feature from the menu, then explain what the user types and what the app stores.',
  },
  {
    title: 'Proof',
    line: 'Run one simple demo value and point to the output or saved data as evidence.',
  },
];

const presentationSpeakingRoles = [
  { title: 'Opener', job: 'Explains the problem and what a budget tracker does.' },
  { title: 'Builder', job: 'Explains how the base app was rebuilt from snippets.' },
  { title: 'Feature lead', job: 'Explains the group feature and where its code lives.' },
  { title: 'Tester', job: 'Runs the demo and explains the proof.' },
];

function PresentationPrepPage(props: {
  progress: ProgressRecord;
  questState: QuestState;
  selectedPack: ReturnType<typeof getGroupFeaturePack>;
  onCompletePresentation: () => void;
  onExportReceipt: () => void;
  onRetakeLevel: (level: QuestLevel) => void;
}) {
  const firstFeature = props.selectedPack.features[0] ?? props.selectedPack.title;
  const completedSteps = new Set(props.progress.completedSteps);
  const presentationDone = completedSteps.has('presentation-pack');

  return (
    <section className="presentation-room">
      <section className="presentation-brief">
        <div>
          <p className="eyebrow">Presentation rehearsal room</p>
          <h2>Turn the whole quest into a clean story</h2>
          <p>
            Do not present random code. Present the journey: problem, base tracker, group feature, proof, and what each
            member learned.
          </p>
        </div>
        <div className="presentation-meter">
          <strong>{props.progress.completedSteps.length}/7</strong>
          <span>levels saved</span>
        </div>
      </section>

      <section className="presentation-section">
        <div className="section-heading compact">
          <p className="eyebrow">Roadmap recap</p>
          <h2>What we learned, and how to say it</h2>
        </div>
        <div className="presentation-recap-grid">
          {presentationRecapItems.map((item) => {
            const level = levelById(item.levelId);
            const done = completedSteps.has(item.levelId);
            return (
              <article className={`presentation-recap-card ${done ? 'done' : ''}`} key={item.levelId}>
                <div>
                  <span>{level.level}</span>
                  <strong>{level.title}</strong>
                </div>
                <p>{item.learned}</p>
                <em>{item.say}</em>
                {done && (
                  <button
                    aria-label={`Retake ${level.title}`}
                    className="retake-mini-button"
                    title={`Retake ${level.title}`}
                    type="button"
                    onClick={() => props.onRetakeLevel(level)}
                  >
                    <RotateCcw aria-hidden="true" />
                    <span>Retake</span>
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="presentation-section presentation-script-section">
        <div className="section-heading compact">
          <p className="eyebrow">Demo script</p>
          <h2>Four things to say in order</h2>
        </div>
        <div className="presentation-script-grid">
          {presentationScriptCards.map((card, index) => (
            <article className="presentation-script-card" key={card.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{card.title}</strong>
              <p>{card.line}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="presentation-section presentation-proof">
        <div>
          <p className="eyebrow">Group feature proof</p>
          <h2>{props.selectedPack.title}</h2>
          <p>
            Start your feature demo with <strong>{firstFeature}</strong>. Use simple values so nobody gets stuck while
            everyone is watching.
          </p>
        </div>
        <ol className="setup-action-list presentation-proof-list">
          <li>
            <span>Run <code>python main.py</code> from VS Code.</span>
          </li>
          <li>
            <span>Choose the menu option for {props.selectedPack.title}.</span>
          </li>
          <li>
            <span>Enter one small test value and show the result.</span>
          </li>
          <li>
            <span>Explain which function handled the feature and where the data was saved.</span>
          </li>
        </ol>
      </section>

      <section className="presentation-section">
        <div className="section-heading compact">
          <p className="eyebrow">Each member says</p>
          <h2>Give everybody a small speaking job</h2>
        </div>
        <div className="presentation-role-grid">
          {presentationSpeakingRoles.map((role) => (
            <article className="presentation-role-card" key={role.title}>
              <Users aria-hidden="true" />
              <strong>{role.title}</strong>
              <p>{role.job}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="presentation-section presentation-export">
        <div>
          <p className="eyebrow">Final proof</p>
          <h2>Export the receipt after rehearsal</h2>
          <p>
            The receipt records your group, progress code, completed levels, and badges:
            {' '}
            <strong>{props.questState.badges.length || 0} badge{props.questState.badges.length === 1 ? '' : 's'}</strong>.
          </p>
        </div>
        <div className="presentation-final-actions">
          <button className="brutal-button secondary" type="button" onClick={props.onExportReceipt}>
            Export completion receipt
          </button>
          <button
            className="brutal-button primary"
            disabled={presentationDone}
            type="button"
            onClick={props.onCompletePresentation}
          >
            {presentationDone ? 'Presentation pack complete' : 'Mark presentation pack complete'}
          </button>
        </div>
      </section>
    </section>
  );
}

function SetupStepper(props: {
  progress: ProgressRecord;
  onCompleteStep: (stepId: SetupStepId) => void;
  onSelectStep: (stepIndex: number) => void;
}) {
  const completedSteps = new Set(props.progress.setupCompletedSteps ?? []);
  const activeIndex = Math.max(0, Math.min(setupSteps.length - 1, props.progress.setupStepIndex ?? 0));
  const activeStep = setupSteps[activeIndex];
  const activeStepDone = completedSteps.has(activeStep.id);
  const isSetupFinished = SETUP_STEP_IDS.every((id) => completedSteps.has(id));
  const completedCount = setupSteps.filter((step) => completedSteps.has(step.id)).length;
  const nextIndex = Math.min(activeIndex + 1, setupSteps.length - 1);
  const setupActionHref =
    activeStep.id === 'open-starter-kit'
      ? `/downloads/${getGroupStarterKitFilename(props.progress.groupId)}`
      : activeStep.actionHref;
  const isExternalAction = setupActionHref?.startsWith('http');

  return (
    <section className="setup-stepper quest-panel">
      <div className="setup-stepper-top">
        <div>
          <p className="eyebrow">Setup quest</p>
          <h2>Do one tiny action at a time</h2>
          <p className="muted-copy">Each step gives one job, one checkpoint, and a video for students who get stuck.</p>
        </div>
        <div className="setup-score">
          <strong>{completedCount}/{setupSteps.length}</strong>
          <span>done</span>
        </div>
      </div>

      <div className="setup-step-list" aria-label="Setup steps">
        {setupSteps.map((step, index) => {
          const done = completedSteps.has(step.id);
          const locked = index > completedCount;
          return (
            <button
              aria-label={`${index + 1}. ${done ? 'Done' : step.checkpoint}`}
              aria-current={index === activeIndex ? 'step' : undefined}
              className={`setup-step-chip ${index === activeIndex ? 'active' : ''} ${done ? 'done' : ''}`}
              disabled={locked}
              key={step.id}
              type="button"
              onClick={() => props.onSelectStep(index)}
            >
              <span>{index + 1}</span>
            </button>
          );
        })}
      </div>

      <article className={`setup-current-card ${activeStepDone ? 'done' : ''}`}>
        <div className="setup-current-copy">
          <ol className="setup-action-list">
            {activeStep.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="setup-actions">
            {setupActionHref && (
              <a
                className="mini-button setup-action"
                href={setupActionHref}
                target={isExternalAction ? '_blank' : undefined}
                rel={isExternalAction ? 'noreferrer' : undefined}
                download={!isExternalAction ? true : undefined}
              >
                {activeStep.actionLabel}
              </a>
            )}
            {isSetupFinished ? (
              <button className="mini-button primary" disabled type="button">
                Setup complete
              </button>
            ) : activeStepDone ? (
              <button className="mini-button primary" type="button" onClick={() => props.onSelectStep(nextIndex)}>
                Next step
              </button>
            ) : (
              <button className="mini-button primary" type="button" onClick={() => props.onCompleteStep(activeStep.id)}>
                I did this
              </button>
            )}
            <button
              className="mini-button ghost"
              disabled={activeIndex === 0}
              type="button"
              onClick={() => props.onSelectStep(activeIndex - 1)}
            >
              Back
            </button>
          </div>

          <details className="setup-stuck">
            <summary>I'm stuck</summary>
            <p>{activeStep.stuckTip}</p>
          </details>
        </div>

        <div className="setup-video-card">
          <iframe
            title={activeStep.videoTitle}
            src={activeStep.videoEmbed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </article>
    </section>
  );
}

function RebuildStepper(props: {
  progress: ProgressRecord;
  onCompleteStep: (stepId: RebuildStepId) => void;
  onSelectStep: (stepIndex: number) => void;
}) {
  const [rebuildPartIndex, setRebuildPartIndex] = useState(0);
  const completedSteps = new Set(props.progress.rebuildCompletedSteps ?? []);
  const activeIndex = Math.max(0, Math.min(rebuildSteps.length - 1, props.progress.rebuildStepIndex ?? 0));
  const activeStep = rebuildSteps[activeIndex];
  const activeStepDone = completedSteps.has(activeStep.id);
  const isRebuildFinished = REBUILD_STEP_IDS.every((id) => completedSteps.has(id));
  const completedCount = rebuildSteps.filter((step) => completedSteps.has(step.id)).length;
  const nextIndex = Math.min(activeIndex + 1, rebuildSteps.length - 1);
  const rebuildParts = activeStep.parts;
  const currentPart = rebuildParts[rebuildPartIndex] ?? 'task';
  const rebuildPartCount = rebuildParts.length;
  const currentRebuildPart = rebuildPartIndex + 1;

  useEffect(() => {
    setRebuildPartIndex(0);
  }, [activeStep.id]);

  function goToPreviousRebuildPart() {
    setRebuildPartIndex((current) => Math.max(0, current - 1));
  }

  function goToNextRebuildPart() {
    setRebuildPartIndex((current) => Math.min(rebuildPartCount - 1, current + 1));
  }

  return (
    <section className="rebuild-workbench quest-panel">
      <div className="setup-stepper-top">
        <div>
          <p className="eyebrow">Rebuild workbench</p>
          <h2>Build main.py one safe piece at a time</h2>
          <p className="muted-copy">
            Use the snippet order, proof checks, and error fixes here before opening the full reference solution.
          </p>
        </div>
        <div className="setup-score">
          <strong>{completedCount}/{rebuildSteps.length}</strong>
          <span>done</span>
        </div>
      </div>

      <div className="setup-step-list rebuild-step-list" aria-label="Rebuild app steps">
        {rebuildSteps.map((step, index) => {
          const done = completedSteps.has(step.id);
          const locked = index > completedCount;
          return (
            <button
              aria-label={`${index + 1}. ${step.checkpoint}`}
              aria-current={index === activeIndex ? 'step' : undefined}
              className={`setup-step-chip ${index === activeIndex ? 'active' : ''} ${done ? 'done' : ''}`}
              disabled={locked}
              key={step.id}
              type="button"
              onClick={() => props.onSelectStep(index)}
            >
              <span>{index + 1}</span>
            </button>
          );
        })}
      </div>

      <article className="rebuild-current-card">
        <div className="learn-part-meter" aria-label={`Rebuild part ${currentRebuildPart} of ${rebuildPartCount}`}>
          <span>Part {currentRebuildPart} of {rebuildPartCount}</span>
          <div className="learn-part-dots" aria-hidden="true">
            {Array.from({ length: rebuildPartCount }, (_, index) => (
              <span className={index <= rebuildPartIndex ? 'active' : ''} key={index} />
            ))}
          </div>
        </div>

        {currentPart === 'task' && (
          <section className="rebuild-switch-panel rebuild-task-panel" key={`rebuild-task-${activeStep.id}`}>
            <div className="rebuild-task-layout">
              <div className="rebuild-task-copy">
                <div className="learn-card-heading">
                  <p className="eyebrow">Current task</p>
                  <h3>{activeStep.title}</h3>
                </div>
                <p>{activeStep.goal}</p>

                <ol className="rebuild-action-list">
                  {activeStep.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>

                <div className="rebuild-coach-note">
                  <strong>Why this matters</strong>
                  <p>{activeStep.coachNote}</p>
                </div>
              </div>

              <aside className="rebuild-video-card">
                <p className="eyebrow">Watch if stuck</p>
                <iframe
                  title={activeStep.videoTitle}
                  src={activeStep.videoEmbed}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </aside>
            </div>
          </section>
        )}

        {currentPart === 'map' && (
          <section className="rebuild-switch-panel rebuild-map-panel" key={`rebuild-map-${activeStep.id}`}>
            <div className="learn-card-heading">
              <p className="eyebrow">Jigsaw map</p>
              <h3>Paste in this order</h3>
            </div>
            <ol className="rebuild-snippet-map">
              {rebuildSnippetPlan.map(([file, purpose], index) => (
                <li className={activeStep.snippetFiles.includes(file) ? 'current' : ''} key={file}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{file}</strong>
                    <p>{purpose}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {currentPart === 'check' && (
          <section className="rebuild-switch-panel rebuild-task-panel" key={`rebuild-check-${activeStep.id}`}>
            <div className="learn-card-heading">
              <p className="eyebrow">Run check</p>
              <h3>Test before moving on</h3>
            </div>
            <div className="rebuild-run-check">
              <strong>{activeStep.runCheck}</strong>
              <p>{activeStep.proof}</p>
            </div>
            <details className="setup-stuck" open>
              <summary>What this proves</summary>
              <p>{activeStep.stuckTip}</p>
            </details>
          </section>
        )}

        {currentPart === 'errors' && (
          <section className="rebuild-switch-panel rebuild-error-panel" key={`rebuild-error-${activeStep.id}`}>
            <div className="section-heading">
              <p className="eyebrow">Error rescue</p>
              <h2>When the terminal complains, read the first line calmly</h2>
            </div>
            <div className="rebuild-error-grid">
              {rebuildErrorFixes.map(([error, fix]) => (
                <article key={error}>
                  <strong>{error}</strong>
                  <p>{fix}</p>
                </article>
              ))}
            </div>
            <div className="rebuild-mistake-box">
              <strong>For this step, check these first</strong>
              <ul>
                {activeStep.commonMistakes.map((mistake) => (
                  <li key={mistake}>{mistake}</li>
                ))}
              </ul>
            </div>
            <details className="setup-stuck">
              <summary>I'm stuck</summary>
              <p>{activeStep.stuckTip}</p>
            </details>
          </section>
        )}

        <div className="setup-actions rebuild-switch-actions">
          <button
            className="mini-button ghost"
            disabled={rebuildPartIndex === 0}
            type="button"
            onClick={goToPreviousRebuildPart}
          >
            Back
          </button>
          {rebuildPartIndex < rebuildPartCount - 1 ? (
            <button className="mini-button primary" type="button" onClick={goToNextRebuildPart}>
              Continue
            </button>
          ) : isRebuildFinished ? (
            <button className="mini-button primary" disabled type="button">
              Rebuild complete
            </button>
          ) : activeStepDone ? (
            <button className="mini-button primary" type="button" onClick={() => props.onSelectStep(nextIndex)}>
              Next task
            </button>
          ) : (
            <button className="mini-button primary" type="button" onClick={() => props.onCompleteStep(activeStep.id)}>
              I did this
            </button>
          )}
          <button
            className="mini-button ghost"
            disabled={activeIndex === 0}
            type="button"
            onClick={() => props.onSelectStep(activeIndex - 1)}
          >
            Previous task
          </button>
        </div>
      </article>
    </section>
  );
}

const OUTPUT_PLACEHOLDER = 'Output will appear here.';
const BRYTHON_VERSION = '3.13.2';
const BRYTHON_CORE_URL = `https://cdnjs.cloudflare.com/ajax/libs/brython/${BRYTHON_VERSION}/brython.min.js`;
const BRYTHON_STDLIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/brython/${BRYTHON_VERSION}/brython_stdlib.min.js`;
const INLINE_BLANK_TOKEN = '__BUDGET_QUEST_BLANK__';
let brythonReadyPromise: Promise<BrythonRuntime> | null = null;

type BrythonRuntime = {
  runPythonSource: (source: string, attributes?: { id?: string; debug?: number }) => unknown;
  whenReady?: Promise<void>;
};

type BrythonWindow = Window &
  typeof globalThis & {
    __BRYTHON__?: BrythonRuntime;
    brython?: (options?: { debug?: number }) => void;
    [key: string]: unknown;
  };

type TerminalRunEvent = {
  inputIndex?: number;
  text: string;
  type: 'stdout' | 'stderr' | 'prompt';
};

type PythonExecutionStatus = 'idle' | 'loading' | 'waiting' | 'running' | 'complete' | 'error';

function formatPythonOutput(stdout: string, stderr: string, fallback: string) {
  const outputParts = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean);
  return outputParts.length > 0 ? outputParts.join('\n') : fallback;
}

function splitTerminalLines(text: string) {
  const normalizedText = text.replace(/\r\n/g, '\n');
  const withoutTrailingBreak = normalizedText.endsWith('\n') ? normalizedText.slice(0, -1) : normalizedText;
  return withoutTrailingBreak.split('\n').filter((line) => line.trim().length > 0);
}

function terminalOutputKind(line: string, status: PythonExecutionStatus) {
  if (
    status === 'error' ||
    /\b(traceback|syntaxerror|nameerror|typeerror|valueerror|indentationerror|exception|error)\b/i.test(line)
  ) {
    return 'error';
  }

  if (line === OUTPUT_PLACEHOLDER) return 'muted';
  if (status === 'loading' || status === 'running' || status === 'waiting') return 'status';
  return 'output';
}

const PYTHON_SYNTAX_PATTERN =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(#.*)|\b(def|class|if|elif|else|for|while|return|import|from|as|in|True|False|None|and|or|not|pass)\b|\b(print|input|float|int|str|len|range|list|dict|sum|min|max|append)\b|\b\d+(?:\.\d+)?\b|([()[\]{}.,:+\-*/%=<>])/g;

function getPythonTokenClass(token: string) {
  if (/^["']/.test(token)) return 'string';
  if (token.startsWith('#')) return 'comment';
  if (/^\d/.test(token)) return 'number';
  if (/^(print|input|float|int|str|len|range|list|dict|sum|min|max|append)$/.test(token)) return 'builtin';
  if (/^(def|class|if|elif|else|for|while|return|import|from|as|in|True|False|None|and|or|not|pass)$/.test(token)) {
    return 'keyword';
  }
  return 'operator';
}

function highlightPythonSource(source: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  PYTHON_SYNTAX_PATTERN.lastIndex = 0;

  for (const match of source.matchAll(PYTHON_SYNTAX_PATTERN)) {
    const token = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      nodes.push(source.slice(lastIndex, matchIndex));
    }

    nodes.push(
      <span className={`inline-code-token ${getPythonTokenClass(token)}`} key={`${keyPrefix}-${matchIndex}-${token}`}>
        {token}
      </span>,
    );
    lastIndex = matchIndex + token.length;
  }

  if (lastIndex < source.length) {
    nodes.push(source.slice(lastIndex));
  }

  return nodes;
}

function primeScriptPreload(id: string, href: string) {
  if (document.getElementById(id)) return;

  const preloadLink = document.createElement('link');
  preloadLink.id = id;
  preloadLink.rel = 'preload';
  preloadLink.as = 'script';
  preloadLink.href = href;
  document.head.appendChild(preloadLink);
}

function primeBrythonAssetHints() {
  if (typeof document === 'undefined') return;

  primeScriptPreload('budget-quest-brython-core-preload', BRYTHON_CORE_URL);
  primeScriptPreload('budget-quest-brython-stdlib-preload', BRYTHON_STDLIB_URL);
}

function loadScriptOnce(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(id) as HTMLScriptElement | null;
    if (existingScript?.dataset.loaded === 'true') {
      resolve();
      return;
    }

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadBrythonRuntime() {
  if (brythonReadyPromise) return brythonReadyPromise;

  primeBrythonAssetHints();

  const readyPromise = (async () => {
    const brythonWindow = window as BrythonWindow;
    if (!brythonWindow.__BRYTHON__) {
      await loadScriptOnce('budget-quest-brython-core', BRYTHON_CORE_URL);
      await loadScriptOnce('budget-quest-brython-stdlib', BRYTHON_STDLIB_URL);
      brythonWindow.brython?.({ debug: 0 });
    }

    const runtime = brythonWindow.__BRYTHON__;
    if (!runtime) throw new Error('Brython did not start. Check your internet and refresh.');
    await runtime.whenReady;
    return runtime;
  })();

  brythonReadyPromise = readyPromise;
  void readyPromise.catch(() => {
    if (brythonReadyPromise === readyPromise) {
      brythonReadyPromise = null;
    }
  });

  return brythonReadyPromise;
}

function scheduleBrythonWarmup() {
  primeBrythonAssetHints();
  if (import.meta.env.MODE === 'test' || typeof window === 'undefined') return () => {};

  let cancelled = false;
  const browserWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  const startWarmup = () => {
    if (cancelled) return;
    void loadBrythonRuntime().catch(() => {
      // The Run button will surface a clear error and retry if the background warm-up failed.
    });
  };

  if (typeof browserWindow.requestIdleCallback === 'function') {
    const idleId = browserWindow.requestIdleCallback(startWarmup, { timeout: 1200 });
    return () => {
      cancelled = true;
      browserWindow.cancelIdleCallback?.(idleId);
    };
  }

  const timeoutId = window.setTimeout(startWarmup, 350);
  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
  };
}

function hasObviousForeverLoop(code: string) {
  return /\bwhile\s+(True|1)\s*:/i.test(code);
}

function extractInputPrompts(code: string) {
  const prompts: string[] = [];
  const inputPattern = /input\s*\(\s*(?:(["'])(.*?)\1)?\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = inputPattern.exec(code)) !== null) {
    prompts.push(match[2] || `Enter value ${prompts.length + 1}:`);
  }

  return prompts;
}

function splitInitialInputs(initialInput?: string) {
  return (initialInput ?? '').split(/\r?\n/).map((line) => line.trimEnd());
}

function usePythonExecution(code: string, initialInput: string | undefined, resetKey: string) {
  const requestIdRef = useRef(0);
  const [output, setOutput] = useState(OUTPUT_PLACEHOLDER);
  const [status, setStatus] = useState<PythonExecutionStatus>('idle');
  const [terminalEvents, setTerminalEvents] = useState<TerminalRunEvent[]>([]);
  const inputPrompts = useMemo(() => extractInputPrompts(code), [code]);
  const inputPromptKey = inputPrompts.join('\u001f');
  const [terminalInputs, setTerminalInputs] = useState(() =>
    extractInputPrompts(code).map((_, index) => splitInitialInputs(initialInput)[index] ?? ''),
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setOutput(OUTPUT_PLACEHOLDER);
    setStatus('idle');
    setTerminalEvents([]);
  }, [resetKey]);

  useEffect(() => {
    const defaultInputs = splitInitialInputs(initialInput);
    setTerminalInputs((currentInputs) =>
      inputPrompts.map((_, index) => currentInputs[index] ?? defaultInputs[index] ?? ''),
    );
  }, [inputPromptKey, initialInput]);

  const isBusy = status === 'loading' || status === 'running';

  async function executeCode(id: number) {
    setStatus('loading');
    setOutput('Starting Brython...');

    if (hasObviousForeverLoop(code)) {
      setStatus('error');
      setOutput('This looks like a forever loop. Change the loop before running it here.');
      return;
    }

    if (import.meta.env.MODE === 'test') {
      const simulatedOutput =
        inputPrompts.length > 0
          ? terminalInputs.slice(0, inputPrompts.length).join('\n')
          : 'Ran successfully. No printed output yet. Try adding print(...).';
      const fallbackOutput = simulatedOutput.trim() || 'Ran successfully. No printed output yet. Try adding print(...).';
      const baseTerminalEvents = inputPrompts.length > 0 ? terminalEvents.filter((event) => event.type === 'prompt') : [];
      setStatus('complete');
      setTerminalEvents([...baseTerminalEvents, { text: fallbackOutput, type: 'stdout' }]);
      setOutput(fallbackOutput);
      return;
    }

    const contextKey = `__budgetQuestBrythonRun${id}`;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const nextTerminalEvents: TerminalRunEvent[] =
      inputPrompts.length > 0 ? terminalEvents.filter((event) => event.type === 'prompt') : [];
    const inputLines = terminalInputs.map((line) => line.trimEnd());
    let inputIndex = 0;
    const brythonWindow = window as BrythonWindow;

    brythonWindow[contextKey] = {
      write(streamName: 'stdout' | 'stderr', text: string) {
        if (streamName === 'stderr') {
          stderr.push(text);
          return;
        }
        stdout.push(text);
      },
      readInput(prompt = '') {
        const nextValue = inputLines[inputIndex] ?? '';
        const promptAlreadyShown = nextTerminalEvents.some((event) => event.type === 'prompt' && event.inputIndex === inputIndex);
        if (!promptAlreadyShown) {
          nextTerminalEvents.push({ inputIndex, text: String(prompt), type: 'prompt' });
        }
        inputIndex += 1;
        return nextValue;
      },
    };

    const wrappedCode = `from browser import window
import builtins
import sys

_ctx = getattr(window, "${contextKey}")

class _BudgetQuestWriter:
    def __init__(self, stream_name):
        self.stream_name = stream_name

    def write(self, text):
        if text:
            _ctx.write(self.stream_name, str(text))

    def flush(self):
        pass

def input(prompt=""):
    return _ctx.readInput(str(prompt))

builtins.input = input
sys.stdout = _BudgetQuestWriter("stdout")
sys.stderr = _BudgetQuestWriter("stderr")

${code}`;

    try {
      const runtime = await loadBrythonRuntime();
      if (requestIdRef.current !== id) return;
      setStatus('running');
      setOutput('Running your code...');
      runtime.runPythonSource(wrappedCode, { id: `budget_quest_runner_${id}`, debug: 0 });
      if (requestIdRef.current !== id) return;
      setStatus('complete');
      const stdoutText = stdout.join('').trimEnd();
      const stderrText = stderr.join('').trimEnd();
      if (stdoutText) nextTerminalEvents.push({ text: stdoutText, type: 'stdout' });
      if (stderrText) nextTerminalEvents.push({ text: stderrText, type: 'stderr' });
      setTerminalEvents([...nextTerminalEvents]);
      setOutput(formatPythonOutput(stdout.join(''), stderr.join(''), 'Ran successfully. No printed output yet. Try adding print(...).'));
    } catch (error) {
      if (requestIdRef.current !== id) return;
      setStatus('error');
      const message = error instanceof Error ? error.message : String(error);
      const stdoutText = stdout.join('').trimEnd();
      const stderrText = stderr.join('').trimEnd();
      if (stdoutText) nextTerminalEvents.push({ text: stdoutText, type: 'stdout' });
      if (stderrText) {
        nextTerminalEvents.push({ text: stderrText, type: 'stderr' });
      } else {
        nextTerminalEvents.push({ text: message, type: 'stderr' });
      }
      setTerminalEvents([...nextTerminalEvents]);
      setOutput(formatPythonOutput(stdout.join(''), stderr.join(''), message));
    } finally {
      delete brythonWindow[contextKey];
    }
  }

  function runCode() {
    if (hasObviousForeverLoop(code)) {
      requestIdRef.current += 1;
      setStatus('error');
      setTerminalEvents([{ text: 'This looks like a forever loop. Change the loop before running it here.', type: 'stderr' }]);
      setOutput('This looks like a forever loop. Change the loop before running it here.');
      return;
    }

    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    setTerminalEvents([]);

    if (inputPrompts.length > 0) {
      setStatus('waiting');
      setOutput('Press Enter to continue.');
      setTerminalEvents([{ inputIndex: 0, text: inputPrompts[0], type: 'prompt' }]);
      return;
    }

    void executeCode(id);
  }

  function submitTerminalInput(inputIndex: number) {
    if (status !== 'waiting') return;

    if (inputIndex < inputPrompts.length - 1) {
      const nextInputIndex = inputIndex + 1;
      setTerminalEvents((currentEvents) => {
        const nextPromptExists = currentEvents.some((event) => event.type === 'prompt' && event.inputIndex === nextInputIndex);
        if (nextPromptExists) return currentEvents;
        return [...currentEvents, { inputIndex: nextInputIndex, text: inputPrompts[nextInputIndex], type: 'prompt' }];
      });
      return;
    }

    const id = requestIdRef.current;
    void executeCode(id);
  }

  function resetOutput() {
    requestIdRef.current += 1;
    setOutput(OUTPUT_PLACEHOLDER);
    setStatus('idle');
    setTerminalEvents([]);
  }

  return {
    inputPrompts,
    isBusy,
    output,
    resetOutput,
    runCode,
    setTerminalInputs,
    status,
    submitTerminalInput,
    terminalEvents,
    terminalInputs,
  };
}

function TerminalPromptLine(props: {
  inputIndex: number;
  onSubmitInput: (inputIndex: number) => void;
  prompt: string;
  setTerminalInputs: React.Dispatch<React.SetStateAction<string[]>>;
  terminalInputs: string[];
}) {
  const currentValue = props.terminalInputs[props.inputIndex] ?? '';
  const inputWidth = Math.max(7, Math.min(20, currentValue.length + 2));

  return (
    <label className="terminal-line prompt python-terminal-input-line">
      <span className="terminal-marker" aria-hidden="true">
        &gt;
      </span>
      <span className="terminal-line-text">{props.prompt}</span>
      <input
        aria-label={`Terminal input for ${props.prompt}`}
        autoCapitalize="none"
        autoComplete="off"
        className="terminal-inline-input inline-code-blank-input"
        spellCheck={false}
        style={{ width: `${inputWidth}ch` }}
        value={props.terminalInputs[props.inputIndex] ?? ''}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          props.onSubmitInput(props.inputIndex);
        }}
        onChange={(event) => {
          props.setTerminalInputs((currentInputs) => {
            const nextInputs = [...currentInputs];
            nextInputs[props.inputIndex] = event.target.value;
            return nextInputs;
          });
        }}
      />
    </label>
  );
}

function TerminalTextLine(props: {
  line: string;
  status: PythonExecutionStatus;
  type?: 'stdout' | 'stderr';
}) {
  const kind = props.type === 'stderr' ? 'error' : terminalOutputKind(props.line, props.status);

  return (
    <span className={`terminal-line ${kind}`}>
      <span className="terminal-marker" aria-hidden="true">
        &gt;
      </span>
      <span className="terminal-line-text">{props.line || ' '}</span>
    </span>
  );
}

function renderTerminalText(
  text: string,
  status: PythonExecutionStatus,
  type?: 'stdout' | 'stderr',
  keyPrefix = type ?? 'message',
) {
  return splitTerminalLines(text).map((line, index) => (
    <TerminalTextLine key={`${keyPrefix}-${index}-${line}`} line={line} status={status} type={type} />
  ));
}

function PythonTerminalPanel(props: {
  inputPrompts: string[];
  isBusy: boolean;
  output: string;
  runCode: () => void;
  resetOutput: () => void;
  setTerminalInputs: React.Dispatch<React.SetStateAction<string[]>>;
  status: PythonExecutionStatus;
  submitTerminalInput: (inputIndex: number) => void;
  terminalEvents: TerminalRunEvent[];
  terminalInputs: string[];
}) {
  const hasRunTranscript = props.terminalEvents.length > 0;
  const hasTextTranscript = props.terminalEvents.some((event) => event.type !== 'prompt');

  return (
    <div className="python-terminal" role="region" aria-label="Python terminal">
      <div className="python-terminal-top">
        <div className="python-terminal-actions">
          <button
            aria-label={props.isBusy ? 'Running Python' : 'Run Python'}
            className="terminal-run-pill"
            disabled={props.isBusy}
            title={props.isBusy ? 'Running Python' : 'Run Python'}
            type="button"
            onClick={props.runCode}
          >
            <Play aria-hidden="true" />
          </button>
          <button
            aria-label="Reset Python"
            className="terminal-reset-icon"
            title="Reset Python"
            type="button"
            onClick={props.resetOutput}
          >
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="python-output" aria-busy={props.isBusy} aria-live="polite">
        {hasRunTranscript &&
          props.terminalEvents.flatMap((event, eventIndex) => {
              if (event.type === 'prompt') {
                return [
                  <TerminalPromptLine
                    inputIndex={event.inputIndex ?? 0}
                    key={`prompt-${eventIndex}-${event.text}`}
                    onSubmitInput={props.submitTerminalInput}
                    prompt={event.text || `Enter value ${(event.inputIndex ?? 0) + 1}:`}
                    setTerminalInputs={props.setTerminalInputs}
                    terminalInputs={props.terminalInputs}
                  />,
                ];
              }

              return renderTerminalText(event.text, props.status, event.type, `${event.type}-${eventIndex}`);
            })}
        {(!hasRunTranscript || !hasTextTranscript) && renderTerminalText(props.output, props.status)}
      </div>
    </div>
  );
}

function PythonPracticeRunner(props: {
  initialCode: string;
  initialInput?: string;
}) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const [code, setCode] = useState(props.initialCode);
  const lineNumbers = useMemo(() => code.split('\n').map((_, index) => index + 1), [code]);
  const execution = usePythonExecution(code, props.initialInput, `${props.initialCode}\u001f${props.initialInput ?? ''}`);

  useEffect(() => {
    setCode(props.initialCode);
  }, [props.initialCode, props.initialInput]);

  function resetRunner() {
    setCode(props.initialCode);
    execution.resetOutput();
  }

  function placeEditorCaret(position: number) {
    window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.selectionStart = position;
      editor.selectionEnd = position;
      editor.focus();
    }, 0);
  }

  function replaceEditorSelection(textarea: HTMLTextAreaElement, insertion: string) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextCode = `${code.slice(0, start)}${insertion}${code.slice(end)}`;
    setCode(nextCode);
    placeEditorCaret(start + insertion.length);
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Tab') {
      event.preventDefault();
      replaceEditorSelection(event.currentTarget, '    ');
      return;
    }

    if (event.key !== 'Enter') return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const lineStart = code.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
    const currentLine = code.slice(lineStart, textarea.selectionStart);
    const baseIndent = currentLine.match(/^\s*/)?.[0] ?? '';
    const extraIndent = currentLine.trimEnd().endsWith(':') ? '    ' : '';
    replaceEditorSelection(textarea, `\n${baseIndent}${extraIndent}`);
  }

  function syncEditorScroll(event: UIEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = target.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
  }

  return (
    <section className={`python-runner ${execution.status === 'error' ? 'error' : ''}`} aria-label="Python practice runner">
      <div className="python-runner-lab">
        <div className="python-code-field">
          <div className="python-editor-shell">
            <div aria-label="Python editor line numbers" className="python-line-numbers" ref={lineNumbersRef} role="list">
              {lineNumbers.map((lineNumber) => (
                <span key={lineNumber} role="listitem">
                  {lineNumber}
                </span>
              ))}
            </div>
            <div className="python-editor-stage">
              <pre className="python-code-highlight" ref={highlightRef} aria-hidden="true">
                {highlightPythonSource(code, 'practice-code')}
              </pre>
              <textarea
                className="python-code-textarea"
                value={code}
                aria-label="Practice Python code"
                ref={editorRef}
                spellCheck={false}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={handleEditorKeyDown}
                onScroll={syncEditorScroll}
                wrap="off"
              />
            </div>
          </div>
        </div>

        <PythonTerminalPanel {...execution} resetOutput={resetRunner} />
      </div>
    </section>
  );
}

function normalizeChallengeAnswer(answer: string) {
  return answer.trim().replace(/\s+/g, ' ').toLowerCase();
}

function unquoteCodeText(value: string) {
  const trimmed = value.trim();
  const firstCharacter = trimmed[0];
  const lastCharacter = trimmed[trimmed.length - 1];
  if ((firstCharacter === '"' || firstCharacter === "'") && firstCharacter === lastCharacter) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function getChallengeFeedback(challenge: LearnCodeChallenge, answer: string, isCorrect: boolean) {
  if (isCorrect) return challenge.success;

  const trimmedAnswer = answer.trim();
  const trimmedExpected = challenge.answer.trim();
  const normalizedAnswer = normalizeChallengeAnswer(trimmedAnswer);
  const normalizedExpected = normalizeChallengeAnswer(trimmedExpected);
  const expectedWithoutQuotes = unquoteCodeText(trimmedExpected);

  if (!trimmedAnswer) {
    return `Type only the missing part into the blank. For this one, look for ${trimmedExpected}.`;
  }

  if (normalizedAnswer === normalizeChallengeAnswer(expectedWithoutQuotes) && expectedWithoutQuotes !== trimmedExpected) {
    return `You found the right word, but wrap it in quotes: ${trimmedExpected}.`;
  }

  if (normalizedAnswer.replace(/[()]/g, '') === normalizedExpected && /[()]/.test(trimmedAnswer)) {
    return `Only type the missing part, not the brackets. Try ${trimmedExpected}.`;
  }

  if (trimmedAnswer.includes('=') || trimmedAnswer.includes(':') || trimmedAnswer.includes('\n')) {
    return `Only type the small missing piece, not the whole line. The blank should be ${trimmedExpected}.`;
  }

  if (trimmedAnswer.toLowerCase() === trimmedExpected.toLowerCase() && trimmedAnswer !== trimmedExpected) {
    return `Python cares about capital letters here. Type it exactly as ${trimmedExpected}.`;
  }

  if (normalizedExpected.startsWith(normalizedAnswer) || normalizedAnswer.startsWith(normalizedExpected)) {
    return `You are close. Compare your answer with the exact missing piece: ${trimmedExpected}.`;
  }

  return challenge.hint;
}

function InlineBlankCodeLine(props: {
  answer: string;
  line: string;
  lineIndex: number;
  onAnswerChange: (answer: string) => void;
}) {
  const parts = props.line.split(INLINE_BLANK_TOKEN);
  const blankWidth = Math.max(5, Math.min(18, (props.answer || '____').length + 2));

  return (
    <span className="inline-code-line">
      {parts.map((part, partIndex) => (
        <span className="inline-code-fragment" key={`${props.lineIndex}-${partIndex}`}>
          {highlightPythonSource(part, `challenge-${props.lineIndex}-${partIndex}`)}
          {partIndex < parts.length - 1 && (
            <input
              aria-label="Missing code"
              autoCapitalize="none"
              autoComplete="off"
              className="inline-code-blank-input"
              placeholder="____"
              spellCheck={false}
              style={{ width: `${blankWidth}ch` }}
              value={props.answer}
              onChange={(event) => props.onAnswerChange(event.target.value)}
            />
          )}
        </span>
      ))}
    </span>
  );
}

function InlineBlankPythonRunner(props: {
  answer: string;
  challenge: LearnCodeChallenge;
  onAnswerChange: (answer: string) => void;
  onRunAttempt?: () => void;
}) {
  const templateCode = useMemo(() => props.challenge.buildCode(INLINE_BLANK_TOKEN), [props.challenge]);
  const runnableCode = useMemo(() => props.challenge.buildCode(props.answer.trim()), [props.answer, props.challenge]);
  const lines = useMemo(() => templateCode.split('\n'), [templateCode]);
  const execution = usePythonExecution(
    runnableCode,
    props.challenge.stdin,
    `${props.challenge.prompt}\u001f${props.challenge.stdin ?? ''}`,
  );
  const runAndCheckBlank = () => {
    props.onRunAttempt?.();
    execution.runCode();
  };

  return (
    <section className={`python-runner inline-blank-runner ${execution.status === 'error' ? 'error' : ''}`} aria-label="Python practice runner">
      <div className="python-runner-lab inline-blank-lab">
        <div className="inline-code-editor-shell" aria-label="Fill the blank code editor">
          <div aria-label="Python editor line numbers" className="python-line-numbers inline-code-line-numbers pinned-gutter" role="list">
            {lines.map((_, index) => (
              <span key={index + 1} role="listitem">
                {index + 1}
              </span>
            ))}
          </div>
          <div className="inline-code-lines">
            {lines.map((line, index) => (
              <InlineBlankCodeLine
                answer={props.answer}
                key={`${line}-${index}`}
                line={line}
                lineIndex={index}
                onAnswerChange={props.onAnswerChange}
              />
            ))}
          </div>
        </div>

        <PythonTerminalPanel {...execution} runCode={runAndCheckBlank} />
      </div>
    </section>
  );
}

function CodeFillChallenge({
  challenge,
  onSolvedChange,
}: {
  challenge: LearnCodeChallenge;
  onSolvedChange: (solved: boolean) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const normalizedAnswer = normalizeChallengeAnswer(answer);
  const isCorrect = normalizedAnswer === normalizeChallengeAnswer(challenge.answer);

  useEffect(() => {
    setAnswer('');
    setChecked(false);
    onSolvedChange(false);
  }, [challenge]);

  function checkBlank() {
    const correct = normalizeChallengeAnswer(answer) === normalizeChallengeAnswer(challenge.answer);
    setChecked(true);
    onSolvedChange(correct);
  }

  const feedback = checked ? getChallengeFeedback(challenge, answer, isCorrect) : '';

  return (
    <section
      className={`code-activity-section code-challenge inline-code-challenge ${checked ? (isCorrect ? 'correct' : 'wrong') : ''}`}
      aria-label="Complete this code exercise"
    >
      <div className="inline-code-challenge-header">
        <div>
          <h4>{challenge.prompt}</h4>
        </div>
        <div className="setup-actions code-challenge-actions">
          <button className="mini-button secondary" disabled={answer.trim().length === 0} type="button" onClick={checkBlank}>
            Check blank
          </button>
        </div>
        {checked && (
          <p className={`code-challenge-feedback ${isCorrect ? 'correct' : 'wrong'}`} aria-live="polite">
            {feedback}
          </p>
        )}
      </div>

      <InlineBlankPythonRunner
        answer={answer}
        challenge={challenge}
        onAnswerChange={(nextAnswer) => {
          setAnswer(nextAnswer);
          setChecked(false);
          onSolvedChange(false);
        }}
        onRunAttempt={checkBlank}
      />
    </section>
  );
}

function LearnBasicsStepper(props: {
  progress: ProgressRecord;
  onCompleteStep: (stepId: LearnStepId) => void;
  onSelectStep: (stepIndex: number) => void;
}) {
  const lessonCardRef = useRef<HTMLElement | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedAnswerId, setSelectedAnswerId] = useState('');
  const [checkedAnswerId, setCheckedAnswerId] = useState('');
  const [codeChallengeSolved, setCodeChallengeSolved] = useState(false);
  const [lessonPartIndex, setLessonPartIndex] = useState(0);
  const completedSteps = new Set(props.progress.learnCompletedSteps ?? []);
  const activeIndex = Math.max(0, Math.min(learnSteps.length - 1, props.progress.learnStepIndex ?? 0));
  const activeStep = learnSteps[activeIndex];
  const activeStepDone = completedSteps.has(activeStep.id);
  const isLearnFinished = LEARN_STEP_IDS.every((id) => completedSteps.has(id));
  const completedCount = learnSteps.filter((step) => completedSteps.has(step.id)).length;
  const nextIndex = Math.min(activeIndex + 1, learnSteps.length - 1);
  const selectedAnswer = activeStep.quiz.options.find((option) => option.id === selectedAnswerId);
  const checkedAnswer = activeStep.quiz.options.find((option) => option.id === checkedAnswerId);
  const answerIsCorrect = Boolean(checkedAnswer?.correct);
  const answerWasChecked = checkedAnswerId.length > 0;
  const canCompleteLesson = activeStepDone || answerIsCorrect;
  const lessonPartCount = 7;
  const currentLessonPart = lessonPartIndex + 1;
  const isQuizPart = lessonPartIndex === lessonPartCount - 1;
  const isCodeChallengePart = lessonPartIndex === 4;
  const canContinueLessonPart = !isCodeChallengePart || codeChallengeSolved;

  useEffect(() => {
    setSelectedAnswerId('');
    setCheckedAnswerId('');
    setCodeChallengeSolved(false);
    setLessonPartIndex(0);
  }, [activeStep.id]);

  useEffect(() => {
    const lessonCard = lessonCardRef.current;
    if (lessonPartIndex === 0 || typeof lessonCard?.scrollIntoView !== 'function') return;
    lessonCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [lessonPartIndex]);

  useEffect(() => scheduleBrythonWarmup(), []);

  function goToPreviousLessonPart() {
    setLessonPartIndex((current) => Math.max(0, current - 1));
  }

  function goToNextLessonPart() {
    setLessonPartIndex((current) => Math.min(lessonPartCount - 1, current + 1));
  }

  return (
    <section className="setup-stepper learn-stepper quest-panel">
      <div className="setup-stepper-top">
        <div>
          <p className="eyebrow">Python from zero</p>
          <h2>Learn the project one small idea at a time</h2>
          <p className="muted-copy">
            No coding background needed. Each lesson explains one tiny Python idea, shows why it matters, then
            connects it back to the budget tracker.
          </p>
        </div>
        <div className="setup-score">
          <strong>{completedCount}/{learnSteps.length}</strong>
          <span>done</span>
        </div>
      </div>

      <div className="setup-step-list" aria-label="Learn basics steps">
        {learnSteps.map((step, index) => {
          const done = completedSteps.has(step.id);
          const locked = index > completedCount;
          return (
            <button
              aria-label={`${index + 1}. ${step.checkpoint}`}
              aria-current={index === activeIndex ? 'step' : undefined}
              className={`setup-step-chip ${index === activeIndex ? 'active' : ''} ${done ? 'done' : ''}`}
              disabled={locked}
              key={step.id}
              type="button"
              onClick={() => props.onSelectStep(index)}
            >
              <span>{index + 1}</span>
            </button>
          );
        })}
      </div>

      <article ref={lessonCardRef} className={`setup-current-card learn-course-card ${activeStepDone ? 'done' : ''}`}>
        <div className="learn-part-meter" aria-label={`Lesson part ${currentLessonPart} of ${lessonPartCount}`}>
          <span>Part {currentLessonPart} of {lessonPartCount}</span>
          <div className="learn-part-dots" aria-hidden="true">
            {Array.from({ length: lessonPartCount }, (_, index) => (
              <span className={index <= lessonPartIndex ? 'active' : ''} key={index} />
            ))}
          </div>
        </div>

        {lessonPartIndex === 0 && (
          <section className="learn-switch-panel learn-idea-page" key={`idea-${activeStep.id}`}>
            <div className="learn-card-heading">
              <p className="eyebrow">Today's idea</p>
              <h3>{activeStep.snippetName}</h3>
            </div>
            <p>{activeStep.studentHook}</p>
            <div className="learn-student-prompt">
              <Lightbulb aria-hidden="true" />
              <p>
                Read this slowly first. You are only trying to understand the idea before seeing the code.
              </p>
            </div>
          </section>
        )}

        {lessonPartIndex === 1 && (
          <section className="learn-switch-panel learn-code-page" key={`code-${activeStep.id}`}>
            <div className="learn-idea-visual" aria-label={activeStep.visual.title}>
              <strong>{activeStep.visual.title}</strong>
              <div>
                {activeStep.visual.nodes.map((node) => (
                  <span key={node}>{node}</span>
                ))}
              </div>
              <p>{activeStep.visual.note}</p>
            </div>
            <pre className="learn-code-block">
              <code>{activeStep.snippet}</code>
            </pre>
            <div className="learn-teacher-note">
              <Lightbulb aria-hidden="true" />
              <p>{activeStep.explain}</p>
            </div>
          </section>
        )}

        {lessonPartIndex === 2 && (
          <section className="learn-switch-panel learn-runner-page" aria-label="Run this code exercise" key={`runner-${activeStep.id}`}>
            <div className="code-activity-copy">
              <p className="eyebrow">Mini code lab</p>
              <h4>Run the tiny version</h4>
              <p>Try the snippet here first. When the output makes sense, the starter kit will feel less strange.</p>
            </div>
            <PythonPracticeRunner
              initialCode={runnableLessonExamples[activeStep.id].code}
              initialInput={runnableLessonExamples[activeStep.id].stdin}
            />
          </section>
        )}

        {lessonPartIndex === 3 && (
          <section className="learn-switch-panel learn-practice-page" key={`practice-${activeStep.id}`}>
            <div className="learn-card-heading">
              <p className="eyebrow">Lesson {activeIndex + 1}</p>
              <h3>{activeStep.title}</h3>
            </div>

            <div className="learn-decode-grid" aria-label={`${activeStep.title} code breakdown`}>
              {activeStep.decode.map((item) => (
                <article className="learn-decode-card" key={item.label}>
                  <code>{item.label}</code>
                  <p>{item.meaning}</p>
                </article>
              ))}
            </div>

            <div className="learn-mini-mission">
              <div>
                <p className="eyebrow">Naija student mode</p>
                <h4>{activeStep.mission.title}</h4>
                <p>{activeStep.mission.body}</p>
              </div>
              <pre>
                <code>{activeStep.mission.example}</code>
              </pre>
            </div>
          </section>
        )}

        {lessonPartIndex === 4 && (
          <section className="learn-switch-panel learn-code-challenge-page" key={`challenge-${activeStep.id}`}>
            <CodeFillChallenge challenge={learnCodeChallenges[activeStep.id]} onSolvedChange={setCodeChallengeSolved} />
          </section>
        )}

        {lessonPartIndex === 5 && (
          <section className="learn-switch-panel learn-bridge-page" key={`bridge-${activeStep.id}`}>
            <details className="learn-predict" open>
              <summary>
                <span>Try it in your head</span>
                <strong>{activeStep.predict.prompt}</strong>
              </summary>
              <div>
                <p className="eyebrow">Expected answer</p>
                <strong>{activeStep.predict.output}</strong>
                <p>{activeStep.predict.note}</p>
              </div>
            </details>

            <article className="learn-project-bridge">
              <p className="eyebrow">{activeStep.projectBridge.title}</p>
              <h4>{activeStep.projectBridge.body}</h4>
              <p>{activeStep.projectBridge.fileHint}</p>
            </article>
          </section>
        )}

        {isQuizPart && (
          <section className="learn-switch-panel learn-quiz-page" key={`quiz-${activeStep.id}`}>
            <fieldset className="learn-quiz">
              <legend>{activeStep.quiz.prompt}</legend>
              {activeStep.quiz.options.map((option) => (
                <label
                  className={`learn-quiz-option ${
                    answerWasChecked && option.id === checkedAnswerId
                      ? option.correct
                        ? 'correct'
                        : 'wrong'
                      : ''
                  }`}
                  key={option.id}
                >
                  <input
                    checked={selectedAnswerId === option.id}
                    name={`quiz-${activeStep.id}`}
                    type="radio"
                    value={option.id}
                    onChange={() => {
                      setSelectedAnswerId(option.id);
                      setCheckedAnswerId('');
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>

            {answerWasChecked && (
              <p className={`learn-feedback ${answerIsCorrect ? 'correct' : 'wrong'}`}>
                {answerIsCorrect ? activeStep.quiz.correctMessage : activeStep.quiz.wrongMessage}
              </p>
            )}

            <div className="setup-actions learn-quiz-actions">
              <button className="mini-button ghost" type="button" onClick={goToPreviousLessonPart}>
                Review previous part
              </button>
              <button className="mini-button setup-action" type="button" onClick={() => setSummaryOpen(true)}>
                Summary
              </button>
              <button
                className="mini-button secondary"
                disabled={!selectedAnswer || activeStepDone}
                type="button"
                onClick={() => setCheckedAnswerId(selectedAnswerId)}
              >
                Check answer
              </button>
              {isLearnFinished ? (
                <button className="mini-button primary" disabled type="button">
                  Learning complete
                </button>
              ) : activeStepDone ? (
                <button className="mini-button primary" type="button" onClick={() => props.onSelectStep(nextIndex)}>
                  Next lesson
                </button>
              ) : (
                <button
                  className="mini-button primary"
                  disabled={!canCompleteLesson}
                  type="button"
                  onClick={() => props.onCompleteStep(activeStep.id)}
                >
                  I understand this
                </button>
              )}
              <button
                className="mini-button ghost"
                disabled={activeIndex === 0}
                type="button"
                onClick={() => props.onSelectStep(activeIndex - 1)}
              >
                Previous lesson
              </button>
            </div>

            <details className="setup-stuck">
              <summary>I'm stuck</summary>
              <p>{activeStep.stuckTip}</p>
            </details>

            <details className="learn-video-support">
              <summary>Watch backup video</summary>
              <div className="setup-video-card">
                <iframe
                  title={activeStep.videoTitle}
                  src={activeStep.videoEmbed}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </details>
          </section>
        )}

        {!isQuizPart && (
          <div className="setup-actions learn-switch-actions">
            <button
              className="mini-button ghost"
              disabled={lessonPartIndex === 0}
              type="button"
              onClick={goToPreviousLessonPart}
            >
              Back
            </button>
            <button className="mini-button primary" disabled={!canContinueLessonPart} type="button" onClick={goToNextLessonPart}>
              Continue
            </button>
          </div>
        )}
      </article>

      {summaryOpen && <PythonSummaryDialog onClose={() => setSummaryOpen(false)} />}
    </section>
  );
}

function UnderstandAppStepper(props: {
  progress: ProgressRecord;
  onCompleteStep: (stepId: UnderstandStepId) => void;
  onSelectStep: (stepIndex: number) => void;
}) {
  const lessonCardRef = useRef<HTMLElement | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState('');
  const [checkedAnswerId, setCheckedAnswerId] = useState('');
  const [codeChallengeSolved, setCodeChallengeSolved] = useState(false);
  const [understandPartIndex, setUnderstandPartIndex] = useState(0);
  const completedSteps = new Set(props.progress.understandCompletedSteps ?? []);
  const activeIndex = Math.max(0, Math.min(understandSteps.length - 1, props.progress.understandStepIndex ?? 0));
  const activeStep = understandSteps[activeIndex];
  const activeStepDone = completedSteps.has(activeStep.id);
  const isUnderstandFinished = UNDERSTAND_STEP_IDS.every((id) => completedSteps.has(id));
  const completedCount = understandSteps.filter((step) => completedSteps.has(step.id)).length;
  const nextIndex = Math.min(activeIndex + 1, understandSteps.length - 1);
  const selectedAnswer = activeStep.quiz.options.find((option) => option.id === selectedAnswerId);
  const checkedAnswer = activeStep.quiz.options.find((option) => option.id === checkedAnswerId);
  const answerIsCorrect = Boolean(checkedAnswer?.correct);
  const answerWasChecked = checkedAnswerId.length > 0;
  const understandPartCount = 5;
  const currentUnderstandPart = understandPartIndex + 1;
  const isQuizPart = understandPartIndex === understandPartCount - 1;
  const isCodeChallengePart = understandPartIndex === 3;
  const canContinueUnderstandPart = !isCodeChallengePart || codeChallengeSolved;
  const canCompleteTopic = activeStepDone || answerIsCorrect;

  useEffect(() => {
    setSelectedAnswerId('');
    setCheckedAnswerId('');
    setCodeChallengeSolved(false);
    setUnderstandPartIndex(0);
  }, [activeStep.id]);

  useEffect(() => {
    const lessonCard = lessonCardRef.current;
    if (understandPartIndex === 0 || typeof lessonCard?.scrollIntoView !== 'function') return;
    lessonCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [understandPartIndex]);

  useEffect(() => scheduleBrythonWarmup(), []);

  function goToPreviousPart() {
    setUnderstandPartIndex((current) => Math.max(0, current - 1));
  }

  function goToNextPart() {
    setUnderstandPartIndex((current) => Math.min(understandPartCount - 1, current + 1));
  }

  return (
    <section className="setup-stepper learn-stepper understand-stepper quest-panel">
      <div className="setup-stepper-top">
        <div>
          <p className="eyebrow">Project x-ray</p>
          <h2>Trace the base app like a story</h2>
          <p className="muted-copy">
            Follow the real starter files slowly. Each topic explains one project job, lets students run a tiny
            version, then checks that they can say what happened.
          </p>
        </div>
        <div className="setup-score">
          <strong>{completedCount}/{understandSteps.length}</strong>
          <span>done</span>
        </div>
      </div>

      <div className="setup-step-list understand-step-list" aria-label="Understand app steps">
        {understandSteps.map((step, index) => {
          const done = completedSteps.has(step.id);
          const locked = index > completedCount;
          return (
            <button
              aria-label={`${index + 1}. ${step.checkpoint}`}
              aria-current={index === activeIndex ? 'step' : undefined}
              className={`setup-step-chip ${index === activeIndex ? 'active' : ''} ${done ? 'done' : ''}`}
              disabled={locked}
              key={step.id}
              type="button"
              onClick={() => props.onSelectStep(index)}
            >
              <span>{index + 1}</span>
            </button>
          );
        })}
      </div>

      <article ref={lessonCardRef} className={`setup-current-card learn-course-card understand-course-card ${activeStepDone ? 'done' : ''}`}>
        <div className="learn-part-meter" aria-label={`Understand part ${currentUnderstandPart} of ${understandPartCount}`}>
          <span>Part {currentUnderstandPart} of {understandPartCount}</span>
          <div className="learn-part-dots" aria-hidden="true">
            {Array.from({ length: understandPartCount }, (_, index) => (
              <span className={index <= understandPartIndex ? 'active' : ''} key={index} />
            ))}
          </div>
        </div>

        {understandPartIndex === 0 && (
          <section className="learn-switch-panel understand-story-page" key={`understand-story-${activeStep.id}`}>
            <div className="learn-card-heading">
              <p className="eyebrow">What this part does</p>
              <h3>{activeStep.title}</h3>
            </div>
            <p className="understand-file-pill">
              Starter file: <code>{activeStep.starterFile}</code>
            </p>
            <p className="understand-big-idea">{activeStep.bigIdea}</p>
            <div className="learn-idea-visual" aria-label={activeStep.visual.title}>
              <strong>{activeStep.visual.title}</strong>
              <div>
                {activeStep.visual.nodes.map((node) => (
                  <span key={node}>{node}</span>
                ))}
              </div>
              <p>{activeStep.visual.note}</p>
            </div>
            <div className="learn-student-prompt">
              <Lightbulb aria-hidden="true" />
              <p>{activeStep.plainEnglish}</p>
            </div>
            <div className="understand-explain-grid">
              <article className="understand-help-card">
                <strong>What to notice</strong>
                <ol>
                  {activeStep.walkthrough.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </article>
              <article className="understand-help-card warning">
                <strong>Where students get confused</strong>
                <p>{activeStep.confusionTip}</p>
              </article>
            </div>
          </section>
        )}

        {understandPartIndex === 1 && (
          <section className="learn-switch-panel understand-code-page" key={`understand-code-${activeStep.id}`}>
            <div className="learn-card-heading">
              <p className="eyebrow">Starter file</p>
              <h3>{activeStep.starterFile}</h3>
            </div>
            <div className="understand-real-file-note">
              <strong>In the real file</strong>
              <p>
                Read this block slowly before touching it. Your job is to know what each line contributes to the
                finished tracker, not to memorize it like a poem.
              </p>
            </div>
            <pre className="learn-code-block">
              <code>{activeStep.realCode}</code>
            </pre>
            <div className="learn-decode-grid understand-decode-grid" aria-label={`${activeStep.title} project code breakdown`}>
              {activeStep.decode.map((item) => (
                <article className="learn-decode-card" key={item.label}>
                  <code>{item.label}</code>
                  <p>{item.meaning}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {understandPartIndex === 2 && (
          <section className="learn-switch-panel learn-runner-page understand-runner-page" aria-label="Run this project snippet" key={`understand-runner-${activeStep.id}`}>
            <div className="code-activity-copy">
              <p className="eyebrow">Mini project lab</p>
              <h4>Run the idea in isolation</h4>
              <p>Practice the small version first. It is easier to understand the full starter file after this.</p>
            </div>
            <PythonPracticeRunner initialCode={activeStep.practice.code} initialInput={activeStep.practice.stdin} />
            <details className="learn-video-support">
              <summary>Watch backup video</summary>
              <div className="setup-video-card">
                <iframe
                  title={activeStep.videoTitle}
                  src={activeStep.videoEmbed}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </details>
          </section>
        )}

        {understandPartIndex === 3 && (
          <section className="learn-switch-panel understand-code-challenge-page" key={`understand-challenge-${activeStep.id}`}>
            <CodeFillChallenge challenge={activeStep.challenge} onSolvedChange={setCodeChallengeSolved} />
          </section>
        )}

        {isQuizPart && (
          <section className="learn-switch-panel learn-quiz-page understand-quiz-page" key={`understand-quiz-${activeStep.id}`}>
            <fieldset className="learn-quiz">
              <legend>{activeStep.quiz.prompt}</legend>
              {activeStep.quiz.options.map((option) => (
                <label
                  className={`learn-quiz-option ${
                    answerWasChecked && option.id === checkedAnswerId
                      ? option.correct
                        ? 'correct'
                        : 'wrong'
                      : ''
                  }`}
                  key={option.id}
                >
                  <input
                    checked={selectedAnswerId === option.id}
                    name={`understand-quiz-${activeStep.id}`}
                    type="radio"
                    value={option.id}
                    onChange={() => {
                      setSelectedAnswerId(option.id);
                      setCheckedAnswerId('');
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>

            {answerWasChecked && (
              <p className={`learn-feedback ${answerIsCorrect ? 'correct' : 'wrong'}`}>
                {answerIsCorrect ? activeStep.quiz.correctMessage : activeStep.quiz.wrongMessage}
              </p>
            )}

            <div className="setup-actions learn-quiz-actions">
              <button className="mini-button ghost" type="button" onClick={goToPreviousPart}>
                Review previous part
              </button>
              <button
                className="mini-button secondary"
                disabled={!selectedAnswer || activeStepDone}
                type="button"
                onClick={() => setCheckedAnswerId(selectedAnswerId)}
              >
                Check answer
              </button>
              {isUnderstandFinished ? (
                <button className="mini-button primary" disabled type="button">
                  Understand complete
                </button>
              ) : activeStepDone ? (
                <button className="mini-button primary" type="button" onClick={() => props.onSelectStep(nextIndex)}>
                  Next topic
                </button>
              ) : (
                <button
                  className="mini-button primary"
                  disabled={!canCompleteTopic}
                  type="button"
                  onClick={() => props.onCompleteStep(activeStep.id)}
                >
                  I get this part
                </button>
              )}
              <button
                className="mini-button ghost"
                disabled={activeIndex === 0}
                type="button"
                onClick={() => props.onSelectStep(activeIndex - 1)}
              >
                Previous topic
              </button>
            </div>

            <details className="setup-stuck">
              <summary>I'm stuck</summary>
              <p>{activeStep.stuckTip}</p>
            </details>
          </section>
        )}

        {!isQuizPart && (
          <div className="setup-actions learn-switch-actions">
            <button className="mini-button ghost" disabled={understandPartIndex === 0} type="button" onClick={goToPreviousPart}>
              Back
            </button>
            <button className="mini-button primary" disabled={!canContinueUnderstandPart} type="button" onClick={goToNextPart}>
              Continue
            </button>
          </div>
        )}
      </article>
    </section>
  );
}

function PythonSummaryDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="python-beginner-summary-title"
        aria-modal="true"
        className="summary-dialog"
        role="dialog"
      >
        <button aria-label="Close summary" className="dialog-close" type="button" onClick={onClose}>
          <X aria-hidden="true" />
        </button>

        <div className="summary-intro">
          <p className="eyebrow">Beginner rescue guide</p>
          <h2 id="python-beginner-summary-title">Python beginner rescue guide</h2>
          <p>
            A budget tracker is a small money notebook. It helps people record money coming in, money going out,
            and the balance left. Python lets us turn that notebook into a terminal app that asks questions,
            calculates totals, and saves records.
          </p>
        </div>

        <div className="summary-visual-grid" aria-label="Python basics visual guide">
          <article className="summary-visual">
            <span className="visual-badge">1</span>
            <h3>What the app helps with</h3>
            <div className="box-visual" aria-hidden="true">
              <span>income</span>
              <strong>expense</strong>
              <span>balance</span>
            </div>
            <p>The tracker shows whether money is entering, leaving, or remaining.</p>
          </article>

          <article className="summary-visual">
            <span className="visual-badge">2</span>
            <h3>Python syntax survival kit</h3>
            <div className="flow-visual" aria-hidden="true">
              <span>quotes</span>
              <span>=</span>
              <span>()</span>
            </div>
            <p>Quotes mean text, equals stores a value, and brackets pass information into commands.</p>
          </article>

          <article className="summary-visual">
            <span className="visual-badge">3</span>
            <h3>How the project grows</h3>
            <div className="choice-visual" aria-hidden="true">
              <span>ask</span>
              <span>calculate</span>
              <span>save</span>
            </div>
            <p>The final app is just many tiny ideas working together.</p>
          </article>
        </div>

        <div className="summary-note-grid">
          <article className="summary-note">
            <h3>Think like a student</h3>
            <p>
              Transport fare, food money, airtime, printing, dues, and group contribution are all real examples.
              That makes the project easier to explain during presentation.
            </p>
          </article>
          <article className="summary-note warning">
            <h3>Common beginner mistakes</h3>
            <p>
              Forgetting quotes, mixing text with numbers, missing brackets, and breaking indentation cause most
              early Python errors. Fix one line at a time.
            </p>
          </article>
          <article className="summary-note">
            <h3>How to learn without stress</h3>
            <p>
              Read the story, look at the tiny code, say what it does in English, then answer the check. The video
              is only backup.
            </p>
          </article>
        </div>

        <div className="summary-map" aria-label="Starter kit file map">
          {[
            ['01', 'header', 'imports and save file'],
            ['02', 'load', 'read old records'],
            ['03', 'save', 'write new records'],
            ['04', 'income', 'add money in'],
            ['05', 'expense', 'add money out'],
            ['06', 'view', 'show records'],
            ['07', 'balance', 'total the money'],
            ['08', 'menu', 'choose actions'],
            ['09', 'start', 'run the app'],
          ].map(([number, title, body]) => (
            <article key={number}>
              <strong>{number}</strong>
              <span>{title}</span>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DownloadsGrid(props: {
  progress: ProgressRecord;
  questState: ReturnType<typeof calculateQuestState>;
  selectedPack: ReturnType<typeof getGroupFeaturePack>;
  onExportReceipt: () => void;
}) {
  const groupStarterKitHref = `/downloads/${getGroupStarterKitFilename(props.progress.groupId)}`;
  const groupFeaturePdfHref = `/downloads/${getGroupFeaturePdfFilename(props.progress.groupId)}`;

  return (
    <div className="download-grid">
      <a className="download-card" href={groupStarterKitHref} download>
        <Download aria-hidden="true" />
        <strong>Download group starter kit</strong>
        <span>Group {props.progress.groupId} snippets, nudge guide, sample data, and feature PDF.</span>
      </a>

      {props.questState.isGroupMissionUnlocked ? (
        <a className="download-card accent" href={groupFeaturePdfHref} download>
          <FileText aria-hidden="true" />
          <strong>Download group feature PDF</strong>
          <span>{props.selectedPack.title}: at least five custom features.</span>
        </a>
      ) : (
        <div className="download-card locked">
          <Lock aria-hidden="true" />
          <strong>Group feature PDF locked until checkpoint</strong>
          <span>Complete Level 4 so the group knows the base app first.</span>
        </div>
      )}

      <button className="download-card receipt-button" type="button" onClick={props.onExportReceipt}>
        <ReceiptText aria-hidden="true" />
        <strong>Export completion receipt</strong>
        <span>Use this as proof of completed levels and feature choice.</span>
      </button>
    </div>
  );
}

function ResourceGrid({ resources }: { resources: typeof tutorialResources }) {
  return (
    <section className="tutorial-section">
      <div className="section-heading">
        <p className="eyebrow">Setup Links</p>
        <h2>Install the right tools</h2>
      </div>
      <div className="resource-grid">
        {resources.map((resource) => (
          <a href={resource.href} className="resource-card" key={resource.title} target="_blank" rel="noreferrer">
            <PlayCircle aria-hidden="true" />
            <strong>{resource.title}</strong>
            <span>{resource.description}</span>
            <em>{resource.action}</em>
          </a>
        ))}
      </div>
    </section>
  );
}

function VideoGrid() {
  return (
    <section className="tutorial-section">
      <div className="section-heading">
        <p className="eyebrow">Tutorials</p>
        <h2>Watch only what helps this project</h2>
      </div>
      <div className="video-grid">
        {videos.map((video) => (
          <div className="video-card" key={video.title}>
            <iframe
              title={video.title}
              src={video.embed}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <strong>{video.title}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function toPythonIdentifier(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'group_feature';
}

function groupFeatureFunctionName(title: string) {
  return `show_${toPythonIdentifier(title)}`;
}

type GroupMissionTrainingStepId =
  | 'choose-feature'
  | 'plan-data'
  | 'write-helper'
  | 'wire-menu'
  | 'test-present';

type GroupMissionTrainingStep = {
  id: GroupMissionTrainingStepId;
  checkpoint: string;
  title: string;
  idea: string;
  studentQuestion: string;
  beginnerAnswer: string;
  tinyWin: string;
  coachMove: string;
  location: {
    before: string;
    target: string;
    after: string;
  };
  roles: Array<{
    label: string;
    job: string;
  }>;
  guideTitle: string;
  guide: string[];
  note: string;
  copyShapeIntro: string;
  proofChecklist: string[];
  mistakeChecks: string[];
  videoTitle: string;
  videoEmbed: string;
  stuckTip: string;
};

const groupMissionTrainingSteps: GroupMissionTrainingStep[] = [
  {
    id: 'choose-feature',
    checkpoint: 'Choose one feature',
    title: 'Pick one feature before touching code',
    idea:
      'A group feature becomes easier when the team agrees on one tiny first version. Build the smallest useful version, test it, then improve it.',
    studentQuestion: 'We have five features. Are we supposed to build everything at once?',
    beginnerAnswer:
      'No. Start with one feature and make the smallest version work. After the pattern works once, the next feature is mostly repetition.',
    tinyWin: 'The group can say the feature in one sentence before opening VS Code.',
    coachMove:
      'Ask: what will the user type, what should the app remember, and what should the app show back?',
    location: {
      before: 'Open your group PDF and README_NUDGE.md first.',
      target: 'Write the chosen feature name at the top of your rough work or notebook.',
      after: 'Only then open main.py and decide the first code change.',
    },
    roles: [
      { label: 'Driver', job: 'Types in VS Code and shares the screen.' },
      { label: 'Reader', job: 'Reads this portal and calls out the next instruction.' },
      { label: 'Tester', job: 'Runs the terminal after every small change.' },
      { label: 'Explainer', job: 'Says what changed in plain English.' },
    ],
    guideTitle: 'Read the feature sheet',
    guide: [
      'Download your group feature PDF and read only your group page first.',
      'Pick one feature card from the list below. Start with the simplest one.',
      'Write one sentence that explains what the user should be able to do.',
      'Decide who will type, who will read instructions, and who will test.',
    ],
    note: 'Do not split into five different features immediately. One working feature is better than five unfinished ideas.',
    copyShapeIntro:
      'Copy this planning shape into your rough work before editing code. It keeps the group from arguing about what to build.',
    proofChecklist: [
      'One feature is selected and every group member can say what it does.',
      'The Driver, Reader, Tester, and Explainer roles are assigned.',
      'The first version is small enough to test in under two minutes.',
      'The group knows which menu option will eventually open this feature.',
    ],
    mistakeChecks: [
      'Do not start by building all five features.',
      'Do not let only one person understand the feature.',
      'Do not copy random code before deciding the user action.',
    ],
    videoTitle: 'How to plan a beginner programming task',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=219',
    stuckTip: 'If the feature sounds too big, reduce it to one button/menu option and one printed result first.',
  },
  {
    id: 'plan-data',
    checkpoint: 'Plan saved data',
    title: 'Give the feature a home inside budget_data.json',
    idea:
      'Most group features need somewhere to store information. In this project, saved information lives inside the data dictionary and later becomes budget_data.json.',
    studentQuestion: 'Why are we talking about data before writing the feature?',
    beginnerAnswer:
      'Because a tracker is only useful if it remembers things. If you know where the record will be stored, the function becomes easier to write.',
    tinyWin: 'The group knows the exact dictionary key that will hold the new records.',
    coachMove:
      'Treat the dictionary like a school file cabinet: every drawer needs one clear label before anyone can file work there.',
    location: {
      before: 'Look inside `load_data()` where the default dictionary is returned.',
      target: 'Add one new key beside `"income"` and `"expenses"`.',
      after: 'Use that same key inside your new feature function.',
    },
    roles: [
      { label: 'Driver', job: 'Adds the new key in main.py.' },
      { label: 'Reader', job: 'Spells the key out loud so it stays consistent.' },
      { label: 'Tester', job: 'Runs the app and checks budget_data.json later.' },
      { label: 'Explainer', job: 'Explains the new key as a new notebook page.' },
    ],
    guideTitle: 'Sketch the data shape',
    guide: [
      'Look at the base shape: data has income and expenses.',
      'Add one new key for your group feature, using a simple lowercase name.',
      'Start with an empty list so the app can hold many records later.',
      'Use the same key name in every function. Random spelling changes cause bugs.',
    ],
    note: 'This is like adding a new page to the budget notebook. If the page has no name, the app will not know where to write.',
    copyShapeIntro:
      'Copy this shape into your real project near the default return from `load_data()`. Keep the key spelling exactly the same everywhere.',
    proofChecklist: [
      '`load_data()` has a new feature key beside income and expenses.',
      'The key uses quotes and points to an empty list.',
      'The group writes the key name in their notes so nobody changes the spelling.',
      'The app still runs after adding the key.',
    ],
    mistakeChecks: [
      'Do not remove `"income"` or `"expenses"`.',
      'Do not use spaces inside the key name.',
      'Do not spell the key one way in `load_data()` and another way in the function.',
    ],
    videoTitle: 'Python dictionaries explained',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=2476',
    stuckTip: 'Say it in English: data has income, expenses, and one extra list for our group feature.',
  },
  {
    id: 'write-helper',
    checkpoint: 'Write helper function',
    title: 'Put the feature inside its own function',
    idea:
      'A feature should not be scattered everywhere. A helper function gives the feature one clear home that the menu can call later.',
    studentQuestion: 'Why not just paste the feature code inside the menu?',
    beginnerAnswer:
      'That makes the menu messy. A function lets the menu stay clean: the menu chooses, then the function does the work.',
    tinyWin: 'The feature has one named function that can run without the full menu first.',
    coachMove:
      'Read the function name like English. If the name says the job clearly, the presentation becomes easier.',
    location: {
      before: 'Paste this function after the base helper functions.',
      target: 'Place it above `main_menu()` so the menu can call it.',
      after: 'Later, add one `elif` in `main_menu()` that calls this function.',
    },
    roles: [
      { label: 'Driver', job: 'Types the function and preserves indentation.' },
      { label: 'Reader', job: 'Checks the colon, brackets, and spelling.' },
      { label: 'Tester', job: 'Runs the tiny version before touching the full app again.' },
      { label: 'Explainer', job: 'Explains what the function receives and changes.' },
    ],
    guideTitle: 'Create the function block',
    guide: [
      'Place the new function above main_menu().',
      'Start with def, a clear function name, brackets, and a colon.',
      'Pass data into the function so it can read and update saved records.',
      'First print a friendly message. Then add input and append lines slowly.',
    ],
    note: 'Functions are like roles in group work. One role handles one job, so the project is easier to explain during presentation.',
    copyShapeIntro:
      'Copy this function shape above `main_menu()`. Start with the print line first; add input and saving after the function runs once.',
    proofChecklist: [
      'The new function starts with `def` and ends the first line with a colon.',
      'Every line inside the function is indented.',
      'The function accepts `data` so it can use the saved notebook.',
      'The function can run in the mini lab before it is connected to the menu.',
    ],
    mistakeChecks: [
      'Do not forget the colon after the function name.',
      'Do not remove indentation inside the function.',
      'Do not call the function before Python has seen its definition.',
    ],
    videoTitle: 'Python functions for beginners',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=1965',
    stuckTip: 'If the function does not run, check the colon and indentation before changing anything else.',
  },
  {
    id: 'wire-menu',
    checkpoint: 'Connect menu option',
    title: 'Add one menu number for the new feature',
    idea:
      'The user should not need to know your function name. They should pick a menu number, and main_menu() should send them to the new feature.',
    studentQuestion: 'How will the user open our feature after we write the function?',
    beginnerAnswer:
      'Add a new menu line and one matching `elif`. The printed number and the `elif` number must match exactly.',
    tinyWin: 'Typing the new menu number opens the group feature from the real CLI menu.',
    coachMove:
      'Point at the printed option, then point at the matching `elif`. They are a pair, like question and answer.',
    location: {
      before: 'Inside `main_menu()`, find the menu print lines.',
      target: 'Add a new printed option and a matching `elif choice == "...":` block.',
      after: 'Call your new feature function inside that `elif` block.',
    },
    roles: [
      { label: 'Driver', job: 'Adds the menu print line and `elif` route.' },
      { label: 'Reader', job: 'Checks that the menu number matches the condition.' },
      { label: 'Tester', job: 'Types that number in the terminal and watches what happens.' },
      { label: 'Explainer', job: 'Explains menu choice to function call.' },
    ],
    guideTitle: 'Wire it into main_menu()',
    guide: [
      'Find the menu print lines and add one new line for your group feature.',
      'Find the if and elif choices below the input line.',
      'Add a new elif that checks the new menu number as text, like "6".',
      'Inside that elif, call your feature function and pass data into it.',
    ],
    note: 'input() returns text, so menu choices should be checked with quotes. Use "6", not 6.',
    copyShapeIntro:
      'Copy this menu route beside the other `elif` blocks. Change only the number if your group chooses another menu number.',
    proofChecklist: [
      'The menu displays a new option for your group feature.',
      'The `elif` checks the same number the menu prints.',
      'The `elif` calls your feature function with `data`.',
      'Typing the new number in the terminal opens the feature.',
    ],
    mistakeChecks: [
      'Do not check menu numbers without quotes.',
      'Do not place the `elif` outside the menu loop.',
      'Do not call a function name that is spelled differently above.',
    ],
    videoTitle: 'Python if elif menu logic',
    videoEmbed: 'https://www.youtube.com/embed/kqtD5dpn9C8?start=1502',
    stuckTip: 'If your option never runs, check that the printed menu number and the elif number match exactly.',
  },
  {
    id: 'test-present',
    checkpoint: 'Test and explain',
    title: 'Prove it works before adding the next feature',
    idea:
      'Testing is part of building. Run the app, choose the new menu option, use simple values, then explain what changed in data.',
    studentQuestion: 'How do we know it is actually finished and not just looking finished?',
    beginnerAnswer:
      'You need proof: the menu opens it, the terminal accepts a simple test, the saved data changes, and one person can explain the flow.',
    tinyWin: 'The group can run one clean demo and explain what changed without reading the whole code.',
    coachMove:
      'Use small test values first. A simple demo is easier to debug and easier to present.',
    location: {
      before: 'Run `python main.py` in the VS Code terminal.',
      target: 'Choose your new menu option and enter simple test values.',
      after: 'Check the output or `budget_data.json`, then rehearse the explanation.',
    },
    roles: [
      { label: 'Driver', job: 'Runs the final test in VS Code.' },
      { label: 'Reader', job: 'Reads the proof checklist out loud.' },
      { label: 'Tester', job: 'Tries one normal value and one simple mistake.' },
      { label: 'Explainer', job: 'Practices the demo explanation.' },
    ],
    guideTitle: 'Do the presentation check',
    guide: [
      'Run python main.py from the terminal.',
      'Choose your new menu option and enter simple test values.',
      'View the output or open budget_data.json to confirm the record exists.',
      'Prepare one explanation: what the feature does, which function runs it, and where the data is saved.',
    ],
    note: 'A good presentation is not just showing code. It is explaining the user problem, the function, the data, and the test result.',
    copyShapeIntro:
      'Copy this proof script into your group notes. It becomes the presentation path when your lecturer asks what you added.',
    proofChecklist: [
      'Run `python main.py` and choose the new menu option.',
      'Enter simple test values that are easy to explain.',
      'Confirm the result prints or appears in `budget_data.json`.',
      'One member explains the user problem, function name, data key, and test result.',
    ],
    mistakeChecks: [
      'Do not present a feature nobody has tested from the menu.',
      'Do not use confusing demo values.',
      'Do not let only the Driver know how the feature works.',
    ],
    videoTitle: 'How to debug Python code',
    videoEmbed: 'https://www.youtube.com/embed/NIWwJbo-9_8',
    stuckTip: 'If the app crashes, read the first error line and check the exact line number before asking the group to guess.',
  },
];

function groupFeatureDataKey(title: string) {
  return toPythonIdentifier(title);
}

function groupMissionMenuNumber(selectedPack: ReturnType<typeof getGroupFeaturePack>) {
  return String(5 + selectedPack.id);
}

function buildGroupMissionChallenge(
  selectedPack: ReturnType<typeof getGroupFeaturePack>,
  selectedFeature: string,
  stepId: GroupMissionTrainingStepId,
): LearnCodeChallenge {
  const functionName = groupFeatureFunctionName(selectedPack.title);
  const dataKey = groupFeatureDataKey(selectedPack.title);
  const menuNumber = groupMissionMenuNumber(selectedPack);

  if (stepId === 'choose-feature') {
    return {
      prompt: 'Which list method adds the chosen feature into a plan?',
      answer: 'append',
      hint: 'Lists grow by calling append().',
      success: 'Correct - append() adds one feature plan without deleting the old list.',
      buildCode: (answer) => `feature_plan = []
feature_plan.${answer || '____'}("${selectedFeature}")
print(feature_plan)`,
    };
  }

  if (stepId === 'plan-data') {
    return {
      prompt: `Which quoted key should hold ${selectedPack.title} records?`,
      answer: `"${dataKey}"`,
      hint: `Use quotes because dictionary keys are text. Type "${dataKey}".`,
      success: `Correct - "${dataKey}" is the feature's home inside data.`,
      buildCode: (answer) => `data = {"income": [], "expenses": [], ${answer || '____'}: []}
print(data["${dataKey}"])`,
    };
  }

  if (stepId === 'wire-menu') {
    return {
      prompt: 'Which keyword checks the next menu option after if?',
      answer: 'elif',
      hint: 'It is short for else-if and checks another menu route.',
      success: `Correct - elif connects menu option ${menuNumber} to the feature function.`,
      buildCode: (answer) => `choice = "${menuNumber}"

if choice == "1":
    print("Add income")
${answer || '____'} choice == "${menuNumber}":
    print("${selectedPack.title} selected")
else:
    print("Invalid option")`,
    };
  }

  if (stepId === 'test-present') {
    return {
      prompt: 'Which function shows your proof message in the terminal?',
      answer: 'print',
      hint: 'The same function that shows normal output in the terminal.',
      success: 'Correct - print() helps your group show proof while testing.',
      buildCode: (answer) => `feature_done = True
${answer || '____'}("Feature tested:", feature_done)`,
    };
  }

  return {
    prompt: `Which keyword creates the ${selectedPack.title} helper function?`,
    answer: 'def',
    hint: 'A function starts with def, then the function name, then brackets and a colon.',
    success: `Correct - def tells Python that ${functionName} is a reusable job.`,
    buildCode: (answer) => `${answer || '____'} ${functionName}(data):
    print("${selectedFeature}")

data = {"${dataKey}": []}
${functionName}(data)`,
  };
}

function buildGroupMissionPracticeCode(
  selectedPack: ReturnType<typeof getGroupFeaturePack>,
  selectedFeature: string,
  stepId: GroupMissionTrainingStepId,
) {
  const dataKey = groupFeatureDataKey(selectedPack.title);
  const functionName = groupFeatureFunctionName(selectedPack.title);
  const menuNumber = groupMissionMenuNumber(selectedPack);

  if (stepId === 'plan-data') {
    return `data = {"income": [], "expenses": [], "${dataKey}": []}

data["${dataKey}"].append({
    "feature": "${selectedFeature}",
    "status": "first test"
})

print(data["${dataKey}"])`;
  }

  if (stepId === 'write-helper') {
    return `def ${functionName}(data):
    data["${dataKey}"].append({
        "feature": "${selectedFeature}",
        "status": "tested"
    })
    print("Added:", data["${dataKey}"][0]["feature"])

data = {"${dataKey}": []}
${functionName}(data)`;
  }

  if (stepId === 'wire-menu') {
    return `def ${functionName}(data):
    print("${selectedPack.title} feature opened")

choice = "${menuNumber}"
data = {"${dataKey}": []}

if choice == "${menuNumber}":
    ${functionName}(data)
else:
    print("Choose the feature menu number")`;
  }

  if (stepId === 'test-present') {
    return `data = {"${dataKey}": [{"feature": "${selectedFeature}", "status": "tested"}]}

print("Demo line 1: our feature is ${selectedPack.title}")
print("Demo line 2: this function stores records in ${dataKey}")
print("Demo line 3:", data["${dataKey}"][0]["status"])`;
  }

  return `feature_plan = []
feature_plan.append({
    "feature": "${selectedFeature}",
    "status": "todo",
    "owner": "Group ${selectedPack.id}"
})

print(feature_plan[0]["feature"])
print(feature_plan[0]["status"])`;
}

function buildGroupMissionReferenceCode(
  selectedPack: ReturnType<typeof getGroupFeaturePack>,
  selectedFeature: string,
  stepId: GroupMissionTrainingStepId,
) {
  const dataKey = groupFeatureDataKey(selectedPack.title);
  const functionName = groupFeatureFunctionName(selectedPack.title);
  const menuNumber = groupMissionMenuNumber(selectedPack);

  if (stepId === 'plan-data') {
    return `# inside load_data() default return
return {
    "income": [],
    "expenses": [],
    "${dataKey}": []
}`;
  }

  if (stepId === 'write-helper') {
    return `def ${functionName}(data):
    record = {
        "feature": "${selectedFeature}",
        "status": "todo"
    }
    data["${dataKey}"].append(record)`;
  }

  if (stepId === 'wire-menu') {
    return `print("${menuNumber}. ${selectedPack.title}")

elif choice == "${menuNumber}":
    ${functionName}(data)`;
  }

  if (stepId === 'test-present') {
    return `# test path
python main.py
choose ${menuNumber}
check budget_data.json
explain ${functionName}()`;
  }

  return `# group plan
feature = "${selectedFeature}"
first_version = "make one small working version"`;
}

function renderMissionInstructionText(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function GroupMissionPanel(props: {
  access: GroupMissionAccess;
  loading: boolean;
  onCompleteMission: () => void;
  progress: ProgressRecord;
  selectedPack: ReturnType<typeof getGroupFeaturePack>;
}) {
  const missionCardRef = useRef<HTMLElement | null>(null);
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);
  const [trainingStepIndex, setTrainingStepIndex] = useState(0);
  const [trainingPartIndex, setTrainingPartIndex] = useState(0);
  const [completedTrainingSteps, setCompletedTrainingSteps] = useState<GroupMissionTrainingStepId[]>([]);
  const [codeChallengeSolved, setCodeChallengeSolved] = useState(false);
  const selectedFeature = props.selectedPack.features[selectedFeatureIndex] ?? props.selectedPack.features[0];
  const activeStep = groupMissionTrainingSteps[trainingStepIndex] ?? groupMissionTrainingSteps[0];
  const activeStepDone = completedTrainingSteps.includes(activeStep.id);
  const completedCount = groupMissionTrainingSteps.filter((step) => completedTrainingSteps.includes(step.id)).length;
  const allTrainingDone = groupMissionTrainingSteps.every((step) => completedTrainingSteps.includes(step.id));
  const nextIndex = Math.min(trainingStepIndex + 1, groupMissionTrainingSteps.length - 1);
  const trainingPartCount = 5;
  const currentTrainingPart = trainingPartIndex + 1;
  const isChallengePart = trainingPartIndex === 3;
  const canContinuePart = !isChallengePart || codeChallengeSolved;
  const missionChallenge = useMemo(
    () => buildGroupMissionChallenge(props.selectedPack, selectedFeature, activeStep.id),
    [activeStep.id, props.selectedPack, selectedFeature],
  );
  const missionPracticeCode = useMemo(
    () => buildGroupMissionPracticeCode(props.selectedPack, selectedFeature, activeStep.id),
    [activeStep.id, props.selectedPack, selectedFeature],
  );
  const referenceCode = useMemo(
    () => buildGroupMissionReferenceCode(props.selectedPack, selectedFeature, activeStep.id),
    [activeStep.id, props.selectedPack, selectedFeature],
  );
  const waitingNames = props.access.waitingNames.slice(0, 4).join(', ');
  const missionIsComplete = props.progress.completedSteps.includes('group-mission');

  useEffect(() => {
    setTrainingPartIndex(0);
    setCodeChallengeSolved(false);
  }, [activeStep.id]);

  useEffect(() => {
    const missionCard = missionCardRef.current;
    if (trainingPartIndex === 0 || typeof missionCard?.scrollIntoView !== 'function') return;
    missionCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [trainingPartIndex]);

  useEffect(() => scheduleBrythonWarmup(), []);

  function selectTrainingStep(stepIndex: number) {
    setTrainingStepIndex(stepIndex);
    setTrainingPartIndex(0);
  }

  function goToPreviousPart() {
    setTrainingPartIndex((current) => Math.max(0, current - 1));
  }

  function goToNextPart() {
    setTrainingPartIndex((current) => Math.min(trainingPartCount - 1, current + 1));
  }

  function markTrainingStepDone() {
    setCompletedTrainingSteps((current) =>
      current.includes(activeStep.id) ? current : [...current, activeStep.id],
    );
  }

  return (
    <section className="group-mission-workbench">
      <div className="group-gate-card">
        <div>
          <p className="eyebrow">{props.access.devPreview ? 'Dev preview' : 'Group gate'}</p>
          <h2>{props.selectedPack.title}</h2>
          <p>{props.selectedPack.overview}</p>
        </div>
        <div className="group-ready-meter">
          <strong>
            {props.access.readyCount}/{props.access.totalCount}
          </strong>
          <span>ready</span>
        </div>
        <p className={`group-gate-note ${props.access.allGroupReady ? 'ready' : ''}`}>
          {props.loading
            ? 'Checking group readiness...'
            : props.access.allGroupReady
              ? 'Everyone saved the earlier levels. The real group mission is open.'
              : props.access.devPreview
                ? 'Dev preview is on, so you can build this page before the full team finishes.'
                : waitingNames
                  ? `Waiting for: ${waitingNames}.`
                  : 'Waiting for the full group to finish the earlier levels.'}
        </p>
      </div>

      <section className="setup-stepper learn-stepper group-training-stepper quest-panel">
        <div className="setup-stepper-top">
          <div>
            <p className="eyebrow">Group feature lab</p>
            <h2>Feature build training</h2>
            <p className="muted-copy">
              Assemble the group feature the same way you learned the base app: one idea, one tiny code test, one
              checkpoint.
            </p>
          </div>
          <div className="setup-score">
            <strong>{completedCount}/{groupMissionTrainingSteps.length}</strong>
            <span>done</span>
          </div>
        </div>

        <div className="setup-step-list group-mission-step-list" aria-label="Group mission steps">
          {groupMissionTrainingSteps.map((step, index) => {
            const done = completedTrainingSteps.includes(step.id);
            const locked = index > completedCount;
            return (
              <button
                aria-label={`${index + 1}. ${step.checkpoint}`}
                aria-current={index === trainingStepIndex ? 'step' : undefined}
                className={`setup-step-chip ${index === trainingStepIndex ? 'active' : ''} ${done ? 'done' : ''}`}
                disabled={locked}
                key={step.id}
                type="button"
                onClick={() => selectTrainingStep(index)}
              >
                <span>{index + 1}</span>
              </button>
            );
          })}
        </div>

        <article ref={missionCardRef} className={`setup-current-card learn-course-card group-mission-course-card ${activeStepDone ? 'done' : ''}`}>
          <div className="learn-part-meter" aria-label={`Group mission part ${currentTrainingPart} of ${trainingPartCount}`}>
            <span>Part {currentTrainingPart} of {trainingPartCount}</span>
            <div className="learn-part-dots" aria-hidden="true">
              {Array.from({ length: trainingPartCount }, (_, index) => (
                <span className={index <= trainingPartIndex ? 'active' : ''} key={index} />
              ))}
            </div>
          </div>

          {trainingPartIndex === 0 && (
            <section className="learn-switch-panel mission-mini-section" key={`mission-idea-${activeStep.id}`}>
              <div className="mission-section-copy">
                <p className="eyebrow">Build idea</p>
                <h3>{activeStep.title}</h3>
                <p>{activeStep.idea}</p>
              </div>

              {activeStep.id === 'choose-feature' ? (
                <div className="mission-feature-grid" aria-label="Group feature choices">
                  {props.selectedPack.features.map((feature, index) => (
                    <button
                      className={`mission-feature-card ${selectedFeatureIndex === index ? 'active' : ''}`}
                      key={feature}
                      type="button"
                      onClick={() => setSelectedFeatureIndex(index)}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{feature}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="learn-idea-visual" aria-label="Current feature">
                  <strong>Current feature</strong>
                  <div>
                    <span>{props.selectedPack.title}</span>
                    <span>{selectedFeature}</span>
                    <span>{activeStep.checkpoint}</span>
                  </div>
                  <p>Keep using this same selected feature until it works, then repeat for the next feature.</p>
                </div>
              )}

              <div className="mission-hint-box">
                <Lightbulb aria-hidden="true" />
                <span>{activeStep.note}</span>
              </div>

              <div className="mission-beginner-grid" aria-label="Beginner support for this step">
                <article className="mission-beginner-card question">
                  <p className="eyebrow">What you might be thinking</p>
                  <h4>{activeStep.studentQuestion}</h4>
                  <p>{activeStep.beginnerAnswer}</p>
                </article>

                <article className="mission-beginner-card tiny-win">
                  <p className="eyebrow">Tiny win</p>
                  <h4>{activeStep.tinyWin}</h4>
                  <p>{activeStep.coachMove}</p>
                </article>

                <article className="mission-beginner-card location-card">
                  <p className="eyebrow">Where this goes in main.py</p>
                  <ol className="mission-location-map">
                    <li>
                      <span>Before</span>
                      <strong>{renderMissionInstructionText(activeStep.location.before)}</strong>
                    </li>
                    <li>
                      <span>Do here</span>
                      <strong>{renderMissionInstructionText(activeStep.location.target)}</strong>
                    </li>
                    <li>
                      <span>After</span>
                      <strong>{renderMissionInstructionText(activeStep.location.after)}</strong>
                    </li>
                  </ol>
                </article>

                <article className="mission-beginner-card roles-card">
                  <p className="eyebrow">Group roles</p>
                  <div className="mission-role-grid">
                    {activeStep.roles.map((role) => (
                      <span key={role.label}>
                        <strong>{role.label}</strong>
                        {role.job}
                      </span>
                    ))}
                  </div>
                </article>
              </div>
            </section>
          )}

          {trainingPartIndex === 1 && (
            <section className="learn-switch-panel mission-mini-section split" key={`mission-guide-${activeStep.id}`}>
              <div className="mission-section-copy">
                <p className="eyebrow">Read the feature sheet</p>
                <h3>{activeStep.guideTitle}</h3>
                <ol className="setup-action-list mission-guide-list">
                  {activeStep.guide.map((item) => (
                    <li key={item}>
                      <span>{renderMissionInstructionText(item)}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mission-guide-stack">
                <div className="mission-copy-shape-card">
                  <p className="eyebrow">Copy this shape into your real project</p>
                  <strong>{activeStep.copyShapeIntro}</strong>
                </div>
                <pre className="learn-code-block mission-code-block">
                  <code>{referenceCode}</code>
                </pre>
                <a className="download-card feature-download" href={`/downloads/${getGroupFeaturePdfFilename(props.progress.groupId)}`} download>
                  <FileText aria-hidden="true" />
                  <strong>Download group feature PDF</strong>
                  <span>Use this sheet while choosing and tracking at least five features.</span>
                </a>
              </div>
            </section>
          )}

          {trainingPartIndex === 2 && (
            <section className="learn-switch-panel learn-runner-page mission-mini-section" aria-label="Run this group feature practice" key={`mission-run-${activeStep.id}`}>
              <div className="code-activity-copy">
                <p className="eyebrow">Mini code lab</p>
                <h4>Run the tiny version first</h4>
                <p>
                  This is a rehearsal. If the small code makes sense, the group will edit <code>main.py</code> with less
                  panic.
                </p>
              </div>
              <PythonPracticeRunner initialCode={missionPracticeCode} />
            </section>
          )}

          {trainingPartIndex === 3 && (
            <section className="learn-switch-panel understand-code-challenge-page" key={`mission-challenge-${activeStep.id}`}>
              <CodeFillChallenge challenge={missionChallenge} onSolvedChange={setCodeChallengeSolved} />
            </section>
          )}

          {trainingPartIndex === 4 && (
            <section className="learn-switch-panel mission-mini-section split" key={`mission-check-${activeStep.id}`}>
              <div className="mission-section-copy">
                <p className="eyebrow">Checkpoint</p>
                <h3>Do this in VS Code</h3>
                <p>{activeStep.note}</p>
                <ol className="setup-action-list mission-check-list">
                  {activeStep.proofChecklist.map((item) => (
                    <li key={item}>
                      <span>{renderMissionInstructionText(item)}</span>
                    </li>
                  ))}
                </ol>
                <div className="mission-mistake-card">
                  <strong>Check these before calling it broken</strong>
                  <ul>
                    {activeStep.mistakeChecks.map((mistake) => (
                      <li key={mistake}>{renderMissionInstructionText(mistake)}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <details className="setup-stuck mission-video-support" open>
                <summary>Watch or rescue</summary>
                <p>{activeStep.stuckTip}</p>
                <div className="setup-video-card">
                  <iframe
                    title={activeStep.videoTitle}
                    src={activeStep.videoEmbed}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </details>
            </section>
          )}

          {trainingPartIndex < trainingPartCount - 1 ? (
            <div className="setup-actions learn-switch-actions">
              <button className="mini-button ghost" disabled={trainingPartIndex === 0} type="button" onClick={goToPreviousPart}>
                Back
              </button>
              <button className="mini-button primary" disabled={!canContinuePart} type="button" onClick={goToNextPart}>
                Continue
              </button>
            </div>
          ) : (
            <div className="setup-actions learn-switch-actions">
              <button className="mini-button ghost" type="button" onClick={goToPreviousPart}>
                Back
              </button>
              {allTrainingDone || missionIsComplete ? (
                <button className="mini-button primary" disabled={missionIsComplete} type="button" onClick={props.onCompleteMission}>
                  {missionIsComplete ? 'Group mission complete' : 'Finish group mission'}
                </button>
              ) : activeStepDone ? (
                <button className="mini-button primary" type="button" onClick={() => selectTrainingStep(nextIndex)}>
                  Next feature step
                </button>
              ) : (
                <button className="mini-button primary" type="button" onClick={markTrainingStepDone}>
                  I did this
                </button>
              )}
              <button
                className="mini-button ghost"
                disabled={trainingStepIndex === 0}
                type="button"
                onClick={() => selectTrainingStep(trainingStepIndex - 1)}
              >
                Previous step
              </button>
            </div>
          )}
        </article>
      </section>
    </section>
  );
}

function SupportCards({ sectionIds }: { sectionIds: Array<keyof typeof supportSections> }) {
  return (
    <section className="support-section">
      <div className="section-heading">
        <p className="eyebrow">Support System</p>
        <h2>The extra help that keeps groups moving</h2>
      </div>
      <div className="support-grid">
        {sectionIds.map((id) => {
          const section = supportSections[id];
          return (
            <article className="support-card" key={id}>
              {supportIcon(id)}
              <h3>{section.title}</h3>
              <p>{section.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InfoBlock({ body, title }: { body: string; title: string }) {
  return (
    <article className="support-card">
      <CheckCircle2 aria-hidden="true" />
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function supportIcon(id: string) {
  const props = { 'aria-hidden': 'true' } as const;
  if (id === 'hint-ladder') return <Lightbulb {...props} />;
  if (id === 'checkpoint-questions') return <ClipboardList {...props} />;
  if (id === 'group-roles') return <Users {...props} />;
  if (id === 'troubleshooting') return <Bug {...props} />;
  if (id === 'presentation-helper') return <CheckCircle2 {...props} />;
  if (id === 'sample-data-pack') return <Download {...props} />;
  return <ReceiptText {...props} />;
}

function markCompleteLabel(levelId: string): string {
  const labels: Record<string, string> = {
    setup: 'Mark setup complete',
    'learn-basics': 'Mark learn basics complete',
    'rebuild-app': 'Mark rebuild app complete',
    'understand-app': 'Mark understand app complete',
    'group-mission': 'Mark group mission complete',
    'presentation-pack': 'Mark presentation pack complete',
  };
  return labels[levelId] ?? 'Mark level complete';
}

function levelById(id: QuestLevelId): QuestLevel {
  const level = questLevels.find((item) => item.id === id);
  if (!level) throw new Error(`Unknown quest level: ${id}`);
  return level;
}

function pageFromPath(pathname: string): QuestPageId {
  return allQuestPages.find((page) => page.path === pathname)?.id ?? 'overview';
}

export default App;
