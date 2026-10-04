# 🩸 AVIS WhatsApp Sender

Applicazione desktop per Windows sviluppata per le sezioni **AVIS (Associazione Volontari Italiani Sangue)** per inviare messaggi personalizzati e immagini/locandine ai donatori tramite WhatsApp Web, con costo zero (0 €) e rischio ban azzerato.

---

## 🌟 Funzionalità Principali

- **Messaggio con Foto & Didascalia Unita**: invio di locandine o volantini con il messaggio posizionato come didascalia direttamente sotto la foto (un unico fumetto WhatsApp).
- **Pilota Automatico a Scheda Singola**:
  - Invia in sequenza a tutta la lista donatori senza intervento manuale.
  - **Riusa sempre la stessa scheda browser**: evita di aprire centinaia di schede nel browser per liste numerose (100 - 600+ donatori).
  - **Protezione Anti-Ban**: pausa automatica naturale (8-12 secondi) tra gli invii per simulare il comportamento umano e tutelare il numero ufficiale.
  - **Pulsante di arresto e ripresa**: possibilità di fermare il pilota in qualsiasi momento e riprendere dal punto esatto.
- **Invio Manuale / Assistito ("1-Click")**:
  - Controllo passo-passo con la barra `Spazio` e tasto `Salta`.
- **Protezione Assoluta del File Excel Originale**:
  - Il file Excel originale non viene **mai** modificato o alterato.
  - Viene creato in automatico sul Desktop un file di log dedicato: `Log_Invio_AVIS_<nome>_<data_ora>.xlsx` con il tracciamento orario di ogni invio.
- **Messaggi Personalizzati con Segnaposto**:
  - Supporto per `[nome]` e `[cognome]` (sostituiti con iniziale maiuscola).
  - Se non si usano segnaposto, il messaggio viene inviato identico a tutta la lista.
- **Gestione Modelli di Testo**: salvataggio ed eliminazione di modelli personalizzati salvati in JSON locale.
- **❓ Guida all'Uso Integrata**: manuale operativo dettagliato accessibile direttamente dalla barra del programma con esempi pratici per ogni funzionalità.
- **🔄 Reset Completo**: pulsante rapido per azzerare la sessione e ripartire da zero.

---

## 📋 Requisiti

- **Sistema Operativo**: Windows 10 / Windows 11
- **Browser**: Google Chrome, Microsoft Edge, Brave o qualsiasi browser moderno con accesso effettuato a [WhatsApp Web](https://web.whatsapp.com).
- **Python**: 3.11 o 3.12 (solo per sviluppo o avvio da sorgenti).

---

## 🚀 Installazione & Avvio Rapido

### 1. Clonare il repository
```bash
git clone https://github.com/CorsiDanilo/AvisWhatsAppSender.git
cd AvisWhatsAppSender
```

### 2. Installare le dipendenze
```bash
pip install -r requirements.txt
```

### 3. Avviare l'applicazione
```bash
python main.py
```

---

## 🧪 Esecuzione dei Test

La suite di test automatici garantisce la stabilità di ogni componente (URL dispatch, clipboard immagini Windows, parsing Excel, normalizzazione numeri e gestione modelli):

```bash
pytest tests/ -v
```

---

## 📦 Compilazione dell'Eseguibile Standalone (.EXE)

Per generare un file `.exe` autonomo che non richiede l'installazione di Python sul computer dell'operatore:

```bash
python build_exe.py
```

L'eseguibile standalone verrà creato nella cartella `dist/AvisWhatsAppSender.exe`.

---

## 📂 Struttura del Progetto

```text
├── AvisWhatsAppSender.spec      # Configurazione PyInstaller
├── build_exe.py                 # Script di compilazione standalone
├── create_sample_excel.py       # Utility per generare donatori fittizi di test
├── donatori_esempio.xlsx        # File Excel di esempio con numeri fittizi
├── images.png                   # Logo AVIS di esempio
├── main.py                      # Punto di ingresso dell'applicazione
├── modelli.json                 # Modelli di testo predefiniti
├── requirements.txt             # Dipendenze Python (customtkinter, openpyxl, pillow, pywin32)
├── src/
│   ├── app_ui.py                # Interfaccia grafica CustomTkinter e modale guida
│   ├── dispatch_engine.py       # Automazione tastiera Windows, clipboard CF_DIB e navigazione browser
│   ├── excel_manager.py         # Parsing openpyxl, pulizia numeri (+39) e log su Desktop
│   └── template_manager.py      # Gestione modelli JSON e sostituzione [nome]/[cognome]
└── tests/
    ├── test_dispatch_engine.py  # Test automazione WhatsApp e gestione didascalie
    ├── test_excel_manager.py    # Test normalizzazione numeri e log su Desktop
    ├── test_template_manager.py # Test segnaposto e persistenza modelli
    └── test_ui_smoke.py         # Smoke test avvio GUI, pulsanti e modali
```

---

## 🔒 Sicurezza & Privacy

- Nessuna credenziale o token viene salvato nel cloud o trasmesso all'esterno.
- Tutti i dati dei donatori rimangono esclusivamente in locale sul computer dell'operatore.
