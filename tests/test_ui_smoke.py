import pytest
import os
import tempfile
import time
from unittest.mock import MagicMock, patch
import openpyxl
from src.app_ui import AvisWhatsAppApp
from src.playwright_engine import WhatsAppBrowserController
from src.excel_manager import DonorRecord

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

        # Verifica controller browser Playwright e controlli header
        assert hasattr(app, "browser_controller")
        assert isinstance(app.browser_controller, WhatsAppBrowserController)
        assert hasattr(app, "btn_connect_wa") and app.btn_connect_wa is not None
        assert hasattr(app, "lbl_wa_status") and app.lbl_wa_status is not None
        assert "Connetti WhatsApp" in app.btn_connect_wa.cget("text")
        assert "Non connesso" in app.lbl_wa_status.cget("text")
        
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
        app.lbl_wa_status.configure(text="🟢 WhatsApp Connesso", text_color="#28a745")
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
        assert "Non connesso" in app.lbl_wa_status.cget("text")
        assert app.progress_bar.get() == 0
        # Verifica presenza pulsante guida e apertura modale
        assert hasattr(app, "btn_guide")
        guide_win = app._show_guide_window()
        assert guide_win is not None
        guide_win.destroy()
    finally:
        app.destroy()


def test_app_window_closing_closes_controller():
    app = AvisWhatsAppApp()
    app.browser_controller = MagicMock()
    with patch.object(app, "destroy", wraps=app.destroy) as mock_destroy:
        app._on_window_closing()
        app.browser_controller.close.assert_called_once()
        mock_destroy.assert_called_once()


def test_on_click_connect_wa_authenticated():
    app = AvisWhatsAppApp()
    try:
        app.browser_controller = MagicMock()
        app.browser_controller.ensure_browser.return_value = True
        app.browser_controller.check_auth_status.return_value = "authenticated"

        app._on_click_connect_wa()

        for _ in range(20):
            app.update()
            if "WhatsApp Connesso" in app.lbl_wa_status.cget("text"):
                break
            time.sleep(0.05)

        assert "WhatsApp Connesso" in app.lbl_wa_status.cget("text")
    finally:
        app.destroy()


def test_on_click_connect_wa_qr_required():
    app = AvisWhatsAppApp()
    try:
        app.browser_controller = MagicMock()
        app.browser_controller.ensure_browser.return_value = True
        app.browser_controller.check_auth_status.return_value = "qr_required"

        app._on_click_connect_wa()

        for _ in range(20):
            app.update()
            if "Inquadra QR Code" in app.lbl_wa_status.cget("text"):
                break
            time.sleep(0.05)

        assert "Inquadra QR Code" in app.lbl_wa_status.cget("text")
    finally:
        app.destroy()


def test_manual_dispatch_prepare_ready_and_confirm_send():
    app = AvisWhatsAppApp()
    try:
        app.browser_controller = MagicMock()
        app.browser_controller.is_running = True
        app.browser_controller.open_chat.return_value = "ready"
        app.browser_controller.send_message.return_value = True

        app.records = [
            DonorRecord(row_idx=2, nome="Mario", cognome="Rossi", telefono_raw="333111", telefono_clean="39333111", inviato="No", is_valid=True)
        ]
        app.current_index = 0
        app.current_excel_path = "dummy.xlsx"
        app.excel_mgr.mark_as_sent = MagicMock()

        # Step 1: Prepara donatore
        t1 = app._on_dispatch_step()
        if t1:
            t1.join(timeout=1.0)
        app.update()

        assert app.waiting_for_next_confirm is True
        assert "CONFERMA E INVIA" in app.btn_dispatch.cget("text")
        assert app.browser_controller.open_chat.called

        # Step 2: Conferma e invia
        t2 = app._on_dispatch_step()
        if t2:
            t2.join(timeout=1.0)
        app.update()

        assert app.waiting_for_next_confirm is False
        assert app.records[0].inviato == "Sì"
        assert app.current_index == 1
        app.browser_controller.send_message.assert_called_once()
        app.excel_mgr.mark_as_sent.assert_called_with("dummy.xlsx", 2, status="Sì")
    finally:
        app.destroy()


@patch("src.app_ui.messagebox.showwarning")
def test_manual_dispatch_prepare_invalid_number(mock_showwarning):
    app = AvisWhatsAppApp()
    try:
        app.browser_controller = MagicMock()
        app.browser_controller.is_running = True
        app.browser_controller.open_chat.return_value = "invalid_number"

        app.records = [
            DonorRecord(row_idx=2, nome="Mario", cognome="Rossi", telefono_raw="333111", telefono_clean="39333111", inviato="No", is_valid=True)
        ]
        app.current_index = 0
        app.current_excel_path = "dummy.xlsx"
        app.excel_mgr.mark_as_sent = MagicMock()

        t = app._on_dispatch_step()
        if t:
            t.join(timeout=1.0)
        app.update()

        assert app.waiting_for_next_confirm is False
        assert app.records[0].inviato == "Saltato (Non su WhatsApp)"
        assert app.current_index == 1
        app.excel_mgr.mark_as_sent.assert_called_with("dummy.xlsx", 2, status="Saltato (Non su WhatsApp)")
        mock_showwarning.assert_called_once()
    finally:
        app.destroy()


@patch("src.app_ui.time.sleep")
@patch("src.app_ui.messagebox.showinfo")
def test_autopilot_worker_flow(mock_showinfo, mock_sleep):
    app = AvisWhatsAppApp()
    try:
        app.browser_controller = MagicMock()
        app.browser_controller.ensure_browser.return_value = True
        app.browser_controller.check_auth_status.return_value = "authenticated"
        # Primo donatore pronto, secondo donatore numero non valido
        app.browser_controller.open_chat.side_effect = ["ready", "invalid_number"]
        app.browser_controller.send_message.return_value = True

        app.records = [
            DonorRecord(row_idx=2, nome="Mario", cognome="Rossi", telefono_raw="333111", telefono_clean="39333111", inviato="No", is_valid=True),
            DonorRecord(row_idx=3, nome="Luigi", cognome="Verdi", telefono_raw="333222", telefono_clean="39333222", inviato="No", is_valid=True),
        ]
        app.current_index = 0
        app.current_excel_path = "dummy.xlsx"
        app.excel_mgr.mark_as_sent = MagicMock()
        app.autopilot_running = True
        app.autopilot_cancel_requested = False

        app._autopilot_worker(page_wait=0.01, anti_ban_delay=0.01, reuse_tab=True)
        app.update()

        assert app.records[0].inviato == "Sì"
        assert app.records[1].inviato == "Saltato (Non su WhatsApp)"
        assert app.current_index == 2
        assert app.autopilot_running is False
        mock_showinfo.assert_called_once()
    finally:
        app.destroy()


def test_on_browser_closed_by_user_updates_ui():
    app = AvisWhatsAppApp()
    try:
        app.lbl_wa_status.configure(text="🟢 WhatsApp Connesso")
        app.btn_connect_wa.configure(text="🌐 Mostra WhatsApp Web")

        app._on_browser_closed_by_user()
        app.update()

        assert "Non connesso" in app.lbl_wa_status.cget("text")
        assert "Connetti WhatsApp Web" in app.btn_connect_wa.cget("text")
    finally:
        app.destroy()
