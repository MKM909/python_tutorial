export type GroupFeaturePack = {
  id: number;
  title: string;
  theme: string;
  overview: string;
  features: string[];
  stretchIdeas: string[];
};

export const groupFeaturePacks: GroupFeaturePack[] = [
  {
    id: 1,
    title: 'Savings Goals',
    theme: 'Help users save for something specific.',
    overview: 'Add a savings-goal section to the budget tracker so users can track a target amount.',
    features: [
      'Create a savings goal with a name and target amount.',
      'Add money toward an existing savings goal.',
      'Show the percentage completed for each goal.',
      'Warn the user when an expense may affect their savings plan.',
      'Display a goal summary that shows target, saved amount, and remaining amount.',
    ],
    stretchIdeas: ['Add a goal deadline.', 'Show goals sorted by closest to completion.'],
  },
  {
    id: 2,
    title: 'Category Limits',
    theme: 'Stop users from overspending in one category.',
    overview: 'Let users set spending limits for categories like food, transport, and data.',
    features: [
      'Create a monthly spending limit for a category.',
      'Show the remaining amount for each category.',
      'Warn the user when a category is close to its limit.',
      'List categories that have gone above their limit.',
      'Reset category spending for a new month.',
    ],
    stretchIdeas: ['Add default Nigerian student categories.', 'Show the most used category.'],
  },
  {
    id: 3,
    title: 'Time Summaries',
    theme: 'Help users understand spending over time.',
    overview: 'Add daily and weekly summaries so users can see when they spend the most.',
    features: [
      'Show total income and expenses for one selected day.',
      'Show total income and expenses for one selected week.',
      'Find the day with the highest spending.',
      'Print a simple trend message such as spending increased or reduced.',
      'Save the time summary into a text report file.',
    ],
    stretchIdeas: ['Add monthly summary comparison.', 'Show average spending per day.'],
  },
  {
    id: 4,
    title: 'Search And Filter',
    theme: 'Find records quickly.',
    overview: 'Improve the tracker so users can search and filter old income and expense records.',
    features: [
      'Search transactions by keyword.',
      'Filter records by category.',
      'Filter records by income or expense type.',
      'Sort filtered results by amount or date.',
      'Show the balance for only the filtered records.',
    ],
    stretchIdeas: ['Add search by amount range.', 'Show how many results were found.'],
  },
  {
    id: 5,
    title: 'Receipt Notes',
    theme: 'Make transactions easier to remember.',
    overview: 'Let users attach vendor names and notes to each expense.',
    features: [
      'Add a vendor or shop name to an expense.',
      'Add a short note that explains what the expense was for.',
      'Edit the note for an existing transaction.',
      'Search expenses by vendor name.',
      'Show the vendors where the user spends the most money.',
    ],
    stretchIdeas: ['Add receipt number field.', 'Group expenses by vendor.'],
  },
  {
    id: 6,
    title: 'Income Planner',
    theme: 'Plan expected money before it arrives.',
    overview: 'Help users compare expected income with money they actually received.',
    features: [
      'Create expected income sources such as allowance or salary.',
      'Mark expected income as received.',
      'Show expected income versus actual income.',
      'Warn the user when expected income has not arrived.',
      'Display an income-planning summary.',
    ],
    stretchIdeas: ['Add recurring income.', 'Add a payment due date.'],
  },
  {
    id: 7,
    title: 'Debt Tracker',
    theme: 'Track money owed and money borrowed.',
    overview: 'Add a simple debt section for students who borrow or lend money.',
    features: [
      'Record a debt with person name, amount, and reason.',
      'Record a payment made toward a debt.',
      'Show the remaining amount for each debt.',
      'Add a due date reminder message.',
      'Show the total amount owed across all debts.',
    ],
    stretchIdeas: ['Separate money borrowed from money lent.', 'Mark debts as fully paid.'],
  },
  {
    id: 8,
    title: 'Needs Wants Savings',
    theme: 'Classify spending using a simple money rule.',
    overview: 'Teach users to split spending into needs, wants, and savings.',
    features: [
      'Classify each expense as need, want, or savings.',
      'Calculate the percentage spent in each class.',
      'Compare spending with the 50-30-20 rule.',
      'Warn when wants are too high compared with needs.',
      'Print a simple text chart for the three classes.',
    ],
    stretchIdeas: ['Let users choose their own rule.', 'Suggest one area to reduce.'],
  },
  {
    id: 9,
    title: 'Spending Lock',
    theme: 'Protect a target balance.',
    overview: 'Warn users before their spending pushes them below a safe balance.',
    features: [
      'Set a minimum safe balance.',
      'Calculate how much the user can safely spend.',
      'Warn before adding an expense that breaks the safe balance.',
      'Create a daily spending limit from the safe balance.',
      'Allow the user to reset the safe balance target.',
    ],
    stretchIdeas: ['Add emergency expense override.', 'Show remaining safe spending for the week.'],
  },
  {
    id: 10,
    title: 'CSV Backup',
    theme: 'Move data in and out of the tracker.',
    overview: 'Add CSV import and export so transaction data can be opened in spreadsheet apps.',
    features: [
      'Export all transactions to a CSV file.',
      'Import transactions from a CSV file.',
      'Validate imported rows before saving them.',
      'Use a backup filename that includes the current date.',
      'Show how many records were imported or exported.',
    ],
    stretchIdeas: ['Skip duplicate imported rows.', 'Export only expenses or only income.'],
  },
  {
    id: 11,
    title: 'Monthly Report',
    theme: 'Prepare a clear report for one month.',
    overview: 'Generate a month report students can show during presentation.',
    features: [
      'Let the user choose a month to report on.',
      'Calculate income, expenses, and balance for that month.',
      'Find the biggest expense category for the month.',
      'Print an ASCII bar chart for category totals.',
      'Save the monthly report into a text file.',
    ],
    stretchIdeas: ['Compare two months.', 'Add best and worst spending days.'],
  },
  {
    id: 12,
    title: 'Smart Alerts',
    theme: 'Warn users about suspicious spending.',
    overview: 'Add alert messages that help users notice budget problems early.',
    features: [
      'Warn when balance becomes low.',
      'Detect possible duplicate expenses.',
      'Warn when one expense is unusually large.',
      'Warn when a category suddenly increases.',
      'Keep an alert history that the user can view.',
    ],
    stretchIdeas: ['Let the user choose alert limits.', 'Clear old alerts.'],
  },
  {
    id: 13,
    title: 'Group Ledger',
    theme: 'Track spending by group member.',
    overview: 'Useful if group members want to track who added which transaction.',
    features: [
      'Create a list of group member names.',
      'Tag each transaction with one member name.',
      'Show total expenses for each member.',
      'Find the member with the highest expense total.',
      'Print a member summary for presentation.',
    ],
    stretchIdeas: ['Add equal contribution check.', 'Filter transactions by member.'],
  },
  {
    id: 14,
    title: 'Mini Analytics',
    theme: 'Turn budget data into simple insights.',
    overview: 'Add beginner-friendly analytics that explain the user budget in plain English.',
    features: [
      'Show the top five highest expenses.',
      'Calculate the average expense amount.',
      'Calculate category percentages.',
      'Print an ASCII chart of category spending.',
      'Give a simple spending score with an explanation.',
    ],
    stretchIdeas: ['Show best saving week.', 'Suggest the category to reduce first.'],
  },
];

export function getGroupFeaturePack(groupId: number): GroupFeaturePack {
  const pack = groupFeaturePacks.find((group) => group.id === groupId);
  if (!pack) {
    throw new Error(`Unknown group id: ${groupId}`);
  }
  return pack;
}

export function getGroupFeaturePdfFilename(groupId: number): string {
  return `group-${groupId}-feature-pack.pdf`;
}

export function getGroupStarterKitFilename(groupId: number): string {
  return `group-${groupId}-budget-tracker-starter-kit.zip`;
}
