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


def copy_text_to_clipboard(text: str) -> bool:
    """Copia una stringa di testo negli appunti di sistema di Windows."""
    if not HAS_WIN32:
        return False
    import win32con
    for _ in range(5):
        try:
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, text)
            win32clipboard.CloseClipboard()
            return True
        except Exception:
            time.sleep(0.05)
    return False


def simulate_ctrl_l() -> None:
    """Simula la pressione di Ctrl+L per selezionare la barra degli indirizzi del browser."""
    import ctypes
    if hasattr(ctypes, "windll") and hasattr(ctypes.windll, "user32"):
        VK_CONTROL = 0x11
        VK_L = 0x4C
        KEYEVENTF_KEYUP = 0x0002
        ctypes.windll.user32.keybd_event(VK_CONTROL, 0, 0, 0)
        ctypes.windll.user32.keybd_event(VK_L, 0, 0, 0)
        time.sleep(0.05)
        ctypes.windll.user32.keybd_event(VK_L, 0, KEYEVENTF_KEYUP, 0)
        ctypes.windll.user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)


def simulate_paste() -> None:
    """Simula la pressione di Ctrl+V negli appunti per incollare."""
    import ctypes
    if hasattr(ctypes, "windll") and hasattr(ctypes.windll, "user32"):
        VK_CONTROL = 0x11
        VK_V = 0x56
        KEYEVENTF_KEYUP = 0x0002
        ctypes.windll.user32.keybd_event(VK_CONTROL, 0, 0, 0)
        ctypes.windll.user32.keybd_event(VK_V, 0, 0, 0)
        time.sleep(0.05)
        ctypes.windll.user32.keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0)
        ctypes.windll.user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)


def simulate_enter() -> None:
    """Simula la pressione del tasto Invio."""
    import ctypes
    if hasattr(ctypes, "windll") and hasattr(ctypes.windll, "user32"):
        VK_RETURN = 0x0D
        KEYEVENTF_KEYUP = 0x0002
        ctypes.windll.user32.keybd_event(VK_RETURN, 0, 0, 0)
        time.sleep(0.05)
        ctypes.windll.user32.keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, 0)


def focus_browser_window() -> bool:
    """Trova e porta in primo piano la finestra del browser (WhatsApp / Chrome / Edge / Firefox / Brave)."""
    import ctypes
    try:
        import win32gui
        import win32con

        def enum_cb(hwnd, matches):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd).lower()
                if any(k in title for k in ["whatsapp", "chrome", "edge", "firefox", "brave", "opera"]):
                    matches.append(hwnd)

        matches = []
        win32gui.EnumWindows(enum_cb, matches)
        if matches:
            hwnd = matches[0]
            if win32gui.IsIconic(hwnd):
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            ctypes.windll.user32.keybd_event(0x12, 0, 0, 0)
            ctypes.windll.user32.keybd_event(0x12, 0, 2, 0)
            win32gui.SetForegroundWindow(hwnd)
            time.sleep(0.1)
            return True
    except Exception:
        pass
    return False


def navigate_current_tab(url: str) -> None:
    """
    Naviga la scheda corrente del browser all'URL specificato senza aprire nuove finestre/schede:
    Copia l'URL negli appunti, seleziona la barra degli indirizzi (Ctrl+L), incolla (Ctrl+V) e preme Invio.
    """
    copy_text_to_clipboard(url)
    time.sleep(0.05)
    simulate_ctrl_l()
    time.sleep(0.15)
    simulate_paste()
    time.sleep(0.15)
    simulate_enter()


def execute_autopilot_step(
    phone: str,
    text: str,
    image_path: Optional[str] = None,
    page_wait_s: float = 5.0,
    action_delay_s: float = 1.5,
    is_first: bool = False,
    reuse_tab: bool = True,
    cancel_check = None,
    open_browser_fn = None,
    navigate_tab_fn = None,
    copy_img_fn = None,
    copy_text_fn = None,
    paste_fn = None,
    enter_fn = None,
    sleep_fn = None,
    focus_browser_fn = None
) -> bool:
    """
    Esegue un singolo ciclo di invio automatico:
    1. Se presente un'immagine: apre la chat pulita (senza testo nell'URL), incolla l'immagine e poi
       incolla il messaggio come DIDASCALIA della foto (inviando UNICO messaggio con foto + testo).
    2. Se non c'è immagine: apre la chat con testo precompilato e preme Invio (solo testo).
    3. Gestisce il riscaldamento iniziale (+5s sul primo donatore) e il riutilizzo della stessa scheda.
    """
    if cancel_check and cancel_check():
        return False

    _open_browser = open_browser_fn or open_whatsapp_chat
    _navigate_tab = navigate_tab_fn or navigate_current_tab
    _copy_img = copy_img_fn or copy_image_to_clipboard
    _copy_text = copy_text_fn or copy_text_to_clipboard
    _paste = paste_fn or simulate_paste
    _enter = enter_fn or simulate_enter
    _focus = focus_browser_fn or focus_browser_window

    def do_sleep(seconds: float):
        if sleep_fn is not None:
            sleep_fn(seconds)
        else:
            step = 0.1
            elapsed = 0.0
            while elapsed < seconds:
                if cancel_check and cancel_check():
                    return
                chunk = min(step, seconds - elapsed)
                time.sleep(chunk)
                elapsed += chunk

    # 1. Apertura o navigazione della chat
    # Se presente un'immagine, non mettiamo il testo nell'URL per poterlo inserire come didascalia della foto
    url_text = "" if image_path else text
    url = generate_whatsapp_url(phone, url_text)

    if is_first or not reuse_tab:
        _open_browser(phone, url_text)
        total_wait = page_wait_s + (5.0 if is_first else 0.0)
    else:
        _focus()
        _navigate_tab(url)
        total_wait = page_wait_s

    if cancel_check and cancel_check():
        return False

    # 2. Attesa caricamento chat
    do_sleep(total_wait)
    if cancel_check and cancel_check():
        return False

    # 3. Invio messaggio
    if image_path:
        # Copia immagine negli appunti e incollala in chat (apre l'anteprima foto con didascalia)
        _copy_img(image_path)
        if cancel_check and cancel_check():
            return False

        _paste()
        do_sleep(action_delay_s)
        if cancel_check and cancel_check():
            return False

        # Se c'è testo, incollalo come didascalia della foto
        if text:
            _copy_text(text)
            if cancel_check and cancel_check():
                return False
            _paste()
            do_sleep(0.5)
            if cancel_check and cancel_check():
                return False

        # Spedisce la foto CON didascalia in un unico messaggio
        _enter()
        do_sleep(1.0)
    else:
        # Invio standard solo testo
        if text:
            _enter()
            do_sleep(1.0)
            if cancel_check and cancel_check():
                return False

    return True


