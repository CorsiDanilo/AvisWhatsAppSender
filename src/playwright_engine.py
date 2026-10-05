"""Modulo per il controllo del browser Microsoft Edge tramite Playwright.

Gestisce la sessione persistente di WhatsApp Web, il monitoraggio dello stato di autenticazione,
l'apertura delle chat, la rilevazione dei numeri non validi e l'invio di messaggi (testo e immagini).
"""

from __future__ import annotations

import concurrent.futures
import logging
import os
import queue
import threading
import time
from typing import Optional, Callable

from playwright.sync_api import sync_playwright

LOG_FILE = os.path.join(
    os.getenv("LOCALAPPDATA", os.path.expanduser("~")),
    "AvisWhatsAppSender",
    "engine_debug.log",
)
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
logger = logging.getLogger("playwright_engine")
logger.setLevel(logging.DEBUG)
if not logger.handlers:
    try:
        fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(fh)
    except Exception:
        pass

# Percorso predefinito del profilo Edge dedicato ad AvisWhatsAppSender
DEFAULT_SESSION_DIR = os.path.join(
    os.getenv("LOCALAPPDATA", os.path.expanduser("~")),
    "AvisWhatsAppSender",
    "edge_session",
)

WHATSAPP_WEB_URL = "https://web.whatsapp.com"

# Selettori per il riconoscimento dello stato di WhatsApp Web
AUTH_SELECTORS = [
    # Selettori strutturali classici
    "#pane-side",
    'div[data-tab="3"]',
    'div[id="side"]',
    '#main',
    # Selettori semantici e attributi ARIA (WhatsApp Web moderno)
    'header',
    'div[role="textbox"]',
    '[aria-label*="Cerca" i]',
    '[aria-label*="Search" i]',
    'div[aria-label*="Elenco chat" i]',
    'div[aria-label*="Chat list" i]',
    'div[role="grid"]',
    'button[aria-label*="Nuova chat" i]',
    'button[aria-label*="New chat" i]',
    'button[aria-label*="Menu" i]',
    'button[aria-label*="Stato" i]',
    'button[aria-label*="Status" i]',
    'button[aria-label*="Community" i]',
    'button[aria-label*="Canali" i]',
    'button[aria-label*="Channels" i]',
    'span[data-icon="chats-filled"]',
    'span[data-icon="chat"]',
    'span[data-icon="menu"]',
    'span[data-icon="community"]',
    'span[data-icon="status-outline"]',
    'span[data-icon="newsletter-outline"]',
    'div[data-testid="chat-list"]',
    'div[data-testid="intro-title"]',
]

QR_SELECTORS = [
    "canvas[aria-label]",
    "canvas",
    'div[data-ref]',
    'div[data-testid="qrcode"]',
    'div[aria-label*="Scan" i]',
    'div[aria-label*="Inquadra" i]',
    'span:has-text("WhatsApp sul tuo computer")',
    'span:has-text("WhatsApp on your computer")',
]

LOADING_SELECTORS = [
    "progress",
    'div[role="progressbar"]',
    'div[data-animate-loading="true"]',
    'span:has-text("Sincronizzazione")',
    'span:has-text("Caricamento delle chat")',
]

# Selettori per la rilevazione di popup modali di errore (numero non valido/non su WhatsApp)
INVALID_MODAL_SELECTORS = [
    'div[role="dialog"]',
    'div[data-animate-modal-popup="true"]',
    'div[role="alert"]',
]

# Parole chiave indicative di numero non registrato o non valido
INVALID_NUMBER_KEYWORDS = [
    "non valido",
    "non e valido",
    "non è valido",
    "invalid",
    "invalido",
    "non è su whatsapp",
    "non e su whatsapp",
    "not on whatsapp",
    "non registrato",
    "impossibile aprire la chat",
    "impossibile aprire",
]


# Selettori per verificare la presenza e prontezza della casella messaggio chat
CHAT_INPUT_SELECTORS = [
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[id="main"] footer',
]

# Selettori per pulsante di invio messaggio
SEND_BUTTON_SELECTORS = [
    'span[data-icon="send"]',
    'button[aria-label="Invia"]',
    'button[aria-label="Send"]',
    'div[role="button"][aria-label="Invia"]',
    'div[role="button"][aria-label="Send"]',
    'span[data-testid="send"]',
]

# Selettori per input caricamento file (immagine/media)
FILE_INPUT_SELECTORS = [
    'input[accept*="image"]',
    'input[type="file"]',
]

# Selettori per contenitore modale di anteprima immagine
MEDIA_PREVIEW_SELECTORS = [
    'div[role="dialog"]',
    'div[data-animate-modal-popup="true"]',
    'div[aria-label*="Anteprima"]',
    'div[aria-label*="Preview"]',
]

# Selettori per campo didascalia nella modale di anteprima
CAPTION_INPUT_SELECTORS = [
    'div[role="dialog"] div[contenteditable="true"]',
    'div[data-animate-modal-popup="true"] div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="6"]',
    'div[contenteditable="true"]',
]



class WhatsAppBrowserController:
    """Controller Playwright per pilotare Microsoft Edge con profilo utente persistente.
    Tutte le chiamate a Playwright vengono serializzate ed eseguite su un thread dedicato
    per garantire la thread-safety assoluta con l'interfaccia grafica e i thread di lavoro.
    """

    def __init__(
        self,
        session_dir: Optional[str] = None,
        headless: bool = False,
        on_close_callback: Optional[Callable[[], None]] = None,
    ) -> None:
        self.session_dir = session_dir or DEFAULT_SESSION_DIR
        self.headless = headless
        self.on_close_callback = on_close_callback
        self.playwright_instance = None
        self.context = None
        self.page = None

        self._work_queue: queue.Queue = queue.Queue()
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            daemon=True,
            name="PlaywrightWorker",
        )
        self._worker_thread.start()

    def _worker_loop(self) -> None:
        """Loop del thread dedicato: esegue tutte le operazioni Playwright sullo stesso thread."""
        while True:
            item = self._work_queue.get()
            if item is None:
                break
            fn, args, kwargs, future = item
            try:
                res = fn(*args, **kwargs)
                future.set_result(res)
            except Exception as e:
                future.set_exception(e)
            finally:
                self._work_queue.task_done()

    def _dispatch(self, fn: Callable, *args, **kwargs):
        """Invia una funzione al thread worker ed attende il risultato.
        Se già sul thread worker, la esegue direttamente."""
        if threading.current_thread() == self._worker_thread:
            return fn(*args, **kwargs)
        future = concurrent.futures.Future()
        self._work_queue.put((fn, args, kwargs, future))
        return future.result()

    @property
    def is_running(self) -> bool:
        """Indica se l'istanza del browser e il contesto sono attualmente attivi."""
        return self._dispatch(self._impl_is_running)

    def _impl_is_running(self) -> bool:
        if self.context is None or self.page is None:
            return False
        try:
            if hasattr(self.context, "is_closed") and callable(self.context.is_closed):
                ctx_closed = self.context.is_closed()
                if isinstance(ctx_closed, bool) and ctx_closed:
                    return False
            if hasattr(self.page, "is_closed") and callable(self.page.is_closed):
                res = self.page.is_closed()
                if isinstance(res, bool) and res:
                    return False
            if hasattr(self.page, "evaluate") and callable(self.page.evaluate):
                self.page.evaluate("1")
        except Exception:
            self.context = None
            self.page = None
            return False
        return True

    def _is_context_alive(self) -> bool:
        return self._dispatch(self._impl_is_context_alive)

    def _impl_is_context_alive(self) -> bool:
        """Verifica se il contesto browser è presente e non chiuso."""
        if self.context is None:
            return False
        try:
            if hasattr(self.context, "is_closed") and callable(self.context.is_closed):
                ctx_closed = self.context.is_closed()
                if isinstance(ctx_closed, bool) and ctx_closed:
                    return False
            if self.page is not None:
                if hasattr(self.page, "evaluate") and callable(self.page.evaluate):
                    self.page.evaluate("1")
            elif hasattr(self.context, "pages"):
                _ = self.context.pages
            return True
        except Exception:
            return False

    def _on_context_closed(self, *args, **kwargs) -> None:
        """Gestione evento di chiusura del contesto (finestra chiusa dall'utente)."""
        logger.info("Chiusura contesto rilevata da Playwright.")
        self.context = None
        self.page = None
        if self.on_close_callback and callable(self.on_close_callback):
            try:
                self.on_close_callback()
            except Exception:
                pass

    def _on_page_closed(self, *args, **kwargs) -> None:
        """Gestione evento di chiusura della pagina WhatsApp."""
        logger.info("Chiusura pagina rilevata da Playwright.")
        self.page = None

    def ensure_browser(self) -> bool:
        """Avvia Microsoft Edge con profilo persistente se non già aperto e naviga su WhatsApp Web.

        Ritorna True in caso di successo, False in caso di eccezione.
        """
        return self._dispatch(self._impl_ensure_browser)

    def _impl_ensure_browser(self) -> bool:
        logger.info("Esecuzione _impl_ensure_browser...")
        try:
            # 1. Se il browser non è attivo o non risponde, resetta pulitamente i puntatori
            if not self._impl_is_running():
                if self.context is not None:
                    try:
                        self.context.close()
                    except Exception:
                        pass
                self.context = None
                self.page = None

            # 2. Se è già in esecuzione con pagina aperta e valida, portala in primo piano
            if self._impl_is_running() and self.page is not None:
                if self._impl_bring_to_front():
                    return True
                self.context = None
                self.page = None

            # 3. Assicura che l'istanza Playwright sia inizializzata
            if self.playwright_instance is None:
                logger.info("Avvio sync_playwright().start()...")
                self.playwright_instance = sync_playwright().start()

            # 4. Avvia il contesto se non presente
            if self.context is None:
                launch_kwargs = {
                    "user_data_dir": self.session_dir,
                    "headless": self.headless,
                    "args": ["--start-maximized", "--test-type", "--disable-infobars"],
                    "ignore_default_args": ["--enable-automation"],
                }
                for attempt in range(3):
                    try:
                        logger.info(f"Tentativo {attempt + 1}: avvio Google Chrome...")
                        self.context = self.playwright_instance.chromium.launch_persistent_context(
                            channel="chrome",
                            **launch_kwargs,
                        )
                        logger.info("Google Chrome avviato con successo.")
                        break
                    except Exception as e_chr_sys:
                        logger.warning(f"Tentativo Chrome fallito: {e_chr_sys}")
                        try:
                            logger.info(f"Tentativo {attempt + 1}: avvio Microsoft Edge (fallback)...")
                            self.context = self.playwright_instance.chromium.launch_persistent_context(
                                channel="msedge",
                                **launch_kwargs,
                            )
                            logger.info("Microsoft Edge avviato con successo.")
                            break
                        except Exception as e_edge:
                            logger.warning(f"Tentativo Edge fallito: {e_edge}")
                            try:
                                self.context = self.playwright_instance.chromium.launch_persistent_context(
                                    **launch_kwargs,
                                )
                                logger.info("Chromium puro avviato con successo.")
                                break
                            except Exception as e_chr:
                                logger.warning(f"Tentativo Chromium puro fallito: {e_chr}")
                                if attempt < 2:
                                    time.sleep(0.5)

                if self.context is not None:
                    # Registra listener per rilevare la chiusura della finestra browser da parte dell'utente
                    try:
                        if hasattr(self.context, "on") and callable(self.context.on):
                            self.context.on("close", lambda *args: self._on_context_closed())
                    except Exception:
                        pass

            if self.context is None:
                logger.error("Impossibile avviare il contesto browser.")
                return False

            # 5. Assicura pagina attiva
            page_closed = False
            if self.page is not None:
                try:
                    res = self.page.is_closed()
                    if isinstance(res, bool):
                        page_closed = res
                except Exception:
                    page_closed = True
            else:
                page_closed = True

            if page_closed:
                if self.context.pages:
                    self.page = self.context.pages[0]
                else:
                    self.page = self.context.new_page()

                # Registra listener chiusura pagina
                try:
                    if hasattr(self.page, "on") and callable(self.page.on):
                        self.page.on("close", lambda *args: self._on_page_closed())
                except Exception:
                    pass

            # 6. Naviga su WhatsApp Web se non già aperto
            current_url = getattr(self.page, "url", "") or ""
            if not current_url.startswith(WHATSAPP_WEB_URL):
                logger.info(f"Navigazione verso {WHATSAPP_WEB_URL}...")
                self.page.goto(WHATSAPP_WEB_URL)

            logger.info("ensure_browser completato con successo.")
            return True
        except Exception as e:
            logger.error(f"Eccezione in ensure_browser: {e}", exc_info=True)
            return False

    def check_auth_status(self, timeout_ms: int = 5000) -> str:
        """Verifica lo stato di autenticazione della pagina WhatsApp Web.

        Possibili valori restituiti:
        - 'authenticated': sessione attiva, chat pronte.
        - 'qr_required': QR code da scansionare.
        - 'loading': sincronizzazione messaggi in corso.
        - 'not_connected': browser non attivo o pagina chiusa.
        - 'unknown': stato non determinato entro il timeout.
        """
        return self._dispatch(self._impl_check_auth_status, timeout_ms)

    def _impl_check_auth_status(self, timeout_ms: int = 5000) -> str:
        if not self._impl_is_running() or self.page is None:
            return "not_connected"

        try:
            if hasattr(self.page, "is_closed") and callable(self.page.is_closed):
                res = self.page.is_closed()
                if isinstance(res, bool) and res:
                    return "not_connected"
        except Exception:
            return "not_connected"

        deadline = time.time() + (max(0, timeout_ms) / 1000.0)

        saw_loading = False
        while True:
            # 1. Controlla autenticazione
            for sel in AUTH_SELECTORS:
                try:
                    if self.page.query_selector(sel) is not None:
                        return "authenticated"
                except Exception:
                    pass

            # 2. Controlla QR code richiesto
            for sel in QR_SELECTORS:
                try:
                    if self.page.query_selector(sel) is not None:
                        return "qr_required"
                except Exception:
                    pass

            # 3. Controlla indicatore di caricamento (non interrompe prima della deadline)
            for sel in LOADING_SELECTORS:
                try:
                    if self.page.query_selector(sel) is not None:
                        saw_loading = True
                        break
                except Exception:
                    pass

            if time.time() >= deadline:
                break

            remaining = deadline - time.time()
            time.sleep(min(0.2, max(0.01, remaining)))

        return "loading" if saw_loading else "unknown"

    def bring_to_front(self) -> bool:
        """Porta la pagina e la finestra del browser in primo piano. Ritorna False se la pagina è chiusa."""
        return self._dispatch(self._impl_bring_to_front)

    def _impl_bring_to_front(self) -> bool:
        success = True
        if self.page is not None:
            try:
                self.page.bring_to_front()
            except Exception:
                success = False
                self.context = None
                self.page = None
        else:
            success = False

        if success:
            try:
                from src.dispatch_engine import focus_browser_window
                focus_browser_window()
            except Exception:
                pass
        return success

    def open_chat(self, phone: str, timeout_ms: int = 15000) -> str:
        """Apre la chat per il numero indicato e verifica se il numero è registrato su WhatsApp.

        Parametri:
            phone: Numero di telefono (può contenere caratteri come '+', '-', ' ', ecc.).
            timeout_ms: Timeout massimo in millisecondi per attendere l'apertura della chat o la rilevazione dell'errore.

        Possibili valori restituiti:
        - 'ready': chat aperta e casella messaggio pronta per l'invio.
        - 'invalid_number': popup di errore numero non valido rilevato e chiuso, o numero privo di cifre.
        - 'not_connected': browser non avviato o pagina chiusa.
        - 'error': timeout o errore imprevisto di navigazione.
        """
        return self._dispatch(self._impl_open_chat, phone, timeout_ms)

    def _impl_open_chat(self, phone: str, timeout_ms: int = 15000) -> str:
        if not self._impl_is_running() or self.page is None:
            return "not_connected"

        clean_phone = "".join(filter(str.isdigit, phone or ""))
        if not clean_phone:
            return "invalid_number"

        try:
            target_url = f"{WHATSAPP_WEB_URL}/send?phone={clean_phone}"
            self.page.goto(target_url, timeout=timeout_ms)
        except Exception:
            return "error"

        deadline = time.time() + (max(0, timeout_ms) / 1000.0)

        try:
            while True:
                # 1. Rilevamento errore numero (modale/dialog di avviso)
                for sel in INVALID_MODAL_SELECTORS:
                    try:
                        dialog = self.page.query_selector(sel)
                        if dialog is not None:
                            is_vis = True
                            if hasattr(dialog, "is_visible") and callable(dialog.is_visible):
                                try:
                                    is_vis = dialog.is_visible()
                                except Exception:
                                    is_vis = True
                            if is_vis:
                                text = ""
                                if hasattr(dialog, "inner_text") and callable(dialog.inner_text):
                                    text = dialog.inner_text() or ""
                                elif hasattr(dialog, "text_content") and callable(dialog.text_content):
                                    text = dialog.text_content() or ""

                                text_lower = text.lower()
                                text_normalized = text_lower.replace("è", "e").replace("é", "e")
                                if any(k in text_lower or k in text_normalized for k in INVALID_NUMBER_KEYWORDS):
                                    dismissed = False
                                    try:
                                        buttons = dialog.query_selector_all('button, div[role="button"]')
                                    except Exception:
                                        buttons = []

                                    for btn in buttons:
                                        try:
                                            btn_text = ""
                                            if hasattr(btn, "inner_text") and callable(btn.inner_text):
                                                btn_text = btn.inner_text() or ""
                                            elif hasattr(btn, "text_content") and callable(btn.text_content):
                                                btn_text = btn.text_content() or ""
                                            if btn_text.strip().lower() in ("ok", "chiudi", "close", "annulla", "dismiss"):
                                                btn.click()
                                                dismissed = True
                                                break
                                        except Exception:
                                            pass

                                    if not dismissed:
                                        try:
                                            if hasattr(self.page, "keyboard") and hasattr(self.page.keyboard, "press"):
                                                self.page.keyboard.press("Escape")
                                        except Exception:
                                            pass

                                    return "invalid_number"
                    except Exception:
                        pass

                # 2. Rilevamento chat pronta (presenza input messaggio)
                for sel in CHAT_INPUT_SELECTORS:
                    try:
                        chat_input = self.page.query_selector(sel)
                        if chat_input is not None:
                            is_vis = True
                            if hasattr(chat_input, "is_visible") and callable(chat_input.is_visible):
                                try:
                                    is_vis = chat_input.is_visible()
                                except Exception:
                                    is_vis = True
                            if is_vis:
                                return "ready"
                    except Exception:
                        pass

                if time.time() >= deadline:
                    return "error"

                remaining = deadline - time.time()
                time.sleep(min(0.2, max(0.01, remaining)))
        except Exception:
            return "error"

    def _fill_input(self, element, text: str) -> None:
        """Inserisce il testo all'interno di un elemento editabile."""
        filled = False
        if hasattr(element, "fill") and callable(element.fill):
            try:
                element.fill(text)
                filled = True
            except Exception:
                filled = False

        if not filled and hasattr(element, "type") and callable(element.type):
            try:
                element.type(text)
                filled = True
            except Exception:
                filled = False

        if not filled:
            try:
                if hasattr(element, "click"):
                    element.click()
                if hasattr(self.page, "keyboard") and hasattr(self.page.keyboard, "type"):
                    self.page.keyboard.type(text)
            except Exception:
                pass

    def _send_text_only(self, text: str, deadline: float) -> bool:
        """Invia un messaggio di solo testo nella casella di digitazione della chat."""
        chat_input = None
        while time.time() < deadline:
            for sel in CHAT_INPUT_SELECTORS:
                el = self.page.query_selector(sel)
                if el is not None:
                    if sel == 'div[id="main"] footer' and hasattr(el, "query_selector"):
                        try:
                            inner = el.query_selector('div[contenteditable="true"]')
                            if inner is not None:
                                el = inner
                        except Exception:
                            pass
                    is_vis = True
                    if hasattr(el, "is_visible") and callable(el.is_visible):
                        try:
                            is_vis = el.is_visible()
                        except Exception:
                            is_vis = True
                    if is_vis:
                        chat_input = el
                        break
            if chat_input is not None:
                break
            remaining = deadline - time.time()
            if remaining <= 0:
                break
            time.sleep(min(0.05, max(0.01, remaining)))

        if chat_input is None:
            return False

        self._fill_input(chat_input, text)

        # Invia: click pulsante invio o tasto Enter
        sent = False
        for btn_sel in SEND_BUTTON_SELECTORS:
            btn = self.page.query_selector(btn_sel)
            if btn is not None:
                btn.click()
                sent = True
                break

        if not sent:
            if hasattr(self.page, "keyboard") and hasattr(self.page.keyboard, "press"):
                try:
                    self.page.keyboard.press("Enter")
                    sent = True
                except Exception:
                    pass

        # Attendiamo un secondo per permettere al pacchetto di essere spedito prima del cambio pagina
        time.sleep(1.0)
        return sent

    def send_message(
        self,
        text: str = "",
        image_path: Optional[str] = None,
        timeout_ms: int = 15000,
    ) -> bool:
        """Invia un messaggio di testo ed eventualmente un'immagine con didascalia nella chat corrente.

        Parametri:
            text: Testo del messaggio o didascalia per l'immagine.
            image_path: Percorso opzionale dell'immagine da allegare.
            timeout_ms: Timeout massimo in millisecondi per l'operazione di invio.

        Ritorna True se l'invio è andato a buon fine, False altrimenti.
        """
        return self._dispatch(self._impl_send_message, text, image_path, timeout_ms)

    def _impl_send_message(
        self,
        text: str = "",
        image_path: Optional[str] = None,
        timeout_ms: int = 15000,
    ) -> bool:
        if not self._impl_is_running() or self.page is None:
            return False

        msg_text = (text or "").strip()
        has_valid_image = bool(image_path and os.path.isfile(image_path))

        # Se non c'è testo e l'immagine non è valida/presente, non c'è nulla da inviare
        if not msg_text and not has_valid_image:
            return False

        try:
            deadline = time.time() + (max(0, timeout_ms) / 1000.0)

            # Caso 1: Invio con immagine valida
            if has_valid_image:
                abs_image_path = os.path.abspath(image_path)

                # 1. Carica il file tramite input[type="file"]
                input_set = False
                for sel in FILE_INPUT_SELECTORS:
                    try:
                        file_input = self.page.query_selector(sel)
                        if file_input is not None:
                            if hasattr(file_input, "set_input_files"):
                                file_input.set_input_files(abs_image_path)
                                input_set = True
                                break
                    except Exception:
                        pass

                if not input_set and hasattr(self.page, "set_input_files"):
                    try:
                        self.page.set_input_files('input[type="file"]', abs_image_path)
                        input_set = True
                    except Exception:
                        pass

                if not input_set:
                    # Se non è stato possibile caricare il file ma c'è del testo, fallback a solo testo
                    if msg_text:
                        return self._send_text_only(msg_text, deadline)
                    return False

                # 2. Attendi la comparsa della preview
                modal_indicator = None
                indicators = SEND_BUTTON_SELECTORS + [
                    'span[data-icon="x"]',
                    'span[data-icon="cancel"]',
                    'span[data-icon="crop"]',
                    'span[data-icon="text"]',
                    'span[data-icon="sticker"]',
                    'div[aria-label*="Anteprima"]',
                    'div[aria-label*="Preview"]'
                ]
                
                wait_until = min(deadline, time.time() + 4.0)
                while time.time() < wait_until:
                    for sel in indicators:
                        try:
                            el = self.page.query_selector(sel)
                            if el is not None:
                                is_vis = True
                                if hasattr(el, "is_visible") and callable(el.is_visible):
                                    is_vis = el.is_visible()
                                if is_vis:
                                    modal_indicator = el
                                    break
                        except Exception:
                            pass
                    if modal_indicator is not None:
                        break
                    time.sleep(0.1)

                # Diamo tempo extra per animazione modale
                if modal_indicator is None:
                    time.sleep(1.0)

                # 3. Inserisci la didascalia
                if msg_text:
                    time.sleep(0.5)
                    caption_box = None
                    for cap_sel in CAPTION_INPUT_SELECTORS:
                        try:
                            cb = self.page.query_selector(cap_sel)
                            if cb is not None:
                                is_vis = True
                                if hasattr(cb, "is_visible") and callable(cb.is_visible):
                                    is_vis = cb.is_visible()
                                if is_vis:
                                    caption_box = cb
                                    break
                        except Exception:
                            pass

                    if caption_box is not None:
                        self._fill_input(caption_box, msg_text)
                    else:
                        if hasattr(self.page, "keyboard") and hasattr(self.page.keyboard, "type"):
                            try:
                                self.page.keyboard.type(msg_text)
                            except Exception:
                                pass

                # 4. Invia cliccando il pulsante o premendo Enter
                time.sleep(0.5)
                sent = False
                for btn_sel in SEND_BUTTON_SELECTORS:
                    try:
                        btn = self.page.query_selector(btn_sel)
                        if btn is not None and getattr(btn, 'is_visible', lambda: False)():
                            btn.click()
                            sent = True
                            break
                    except Exception:
                        pass
                
                if not sent:
                    try:
                        if hasattr(self.page, "keyboard") and hasattr(self.page.keyboard, "press"):
                            self.page.keyboard.press("Enter")
                            sent = True
                    except Exception:
                        pass

                # 5. Attendi la chiusura della modale
                wait_close = time.time() + 4.0
                while time.time() < wait_close:
                    if modal_indicator:
                        try:
                            if not getattr(modal_indicator, 'is_visible', lambda: False)():
                                break
                        except Exception:
                            break
                    time.sleep(0.2)
                
                # Pausa extra di sicurezza per permettere l'invio in rete
                time.sleep(1.5)
                
                return sent

            # Caso 2: Solo Testo (o fallback da immagine assente/non valida)
            return self._send_text_only(msg_text, deadline)

        except Exception:
            return False

    def close(self) -> None:
        """Chiude pulitamente pagina, contesto e istanza Playwright per liberare le risorse."""
        return self._dispatch(self._impl_close)

    def _impl_close(self) -> None:
        if self.page:
            try:
                self.page.close()
            except Exception:
                pass
            self.page = None

        if self.context:
            try:
                self.context.close()
            except Exception:
                pass
            self.context = None

        if self.playwright_instance:
            try:
                self.playwright_instance.stop()
            except Exception:
                pass
            self.playwright_instance = None
