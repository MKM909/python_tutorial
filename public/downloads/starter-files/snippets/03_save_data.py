def save_data(data):
    with open(DATA_FILE, "w") as file:
        json.dump(data, file, indent=4)
    print("Data saved successfully.")
