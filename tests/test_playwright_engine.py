import os
from unittest.mock import MagicMock, patch
import pytest

from src.playwright_engine import WhatsAppBrowserController, DEFAULT_SESSION_DIR, WHATSAPP_WEB_URL


def test_controller_default_session_dir():
    controller = WhatsAppBrowserController()
    local_app_data = os.getenv("LOCALAPPDATA", os.path.expanduser("~"))
    expected_path = os.path.join(local_app_data, "AvisWhatsAppSender", "edge_session")
    assert controller.session_dir == expected_path
    assert DEFAULT_SESSION_DIR == expected_path


def test_controller_custom_session_dir():
    custom_dir = r"C:\custom_sessions\avis"
    controller = WhatsAppBrowserController(session_dir=custom_dir)
    assert controller.session_dir == custom_dir


def test_controller_initial_state():
    controller = WhatsAppBrowserController(headless=True)
    assert controller.headless is True
    assert controller.playwright_instance is None
    assert controller.context is None
    assert controller.page is None
    assert controller.is_running is False
    assert WHATSAPP_WEB_URL == "https://web.whatsapp.com"


def test_controller_methods_exist():
    controller = WhatsAppBrowserController()
    assert hasattr(controller, "ensure_browser")
    assert hasattr(controller, "check_auth_status")
    assert hasattr(controller, "open_chat")
    assert hasattr(controller, "send_message")
    assert hasattr(controller, "close")


def test_check_auth_status_not_connected():
    controller = WhatsAppBrowserController()
    assert controller.check_auth_status() == "not_connected"

    # Quando contesto e pagina esistono ma page.is_closed() è True
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = True
    controller.page = mock_page
    assert controller.check_auth_status() == "not_connected"


def test_check_auth_status_authenticated():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.query_selector.side_effect = lambda sel: MagicMock() if sel == "#pane-side" else None
    controller.page = mock_page

    assert controller.check_auth_status(timeout_ms=50) == "authenticated"
    mock_page.query_selector.assert_any_call("#pane-side")


def test_check_auth_status_qr_required():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.query_selector.side_effect = lambda sel: MagicMock() if sel == "canvas[aria-label]" else None
    controller.page = mock_page

    assert controller.check_auth_status(timeout_ms=50) == "qr_required"


def test_check_auth_status_loading():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.query_selector.side_effect = lambda sel: MagicMock() if sel == "progress" else None
    controller.page = mock_page

    assert controller.check_auth_status(timeout_ms=50) == "loading"


@patch("src.playwright_engine.sync_playwright")
def test_ensure_browser_launches_and_navigates(mock_sync_playwright):
    mock_playwright = MagicMock()
    mock_sync_playwright.return_value.start.return_value = mock_playwright
    mock_context = MagicMock()
    mock_playwright.chromium.launch_persistent_context.return_value = mock_context
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.url = "about:blank"
    mock_context.pages = [mock_page]

    controller = WhatsAppBrowserController()
    success = controller.ensure_browser()

    assert success is True
    assert controller.is_running is True
    assert controller.context == mock_context
    assert controller.page == mock_page
    mock_playwright.chromium.launch_persistent_context.assert_called_once_with(
        user_data_dir=controller.session_dir,
        channel="msedge",
        headless=False,
        args=["--start-maximized"],
    )
    mock_page.goto.assert_called_once_with(WHATSAPP_WEB_URL)

    # Invocazione successiva quando è già in esecuzione: ritorna True senza riavviare
    mock_playwright.chromium.launch_persistent_context.reset_mock()
    assert controller.ensure_browser() is True
    mock_playwright.chromium.launch_persistent_context.assert_not_called()


@patch("src.playwright_engine.sync_playwright")
def test_ensure_browser_fallback_to_standard_chromium(mock_sync_playwright):
    mock_playwright = MagicMock()
    mock_sync_playwright.return_value.start.return_value = mock_playwright
    mock_context = MagicMock()
    # Il primo avvio con channel='msedge' fallisce, il secondo ha successo
    mock_playwright.chromium.launch_persistent_context.side_effect = [
        Exception("Edge not installed"),
        mock_context,
    ]
    mock_context.pages = []
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.url = WHATSAPP_WEB_URL
    mock_context.new_page.return_value = mock_page

    controller = WhatsAppBrowserController()
    success = controller.ensure_browser()

    assert success is True
    assert controller.context == mock_context
    assert controller.page == mock_page
    assert mock_playwright.chromium.launch_persistent_context.call_count == 2
    # Verifica che il secondo tentativo sia senza channel='msedge'
    mock_playwright.chromium.launch_persistent_context.assert_called_with(
        user_data_dir=controller.session_dir,
        headless=False,
        args=["--start-maximized"],
    )


def test_close_cleans_up():
    controller = WhatsAppBrowserController()
    mock_pw = MagicMock()
    mock_context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False

    controller.playwright_instance = mock_pw
    controller.context = mock_context
    controller.page = mock_page
    assert controller.is_running is True

    controller.close()

    mock_page.close.assert_called_once()
    mock_context.close.assert_called_once()
    mock_pw.stop.assert_called_once()
    assert controller.page is None
    assert controller.context is None
    assert controller.playwright_instance is None
    assert controller.is_running is False


@patch("src.playwright_engine.sync_playwright")
def test_ensure_browser_failure_returns_false(mock_sync_playwright):
    mock_playwright = MagicMock()
    mock_sync_playwright.return_value.start.return_value = mock_playwright
    mock_playwright.chromium.launch_persistent_context.side_effect = Exception("Fatal launch failure")

    controller = WhatsAppBrowserController()
    success = controller.ensure_browser()

    assert success is False
    assert controller.is_running is False


def test_check_auth_status_unknown_when_no_match():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.query_selector.return_value = None
    controller.page = mock_page

    assert controller.check_auth_status(timeout_ms=10) == "unknown"


def test_open_chat_not_connected():
    controller = WhatsAppBrowserController()
    assert controller.open_chat("393331234567") == "not_connected"

    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = True
    controller.page = mock_page
    assert controller.open_chat("393331234567") == "not_connected"


def test_open_chat_empty_phone():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    controller.page = mock_page

    assert controller.open_chat("") == "invalid_number"
    assert controller.open_chat("  - / () ") == "invalid_number"
    assert controller.open_chat(None) == "invalid_number"
    mock_page.goto.assert_not_called()


def test_open_chat_ready():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False

    mock_chat_input = MagicMock()
    mock_chat_input.is_visible.return_value = True

    def query_selector_mock(selector):
        if selector == 'footer div[contenteditable="true"]':
            return mock_chat_input
        return None

    mock_page.query_selector.side_effect = query_selector_mock
    controller.page = mock_page

    res = controller.open_chat("+39 333-123.4567", timeout_ms=100)

    assert res == "ready"
    mock_page.goto.assert_called_once_with(
        "https://web.whatsapp.com/send?phone=393331234567",
        timeout=100,
    )


def test_open_chat_invalid_number_modal():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False

    mock_dialog = MagicMock()
    mock_dialog.is_visible.return_value = True
    mock_dialog.inner_text.return_value = "Il numero di telefono condiviso tramite URL non è valido."

    mock_ok_button = MagicMock()
    mock_ok_button.inner_text.return_value = "OK"
    mock_dialog.query_selector_all.return_value = [mock_ok_button]

    def query_selector_mock(selector):
        if selector == 'div[role="dialog"]':
            return mock_dialog
        return None

    mock_page.query_selector.side_effect = query_selector_mock
    controller.page = mock_page

    res = controller.open_chat("393339999999", timeout_ms=100)

    assert res == "invalid_number"
    mock_page.goto.assert_called_once_with(
        "https://web.whatsapp.com/send?phone=393339999999",
        timeout=100,
    )
    mock_ok_button.click.assert_called_once()


def test_open_chat_invalid_number_modal_dismissed_with_escape():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False

    mock_dialog = MagicMock()
    mock_dialog.is_visible.return_value = True
    mock_dialog.inner_text.return_value = "Phone number is not on WhatsApp."
    mock_dialog.query_selector_all.return_value = []

    mock_page.query_selector.side_effect = lambda sel: mock_dialog if sel == 'div[role="dialog"]' else None
    controller.page = mock_page

    res = controller.open_chat("393338888888", timeout_ms=100)

    assert res == "invalid_number"
    mock_page.keyboard.press.assert_called_once_with("Escape")


def test_open_chat_timeout_returns_error():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.query_selector.return_value = None
    controller.page = mock_page

    res = controller.open_chat("393331234567", timeout_ms=50)

    assert res == "error"
    mock_page.goto.assert_called_once_with(
        "https://web.whatsapp.com/send?phone=393331234567",
        timeout=50,
    )


def test_open_chat_goto_exception_returns_error():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.goto.side_effect = Exception("Page crashed")
    controller.page = mock_page

    res = controller.open_chat("393331234567", timeout_ms=50)
    assert res == "error"


def test_send_message_not_connected():
    controller = WhatsAppBrowserController()
    assert controller.send_message("Ciao") is False

    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = True
    controller.page = mock_page
    assert controller.send_message("Ciao") is False


def test_send_message_empty_text_and_no_image():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    controller.page = mock_page

    assert controller.send_message("") is False
    assert controller.send_message("   ") is False
    assert controller.send_message(None) is False
    assert controller.send_message("", None) is False


def test_send_message_text_only_success():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False

    mock_chat_input = MagicMock()
    mock_chat_input.is_visible.return_value = True

    mock_send_button = MagicMock()

    def query_selector_mock(selector):
        if selector == 'footer div[contenteditable="true"]':
            return mock_chat_input
        if selector == 'span[data-icon="send"]':
            return mock_send_button
        return None

    mock_page.query_selector.side_effect = query_selector_mock
    controller.page = mock_page

    success = controller.send_message("Messaggio di test AVIS", timeout_ms=500)

    assert success is True
    mock_chat_input.fill.assert_called_once_with("Messaggio di test AVIS")
    mock_send_button.click.assert_called_once()


def test_send_message_with_image_and_caption_success(tmp_path):
    dummy_img = tmp_path / "locandina.jpg"
    dummy_img.write_bytes(b"\xFF\xD8\xFF\xE0dummy_jpeg_data")

    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False

    mock_file_input = MagicMock()
    mock_dialog = MagicMock()
    mock_dialog.is_visible.return_value = True
    mock_caption_box = MagicMock()
    mock_send_button = MagicMock()

    def dialog_query_selector_mock(selector):
        if "contenteditable" in selector:
            return mock_caption_box
        if "send" in selector:
            return mock_send_button
        return None

    mock_dialog.query_selector.side_effect = dialog_query_selector_mock

    def page_query_selector_mock(selector):
        if "input" in selector:
            return mock_file_input
        if "dialog" in selector:
            return mock_dialog
        if "send" in selector:
            return mock_send_button
        return None

    mock_page.query_selector.side_effect = page_query_selector_mock
    controller.page = mock_page

    success = controller.send_message(
        text="Didascalia donazione",
        image_path=str(dummy_img),
        timeout_ms=500,
    )

    assert success is True
    mock_file_input.set_input_files.assert_called_once_with(os.path.abspath(str(dummy_img)))
    mock_caption_box.fill.assert_called_once_with("Didascalia donazione")
    mock_send_button.click.assert_called_once()


def test_send_message_with_image_nonexistent_file_falls_back_or_handles():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False

    mock_chat_input = MagicMock()
    mock_chat_input.is_visible.return_value = True
    mock_page.query_selector.side_effect = lambda sel: mock_chat_input if "contenteditable" in sel else None
    controller.page = mock_page

    nonexistent_path = r"C:\fake_nonexistent_path_avis_12345.jpg"
    success = controller.send_message(
        text="Messaggio fallback",
        image_path=nonexistent_path,
        timeout_ms=500,
    )
    assert success is True
    mock_chat_input.fill.assert_called_once_with("Messaggio fallback")
    mock_page.keyboard.press.assert_called_once_with("Enter")

    assert controller.send_message("", image_path=nonexistent_path) is False


def test_send_message_exception_returns_false():
    controller = WhatsAppBrowserController()
    controller.context = MagicMock()
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.query_selector.side_effect = Exception("Errore imprevisto DOM")
    controller.page = mock_page

    assert controller.send_message("Test crash") is False


def test_is_running_when_context_is_closed():
    controller = WhatsAppBrowserController()
    mock_context = MagicMock()
    mock_context.is_closed.return_value = True
    mock_page = MagicMock()
    mock_page.is_closed.return_value = False

    controller.context = mock_context
    controller.page = mock_page
    assert controller.is_running is False


def test_on_context_closed_cleans_up_and_calls_callback():
    callback = MagicMock()
    controller = WhatsAppBrowserController(on_close_callback=callback)
    controller.context = MagicMock()
    controller.page = MagicMock()

    controller._on_context_closed()

    assert controller.context is None
    assert controller.page is None
    callback.assert_called_once()


@patch("src.playwright_engine.sync_playwright")
def test_ensure_browser_recovers_after_browser_closed_by_user(mock_sync_playwright):
    mock_playwright = MagicMock()
    mock_sync_playwright.return_value.start.return_value = mock_playwright

    # Contesto vecchio (chiuso dall'utente)
    old_context = MagicMock()
    old_context.is_closed.return_value = True
    old_page = MagicMock()
    old_page.is_closed.return_value = True

    # Nuovo contesto che verrà aperto al relaunch
    new_context = MagicMock()
    new_context.is_closed.return_value = False
    new_page = MagicMock()
    new_page.is_closed.return_value = False
    new_page.url = WHATSAPP_WEB_URL
    new_context.pages = [new_page]

    mock_playwright.chromium.launch_persistent_context.return_value = new_context

    controller = WhatsAppBrowserController()
    controller.playwright_instance = mock_playwright
    controller.context = old_context
    controller.page = old_page

    success = controller.ensure_browser()

    assert success is True
    assert controller.context == new_context
    assert controller.page == new_page
    mock_playwright.chromium.launch_persistent_context.assert_called_once()
