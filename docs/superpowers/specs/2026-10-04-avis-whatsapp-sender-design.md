# Specifiche di Progetto: AVIS WhatsApp Sender (Desktop Assistant)

**Data**: 2026-10-04  
**Stato**: Proposta Approvata (Pronta per Piano di Implementazione)  
**Destinatari**: Sezione AVIS (Operatori di segreteria su PC Windows)  

---

## 1. Visione d'Insieme e Obiettivi

L'applicazione desktop **AVIS WhatsApp Sender** è uno strumento software per Windows progettato per consentire alle sezioni comunali AVIS di inviare comunicazioni via WhatsApp (con testo personalizzato o uniforme, e supporto per immagine allegata) a liste di donatori caricate da file Excel.

### Obiettivi Primari
1. **Rischio Ban Zero (0%)**: Nessun uso di bot non autorizzati o scraper emulati che rischiano di far bloccare il numero telefonico ufficiale dell'AVIS.
2. **Costo Zero (0 €)**: Nessun canone di abbonamento e nessuna tariffa a consumo per messaggio (nessuna dipendenza da servizi a pagamento di Meta).
3. **Massima Semplicità d'Uso**: Interfaccia desktop standalone in lingua italiana, ispirata al layout storico di segreteria, distribuibile come file `.exe` autonomo senza installazione di Python.
4. **Resilienza e Tracciamento**: Salvataggio automatico dello stato d'invio nel file Excel per consentire interruzioni e riprese della sessione senza invii duplicati.

---

## 2. Architettura del Sistema

L'applicazione è sviluppata in **Python** ed è strutturata in quattro moduli logici ben isolati:

```
┌────────────────────────────────────────────────────────┐
│                   GUI (CustomTkinter)                  │
│       - Caricamento Excel       - Scelta Immagine      │
│       - Editor Template         - Pannello 1-Click     │
└──────────────┬─────────────────────────┬───────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────┐
│       Data & Excel Engine    │  │   Template Manager   │
│ - Parsing & Normalizzazione  │  │ - Gestione Modelli   │
│ - Pulizia Numeri (+39)       │  │ - Sostituzione Tag   │
│ - Tracciamento "Inviato"     │  │   ([nome], [cognome])│
└──────────────┬───────────────┘  └──────────┬───────────┘
               │                             │
               └──────────────┬──────────────┘
                              ▼
┌────────────────────────────────────────────────────────┐
│               Dispatch & Clipboard Engine              │
│ - Inserimento Immagine in Clipboard (Win32 CF_DIB)     │
│ - URL Encoding & Apertura WhatsApp Web                 │
│ - Avanzamento e Registrazione Esito                    │
└────────────────────────────────────────────────────────┘
```

---

## 3. Componenti di Dettaglio

### 3.1 Data & Excel Engine (`excel_manager.py`)
- **Libreria**: `openpyxl`.
- **Riconoscimento Automatico Colonne**:
  - `Nome`: ricerca case-insensitive di `nome`, `name`, `nominativo`.
  - `Cognome`: ricerca case-insensitive di `cognome`, `surname`.
  - `Telefono`: ricerca case-insensitive di `cellulare`, `telefono`, `tel`, `cell`, `mobile`.
  - `Inviato`: ricerca di colonna di stato preesistente; se assente, viene creata automaticamente come `Stato Invio`.
- **Normalizzazione Numeri Telefonici**:
  - Rimozione di spazi, trattini, punti e caratteri speciali.
  - Se il numero ha 10 cifre e inizia per `3`, aggiunge il prefisso `39`.
  - Riconoscimento e normalizzazione di formati internazionali (`+39...`, `0039...` $\rightarrow$ `39...`).
  - Marcatura immediata delle righe con numeri palesemente non validi come non inviabili.
- **Persistenza Incrementale**:
  - All'invio di ogni singolo donatore, la cella corrispondente nell'Excel viene aggiornata a `Sì` (con timestamp dell'invio) e il file viene salvato su disco.

### 3.2 Template & Modelli (`template_manager.py`)
- **Sostituzione Segnaposto**:
  - `[nome]`: convertito nel nome proprio del donatore (con iniziale maiuscola).
  - `[cognome]`: convertito nel cognome del donatore.
  - In assenza di tag nel testo, il messaggio viene considerato comunicazione generica e inviato identico a tutti i destinatari.
- **Persistenza Modelli**:
  - File locale `modelli.json` nella cartella dell'eseguibile.
  - Consente di salvare e caricare modelli predefiniti (es. *"Ringraziamento Donazione"*, *"Avviso Raccolta Straordinaria"*, *"Auguri di Compleanno"*).

### 3.3 Dispatch & Clipboard Engine (`dispatch_engine.py`)
- **Clipboard Windows (Immagine)**:
  - Quando un'immagine è selezionata (`.jpg`, `.jpeg`, `.png`), il motore la converte in bitmap e la carica negli appunti di sistema (`CF_DIB`) tramite API Windows / ctypes.
  - Risultato: l'operatore può incollare direttamente l'immagine su WhatsApp Web premendo semplicemente `Ctrl + V`.
- **Apertura Chat**:
  - Generazione dell'URL WhatsApp Web:
    `https://web.whatsapp.com/send?phone={numero}&text={testo_url_encoded}`
  - Apertura nel browser predefinito di sistema tramite `webbrowser.open_new_tab`.

### 3.4 Interfaccia Grafica (`app_ui.py`)
- **Libreria**: `customtkinter` (o `tkinter` nativo stilizzato, per massimizzare la leggerezza).
- **Aree della Finestra**:
  1. *Sezione Superiore*: Caricamento file Excel, indicatore donatori (Totali / Da Inviare / Completati), selezione file immagine.
  2. *Sezione Modelli*: Menu a tendina modelli salvati, pulsanti rapidi inserisci `[nome]` e `[cognome]`, pulsanti Salva/Elimina modello.
  3. *Area Testo*: Textbox con supporto per emoji, ritorni a capo e formattazione WhatsApp (`*grassetto*`, `_corsivo_`).
  4. *Pannello Invio Assistito*:
     - Visualizzazione donatore corrente (Nome, Cognome, Telefono pulito).
     - Pulsante prominente: **"Prepara Donatore (SPAZIO)"**.
     - Pulsante secondario: **"Salta Donatore"**.
     - Barra di avanzamento grafica e stato in tempo reale.

---

## 4. Flusso Operativo per l'Operatore (User Journey)

1. L'operatore avvia `AvisWhatsAppSender.exe`.
2. Seleziona il file Excel della giornata (es. `donatori_oggi.xlsx`).
3. (Opzionale) Seleziona l'immagine da allegare (es. locandina o ringraziamento).
4. Sceglie o digita il testo del messaggio nell'editor.
5. Si assicura di avere WhatsApp Web già autenticato sul proprio browser.
6. Clicca su **"Prepara Donatore"** (o preme `Spazio`):
   - Si apre la scheda del donatore su WhatsApp Web con il messaggio già scritto.
   - L'immagine è già posizionata negli appunti.
7. L'operatore fa:
   - `Ctrl + V` (l'immagine compare come allegato con didascalia il testo già presente).
   - `Invio` (spedisce il messaggio).
8. L'operatore torna sull'applicazione (o preme `Spazio`):
   - Il contatto viene segnato come inviato sull'Excel.
   - L'applicazione passa immediatamente al donatore successivo.

---

## 5. Gestione Errori e Casi Limite

- **File Excel bloccato da Microsoft Excel**: Se il file è aperto in modalità esclusiva da Excel, l'app avvisa l'operatore di chiudere Excel prima di iniziare.
- **Numeri telefonici non validi**: Riga saltata automaticamente con notifica visiva, senza interrompere la sessione.
- **Interruzione sessione**: L'operatore può chiudere l'app in qualunque momento; alla successiva apertura dello stesso file Excel, l'app riparte dal primo contatto non ancora inviato.

---

## 6. Distribuzione e Packaging

- Strumento: `PyInstaller`.
- Configurazione: `--onefile --noconsole --name AvisWhatsAppSender`.
- Risultato finale: singolo file eseguibile `.exe` distribuibile su Windows 10 e Windows 11 senza prerequisiti software.
