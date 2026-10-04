import openpyxl

def create_sample_excel(filename="donatori_esempio.xlsx"):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Donatori AVIS"

    headers = ["Nome", "Cognome", "Cellulare", "Data Ultima Donazione"]
    ws.append(headers)

    donors = [
        ["Mario", "Rossi", "333 1234567", "12/09/2026"],
        ["Luigi", "Verdi", "+39 340 9876543", "15/09/2026"],
        ["Giulia", "Bianchi", "3281122334", "18/09/2026"],
        ["Francesca", "Neri", "0039 347 5566778", "20/09/2026"]
    ]

    for d in donors:
        ws.append(d)

    wb.save(filename)
    print(f"File di esempio creato con successo: {filename}")

if __name__ == "__main__":
    create_sample_excel()
