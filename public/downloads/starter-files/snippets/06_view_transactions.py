def view_transactions(data):
    print("\nIncome")
    for item in data["income"]:
        print(f"- {item['source']}: {item['amount']}")

    print("\nExpenses")
    for item in data["expenses"]:
        print(f"- {item['category']} | {item['description']}: {item['amount']}")
