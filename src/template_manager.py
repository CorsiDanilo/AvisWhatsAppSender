import json
import os
import re
from typing import Optional

DEFAULT_TEMPLATES = {
    "Ringraziamento Donazione": (
        "Ciao [nome],\n"
        "*AVIS Comunale* ti ringrazia di cuore per la tua donazione 🩸\n"
        "Il tuo gesto è *prezioso*!\n\n"
        "Salva questo numero per rimanere sempre in contatto con noi su WhatsApp.\n"
        "A presto!"
    ),
    "Promemoria Donazione": (
        "Gentile [nome],\n"
        "ti ricordiamo che domani è prevista la tua donazione di sangue presso la nostra sede.\n"
        "Ricorda di fare una colazione leggera senza latte o derivati!\n"
        "Ti aspettiamo 🩸"
    ),
    "Comunicazione Generale": (
        "Gentile donatore,\n"
        "ti informiamo che domenica si terrà una raccolta straordinaria di sangue.\n"
        "Se puoi donare, contattaci per prenotare il tuo orario!\n"
        "*AVIS Comunale*"
    )
}

def render_template(template: str, nome: Optional[str] = "", cognome: Optional[str] = "") -> str:
    """
    Sostituisce i segnaposto [nome] e [cognome] nel testo del template.
    I valori vengono formattati con iniziale maiuscola (.title()).
    Supporta tag case-insensitive (es. [NOME], [nome], [Nome]).
    """
    if template is None:
        return ""

    nome_clean = (str(nome).strip().title()) if nome else ""
    cognome_clean = (str(cognome).strip().title()) if cognome else ""

    result = template
    # Sostituzione case-insensitive di [nome]
    result = re.sub(r"\[nome\]", nome_clean, result, flags=re.IGNORECASE)
    # Sostituzione case-insensitive di [cognome]
    result = re.sub(r"\[cognome\]", cognome_clean, result, flags=re.IGNORECASE)

    return result


class TemplateManager:
    """Gestisce il caricamento, salvataggio e cancellazione dei modelli di messaggio su file JSON."""

    def __init__(self, filepath: str = "modelli.json"):
        self.filepath = filepath

    def load_templates(self) -> dict[str, str]:
        """Carica i modelli dal file JSON; se non esiste, scrive i default e li restituisce."""
        if not os.path.exists(self.filepath):
            self._save_to_disk(DEFAULT_TEMPLATES)
            return dict(DEFAULT_TEMPLATES)

        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
                return dict(DEFAULT_TEMPLATES)
        except Exception:
            return dict(DEFAULT_TEMPLATES)

    def save_template(self, name: str, text: str) -> None:
        """Salva o aggiorna un modello con il nome specificato."""
        templates = self.load_templates()
        templates[name.strip()] = text.strip()
        self._save_to_disk(templates)

    def delete_template(self, name: str) -> bool:
        """Elimina un modello con il nome specificato."""
        templates = self.load_templates()
        if name in templates:
            del templates[name]
            self._save_to_disk(templates)
            return True
        return False

    def _save_to_disk(self, data: dict[str, str]) -> None:
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
