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
