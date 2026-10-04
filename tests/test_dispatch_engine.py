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
