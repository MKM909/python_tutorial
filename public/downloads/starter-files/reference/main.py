# Budget Tracker CLI
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
    print("\nIncome")
    for item in data["income"]:
        print(f"- {item['source']}: {item['amount']}")

    print("\nExpenses")
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
        print("\n=== Budget Tracker ===")
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
