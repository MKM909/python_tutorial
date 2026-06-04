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
