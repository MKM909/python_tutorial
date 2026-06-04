def add_income(data):
    source = input("Enter income source: ")
    amount = float(input("Enter income amount: "))
    data["income"].append({"source": source, "amount": amount})
    print("Income added.")
