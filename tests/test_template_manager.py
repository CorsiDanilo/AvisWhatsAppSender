import pytest
import os
import tempfile
from src.template_manager import render_template, TemplateManager

def test_render_template_placeholders():
    tpl = "Ciao [nome] [cognome], grazie per la donazione!"
    result = render_template(tpl, nome="mario", cognome="rossi")
    assert result == "Ciao Mario Rossi, grazie per la donazione!"

def test_render_template_case_insensitive_tags():
    tpl = "Gentile [NOME], AVIS ti ringrazia."
    result = render_template(tpl, nome="GIUSEPPE", cognome="VERDI")
    assert result == "Gentile Giuseppe, AVIS ti ringrazia."

def test_render_template_no_placeholders():
    tpl = "Gentile donatore, domenica raccolta sangue straordinaria."
    result = render_template(tpl, nome="Mario", cognome="Rossi")
    assert result == "Gentile donatore, domenica raccolta sangue straordinaria."

def test_render_template_empty_or_none_values():
    tpl = "Ciao [nome], benvenuto!"
    result = render_template(tpl, nome="", cognome="")
    assert result == "Ciao , benvenuto!"

def test_template_manager_default_templates_and_crud():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        # Se il file non esiste, crea i default
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

        manager = TemplateManager(filepath=tmp_path)
        templates = manager.load_templates()

        assert "Ringraziamento Donazione" in templates
        assert "[nome]" in templates["Ringraziamento Donazione"]

        # Aggiungi un nuovo modello
        manager.save_template("Avviso Chiusura", "Attenzione, la sede AVIS rimarrà chiusa per festività.")

        # Ricarica e verifica
        reloaded = manager.load_templates()
        assert "Avviso Chiusura" in reloaded
        assert reloaded["Avviso Chiusura"] == "Attenzione, la sede AVIS rimarrà chiusa per festività."

        # Cancella un modello
        manager.delete_template("Avviso Chiusura")
        final = manager.load_templates()
        assert "Avviso Chiusura" not in final

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
