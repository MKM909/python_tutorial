export type StarterFile = {
  path: string;
  content: string;
};

const referenceMain = `# Budget Tracker CLI
# Beginner-friendly class project template

import json

DATA_FILE = "budget_data.json"


def load_data():
    try:
        with open(DATA_FILE, "r") as file:
            return json.load(file)
    except FileNotFoundError:
        return {"income": [], "expenses": []}


def save_data(data):
    with open(DATA_FILE, "w") as file:
        json.dump(data, file, indent=4)
    print("Data saved successfully.")


def add_income(data):
    source = input("Enter income source: ")
    amount = float(input("Enter income amount: "))
    data["income"].append({"source": source, "amount": amount})
    print("Income added.")


def add_expense(data):
    category = input("Enter expense category: ")
    description = input("Enter expense description: ")
    amount = float(input("Enter expense amount: "))
    data["expenses"].append({
        "category": category,
        "description": description,
        "amount": amount
    })
    print("Expense added.")


def view_transactions(data):
    print("\\nIncome")
    for item in data["income"]:
        print(f"- {item['source']}: {item['amount']}")

    print("\\nExpenses")
    for item in data["expenses"]:
        print(f"- {item['category']} | {item['description']}: {item['amount']}")


def view_balance(data):
    total_income = sum(item["amount"] for item in data["income"])
    total_expenses = sum(item["amount"] for item in data["expenses"])
    balance = total_income - total_expenses
    print(f"Total income: {total_income}")
    print(f"Total expenses: {total_expenses}")
    print(f"Current balance: {balance}")


def main_menu():
    data = load_data()

    while True:
        print("\\n=== Budget Tracker ===")
        print("1. Add income")
        print("2. Add expense")
        print("3. View transactions")
        print("4. View balance")
        print("5. Save and exit")

        choice = input("Choose an option: ")

        if choice == "1":
            add_income(data)
        elif choice == "2":
            add_expense(data)
        elif choice == "3":
            view_transactions(data)
        elif choice == "4":
            view_balance(data)
        elif choice == "5":
            save_data(data)
            print("Goodbye.")
            break
        else:
            print("Invalid option. Try again.")


main_menu()
`;

const snippets: StarterFile[] = [
  {
    path: 'snippets/01_header.py',
    content: `# Budget Tracker CLI
# Put this at the top of main.py.

import json

DATA_FILE = "budget_data.json"
`,
  },
  {
    path: 'snippets/02_load_data.py',
    content: `def load_data():
    try:
        with open(DATA_FILE, "r") as file:
            return json.load(file)
    except FileNotFoundError:
        return {"income": [], "expenses": []}
`,
  },
  {
    path: 'snippets/03_save_data.py',
    content: `def save_data(data):
    with open(DATA_FILE, "w") as file:
        json.dump(data, file, indent=4)
    print("Data saved successfully.")
`,
  },
  {
    path: 'snippets/04_add_income.py',
    content: `def add_income(data):
    source = input("Enter income source: ")
    amount = float(input("Enter income amount: "))
    data["income"].append({"source": source, "amount": amount})
    print("Income added.")
`,
  },
  {
    path: 'snippets/05_add_expense.py',
    content: `def add_expense(data):
    category = input("Enter expense category: ")
    description = input("Enter expense description: ")
    amount = float(input("Enter expense amount: "))
    data["expenses"].append({
        "category": category,
        "description": description,
        "amount": amount
    })
    print("Expense added.")
`,
  },
  {
    path: 'snippets/06_view_transactions.py',
    content: `def view_transactions(data):
    print("\\nIncome")
    for item in data["income"]:
        print(f"- {item['source']}: {item['amount']}")

    print("\\nExpenses")
    for item in data["expenses"]:
        print(f"- {item['category']} | {item['description']}: {item['amount']}")
`,
  },
  {
    path: 'snippets/07_view_balance.py',
    content: `def view_balance(data):
    total_income = sum(item["amount"] for item in data["income"])
    total_expenses = sum(item["amount"] for item in data["expenses"])
    balance = total_income - total_expenses
    print(f"Total income: {total_income}")
    print(f"Total expenses: {total_expenses}")
    print(f"Current balance: {balance}")
`,
  },
  {
    path: 'snippets/08_main_menu.py',
    content: `def main_menu():
    data = load_data()

    while True:
        print("\\n=== Budget Tracker ===")
        print("1. Add income")
        print("2. Add expense")
        print("3. View transactions")
        print("4. View balance")
        print("5. Save and exit")

        choice = input("Choose an option: ")

        if choice == "1":
            add_income(data)
        elif choice == "2":
            add_expense(data)
        elif choice == "3":
            view_transactions(data)
        elif choice == "4":
            view_balance(data)
        elif choice == "5":
            save_data(data)
            print("Goodbye.")
            break
        else:
            print("Invalid option. Try again.")
`,
  },
  {
    path: 'snippets/09_start_app.py',
    content: `main_menu()
`,
  },
];

const nudgeGuide = `# Budget Tracker Nudge Guide

Use this only when your group is stuck. Try arranging the snippets first.

## Big idea

Python reads a file from top to bottom. Put imports and constants first. Then put helper functions. Put the menu near the bottom. Start the app last.

## Gentle order

1. Header and imports
2. Load existing data
3. Save data
4. Add income
5. Add expense
6. View transactions
7. View balance
8. Main menu
9. Start the app

## Run it

Open the folder in VS Code, then run:

\`\`\`bash
python main.py
\`\`\`

If Python says a function is not defined, check that the function appears above where it is called.
`;

const sampleData = `{
  "income": [
    { "source": "Allowance", "amount": 15000 },
    { "source": "Small business", "amount": 8000 }
  ],
  "expenses": [
    { "category": "Food", "description": "Lunch and snacks", "amount": 2500 },
    { "category": "Transport", "description": "Campus shuttle", "amount": 1200 },
    { "category": "Data", "description": "Internet bundle", "amount": 3000 }
  ]
}
`;

export function buildPythonStarterFiles(): StarterFile[] {
  return [
    { path: 'reference/main.py', content: referenceMain },
    ...snippets,
    { path: 'README_NUDGE.md', content: nudgeGuide },
    { path: 'sample_data/budget_data.json', content: sampleData },
  ];
}
