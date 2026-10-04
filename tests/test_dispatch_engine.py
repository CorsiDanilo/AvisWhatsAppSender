import pytest
import os
import tempfile
import urllib.parse
from PIL import Image
from src.dispatch_engine import generate_whatsapp_url, copy_image_to_clipboard, open_whatsapp_chat

def test_generate_whatsapp_url_simple():
    url = generate_whatsapp_url("393331234567", "Ciao Mario!")
    assert url.startswith("https://web.whatsapp.com/send?")
    assert "phone=393331234567" in url
    assert "text=Ciao" in url

def test_generate_whatsapp_url_emojis_and_multiline():
    text = "Ciao Mario,\ngrazie per la donazione 🩸!\n*AVIS Comunale*"
    url = generate_whatsapp_url("393409988776", text)
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(parsed.query)
    
    assert params["phone"][0] == "393409988776"
    assert params["text"][0] == text

def test_copy_image_to_clipboard_valid_image():
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        # Crea un'immagine di test 100x100 rossa
        img = Image.new("RGB", (100, 100), color="red")
        img.save(tmp_path, "PNG")

        result = copy_image_to_clipboard(tmp_path)
        assert result is True
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def test_copy_image_to_clipboard_invalid_file():
    result = copy_image_to_clipboard("percorso_che_non_esiste_12345.png")
    assert result is False

def test_open_whatsapp_chat_dry_run():
    # browser_open=False per non aprire finestre reali durante i test
    url = open_whatsapp_chat("393331122334", "Test messaggio", open_browser=False)
    assert url.startswith("https://web.whatsapp.com/send?phone=393331122334")

def test_copy_text_to_clipboard():
    from src.dispatch_engine import copy_text_to_clipboard
    res = copy_text_to_clipboard("https://web.whatsapp.com/test_123")
    assert res is True

def test_execute_autopilot_step_text_and_image():
    from src.dispatch_engine import execute_autopilot_step
    events = []

    def mock_open(phone, text):
        events.append(f"open:{phone}:{text}")
        return "url"

    def mock_copy_img(path):
        events.append(f"copy_img:{path}")
        return True

    def mock_copy_text(text):
        events.append(f"copy_text:{text}")
        return True

    def mock_paste():
        events.append("paste")

    def mock_enter():
        events.append("enter")

    def mock_sleep(s):
        events.append(f"sleep:{s}")

    success = execute_autopilot_step(
        phone="393331234567",
        text="Ciao Mario",
        image_path="test.png",
        page_wait_s=5.0,
        action_delay_s=1.5,
        is_first=False,
        reuse_tab=False,
        cancel_check=lambda: False,
        open_browser_fn=mock_open,
        copy_img_fn=mock_copy_img,
        copy_text_fn=mock_copy_text,
        paste_fn=mock_paste,
        enter_fn=mock_enter,
        sleep_fn=mock_sleep
    )

    assert success is True
    # Con immagine: l'URL NON ha testo (per evitare messaggi separati o bozze),
    # l'immagine viene incollata, il testo viene incollato come DIDASCALIA nella foto,
    # e Invio spedisce la foto con didascalia in un UNICO messaggio!
    assert events == [
        "open:393331234567:",
        "sleep:5.0",
        "copy_img:test.png",
        "paste",
        "sleep:1.5",
        "copy_text:Ciao Mario",
        "paste",
        "sleep:0.5",
        "enter",
        "sleep:1.0"
    ]

def test_execute_autopilot_step_first_donor_warmup():
    from src.dispatch_engine import execute_autopilot_step
    events = []

    def mock_open(phone, text):
        events.append(f"open:{phone}")
        return "url"

    def mock_enter():
        events.append("enter")

    def mock_sleep(s):
        events.append(f"sleep:{s}")

    success = execute_autopilot_step(
        phone="393331234567",
        text="Primo donatore",
        image_path=None,
        page_wait_s=6.0,
        action_delay_s=1.0,
        is_first=True,  # Primo donatore: warmup extra di +5 secondi
        cancel_check=lambda: False,
        open_browser_fn=mock_open,
        enter_fn=mock_enter,
        sleep_fn=mock_sleep
    )

    assert success is True
    # 6.0 + 5.0 = 11.0s di attesa iniziale
    assert events[0] == "open:393331234567"
    assert events[1] == "sleep:11.0"

def test_execute_autopilot_step_reuse_tab():
    from src.dispatch_engine import execute_autopilot_step
    events = []

    def mock_focus():
        events.append("focus_browser")
        return True

    def mock_navigate(url):
        events.append(f"navigate:{url}")

    def mock_enter():
        events.append("enter")

    def mock_sleep(s):
        events.append(f"sleep:{s}")

    success = execute_autopilot_step(
        phone="393339999999",
        text="Secondo donatore",
        image_path=None,
        page_wait_s=5.0,
        action_delay_s=1.0,
        is_first=False,
        reuse_tab=True,  # Riutilizza la stessa scheda
        cancel_check=lambda: False,
        focus_browser_fn=mock_focus,
        navigate_tab_fn=mock_navigate,
        enter_fn=mock_enter,
        sleep_fn=mock_sleep
    )

    assert success is True
    assert events[0] == "focus_browser"
    assert events[1].startswith("navigate:https://web.whatsapp.com/send?phone=393339999999")
    assert events[2] == "sleep:5.0"
    assert "enter" in events

def test_execute_autopilot_step_text_only():
    from src.dispatch_engine import execute_autopilot_step
    events = []

    def mock_open(phone, text):
        events.append(f"open:{phone}:{text}")
        return "url"

    def mock_enter():
        events.append("enter")

    def mock_sleep(s):
        events.append(f"sleep:{s}")

    success = execute_autopilot_step(
        phone="393331234567",
        text="Ciao Mario",
        image_path=None,
        page_wait_s=4.0,
        action_delay_s=1.0,
        is_first=False,
        reuse_tab=False,
        cancel_check=lambda: False,
        open_browser_fn=mock_open,
        enter_fn=mock_enter,
        sleep_fn=mock_sleep
    )

    assert success is True
    assert events == [
        "open:393331234567:Ciao Mario",
        "sleep:4.0",
        "enter",
        "sleep:1.0"
    ]

def test_execute_autopilot_step_cancelled_early():
    from src.dispatch_engine import execute_autopilot_step
    events = []

    cancel_calls = [0]
    def mock_cancel():
        cancel_calls[0] += 1
        return cancel_calls[0] >= 2

    def mock_open(phone, text):
        events.append("open")
        return "url"

    def mock_enter():
        events.append("enter")

    def mock_sleep(s):
        events.append(f"sleep:{s}")

    success = execute_autopilot_step(
        phone="393331234567",
        text="Ciao Mario",
        image_path=None,
        page_wait_s=4.0,
        action_delay_s=1.0,
        is_first=False,
        reuse_tab=False,
        cancel_check=mock_cancel,
        open_browser_fn=mock_open,
        enter_fn=mock_enter,
        sleep_fn=mock_sleep
    )

    assert success is False
    assert "enter" not in events


