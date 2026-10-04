# AVIS WhatsApp Sender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare un'applicazione desktop Windows standalone (`.exe`) per inviare messaggi WhatsApp personalizzati o generici con immagine allegata a una lista di donatori AVIS da Excel, usando la modalità di invio assistito (0% rischio ban, 0€ di costo).

**Architecture:** Moduli Python disaccoppiati (lettura/scrittura Excel con persistenza stato incrementale, gestione template e segnaposto, copia immagine in clipboard Windows via DIB e apertura WhatsApp Web con codifica URL, interfaccia grafica moderna con CustomTkinter).

**Tech Stack:** Python 3.12, CustomTkinter, openpyxl, Pillow, pywin32, pytest, PyInstaller.

**Spec:** `docs/superpowers/specs/2026-10-04-avis-whatsapp-sender-design.md`

## Global Constraints

- Piattaforma target: Windows 10 e Windows 11.
- Lingua interfaccia utente: Italiano.
- Costo di esercizio: 0 € (nessuna chiamata ad API a pagamento né registrazione servizi esterni).
- Rischio ban: 0% (nessun web-scraping o automazione invasiva; l'apertura avviene tramite URL ufficiale WhatsApp Web e l'invio fisico tramite input utente).
- Persistenza automatica: aggiornamento immediato della colonna `Stato Invio` nel file Excel ad ogni donatore processato.

## Review Focus

1. Numeri di cellulare sporchi o con formati anomali (es. `+39 333 12-34-567`, `0039340...`, prefissi assenti o numeri con 6 cifre) $\rightarrow$ devono essere normalizzati o scartati senza crash.
2. File Excel con nomi di colonna eterogenei (es. `Cellulare` vs `Telefono` vs `TEL`, maiuscolo o minuscolo) $\rightarrow$ auto-rilevamento case-insensitive.
3. Caratteri speciali ed emoji nel messaggio $\rightarrow$ codifica URL rigorosa (`urllib.parse.quote`) per evitare troncamento del testo in WhatsApp Web.
4. Formato immagine per la clipboard di Windows $\rightarrow$ conversione corretta in formato `CF_DIB` affinché WhatsApp Web riconosca l'immagine con `Ctrl+V`.
5. File Excel temporaneamente bloccato o aperto in Microsoft Excel $\rightarrow$ gestione errore con avviso esplicito senza perdita di dati.

---

### Task 1: Scaffolding del Progetto e Configurazione Dipendenze

**Files:**
- Create: `requirements.txt`
- Create: `src/__init__.py`
- Test: `tests/__init__.py`

**Interfaces:**
- Consumes: Standard Python environment
- Produces: Base project structure and dependencies

- [ ] **Step 1: Creare `requirements.txt`**

```text
customtkinter>=5.2.0
openpyxl>=3.1.2
Pillow>=10.0.0
pywin32>=306
pytest>=8.0.0
pyinstaller>=6.4.0
```

- [ ] **Step 2: Creare package folders e `__init__.py`**

Creare cartelle `src` e `tests` con i rispettivi file `__init__.py`.

- [ ] **Step 3: Verificare installazione pacchetti con pytest**

Run: `pytest tests/`
Expected: 0 collected items / passed (nessun errore di importazione).

- [ ] **Step 4: Commit**

```bash
git add requirements.txt src/__init__.py tests/__init__.py
git commit -m "chore: scaffold project structure and requirements"
```

---

### Task 2: Modulo Gestione Dati e Pulizia Numeri (`excel_manager.py`)

**Files:**
- Create: `src/excel_manager.py`
- Test: `tests/test_excel_manager.py`

**Interfaces:**
- Produces:
  - `clean_phone_number(raw: str) -> tuple[str, bool]`
  - `DonorRecord(row_idx: int, nome: str, cognome: str, telefono_raw: str, telefono_clean: str, inviato: str, is_valid: bool)`
  - `ExcelManager`:
    - `load_file(filepath: str) -> list[DonorRecord]`
    - `mark_as_sent(filepath: str, row_idx: int, status: str = "Sì") -> None`
    - `get_counts(records: list[DonorRecord]) -> dict[str, int]`

- [ ] **Step 1: Scrivere i test per la pulizia del numero di telefono**

In `tests/test_excel_manager.py`:
- Test numero standard italiano (es. `"3331234567"` $\rightarrow$ `("393331234567", True)`)
- Test numero con spazi e trattini (`"333 12-34-567"` $\rightarrow$ `("393331234567", True)`)
- Test numero con prefisso `+39` o `0039` (`"+39 340 1122334"` $\rightarrow$ `("393401122334", True)`)
- Test numero non valido (`"1234"`, `""`, `"abc"`) $\rightarrow$ `("", False)`

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `pytest tests/test_excel_manager.py -v`
Expected: FAIL con `ImportError: cannot import name 'clean_phone_number'`

- [ ] **Step 3: Implementare `clean_phone_number` in `src/excel_manager.py`**

Logica:
- Estrazione cifre con regex o filter (`str.isdigit`).
- Rimozione di `0039` o `+39` iniziale per ottenere la radice.
- Se la radice ha 9-10 cifre e inizia per `3`, anteporre `39`.
- Se valida restituire `(formatted, True)`, altrimenti `(raw, False)`.

- [ ] **Step 4: Verificare che i test di pulizia passino**

Run: `pytest tests/test_excel_manager.py -k test_clean_phone -v`
Expected: PASS

- [ ] **Step 5: Scrivere i test per `ExcelManager.load_file` e `mark_as_sent`**

Creare un file `.xlsx` temporaneo tramite fixture `openpyxl`:
- Colonne: `Nome`, `Cognome`, `Cellulare`.
- Rilevamento automatico case-insensitive di colonne `Nome`, `Cognome`, `Cellulare`.
- Creazione della colonna `Stato Invio` se assente.
- Chiamata a `mark_as_sent(filepath, row_idx=2, status="Sì")` e rilettura file per verificare la persistenza della cella.

- [ ] **Step 6: Implementare `ExcelManager` in `src/excel_manager.py`**

Implementare la classe con `openpyxl`, gestione dell'header, creazione colonna `Stato Invio` se mancante, aggiornamento e salvataggio su disco.

- [ ] **Step 7: Eseguire tutti i test di `test_excel_manager.py`**

Run: `pytest tests/test_excel_manager.py -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/excel_manager.py tests/test_excel_manager.py
git commit -m "feat: add excel manager and phone number normalization"
```

---

### Task 3: Modulo Gestione Template e Modelli (`template_manager.py`)

**Files:**
- Create: `src/template_manager.py`
- Test: `tests/test_template_manager.py`

**Interfaces:**
- Produces:
  - `render_template(template: str, nome: str, cognome: str) -> str`
  - `TemplateManager`:
    - `load_templates(filepath: str) -> dict[str, str]`
    - `save_template(name: str, text: str, filepath: str) -> None`
    - `delete_template(name: str, filepath: str) -> None`

- [ ] **Step 1: Scrivere i test per la sostituzione dei segnaposto**

In `tests/test_template_manager.py`:
- Test sostituzione `[nome]` e `[cognome]` con testo formattato (es. `"Ciao [nome]"` con `"MARIO"` $\rightarrow$ `"Ciao Mario"`).
- Test messaggio generico senza segnaposto (il testo rimane identico per tutti).
- Test gestione valori vuoti o None.

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `pytest tests/test_template_manager.py -v`
Expected: FAIL con `ImportError`

- [ ] **Step 3: Implementare `render_template` in `src/template_manager.py`**

- [ ] **Step 4: Scrivere i test per la persistenza su file JSON dei modelli salvati**

Test caricamento modelli predefiniti di default se il file non esiste, aggiunta nuovo modello, persistenza su file e cancellazione.

- [ ] **Step 5: Implementare `TemplateManager` in `src/template_manager.py`**

- [ ] **Step 6: Verificare tutti i test di `test_template_manager.py`**

Run: `pytest tests/test_template_manager.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/template_manager.py tests/test_template_manager.py
git commit -m "feat: add template manager with placeholder substitution and persistence"
```

---

### Task 4: Modulo Dispatch e Clipboard Immagine Windows (`dispatch_engine.py`)

**Files:**
- Create: `src/dispatch_engine.py`
- Test: `tests/test_dispatch_engine.py`

**Interfaces:**
- Produces:
  - `generate_whatsapp_url(phone: str, text: str) -> str`
  - `copy_image_to_clipboard(image_path: str) -> bool`
  - `open_whatsapp_chat(phone: str, text: str) -> str` (apre browser e restituisce URL)

- [ ] **Step 1: Scrivere i test per `generate_whatsapp_url`**

Verificare la corretta formattazione dell'URL WhatsApp Web:
- Base: `https://web.whatsapp.com/send?phone=393331234567&text=...`
- Codifica URL per spazi, a capo, emoji (`🩸`), asterischi di grassetto (`*AVIS*`).

- [ ] **Step 2: Implementare `generate_whatsapp_url` in `src/dispatch_engine.py`**

Utilizzo di `urllib.parse.quote` su `text` e composizione dell'URL.

- [ ] **Step 3: Scrivere i test e l'implementazione di `copy_image_to_clipboard`**

In `src/dispatch_engine.py`:
- Utilizzo di `Pillow` (Image) e `win32clipboard` / `io.BytesIO`.
- Conversione immagine in formato RGB e salvataggio in stream BMP.
- Scrittura del payload `CF_DIB` (salto dell'header bitmap di 14 byte standard) negli appunti di Windows.
- Gestione graceful: se l'immagine non esiste o il file non è valido, restituisce `False` senza crash.

- [ ] **Step 4: Eseguire i test di dispatch**

Run: `pytest tests/test_dispatch_engine.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/dispatch_engine.py tests/test_dispatch_engine.py
git commit -m "feat: add dispatch engine for WhatsApp Web URL and Windows image clipboard"
```

---

### Task 5: Interfaccia Grafica Utente (`app_ui.py`) e Entry Point (`main.py`)

**Files:**
- Create: `src/app_ui.py`
- Create: `main.py`
- Test: `tests/test_ui_smoke.py`

**Interfaces:**
- Consumes: `ExcelManager`, `TemplateManager`, `dispatch_engine`
- Produces: Finestra desktop interattiva con CustomTkinter

- [ ] **Step 1: Implementare la GUI in `src/app_ui.py`**

Componenti della finestra:
- Finestra principale (dimensioni consigliate: 850x700px, tema chiaro/scuro pulito).
- Sezione Superiore:
  - Bottone `Carica Excel` + etichetta file selezionato + label statistiche (`Totale: 0 | Da inviare: 0 | Inviati: 0`).
  - Bottone `Seleziona Immagine` + etichetta immagine + bottone `Rimuovi`.
- Sezione Modelli:
  - Menu a tendina dei modelli salvati + pulsante `Salva Modello Corrente` + pulsante `Elimina Modello`.
  - Pulsanti rapidi segnaposto: `[nome]`, `[cognome]`.
- Sezione Editor Testo:
  - Casella di testo `CTkTextbox` per il messaggio.
- Sezione Invio Assistito:
  - Card donatore corrente: mostra Nome, Cognome, Telefono e stato.
  - Pulsante primario gigante: **"▶ Prepara Donatore (SPAZIO)"**.
  - Pulsante secondario: **"Salta Donatore"**.
  - Barra di avanzamento `CTkProgressBar`.
  - Etichetta istruzioni operative: *"1. Premi Spazio -> 2. Su WhatsApp premi Ctrl+V e Invio -> 3. Premi Spazio per il prossimo"*.
  - Gestione evento tastiera `<space>` per avanzamento rapido.

- [ ] **Step 2: Creare il punto d'ingresso `main.py`**

Avvio dell'applicazione con gestione corretta delle eccezioni.

- [ ] **Step 3: Scrivere uno smoke test per la GUI (`test_ui_smoke.py`)**

Verificare che l'applicazione si istanzi correttamente senza eccezioni in modalità headless o di testing.

- [ ] **Step 4: Eseguire la suite completa di test**

Run: `pytest tests/ -v`
Expected: tutti i test passano.

- [ ] **Step 5: Commit**

```bash
git add src/app_ui.py main.py tests/test_ui_smoke.py
git commit -m "feat: implement modern desktop GUI with CustomTkinter"
```

---

### Task 6: Creazione File Eseguibile (.EXE) e Verifica Finale

**Files:**
- Create: `build_exe.py` (script di automazione build con PyInstaller)
- Produces: `dist/AvisWhatsAppSender.exe`

- [ ] **Step 1: Installare `pyinstaller` nell'ambiente**

Run: `pip install pyinstaller`

- [ ] **Step 2: Configurare lo script di build per CustomTkinter**

CustomTkinter richiede l'inclusione dei propri asset (temi json, font). Creare uno script `build_exe.py` che aggiunge il flag `--add-data` per il percorso di `customtkinter`.

- [ ] **Step 3: Eseguire la compilazione del file `.exe`**

Run: `python build_exe.py`
Expected: generazione con successo di `dist/AvisWhatsAppSender.exe`.

- [ ] **Step 4: Test end-to-end con file Excel di prova**

Generare un file `test_donatori.xlsx` con 3 righe simulate, avviare l'eseguibile, verificare il caricamento del file, l'inserimento dell'immagine in clipboard e l'aggiornamento della colonna `Stato Invio`.

- [ ] **Step 5: Commit finale**

```bash
git add build_exe.py
git commit -m "build: add pyinstaller packaging script for standalone executable"
```
