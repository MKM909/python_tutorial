def view_balance(data):
    total_income = sum(item["amount"] for item in data["income"])
    total_expenses = sum(item["amount"] for item in data["expenses"])
    balance = total_income - total_expenses
    print(f"Total income: {total_income}")
    print(f"Total expenses: {total_expenses}")
    print(f"Current balance: {balance}")
