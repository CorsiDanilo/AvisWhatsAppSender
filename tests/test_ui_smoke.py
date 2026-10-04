import pytest
import os
import tempfile
import openpyxl
from src.app_ui import AvisWhatsAppApp

def test_app_ui_initialization_and_reset():
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

        # Simula modifiche allo stato
        app.current_excel_path = "fittizio.xlsx"
        app.current_log_path = "fittizio_log.xlsx"
        app.current_image_path = "fittizio.png"
        app.current_index = 5
        app.waiting_for_next_confirm = True
        app.lbl_excel_path.configure(text="fittizio.xlsx")
        app.lbl_img_path.configure(text="fittizio.png")
        app.txt_message.delete("1.0", "end")
        app.txt_message.insert("1.0", "Testo modificato a mano")

        # Esegue reset
        app.reset_application_state(confirm=False)

        # Verifica stato ripristinato
        assert app.current_excel_path is None
        assert app.current_log_path is None
        assert app.current_image_path is None
        assert app.records == []
        assert app.current_index == 0
        assert app.waiting_for_next_confirm is False
        assert "Nessun file Excel" in app.lbl_excel_path.cget("text")
        assert "Nessuna immagine" in app.lbl_img_path.cget("text")
        assert app.progress_bar.get() == 0
        # Verifica presenza pulsante guida e apertura modale
        assert hasattr(app, "btn_guide")
        guide_win = app._show_guide_window()
        assert guide_win is not None
        guide_win.destroy()
    finally:
        app.destroy()


