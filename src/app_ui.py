import os
import queue
import random
import threading
import time
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
from typing import Optional
import customtkinter as ctk

from src.excel_manager import ExcelManager, DonorRecord
from src.template_manager import TemplateManager, render_template
from src.dispatch_engine import copy_image_to_clipboard, open_whatsapp_chat, execute_autopilot_step
from src.playwright_engine import WhatsAppBrowserController

class AvisWhatsAppApp(ctk.CTk):
    """Interfaccia grafica principale per AVIS WhatsApp Sender."""

    def __init__(self):
        super().__init__()

        self.title("AVIS WhatsApp Sender - Invio Assistito")
        self.geometry("900x800")
        self.minsize(820, 720)

        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")

        # Moduli di supporto
        self.excel_mgr = ExcelManager()
        self.template_mgr = TemplateManager()
        self.browser_controller = WhatsAppBrowserController(
            on_close_callback=self._on_browser_closed_by_user
        )

        # Stato interno
        self.current_excel_path: Optional[str] = None
        self.current_log_path: Optional[str] = None
        self.current_image_path: Optional[str] = None
        self.records: list[DonorRecord] = []
        self.current_index: int = 0
        self.waiting_for_next_confirm: bool = False
        self.autopilot_running: bool = False
        self.autopilot_cancel_requested: bool = False

        self._ui_queue = queue.Queue()
        self._build_ui()
        self._load_templates_to_menu()
        self._bind_shortcuts()
        self.protocol("WM_DELETE_WINDOW", self._on_window_closing)
        self._process_ui_queue()
        self._poll_wa_connection_liveness()

    def ui_dispatch(self, func, *args, **kwargs):
        """Mette in coda un'azione da eseguire sul main thread della UI."""
        self._ui_queue.put((func, args, kwargs))

    def _process_ui_queue(self):
        """Esegue tutti i task pendenti nella coda UI sul thread principale."""
        if hasattr(self, "_ui_queue"):
            while not self._ui_queue.empty():
                try:
                    func, args, kwargs = self._ui_queue.get_nowait()
                    func(*args, **kwargs)
                except queue.Empty:
                    break
                except Exception:
                    pass
        try:
            super().after(50, self._process_ui_queue)
        except Exception:
            pass

    def update(self):
        self._process_ui_queue()
        return super().update()

    def after(self, ms, func=None, *args):
        """Wrapper thread-safe per Tkinter after con fallback sincrono o via queue se non in mainloop."""
        if func is None:
            return super().after(ms)
        if threading.current_thread() != threading.main_thread():
            self.ui_dispatch(func, *args)
            return "queued"
        try:
            return super().after(ms, func, *args)
        except Exception:
            self.ui_dispatch(func, *args)
            return "queued"


    def _build_ui(self):
        # 1. Header Frame
        header_frame = ctk.CTkFrame(self, corner_radius=10)
        header_frame.pack(fill="x", padx=16, pady=(12, 8))

        title_label = ctk.CTkLabel(
            header_frame,
            text="🩸 AVIS WhatsApp Sender",
            font=ctk.CTkFont(size=20, weight="bold")
        )
        title_label.pack(side="left", padx=16, pady=8)

        # Connessione WhatsApp Web via Edge
        self.btn_connect_wa = ctk.CTkButton(
            header_frame,
            text="🌐 Connetti WhatsApp Web",
            fg_color="#25D366",
            hover_color="#1EBE5D",
            command=self._on_click_connect_wa,
            width=190,
            height=30,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.btn_connect_wa.pack(side="left", padx=(8, 6), pady=8)

        self.lbl_wa_status = ctk.CTkLabel(
            header_frame,
            text="⚪ Non connesso",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="gray50"
        )
        self.lbl_wa_status.pack(side="left", padx=(4, 10), pady=8)

        # Pulsante Reset sulla destra dell'header
        self.btn_reset = ctk.CTkButton(
            header_frame,
            text="🔄 Ripristina / Reset",
            width=140,
            height=30,
            fg_color="#6c757d",
            hover_color="#5a6268",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._on_click_reset
        )
        self.btn_reset.pack(side="right", padx=(6, 16), pady=8)

        # Pulsante Guida all'Uso accanto a Reset
        self.btn_guide = ctk.CTkButton(
            header_frame,
            text="❓ Guida all'Uso",
            width=130,
            height=30,
            fg_color="#17a2b8",
            hover_color="#138496",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._show_guide_window
        )
        self.btn_guide.pack(side="right", padx=(6, 6), pady=8)

        subtitle_label = ctk.CTkLabel(
            header_frame,
            text="Invio Assistito & Pilota Automatico • 0€ Costi",
            font=ctk.CTkFont(size=12, slant="italic"),
            text_color="gray50"
        )
        subtitle_label.pack(side="right", padx=8, pady=8)

        # 2. Frame Dati & Immagine
        files_frame = ctk.CTkFrame(self, corner_radius=10)
        files_frame.pack(fill="x", padx=16, pady=6)

        # Riga Excel
        excel_row = ctk.CTkFrame(files_frame, fg_color="transparent")
        excel_row.pack(fill="x", padx=12, pady=6)

        self.btn_load_excel = ctk.CTkButton(
            excel_row,
            text="📂 Carica File Excel",
            command=self._on_load_excel,
            width=160,
            font=ctk.CTkFont(weight="bold")
        )
        self.btn_load_excel.pack(side="left", padx=(0, 10))

        self.lbl_excel_path = ctk.CTkLabel(
            excel_row,
            text="Nessun file Excel caricato",
            font=ctk.CTkFont(size=12),
            text_color="gray40"
        )
        self.lbl_excel_path.pack(side="left", padx=5)

        self.lbl_stats = ctk.CTkLabel(
            excel_row,
            text="Totale: 0 | Da inviare: 0 | Inviati: 0",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#1f538d"
        )
        self.lbl_stats.pack(side="right", padx=5)

        # Riga Immagine
        img_row = ctk.CTkFrame(files_frame, fg_color="transparent")
        img_row.pack(fill="x", padx=12, pady=(0, 6))

        self.btn_load_img = ctk.CTkButton(
            img_row,
            text="🖼️ Seleziona Immagine",
            command=self._on_select_image,
            width=160,
            fg_color="#3B8ED0"
        )
        self.btn_load_img.pack(side="left", padx=(0, 10))

        self.lbl_img_path = ctk.CTkLabel(
            img_row,
            text="Nessuna immagine selezionata (invio solo testo)",
            font=ctk.CTkFont(size=12),
            text_color="gray40"
        )
        self.lbl_img_path.pack(side="left", padx=5)

        self.btn_clear_img = ctk.CTkButton(
            img_row,
            text="✖ Rimuovi",
            command=self._on_clear_image,
            width=80,
            fg_color="gray60",
            hover_color="gray40"
        )
        self.btn_clear_img.pack(side="right", padx=5)

        # 3. Frame Modelli e Segnaposto
        template_bar = ctk.CTkFrame(self, corner_radius=10)
        template_bar.pack(fill="x", padx=16, pady=6)

        lbl_tpl = ctk.CTkLabel(template_bar, text="Modello:", font=ctk.CTkFont(weight="bold"))
        lbl_tpl.pack(side="left", padx=(12, 6), pady=8)

        self.tpl_menu = ctk.CTkOptionMenu(
            template_bar,
            values=["Ringraziamento Donazione"],
            command=self._on_template_selected,
            width=220
        )
        self.tpl_menu.pack(side="left", padx=5, pady=8)

        btn_save_tpl = ctk.CTkButton(
            template_bar,
            text="💾 Salva Modello",
            width=110,
            command=self._on_save_template
        )
        btn_save_tpl.pack(side="left", padx=4, pady=8)

        btn_del_tpl = ctk.CTkButton(
            template_bar,
            text="🗑️ Elimina",
            width=80,
            fg_color="#D9534F",
            hover_color="#C9302C",
            command=self._on_delete_template
        )
        btn_del_tpl.pack(side="left", padx=4, pady=8)

        # Pulsanti rapidi segnaposto
        sep = ctk.CTkLabel(template_bar, text="|", text_color="gray70")
        sep.pack(side="left", padx=8)

        btn_tag_nome = ctk.CTkButton(
            template_bar,
            text="+ [nome]",
            width=85,
            fg_color="#2E7D32",
            hover_color="#1B5E20",
            command=lambda: self._insert_placeholder("[nome]")
        )
        btn_tag_nome.pack(side="left", padx=4, pady=8)

        btn_tag_cognome = ctk.CTkButton(
            template_bar,
            text="+ [cognome]",
            width=95,
            fg_color="#2E7D32",
            hover_color="#1B5E20",
            command=lambda: self._insert_placeholder("[cognome]")
        )
        btn_tag_cognome.pack(side="left", padx=4, pady=8)

        # 4. Frame Editor Testo
        editor_frame = ctk.CTkFrame(self, corner_radius=10)
        editor_frame.pack(fill="both", expand=True, padx=16, pady=6)

        editor_lbl = ctk.CTkLabel(
            editor_frame,
            text="Testo del messaggio (usa i segnaposto sopra per personalizzare, oppure scrivi un testo uguale per tutti):",
            font=ctk.CTkFont(size=12, weight="bold")
        )
        editor_lbl.pack(anchor="w", padx=12, pady=(8, 4))

        self.txt_message = ctk.CTkTextbox(editor_frame, font=ctk.CTkFont(size=13), wrap="word")
        self.txt_message.pack(fill="both", expand=True, padx=12, pady=(0, 8))

        # 5. Frame Pannello di Invio Assistito
        dispatch_frame = ctk.CTkFrame(self, corner_radius=10)
        dispatch_frame.pack(fill="x", padx=16, pady=(6, 14))

        # Scheda Donatore Corrente
        self.lbl_current_donor = ctk.CTkLabel(
            dispatch_frame,
            text="In attesa di caricamento file Excel...",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#1f538d"
        )
        self.lbl_current_donor.pack(padx=12, pady=(10, 4))

        # Barra di avanzamento
        self.progress_bar = ctk.CTkProgressBar(dispatch_frame)
        self.progress_bar.set(0)
        self.progress_bar.pack(fill="x", padx=24, pady=6)

        # Pulsantone principale di invio e pulsante salta
        btn_action_row = ctk.CTkFrame(dispatch_frame, fg_color="transparent")
        btn_action_row.pack(fill="x", padx=12, pady=(6, 4))

        self.btn_dispatch = ctk.CTkButton(
            btn_action_row,
            text="▶ PREPARA DONATORE (SPAZIO)",
            font=ctk.CTkFont(size=15, weight="bold"),
            fg_color="#28a745",
            hover_color="#218838",
            height=42,
            command=self._on_dispatch_step
        )
        self.btn_dispatch.pack(side="left", expand=True, fill="x", padx=(12, 6))

        self.btn_skip = ctk.CTkButton(
            btn_action_row,
            text="⏭ Salta Donatore",
            font=ctk.CTkFont(size=13),
            fg_color="gray60",
            hover_color="gray40",
            height=42,
            width=140,
            command=self._on_skip_step
        )
        self.btn_skip.pack(side="right", padx=(6, 12))

        # Riquadro Pilota Automatico
        autopilot_box = ctk.CTkFrame(dispatch_frame, fg_color=("gray92", "gray22"), corner_radius=8)
        autopilot_box.pack(fill="x", padx=24, pady=(4, 6))

        self.btn_autopilot = ctk.CTkButton(
            autopilot_box,
            text="🚀 AVVIA PILOTA AUTOMATICO",
            font=ctk.CTkFont(size=14, weight="bold"),
            fg_color="#6f42c1",
            hover_color="#5936a2",
            height=38,
            width=260,
            command=self._toggle_autopilot
        )
        self.btn_autopilot.pack(side="left", padx=(10, 16), pady=6)

        lbl_wait_title = ctk.CTkLabel(autopilot_box, text="Attesa WhatsApp (s):", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_wait_title.pack(side="left", padx=(4, 2), pady=6)

        self.entry_page_wait = ctk.CTkEntry(autopilot_box, width=45, height=28, justify="center")
        self.entry_page_wait.insert(0, "6")
        self.entry_page_wait.pack(side="left", padx=(0, 14), pady=6)

        lbl_antiban_title = ctk.CTkLabel(autopilot_box, text="Pausa anti-ban (s):", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_antiban_title.pack(side="left", padx=(4, 2), pady=6)

        self.entry_anti_ban = ctk.CTkEntry(autopilot_box, width=45, height=28, justify="center")
        self.entry_anti_ban.insert(0, "10")
        self.entry_anti_ban.pack(side="left", padx=(0, 10), pady=6)

        self.chk_reuse_tab = ctk.CTkCheckBox(
            autopilot_box,
            text="Usa 1 sola scheda",
            font=ctk.CTkFont(size=11, weight="bold"),
            width=140
        )
        self.chk_reuse_tab.select()
        self.chk_reuse_tab.pack(side="left", padx=(6, 8), pady=6)

        # Guida rapida e stato
        self.lbl_instructions = ctk.CTkLabel(
            dispatch_frame,
            text="💡 Istruzioni: Usa 'Prepara' per invio manuale, oppure 'Avvia Pilota Automatico' per fare tutto da solo.",
            font=ctk.CTkFont(size=11),
            text_color="gray40"
        )
        self.lbl_instructions.pack(padx=12, pady=(2, 8))

    def _bind_shortcuts(self):
        """Assegna le scorciatoie da tastiera (Spazio per invio manuale, ESC per fermare autopilot)."""
        self.bind("<space>", self._on_space_pressed)
        self.bind("<Escape>", self._on_escape_pressed)

    def _on_space_pressed(self, event):
        # Se il pilota automatico è in esecuzione, ignora la barra spaziatrice
        if self.autopilot_running:
            return
        # Se l'utente sta scrivendo attivamente nella casella di testo, lascia che inserisca lo spazio normale
        focused = self.focus_get()
        if str(focused) == str(self.txt_message._textbox):
            return
        self._on_dispatch_step()

    def _on_escape_pressed(self, event=None):
        if self.autopilot_running:
            self._stop_autopilot()

    def _on_click_connect_wa(self):
        """Avvia la connessione a WhatsApp Web via Google Chrome in un thread worker e monitora l'accesso."""
        self.btn_connect_wa.configure(state="disabled")
        self.lbl_wa_status.configure(text="🟡 Avvio di Google Chrome...", text_color="#fd7e14")

        def worker():
            try:
                ok = self.browser_controller.ensure_browser()
                if not ok:
                    self.after(0, lambda: self._update_wa_status_ui("error"))
                    return

                # Monitora lo stato per un massimo di 90 secondi (o fino ad avvenuta autenticazione)
                deadline = time.time() + 90.0
                last_reported = ""

                while time.time() < deadline:
                    if not self.browser_controller.is_running:
                        break

                    auth = self.browser_controller.check_auth_status(timeout_ms=1500)
                    if auth != last_reported:
                        last_reported = auth
                        self.after(0, lambda a=auth: self._update_wa_status_ui(a))

                    if auth == "authenticated":
                        return

                    time.sleep(0.8)

                final_auth = self.browser_controller.check_auth_status(timeout_ms=1000)
                self.after(0, lambda: self._update_wa_status_ui(final_auth))
            except Exception:
                self.after(0, lambda: self._update_wa_status_ui("error"))

        threading.Thread(target=worker, daemon=True).start()

    def _on_browser_closed_by_user(self):
        """Notifica quando la finestra del browser viene chiusa manualmente dall'utente."""
        try:
            self.after(0, lambda: self._update_wa_status_ui("not_connected"))
        except Exception:
            pass

    def _poll_wa_connection_liveness(self):
        """Monitora periodicamente lo stato di connessione se il browser risulta connesso."""
        try:
            if hasattr(self, "browser_controller") and self.browser_controller is not None:
                if hasattr(self, "lbl_wa_status") and "WhatsApp Connesso" in self.lbl_wa_status.cget("text"):
                    def check_liveness():
                        try:
                            if not self.browser_controller.is_running:
                                self.after(0, lambda: self._update_wa_status_ui("not_connected"))
                        except Exception:
                            pass
                    threading.Thread(target=check_liveness, daemon=True).start()
        except Exception:
            pass
        finally:
            try:
                self.after(2500, self._poll_wa_connection_liveness)
            except Exception:
                pass

    def _update_wa_status_ui(self, auth: str):
        """Aggiorna l'etichetta dello stato di WhatsApp Web e il testo del pulsante."""
        self.btn_connect_wa.configure(state="normal")
        if auth == "authenticated":
            self.lbl_wa_status.configure(text="🟢 WhatsApp Connesso", text_color="#28a745")
            self.btn_connect_wa.configure(text="🌐 Mostra WhatsApp Web")
        elif auth == "qr_required":
            self.lbl_wa_status.configure(text="🟡 Inquadra QR Code su Chrome", text_color="#fd7e14")
            self.btn_connect_wa.configure(text="🌐 Connetti WhatsApp Web")
        elif auth == "loading":
            self.lbl_wa_status.configure(text="🟡 Caricamento WhatsApp Web...", text_color="#fd7e14")
            self.btn_connect_wa.configure(text="🌐 Connetti WhatsApp Web")
        else:
            self.lbl_wa_status.configure(text="⚪ Non connesso", text_color="gray50")
            self.btn_connect_wa.configure(text="🌐 Connetti WhatsApp Web")

    def _on_window_closing(self):
        """Gestisce la chiusura sicura della finestra e la pulizia del browser controller."""
        try:
            if self.autopilot_running:
                self.autopilot_cancel_requested = True
                self.autopilot_running = False
        except Exception:
            pass

        try:
            if hasattr(self, "browser_controller") and self.browser_controller is not None:
                self.browser_controller.close()
        except Exception:
            pass

        self.destroy()

    def _load_templates_to_menu(self):
        templates = self.template_mgr.load_templates()
        names = list(templates.keys())
        if names:
            self.tpl_menu.configure(values=names)
            first_name = names[0]
            self.tpl_menu.set(first_name)
            self.txt_message.delete("1.0", "end")
            self.txt_message.insert("1.0", templates[first_name])

    def _on_template_selected(self, choice: str):
        templates = self.template_mgr.load_templates()
        if choice in templates:
            self.txt_message.delete("1.0", "end")
            self.txt_message.insert("1.0", templates[choice])

    def _on_save_template(self):
        text = self.txt_message.get("1.0", "end").strip()
        if not text:
            messagebox.showwarning("Attenzione", "Il testo del messaggio è vuoto!")
            return

        name = simpledialog.askstring("Salva Modello", "Inserisci il nome del modello da salvare:")
        if name and name.strip():
            self.template_mgr.save_template(name.strip(), text)
            self._load_templates_to_menu()
            self.tpl_menu.set(name.strip())
            messagebox.showinfo("Salvato", f"Modello '{name.strip()}' salvato con successo!")

    def _on_delete_template(self):
        current = self.tpl_menu.get()
        if messagebox.askyesno("Conferma", f"Sei sicuro di voler eliminare il modello '{current}'?"):
            self.template_mgr.delete_template(current)
            self._load_templates_to_menu()

    def _insert_placeholder(self, tag: str):
        self.txt_message.insert("insert", tag)
        self.txt_message.focus_set()

    def _on_load_excel(self):
        path = filedialog.askopenfilename(
            title="Seleziona File Excel Donatori",
            filetypes=[("File Excel", "*.xlsx;*.xls"), ("Tutti i file", "*.*")]
        )
        if not path:
            return

        try:
            records = self.excel_mgr.load_file(path)
            if not records:
                messagebox.showwarning("Attenzione", "Nessun donatore trovato nel file selezionato.")
                return

            log_path = self.excel_mgr.create_desktop_log_copy(path)
            self.current_excel_path = path
            self.current_log_path = log_path
            self.records = records
            self.current_index = 0
            self.waiting_for_next_confirm = False

            filename = os.path.basename(path)
            log_filename = os.path.basename(log_path)
            self.lbl_excel_path.configure(text=f"{filename} (Log: {log_filename})", text_color="#1f538d")

            self._update_stats_and_current_donor()
            messagebox.showinfo(
                "File Caricato",
                f"Caricati {len(records)} donatori con successo!\n\n"
                f"🔒 File originale: NON verrà toccato.\n"
                f"📝 Nuovo file di log creato sul Desktop:\n{log_filename}\n\n"
                "Gli esiti degli invii verranno registrati esclusivamente nel nuovo file di log."
            )
        except Exception as e:
            messagebox.showerror("Errore", f"Impossibile leggere il file Excel o creare il log sul Desktop:\n{e}")

    def _on_select_image(self):
        path = filedialog.askopenfilename(
            title="Seleziona Immagine da Allegare",
            filetypes=[("Immagini", "*.png;*.jpg;*.jpeg;*.bmp"), ("Tutti i file", "*.*")]
        )
        if not path:
            return

        self.current_image_path = path
        self.lbl_img_path.configure(text=f"Allegata: {os.path.basename(path)}", text_color="#2E7D32")

    def _on_clear_image(self):
        self.current_image_path = None
        self.lbl_img_path.configure(text="Nessuna immagine selezionata (invio solo testo)", text_color="gray40")

    def _update_stats_and_current_donor(self):
        if not self.records:
            self.lbl_stats.configure(text="Totale: 0 | Da inviare: 0 | Inviati: 0")
            self.lbl_current_donor.configure(text="In attesa di caricamento file Excel...")
            self.progress_bar.set(0)
            return

        counts = self.excel_mgr.get_counts(self.records)
        self.lbl_stats.configure(
            text=f"Totale: {counts['totale']} | Da inviare: {counts['da_inviare']} | Inviati: {counts['inviati']} | Saltati: {counts['saltati']}"
        )

        # Calcola percentuale progresso
        done_count = counts['inviati'] + counts['saltati']
        prog = done_count / counts['totale'] if counts['totale'] > 0 else 0
        self.progress_bar.set(prog)

        # Trova il prossimo donatore non ancora inviato
        while self.current_index < len(self.records):
            rec = self.records[self.current_index]
            if not rec.inviato.startswith("Sì") and not rec.inviato.startswith("Saltato"):
                break
            self.current_index += 1

        if self.current_index < len(self.records):
            rec = self.records[self.current_index]
            status_text = f"Donatore [{self.current_index + 1}/{len(self.records)}]: {rec.nome} {rec.cognome} — Tel: {rec.telefono_clean or rec.telefono_raw}"
            if not rec.is_valid:
                status_text += " ⚠️ (NUMERO NON VALIDO)"
            self.lbl_current_donor.configure(text=status_text, text_color="#1f538d")
            if not self.autopilot_running:
                self.btn_dispatch.configure(text="▶ PREPARA DONATORE (SPAZIO)", fg_color="#28a745")
        else:
            self.lbl_current_donor.configure(text="🎉 Tutti i donatori della lista sono stati processati!", text_color="#2E7D32")
            if not self.autopilot_running:
                self.btn_dispatch.configure(text="COMPLETATO", fg_color="gray50", state="disabled")

    def _on_dispatch_step(self):
        if not self.records or self.current_index >= len(self.records):
            return

        if self.waiting_for_next_confirm:
            return self._on_confirm_send_step()
        else:
            return self._on_prepare_step()

    def _on_prepare_step(self):
        if not self.records or self.current_index >= len(self.records):
            return

        rec = self.records[self.current_index]

        # Altrimenti, prepariamo il donatore corrente:
        if not rec.is_valid:
            if messagebox.askyesno(
                "Numero non valido",
                f"Il numero di {rec.nome} {rec.cognome} ({rec.telefono_raw}) non sembra valido.\nVuoi saltarlo?"
            ):
                self._on_skip_step()
            return

        self.btn_dispatch.configure(text="⏳ Apertura chat in corso...", state="disabled")
        self.lbl_instructions.configure(
            text=f"Apertura chat Edge per {rec.nome} {rec.cognome}...",
            text_color="#1f538d"
        )

        def worker():
            try:
                if not self.browser_controller.is_running:
                    ok = self.browser_controller.ensure_browser()
                    if not ok:
                        self.after(0, lambda: self._on_prepare_failed("Impossibile avviare Google Chrome."))
                        return

                status = self.browser_controller.open_chat(rec.telefono_clean)

                if status == "invalid_number":
                    self.after(0, lambda: self._handle_invalid_number_in_prepare(rec))
                elif status == "ready":
                    self.after(0, self._on_prepare_ready)
                else:
                    self.after(0, lambda: self._on_prepare_failed(f"Impossibile aprire la chat (stato: {status})."))
            except Exception as e:
                self.after(0, lambda err=e: self._on_prepare_failed(f"Errore: {err}"))

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        return thread

    def _on_prepare_ready(self):
        self.waiting_for_next_confirm = True
        self.btn_dispatch.configure(
            text="✅ CONFERMA E INVIA (SPAZIO)",
            fg_color="#007bff",
            state="normal"
        )
        self.lbl_instructions.configure(
            text="Chat pronta su Chrome! Premi SPAZIO per inviare e passare al prossimo.",
            text_color="#007bff"
        )

    def _handle_invalid_number_in_prepare(self, rec: DonorRecord):
        target_file = self.current_log_path or self.current_excel_path
        if target_file:
            try:
                self.excel_mgr.mark_as_sent(target_file, rec.row_idx, status="Saltato (Non su WhatsApp)")
            except Exception:
                pass
        rec.inviato = "Saltato (Non su WhatsApp)"

        messagebox.showwarning(
            "Numero non registrato",
            f"Il numero di {rec.nome} {rec.cognome} ({rec.telefono_clean}) non risulta registrato su WhatsApp.\n"
            "È stato contrassegnato come 'Saltato (Non su WhatsApp)'."
        )
        self.waiting_for_next_confirm = False
        self.current_index += 1
        self._update_stats_and_current_donor()

    def _on_prepare_failed(self, error_msg: str):
        messagebox.showwarning("Attenzione", error_msg)
        self.btn_dispatch.configure(text="▶ PREPARA DONATORE (SPAZIO)", fg_color="#28a745", state="normal")
        self.lbl_instructions.configure(text=f"⚠️ {error_msg}", text_color="#d9534f")

    def _on_confirm_send_step(self):
        if not self.records or self.current_index >= len(self.records):
            return

        rec = self.records[self.current_index]
        template_text = self.txt_message.get("1.0", "end").strip()
        final_message = render_template(template_text, nome=rec.nome, cognome=rec.cognome)

        self.btn_dispatch.configure(text="⏳ Invio in corso...", state="disabled")

        def worker():
            try:
                sent = self.browser_controller.send_message(final_message, image_path=self.current_image_path)
                def on_done():
                    if sent:
                        try:
                            target_file = self.current_log_path or self.current_excel_path
                            if target_file:
                                self.excel_mgr.mark_as_sent(target_file, rec.row_idx, status="Sì")
                            rec.inviato = "Sì"
                        except Exception as e:
                            messagebox.showerror("Errore Salvataggio Log Excel", f"Impossibile aggiornare il file di log:\n{e}")
                        self.waiting_for_next_confirm = False
                        self.current_index += 1
                        self._update_stats_and_current_donor()
                    else:
                        messagebox.showwarning("Invio non riuscito", f"Impossibile inviare il messaggio a {rec.nome} {rec.cognome}.")
                        self.btn_dispatch.configure(text="✅ CONFERMA E INVIA (SPAZIO)", state="normal")
                self.after(0, on_done)
            except Exception as e:
                self.after(0, lambda: self.btn_dispatch.configure(text="✅ CONFERMA E INVIA (SPAZIO)", state="normal"))
                self.after(0, lambda err=e: messagebox.showerror("Errore", f"Errore durante l'invio: {err}"))

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        return thread

    def _on_skip_step(self):
        if not self.records or self.current_index >= len(self.records):
            return

        rec = self.records[self.current_index]
        try:
            target_file = self.current_log_path or self.current_excel_path
            if target_file:
                self.excel_mgr.mark_as_sent(target_file, rec.row_idx, status="Saltato")
            rec.inviato = "Saltato"
        except Exception as e:
            messagebox.showerror("Errore Salvataggio Log Excel", f"Impossibile aggiornare il file di log:\n{e}")
            return

        self.waiting_for_next_confirm = False
        self.current_index += 1
        self._update_stats_and_current_donor()

    # --- PILOTA AUTOMATICO (AUTOPILOT) ---

    def _toggle_autopilot(self):
        if self.autopilot_running:
            self._stop_autopilot()
        else:
            self._start_autopilot()

    def _start_autopilot(self):
        if not self.records:
            messagebox.showwarning("Nessun Donatore", "Carica prima un file Excel con i donatori!")
            return

        # Trova il primo donatore non ancora inviato
        while self.current_index < len(self.records):
            rec = self.records[self.current_index]
            if not rec.inviato.startswith("Sì") and not rec.inviato.startswith("Saltato"):
                break
            self.current_index += 1

        if self.current_index >= len(self.records):
            messagebox.showinfo("Completato", "Tutti i donatori della lista sono già stati processati!")
            return

        try:
            page_wait = float(self.entry_page_wait.get().strip())
            if page_wait < 2.0:
                page_wait = 2.0
        except ValueError:
            page_wait = 6.0
            self.entry_page_wait.delete(0, "end")
            self.entry_page_wait.insert(0, "6")

        try:
            anti_ban_delay = float(self.entry_anti_ban.get().strip())
            if anti_ban_delay < 3.0:
                anti_ban_delay = 3.0
        except ValueError:
            anti_ban_delay = 10.0
            self.entry_anti_ban.delete(0, "end")
            self.entry_anti_ban.insert(0, "10")

        rimanenti = sum(1 for r in self.records if not r.inviato.startswith("Sì") and not r.inviato.startswith("Saltato"))
        if not messagebox.askyesno(
            "Avvio Pilota Automatico",
            f"Stai per avviare l'invio automatico per {rimanenti} donatori con Google Chrome.\n\n"
            f"• Attesa caricamento WhatsApp: {page_wait}s\n"
            f"• Pausa anti-ban tra donatori: ~{anti_ban_delay}s\n\n"
            "⚠️ AVVERTENZE:\n"
            "1. Durante l'invio evita di interagire sulla finestra di Edge per non interferire con l'automazione.\n"
            "2. Puoi fermare o mettere in pausa l'invio in qualsiasi momento premendo ESC o il pulsante 'Ferma'.\n\n"
            "Vuoi avviare il Pilota Automatico?"
        ):
            return

        self.autopilot_running = True
        self.autopilot_cancel_requested = False

        self.btn_autopilot.configure(
            text="⏸️ FERMA PILOTA AUTOMATICO (ESC)",
            fg_color="#dc3545",
            hover_color="#bd2130"
        )
        self.btn_dispatch.configure(state="disabled")
        self.btn_skip.configure(state="disabled")
        self.btn_load_excel.configure(state="disabled")
        self.btn_reset.configure(state="disabled")

        reuse_tab = bool(self.chk_reuse_tab.get()) if hasattr(self, "chk_reuse_tab") else True

        worker = threading.Thread(
            target=self._autopilot_worker,
            args=(page_wait, anti_ban_delay, reuse_tab),
            daemon=True
        )
        worker.start()

    def _stop_autopilot(self):
        if not self.autopilot_running:
            return
        self.autopilot_cancel_requested = True
        self.lbl_instructions.configure(
            text="🛑 Arresto del pilota automatico in corso...",
            text_color="#dc3545"
        )

    def _set_autopilot_status(self, text: str, text_color: str = "#6f42c1"):
        self.lbl_instructions.configure(text=text, text_color=text_color)

    def _autopilot_worker(self, page_wait: float, anti_ban_delay: float, reuse_tab: bool = True):
        # 1. Assicura browser attivo
        self.after(0, lambda: self._set_autopilot_status("🟡 Avvio di Google Chrome e connessione a WhatsApp Web..."))
        ok = self.browser_controller.ensure_browser()
        if not ok or self.autopilot_cancel_requested:
            self.after(0, lambda: messagebox.showerror("Errore Browser", "Impossibile avviare Google Chrome."))
            self.after(0, self._on_autopilot_finished)
            return

        # 2. Verifica autenticazione
        auth = self.browser_controller.check_auth_status(timeout_ms=5000)
        if auth != "authenticated":
            self.after(0, lambda: self._set_autopilot_status("🟡 Attesa accesso a WhatsApp Web su Chrome (inquadra il QR Code se richiesto)...", text_color="#fd7e14"))
            self.after(0, lambda: self.lbl_wa_status.configure(text="🟡 Inquadra QR Code su Chrome", text_color="#fd7e14"))
            while auth != "authenticated" and self.autopilot_running and not self.autopilot_cancel_requested:
                time.sleep(1.0)
                auth = self.browser_controller.check_auth_status(timeout_ms=2000)

        if self.autopilot_cancel_requested or not self.autopilot_running:
            self.after(0, self._on_autopilot_finished)
            return

        if auth == "authenticated":
            self.after(0, lambda: self.lbl_wa_status.configure(text="🟢 WhatsApp Connesso", text_color="#28a745"))

        # 3. Invio donatori
        while self.autopilot_running and not self.autopilot_cancel_requested:
            # Trova il prossimo donatore da inviare
            while self.current_index < len(self.records):
                rec = self.records[self.current_index]
                if not rec.inviato.startswith("Sì") and not rec.inviato.startswith("Saltato"):
                    break
                self.current_index += 1

            if self.current_index >= len(self.records):
                break

            rec = self.records[self.current_index]

            # Se il numero non è valido, saltalo automaticamente registrandolo su Excel
            if not rec.is_valid:
                try:
                    target_file = self.current_log_path or self.current_excel_path
                    if target_file:
                        self.excel_mgr.mark_as_sent(target_file, rec.row_idx, status="Saltato (Non Valido)")
                    rec.inviato = "Saltato"
                except Exception:
                    pass
                self.current_index += 1
                self.after(0, self._update_stats_and_current_donor)
                continue

            # Prepara il messaggio
            msg_text = self.txt_message.get("1.0", "end").strip()
            final_message = render_template(msg_text, nome=rec.nome, cognome=rec.cognome)

            status_msg = f"🤖 [Autopilot] Inviando a {rec.nome} {rec.cognome} ({rec.telefono_clean})... (Premi ESC per fermare)"
            self.after(0, lambda m=status_msg: self._set_autopilot_status(m))

            # Apertura chat
            status = self.browser_controller.open_chat(rec.telefono_clean)

            if self.autopilot_cancel_requested or not self.autopilot_running:
                break

            if status == "invalid_number":
                try:
                    target_file = self.current_log_path or self.current_excel_path
                    if target_file:
                        self.excel_mgr.mark_as_sent(target_file, rec.row_idx, status="Saltato (Non su WhatsApp)")
                    rec.inviato = "Saltato (Non su WhatsApp)"
                except Exception:
                    pass
                self.current_index += 1
                self.after(0, self._update_stats_and_current_donor)
                continue
            elif status == "ready":
                sent = self.browser_controller.send_message(final_message, image_path=self.current_image_path)

                if self.autopilot_cancel_requested or not self.autopilot_running:
                    break

                if sent:
                    try:
                        target_file = self.current_log_path or self.current_excel_path
                        if target_file:
                            self.excel_mgr.mark_as_sent(target_file, rec.row_idx, status="Sì")
                        rec.inviato = "Sì"
                    except Exception as e:
                        self.after(0, lambda err=e: messagebox.showerror("Errore Salvataggio Log Excel", f"Errore durante l'aggiornamento del log:\n{err}"))
                        break

                    self.current_index += 1
                    self.after(0, self._update_stats_and_current_donor)

                    # Controlla se ci sono altri donatori da inviare per la pausa anti-ban
                    has_more = any(not r.inviato.startswith("Sì") and not r.inviato.startswith("Saltato") for r in self.records[self.current_index:])
                    if not has_more or self.autopilot_cancel_requested:
                        break

                    jitter = random.uniform(-1.0, 1.5)
                    actual_pause = max(3.0, anti_ban_delay + jitter)
                    elapsed = 0.0
                    step = 0.5
                    while elapsed < actual_pause:
                        if self.autopilot_cancel_requested or not self.autopilot_running:
                            break
                        rem = max(0, int(round(actual_pause - elapsed)))
                        self.after(0, lambda r=rem: self._set_autopilot_status(f"⏳ Pausa anti-ban di sicurezza: prossimo tra {r}s... (Premi ESC per fermare)"))
                        time.sleep(step)
                        elapsed += step
                else:
                    self.after(0, lambda: self._set_autopilot_status(f"⚠️ Invio fallito a {rec.nome} {rec.cognome}. Autopilot fermato.", text_color="#d9534f"))
                    break
            else:
                self.after(0, lambda m=f"⚠️ Errore apertura chat ({status}). Autopilot fermato.": self._set_autopilot_status(m, text_color="#d9534f"))
                break

        self.after(0, self._on_autopilot_finished)

    def _on_autopilot_finished(self):
        was_cancelled = self.autopilot_cancel_requested
        self.autopilot_running = False
        self.autopilot_cancel_requested = False

        self.btn_autopilot.configure(
            text="🚀 AVVIA PILOTA AUTOMATICO",
            fg_color="#6f42c1",
            hover_color="#5936a2"
        )
        self.btn_dispatch.configure(state="normal")
        self.btn_skip.configure(state="normal")
        self.btn_load_excel.configure(state="normal")
        self.btn_reset.configure(state="normal")

        self._update_stats_and_current_donor()

        if was_cancelled:
            self._set_autopilot_status("⏹️ Pilota automatico fermato dall'operatore. Stato salvato nell'Excel!", text_color="#d9534f")
        elif self.records and all(r.inviato.startswith("Sì") or r.inviato.startswith("Saltato") for r in self.records):
            messagebox.showinfo("Completato!", "🎉 Fantastico! Tutti i donatori sono stati processati con successo dal Pilota Automatico!")

    # --- RESET / RIPRISTINO ---

    def _on_click_reset(self):
        self.reset_application_state(confirm=True)

    def reset_application_state(self, confirm: bool = True) -> None:
        """Ripristina l'applicazione allo stato iniziale di avvio."""
        if confirm:
            if not messagebox.askyesno(
                "Ripristina Programma",
                "Sei sicuro di voler azzerare la sessione e ripristinare il programma allo stato iniziale?\n\nI file caricati e le modifiche al testo verranno azzerati."
            ):
                return

        # Ferma eventuale pilota automatico
        if self.autopilot_running:
            self.autopilot_cancel_requested = True
            self.autopilot_running = False

        # Reset variabili interne
        self.current_excel_path = None
        self.current_log_path = None
        self.current_image_path = None
        self.records = []
        self.current_index = 0
        self.waiting_for_next_confirm = False

        # Reset etichette file e stato WhatsApp
        self.lbl_excel_path.configure(text="Nessun file Excel caricato", text_color="gray40")
        self.lbl_stats.configure(text="Totale: 0 | Da inviare: 0 | Inviati: 0", text_color="#1f538d")
        self.lbl_img_path.configure(text="Nessuna immagine selezionata (invio solo testo)", text_color="gray40")
        if hasattr(self, "lbl_wa_status"):
            self.lbl_wa_status.configure(text="⚪ Non connesso", text_color="gray50")

        # Reset pannello donatore
        self.lbl_current_donor.configure(text="In attesa di caricamento file Excel...", text_color="#1f538d")
        self.progress_bar.set(0)
        self.btn_dispatch.configure(text="▶ PREPARA DONATORE (SPAZIO)", fg_color="#28a745", state="normal")
        self.btn_skip.configure(state="normal")
        self.btn_load_excel.configure(state="normal")
        self.btn_autopilot.configure(text="🚀 AVVIA PILOTA AUTOMATICO", fg_color="#6f42c1", state="normal")

        # Reset istruzioni
        self.lbl_instructions.configure(
            text="💡 Istruzioni: Usa 'Prepara' per invio manuale, oppure 'Avvia Pilota Automatico' per fare tutto da solo.",
            text_color="gray40"
        )

        # Ricarica modelli originali
        self._load_templates_to_menu()

        # Reset timing e opzioni
        if hasattr(self, "entry_page_wait"):
            self.entry_page_wait.delete(0, "end")
            self.entry_page_wait.insert(0, "6")
        if hasattr(self, "entry_anti_ban"):
            self.entry_anti_ban.delete(0, "end")
            self.entry_anti_ban.insert(0, "10")
        if hasattr(self, "chk_reuse_tab"):
            self.chk_reuse_tab.select()

        if confirm:
            messagebox.showinfo("Reset Completato", "Il programma è stato ripristinato allo stato iniziale.")

    # --- GUIDA ALL'USO ---

    def _show_guide_window(self) -> ctk.CTkToplevel:
        """Apre una finestra di dialogo modale con la guida passo-passo dettagliata ed esempi pratici."""
        guide_win = ctk.CTkToplevel(self)
        guide_win.title("📘 Guida all'Uso Dettagliata - AVIS WhatsApp Sender")
        guide_win.geometry("820x680")
        guide_win.minsize(680, 500)
        guide_win.grab_set()

        # Header della finestra Guida
        top_frame = ctk.CTkFrame(guide_win, corner_radius=8, fg_color="#1f538d")
        top_frame.pack(fill="x", padx=16, pady=(16, 8))

        ctk.CTkLabel(
            top_frame,
            text="📘 Manuale Operativo & Guida Passo-Passo",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color="white"
        ).pack(padx=16, pady=(10, 4))

        ctk.CTkLabel(
            top_frame,
            text="Tutto quello che c'è da sapere per inviare comunicazioni AVIS in sicurezza, a costo zero e senza ban",
            font=ctk.CTkFont(size=12, slant="italic"),
            text_color="#e0e0e0"
        ).pack(padx=16, pady=(0, 10))

        # Frame scorrevole contenente le sezioni
        scroll = ctk.CTkScrollableFrame(guide_win, corner_radius=8)
        scroll.pack(fill="both", expand=True, padx=16, pady=8)

        def add_section(icon_title: str, items: list):
            sec_card = ctk.CTkFrame(scroll, corner_radius=8)
            sec_card.pack(fill="x", pady=6, padx=4)

            lbl_title = ctk.CTkLabel(
                sec_card,
                text=icon_title,
                font=ctk.CTkFont(size=14, weight="bold"),
                anchor="w",
                text_color="#1f538d"
            )
            lbl_title.pack(fill="x", padx=12, pady=(10, 6))

            for subtitle, text in items:
                if subtitle:
                    sub_lbl = ctk.CTkLabel(
                        sec_card,
                        text=subtitle,
                        font=ctk.CTkFont(size=12, weight="bold"),
                        anchor="w"
                    )
                    sub_lbl.pack(fill="x", padx=16, pady=(4, 2))

                body_lbl = ctk.CTkLabel(
                    sec_card,
                    text=text,
                    font=ctk.CTkFont(size=12),
                    justify="left",
                    anchor="w",
                    wraplength=720
                )
                body_lbl.pack(fill="x", padx=16, pady=(0, 6))

        # 1. Prerequisiti
        add_section(
            "🌐 1. Prerequisito Fondamentale: WhatsApp Web",
            [
                (
                    "Accesso a WhatsApp Web prima dell'invio",
                    "Prima di avviare il programma o gli invii, apri il tuo browser preferito (Google Chrome, Google Chrome, ecc.) e collegati a:\nhttps://web.whatsapp.com\n"
                    "Inquadra il codice QR con WhatsApp sul tuo smartphone per accedere. Lascia aperta la scheda di WhatsApp Web nel browser per tutta la sessione di lavoro."
                )
            ]
        )

        # 2. Excel & Log Desktop
        add_section(
            "📂 2. Caricamento Excel & Salvaguardia del File Originale",
            [
                (
                    "Protezione Totale: Il tuo file originale NON viene mai modificato!",
                    "Clicca su '📂 Carica File Excel' e seleziona il file contenente la lista dei donatori.\n"
                    "🛡️ Salvataggio Sicuro: Per evitare danneggiamenti o perdite accidentali, il programma NON tocca mai il file originale. "
                    "Viene invece generato automaticamente sul tuo Desktop un file di log dedicato:\n"
                    "   Desktop \\ Log_Invio_AVIS_<nome>_<data_ora>.xlsx\n"
                    "Tutti gli aggiornamenti di invio ('Sì', 'No', 'Saltato') con data e ora vengono salvati riga per riga in questo nuovo file sul Desktop."
                ),
                (
                    "Struttura consigliata del foglio Excel:",
                    "Il foglio può avere qualsiasi intestazione comune, ad esempio:\n"
                    "• Nome: Mario\n"
                    "• Cognome: Rossi\n"
                    "• Telefono / Cellulare: 3331234567 oppure +39 333 1234567 (i prefissi vengono puliti automaticamente)\n"
                    "• Inviato: No (verrà aggiornato a 'Sì (gg/mm/aaaa hh:mm)' nel file log)"
                )
            ]
        )

        # 3. Modelli & Segnaposto
        add_section(
            "✍️ 3. Modelli di Messaggio & Segnaposto Personalizzati",
            [
                (
                    "Personalizzazione automatica con [nome] e [cognome]",
                    "Puoi scegliere un modello predefinito dal menu a tendina oppure scriverne uno da zero. "
                    "Usa i pulsanti verdi '+ [nome]' e '+ [cognome]' per inserire i segnaposto nel punto desiderato."
                ),
                (
                    "Esempio pratico con segnaposto:",
                    "Testo nel riquadro:\n"
                    "«Ciao [nome] [cognome], ti ricordiamo la donazione di sangue domenica 12 ottobre presso la sede AVIS. Ti aspettiamo!»\n\n"
                    "Risultato inviato a Mario Rossi:\n"
                    "«Ciao Mario Rossi, ti ricordiamo la donazione di sangue domenica 12 ottobre presso la sede AVIS. Ti aspettiamo!»\n\n"
                    "💡 Nota: Se non usi i segnaposto [nome] o [cognome], il messaggio verrà inviato identico a tutta la lista."
                ),
                (
                    "Salvare o eliminare modelli:",
                    "Puoi salvare nuovi modelli cliccando su '💾 Salva Modello' o rimuovere quelli vecchi con '🗑️ Elimina'. Vengono salvati nel file modelli.json."
                )
            ]
        )

        # 4. Immagine con Didascalia
        add_section(
            "🖼️ 4. Invio Immagine con Didascalia Unita (Messaggio Singolo)",
            [
                (
                    "Un solo fumetto WhatsApp elegante",
                    "Se vuoi inviare una locandina, una foto promozionale o un'infografica, clicca su '🖼️ Seleziona Immagine'.\n"
                    "✨ Didascalia Integrata: Il programma incolla la foto e inserisce il testo del messaggio direttamente come didascalia sottostante alla foto. "
                    "Su WhatsApp il donatore riceverà un UNICO messaggio pulito (la foto con il testo in basso), senza messaggi separati o doppi fumetti!\n\n"
                    "Se non selezioni alcuna immagine, il programma invierà un consueto messaggio di solo testo."
                )
            ]
        )

        # 5. Pilota Automatico
        add_section(
            "🚀 5. Pilota Automatico (Consigliato per Liste Numerose: 50 - 600+ Donatori)",
            [
                (
                    "Invio a catena completamente autonomo",
                    "Premendo '🚀 AVVIA PILOTA AUTOMATICO', il programma gestisce tutto da solo in sequenza, senza farti premere tasti per ogni donatore."
                ),
                (
                    "Caratteristiche e opzioni avanzate del Pilota Automatico:",
                    "• 🗂️ Riusa singola scheda browser (Attivo di default): Consente di NON aprire centinaia di schede nel browser! "
                    "Il programma invia i comandi sempre all'interno della stessa scheda di WhatsApp Web, evitando di appesantire o bloccare il computer anche con 600 donatori.\n"
                    "• 🛡️ Pausa Anti-Ban tra invii (default: 10s): Una pausa casuale fisiologica (8-12 secondi) tra un donatore e l'altro che simula il ritmo umano, "
                    "garantendo il 100% di sicurezza contro eventuali blocchi o limitazioni di Meta/WhatsApp sul numero dell'associazione.\n"
                    "• ⏱️ Attesa caricamento chat (default: 6s): Il tempo concesso a WhatsApp Web per aprire la chat del contatto prima di incollare e inviare. "
                    "Se hai una connessione internet lenta, puoi aumentarlo a 7-9 secondi.\n"
                    "• ⏹️ Fermata e Ripresa: Cliccando '⏹️ FERMA PILOTA AUTOMATICO' puoi arrestare l'invio in qualsiasi istante. Lo stato di ogni donatore già contattato resta memorizzato nel file log sul Desktop!"
                )
            ]
        )

        # 6. Invio Manuale / Assistito
        add_section(
            "🖐️ 6. Invio Manuale / Assistito (1 Donatore alla volta)",
            [
                (
                    "Controllo manuale passo-passo",
                    "Se preferisci visionare ogni donatore prima di inviare:\n"
                    "1. Clicca su '▶ PREPARA DONATORE' (oppure premi SPAZIO sulla tastiera).\n"
                    "2. Il programma prepara la chat su WhatsApp Web.\n"
                    "3. Se è presente una foto, premi Ctrl+V e Invio per spedire.\n"
                    "4. Torna sul programma e premi nuovamente SPAZIO per registrare l'invio nel log e visualizzare il donatore successivo.\n"
                    "5. Se desideri ignorare un contatto senza inviare, premi '⏭ Salta Donatore'."
                )
            ]
        )

        # 7. Ripristino / Reset
        add_section(
            "🔄 7. Pulsante Reset / Ripristina Stato Iniziale",
            [
                (
                    "Ricominciare da una sessione pulita",
                    "Il pulsante '🔄 Ripristina / Reset' in alto a destra chiude la sessione attiva, azzera i file e i contatori a zero, "
                    "e reimposta l'applicazione come appena avviata, pronta per caricare una nuova lista o iniziare un'altra campagna."
                )
            ]
        )

        # Footer con pulsante di chiusura
        bottom_frame = ctk.CTkFrame(guide_win, fg_color="transparent")
        bottom_frame.pack(fill="x", padx=16, pady=(4, 14))

        btn_close = ctk.CTkButton(
            bottom_frame,
            text="Chiudi Guida",
            width=130,
            height=32,
            fg_color="#6c757d",
            hover_color="#5a6268",
            font=ctk.CTkFont(weight="bold"),
            command=guide_win.destroy
        )
        btn_close.pack(side="right")

        return guide_win

