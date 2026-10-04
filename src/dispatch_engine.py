import io
import os
import time
import urllib.parse
import webbrowser
from typing import Optional
from PIL import Image

try:
    import win32clipboard
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False


def generate_whatsapp_url(phone: str, text: str) -> str:
    """
    Costruisce l'URL ufficiale per WhatsApp Web con numero e testo codificato in URL.
    """
    clean_phone = "".join(filter(str.isdigit, str(phone or "")))
    encoded_text = urllib.parse.quote(text or "", safe="")
    return f"https://web.whatsapp.com/send?phone={clean_phone}&text={encoded_text}"


def copy_image_to_clipboard(image_path: str) -> bool:
    """
    Converte l'immagine indicata in formato bitmap CF_DIB
    e la copia negli appunti di sistema di Windows.
    Restituisce True in caso di successo, False altrimenti.
    """
    if not image_path or not os.path.exists(image_path):
        return False

    if not HAS_WIN32:
        return False

    try:
        with Image.open(image_path) as img:
            output = io.BytesIO()
            # Converte in RGB e salva come BMP
            img.convert("RGB").save(output, format="BMP")
            data = output.getvalue()[14:]  # Taglia l'header file BMP di 14 byte per ottenere il payload DIB
            output.close()

        # Tenta di aprire gli appunti con un paio di retry in caso di blocco temporaneo
        for _ in range(5):
            try:
                win32clipboard.OpenClipboard()
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
                win32clipboard.CloseClipboard()
                return True
            except Exception:
                time.sleep(0.05)
                continue

        return False
    except Exception:
        try:
            win32clipboard.CloseClipboard()
        except Exception:
            pass
        return False


def open_whatsapp_chat(phone: str, text: str, open_browser: bool = True) -> str:
    """
    Genera l'URL di WhatsApp Web e, se open_browser=True, apre una nuova scheda nel browser predefinito.
    Restituisce l'URL generato.
    """
    url = generate_whatsapp_url(phone, text)
    if open_browser:
        webbrowser.open_new_tab(url)
    return url
