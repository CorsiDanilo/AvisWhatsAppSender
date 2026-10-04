import pytest
import os
import tempfile
import openpyxl
from src.app_ui import AvisWhatsAppApp

def test_app_ui_initialization():
    # Inizializza l'interfaccia (senza far partire il mainloop bloccante)
    app = AvisWhatsAppApp()
    try:
        assert app.title() == "AVIS WhatsApp Sender - Invio Assistito"
        assert app.excel_mgr is not None
        assert app.template_mgr is not None
        assert app.btn_load_excel is not None
        assert app.btn_dispatch is not None
        assert app.txt_message is not None
        
        # Verifica caricamento template iniziale
        current_tpl = app.tpl_menu.get()
        assert current_tpl != ""
        assert len(app.txt_message.get("1.0", "end")) > 5
    finally:
        app.destroy()
