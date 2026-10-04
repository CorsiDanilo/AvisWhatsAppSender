import os
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
from typing import Optional
import customtkinter as ctk

from src.excel_manager import ExcelManager, DonorRecord
from src.template_manager import TemplateManager, render_template
from src.dispatch_engine import copy_image_to_clipboard, open_whatsapp_chat

class AvisWhatsAppApp(ctk.CTk):
    """Interfaccia grafica principale per AVIS WhatsApp Sender."""

    def __init__(self):
        super().__init__()

        self.title("AVIS WhatsApp Sender - Invio Assistito")
        self.geometry("900x780")
        self.minsize(820, 700)

        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")

        # Moduli di supporto
        self.excel_mgr = ExcelManager()
        self.template_mgr = TemplateManager()

        # Stato interno
        self.current_excel_path: Optional[str] = None
        self.current_image_path: Optional[str] = None
        self.records: list[DonorRecord] = []
        self.current_index: int = 0
        self.waiting_for_next_confirm: bool = False

        self._build_ui()
        self._load_templates_to_menu()
        self._bind_shortcuts()

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

        subtitle_label = ctk.CTkLabel(
            header_frame,
            text="Invio Assistito • 0% Rischio Ban • 0€ Costi",
            font=ctk.CTkFont(size=12, slant="italic"),
            text_color="gray50"
        )
        subtitle_label.pack(side="right", padx=16, pady=8)

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
        btn_action_row.pack(fill="x", padx=12, pady=6)

        self.btn_dispatch = ctk.CTkButton(
            btn_action_row,
            text="▶ PREPARA DONATORE (SPAZIO)",
            font=ctk.CTkFont(size=16, weight="bold"),
            fg_color="#28a745",
            hover_color="#218838",
            height=45,
            command=self._on_dispatch_step
        )
        self.btn_dispatch.pack(side="left", expand=True, fill="x", padx=(12, 6))

        self.btn_skip = ctk.CTkButton(
            btn_action_row,
            text="⏭ Salta Donatore",
            font=ctk.CTkFont(size=13),
            fg_color="gray60",
            hover_color="gray40",
            height=45,
            width=140,
            command=self._on_skip_step
        )
        self.btn_skip.pack(side="right", padx=(6, 12))

        # Guida rapida e stato
        self.lbl_instructions = ctk.CTkLabel(
            dispatch_frame,
            text="💡 Istruzioni: Clicca 'Prepara' (o Spazio) ➔ Su WhatsApp premi Ctrl+V e Invio ➔ Premi Spazio per il donatore successivo",
            font=ctk.CTkFont(size=11),
            text_color="gray40"
        )
        self.lbl_instructions.pack(padx=12, pady=(2, 8))

    def _bind_shortcuts(self):
        """Assegna la barra spaziatrice al flusso di avanzamento rapido quando non si digita nell'editor."""
        self.bind("<space>", self._on_space_pressed)

    def _on_space_pressed(self, event):
        # Se l'utente sta scrivendo attivamente nella casella di testo, lascia che inserisca lo spazio normale
        focused = self.focus_get()
        if str(focused) == str(self.txt_message._textbox):
            return
        self._on_dispatch_step()

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

            self.current_excel_path = path
            self.records = records
            self.current_index = 0
            self.waiting_for_next_confirm = False

            filename = os.path.basename(path)
            self.lbl_excel_path.configure(text=filename, text_color="#1f538d")

            self._update_stats_and_current_donor()
            messagebox.showinfo("File Caricato", f"Caricati {len(records)} donatori con successo!")
        except Exception as e:
            messagebox.showerror("Errore", f"Impossibile leggere il file Excel:\n{e}")

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
            if not rec.inviato.startswith("Sì") and rec.inviato != "Saltato":
                break
            self.current_index += 1

        if self.current_index < len(self.records):
            rec = self.records[self.current_index]
            status_text = f"Donatore [{self.current_index + 1}/{len(self.records)}]: {rec.nome} {rec.cognome} — Tel: {rec.telefono_clean or rec.telefono_raw}"
            if not rec.is_valid:
                status_text += " ⚠️ (NUMERO NON VALIDO)"
            self.lbl_current_donor.configure(text=status_text, text_color="#1f538d")
            self.btn_dispatch.configure(text="▶ PREPARA DONATORE (SPAZIO)", fg_color="#28a745")
        else:
            self.lbl_current_donor.configure(text="🎉 Tutti i donatori della lista sono stati processati!", text_color="#2E7D32")
            self.btn_dispatch.configure(text="COMPLETATO", fg_color="gray50", state="disabled")

    def _on_dispatch_step(self):
        if not self.records or self.current_index >= len(self.records):
            return

        rec = self.records[self.current_index]

        # Se eravamo in attesa di conferma invio per il donatore corrente, segniamo come inviato e passiamo al prossimo
        if self.waiting_for_next_confirm:
            try:
                self.excel_mgr.mark_as_sent(self.current_excel_path, rec.row_idx, status="Sì")
                rec.inviato = "Sì"
            except Exception as e:
                messagebox.showerror("Errore Salvataggio Excel", f"Impossibile aggiornare l'Excel:\n{e}")
                return

            self.waiting_for_next_confirm = False
            self.current_index += 1
            self._update_stats_and_current_donor()
            return

        # Altrimenti, prepariamo il donatore corrente:
        if not rec.is_valid:
            if messagebox.askyesno("Numero non valido", f"Il numero di {rec.nome} {rec.cognome} ({rec.telefono_raw}) non sembra valido.\nVuoi saltarlo?"):
                self._on_skip_step()
            return

        # 1. Copia immagine negli appunti se presente
        if self.current_image_path:
            copied = copy_image_to_clipboard(self.current_image_path)
            if not copied:
                messagebox.showwarning("Attenzione Immagine", "Impossibile copiare l'immagine negli appunti di Windows.")

        # 2. Genera testo personalizzato
        template_text = self.txt_message.get("1.0", "end").strip()
        final_message = render_template(template_text, nome=rec.nome, cognome=rec.cognome)

        # 3. Apri WhatsApp Web
        open_whatsapp_chat(rec.telefono_clean, final_message, open_browser=True)

        # 4. Cambia stato pulsante per il prossimo passo
        self.waiting_for_next_confirm = True
        self.btn_dispatch.configure(
            text="✅ CONFERMA E PASSA AL PROSSIMO (SPAZIO)",
            fg_color="#007bff"
        )
        self.lbl_instructions.configure(
            text=f"📨 Scheda aperta per {rec.nome}! Su WhatsApp premi Ctrl+V e Invio. Poi torna qui e premi SPAZIO per confermare.",
            text_color="#007bff"
        )

    def _on_skip_step(self):
        if not self.records or self.current_index >= len(self.records):
            return

        rec = self.records[self.current_index]
        try:
            self.excel_mgr.mark_as_sent(self.current_excel_path, rec.row_idx, status="Saltato")
            rec.inviato = "Saltato"
        except Exception as e:
            messagebox.showerror("Errore Salvataggio Excel", f"Impossibile aggiornare l'Excel:\n{e}")
            return

        self.waiting_for_next_confirm = False
        self.current_index += 1
        self._update_stats_and_current_donor()
