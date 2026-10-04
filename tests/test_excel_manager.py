import pytest
import os
import tempfile
import openpyxl
from src.excel_manager import clean_phone_number, DonorRecord, ExcelManager

def test_clean_phone_standard_italian():
    cleaned, valid = clean_phone_number("3331234567")
    assert valid is True
    assert cleaned == "393331234567"

def test_clean_phone_with_spaces_and_dashes():
    cleaned, valid = clean_phone_number("333 12-34-567")
    assert valid is True
    assert cleaned == "393331234567"

def test_clean_phone_with_plus_prefix():
    cleaned, valid = clean_phone_number("+39 340 1122334")
    assert valid is True
    assert cleaned == "393401122334"

def test_clean_phone_with_00_prefix():
    cleaned, valid = clean_phone_number("0039 340 1122334")
    assert valid is True
    assert cleaned == "393401122334"

def test_clean_phone_already_with_39():
    cleaned, valid = clean_phone_number("393331234567")
    assert valid is True
    assert cleaned == "393331234567"

def test_clean_phone_invalid_short():
    cleaned, valid = clean_phone_number("1234")
    assert valid is False
    assert cleaned == "1234"

def test_clean_phone_invalid_empty():
    cleaned, valid = clean_phone_number("")
    assert valid is False
    assert cleaned == ""

def test_clean_phone_none():
    cleaned, valid = clean_phone_number(None)
    assert valid is False
    assert cleaned == ""

def test_clean_phone_invalid_letters():
    cleaned, valid = clean_phone_number("non ha telefono")
    assert valid is False
    assert cleaned == "non ha telefono"


def test_excel_manager_load_and_mark_sent():
    # Creiamo un file excel temporaneo
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Donatori"
        # Scriviamo intestazioni case-insensitive e miste
        ws.append(["NOME", "Cognome", "Cellulare"])
        ws.append(["Mario", "Rossi", "333 1234567"])
        ws.append(["Luigi", "Verdi", "+393409876543"])
        ws.append(["Anna", "Bianchi", "non valido"])
        wb.save(tmp_path)
        wb.close()

        manager = ExcelManager()
        records = manager.load_file(tmp_path)

        assert len(records) == 3

        # Record 1: Mario
        assert records[0].row_idx == 2
        assert records[0].nome == "Mario"
        assert records[0].cognome == "Rossi"
        assert records[0].telefono_clean == "393331234567"
        assert records[0].is_valid is True
        assert records[0].inviato == "No"

        # Record 2: Luigi
        assert records[1].row_idx == 3
        assert records[1].nome == "Luigi"
        assert records[1].cognome == "Verdi"
        assert records[1].telefono_clean == "393409876543"
        assert records[1].is_valid is True

        # Record 3: Anna
        assert records[2].row_idx == 4
        assert records[2].is_valid is False

        # Verifica conteggi
        counts = manager.get_counts(records)
        assert counts["totale"] == 3
        assert counts["validi"] == 2
        assert counts["da_inviare"] == 2
        assert counts["inviati"] == 0

        # Segna come inviato il primo
        manager.mark_as_sent(tmp_path, row_idx=2, status="Sì")

        # Ricarica file e verifica persistenza
        updated_records = manager.load_file(tmp_path)
        assert updated_records[0].inviato == "Sì"
        new_counts = manager.get_counts(updated_records)
        assert new_counts["inviati"] == 1
        assert new_counts["da_inviare"] == 1

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
