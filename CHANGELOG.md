# Changelog

All notable changes to the **AVIS WhatsApp Sender** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
## [1.3.0] - 2026-10-15

### Summary

Importante aggiornamento che introduce il supporto completo all'invio di allegati multipli (immagini, video, audio e documenti generici come PDF, Word, Excel, PowerPoint, archivi ZIP/RAR e file di testo), la gestione personalizzabile della posizione della didascalia/messaggio, il monitoraggio del peso totale e la continuità garantita della coda di invio senza interruzioni non presidiate.

### Added

- **Supporto Allegati Multipli**: possibilità di selezionare e allegare più file contemporaneamente direttamente dalla finestra di dialogo di sistema ("Tutti i file *.*").
- **Supporto a Documenti e Media Generici**: invio nativo oltre alle immagini di documenti PDF, fogli di calcolo Excel (.xlsx, .xls), documenti Word (.docx, .doc), presentazioni PowerPoint (.pptx, .ppt), file di testo (.txt, .csv), archivi compressi (.zip, .rar), note audio e file video.
- **Gestione e Riordino Sequenza File**: elenco interattivo degli allegati con badge di tipologia, anteprima miniatura, dimensione del singolo file, pulsanti di riordinamento sequenziale (`▲` / `▼`) e pulsanti di rimozione mirata (`✕`) o totale.
- **Scelta Posizione Messaggio/Didascalia**: selettore a 3 modalità quando sono presenti 2 o più allegati:
  1. *Didascalia 1° allegato*: il messaggio personalizzato accompagna il primo file inviato.
  2. *Didascalia ultimo allegato*: i file precedenti vengono inviati senza didascalia e l'ultimo file trasporta il testo.
  3. *Messaggio a parte*: tutti i file vengono inviati in sequenza come media WhatsApp e il testo viene inviato subito dopo come messaggio dedicato.
- **Anteprima WhatsApp Dinamica a Fumetti Multipli**: simulazione in tempo reale nel riquadro di anteprima dell'esatta sequenza di fumetti WhatsApp generata dalla modalità scelta.
- **Tracciamento Completo nel Report di Esito**: salvataggio automatico nel file `esito.json` dell'elenco completo di tutti i file inviati (`attachments`) e della modalità didascalia impiegata (`attachmentPosition`).
- **Avviso Preventivo Connessione per Peso Elevato**: segnalazione visiva sul badge del peso complessivo e alert dedicato quando la dimensione totale degli allegati supera i 50 MB.

### Changed

- **Invio Continuo Non Presidiato**: rimozione del blocco automatico della coda su errori singoli o timeout (`send-uncertain`), garantendo che le sessioni notturne o non presidiate portino a termine tutti i destinatari registrando gli errori come `failed` o `skipped`.
- **Gestione Intelligente Audio su WhatsApp Web**: fallback automatico a messaggio separato se il file designato per la didascalia è una nota audio, rispettando i vincoli tecnici della piattaforma.
- **Pausa Tecnica Sequenziale MMS**: intermezzo di sicurezza di 1.5 secondi tra gli allegati dello stesso destinatario per assicurare il corretto upload dei media su WhatsApp Web prima del successivo invio.

Full Changelog: [https://github.com/CorsiDanilo/AvisWhatsAppSender/compare/v1.2.1...v1.3.0](https://github.com/CorsiDanilo/AvisWhatsAppSender/compare/v1.2.1...v1.3.0)

---
## [1.2.1] - 2026-10-14

### Summary

Release di affinamento incentrata sulla gestione avanzata del ciclo di vita del codice QR di WhatsApp, sul riconoscimento automatico dei prefissi e particelle nei cognomi italiani, sulla validazione dei nominativi donatori e su controlli più rigorosi di invio messaggi.

### Added

- **Gestione QR Scaduto e Ricarica Interattiva**: transizione dedicata allo stato `qr_expired` con overlay visivo sul QR e pulsante di ricarica manuale (`🔄 Ricarica codice QR`) quando il tempo di scansione (~20s) termina, prevenendo notifiche invasive di disconnessione.
- **Riconoscimento Prefissi Cognomi Italiani**: supporto integrato alle particelle e prefissi italiani (`de`, `di`, `del`, `della`, `dello`, `dei`, `degli`, `delle`, `da`, `dal`, `dalla`, `dallo`, `dalle`, `dai`, `dagli`, `la`, `lo`, `li`, `le`, `san`, `santa`, `santo`, `santi`, `van`, `von`, `d'`, `dell'`) sia nel parser donatori che nell'anteprima `ExcelPreviewModal`, garantendo la corretta separazione tra cognome e nome.
- **Validazione Nominativi e Avvisi Numerici**: rilevamento di cifre o caratteri non ammessi nelle colonne nominative con segnalazione contestuale e marcatura trasparente della motivazione di non validità.
- **Auto-Reset della Sessione su Logout**: azzeramento automatico e pulizia sicura delle credenziali locali in caso di disconnessione `LOGOUT` da WhatsApp Web.
- **Verifica Conferma Invio WhatsApp**: aggiunta della funzione di sicurezza `ensureWhatsAppSendResult` per rifiutare e intercettare tempestivamente invii non confermati dal server.

### Changed

- **Soppressione Notifiche Ridondanti di Disconnessione**: le disconnessioni multiple ravvicinate o legate al timeout QR non producono più notifiche di sistema ripetute.
- **Sincronizzazione Sequenza di Chiusura Client**: completamento garantito della diagnostica prima della distruzione del client WhatsApp in caso di errore di connessione.

### Removed

- **File Legacy index.js**: rimosso lo script CLI obsoleto alla radice, centralizzando completamente il ciclo di vita dell'applicazione su Electron e GUI.

Full Changelog: [https://github.com/CorsiDanilo/AvisWhatsAppSender/compare/v1.2.0...v1.2.1](https://github.com/CorsiDanilo/AvisWhatsAppSender/compare/v1.2.0...v1.2.1)

---
## [1.2.0] - 2026-10-13

### Summary

Importante release di ampliamento che introduce il supporto completo ai cognomi composti con strategia di split selezionabile e suggerimenti live nell'anteprima, stima del tempo residuo in tempo reale (Live ETA), report sessione WhatsApp per destinatari multipli con rubrica, automazioni di spegnimento/sospensione post-invio e riorganizzazione delle impostazioni generali.

### Added

- **Riconoscimento Avanzato Cognome e Nome (Split Strategy)**: nuova strategia di estrazione predefinita per colonna unica (`lastWordIsName`) che estrae l'ultima parola come nome (`[nome]`) e le parole precedenti come cognome composto (`[cognome]`), risolvendo in automatico cognomi composti come *Cognome Composto*.
- **Opzione di Split Selezionabile nell'Importazione**: modale di importazione Excel/CSV aggiornato con selezione tra *"Ultima parola = Nome"* (predefinita) e *"Prima parola = Cognome"* (per donatori con cognome singolo e doppi nomi) con aggiornamento istantaneo dell'anteprima a 5 righe.
- **Ricerca e Suggerimenti Live nell'Anteprima Step 2**: campo di ricerca rapida per nome/cognome/telefono con menu a discesa contestuale che mostra in tempo reale l'anteprima del messaggio personalizzato e supporta la navigazione da tastiera (`▲`/`▼`/`Invio`/`Esc`), oltre ai controlli freccia `◀` `▶`.
- **Stima Tempo Residuo in Tempo Reale (Live ETA)**: indicatore dinamico durante l'invio che calcola ore e minuti mancanti in base ai contatti rimanenti, ritardi configurati e pause programmate (con badge dedicato in stato di pausa).
- **Destinatari Multipli Report WhatsApp**: configurazione nella scheda "Generali" di una rubrica con uno o più numeri etichettati (es. Presidente, Segreteria) a cui inviare il riepilogo a fine sessione.
- **Selezione Rapida Report e Azioni per Sessione**: chip interattivi nello Step 3 (Riepilogo) per attivare/disattivare al volo i destinatari del report e selezionare l'azione post-invio per il PC specifica per la singola sessione.
- **Automazioni di Fine Sessione**: opzione per spegnere, sospendere o ibernare automaticamente il PC al termine dell'invio, con banner interattivo e conto alla rovescia di 60 secondi annullabile in qualsiasi momento.
- **Scheda "Generali" nelle Impostazioni**: riorganizzazione dell'interfaccia con raggruppamento chiaro per sistema (avvio automatico Windows, notifiche), rubrica report, automazioni PC e cartelle di archiviazione.

### Changed

- **Capitalizzazione Intelligente Nomi Composti**: aggiornato il motore di render dei template per capitalizzare correttamente tutte le parole dei cognomi composti (es. *Cognome Composto* anziché *Cognome composto*).
- **Perfezionamento Calcolo ETA**: escluso l'intervallo di attesa successivo all'ultimo messaggio e integrato l'overhead di digitazione/invio per una stima oraria accurata.
- **Accessibilità & Riduzione Movimento**: introdotta la media query `@media (prefers-reduced-motion: reduce)` per il monitoraggio ETA.
- **Semplificazione Step 3 (Riepilogo)**: rimossa la scheda ridondante dello stato connessione WhatsApp da Step 3 e aggiunta modifica rapida (`✏️ Modifica`).
- **Aggiornamento Documentazione**: sincronizzati la Guida interna (sezioni 10, 11 e 13), il tutorial interattivo e il README con tutte le ultime funzionalità.

### Fixed

- **Pulsante Schermata Principale su Arresto Sessione**: risolta la mancata risposta del pulsante "← Ritorna alla schermata principale" dopo l'arresto manuale ("Ferma sessione") o il completamento della coda.
- **Ripristino Dashboard su Riconnessione**: ripristino automatico e sicuro della vista dei risultati in caso di disconnessione o riavvio dell'applicazione con sessione pregressa.
- **Validazione e Normalizzazione Numeri**: utility condivisa frontend per la validazione e l'aggiunta automatica del prefisso internazionale italiano (+39).
- **Esportazione Campi Personalizzati**: preservati correttamente i valori validi `0` e `false` nei file CSV degli esiti.
- **Reset Sessione WhatsApp**: la coda viene messa in pausa prima della distruzione del client durante il reset.

Full Changelog: [https://github.com/CorsiDanilo/AvisWhatsAppSender/compare/v1.1.0...v1.2.0](https://github.com/CorsiDanilo/AvisWhatsAppSender/compare/v1.1.0...v1.2.0)

---

## [1.1.0] - 2026-10-11

### Added
- **Segnalazione diagnostica flessibile**: invio dei log allo sviluppatore tramite Gmail, client di posta Windows oppure copia negli appunti.
- **Gestione aggiornamenti più visibile**: avvisi in-app, notifica Windows e procedura guidata per scaricare e installare le nuove versioni.
- **Ripristino sessione WhatsApp**: azzeramento dei dati di autenticazione e generazione di un nuovo QR code direttamente dall'app.

### Changed
- **Importazione donatori più compatibile**: supporto per CSV separati da punto e virgola, colonne AVIS preselezionate e fallback alla mappatura automatica esistente.
- **Riconoscimento cognome e nome da colonna unica**: la colonna singola (es. `COGNOMEENOME`) estrae ora per impostazione predefinita il cognome dalla prima parola e assegna il primo nome utile delle restanti parole al tag saluto `[nome]`.
- **Compleanni da Excel**: riconoscimento delle date seriali di Excel e dei formati senza anno.
- **Stima invio più leggibile**: durate espresse in ore e minuti quando necessario.

### Fixed
- **Reset della sessione WhatsApp**: il reset non può più riutilizzare o ricevere eventi dal tentativo di connessione precedente.
- **Indicatore e gestione connessione WhatsApp**: stato "Connesso" con pallino verde esteso alla fase autenticata e apertura garantita del dialog di gestione anche durante l'avvio della sessione.

---

## [1.0.0] - 2026-10-08

### Summary
Prima release ufficiale di produzione di **AVIS WhatsApp Sender**. L'applicazione fornisce una soluzione completa, sicura e moderna per la gestione e l'invio personalizzato di comunicazioni e promemoria ai donatori AVIS tramite WhatsApp Web.

### Added
- **Automazione WhatsApp Web**: integrazione sicura tramite `whatsapp-web.js` con autenticazione persistente locale, login rapido via QR code e gestione dello stato di connessione.
- **Gestione Destinatari Avanzata**: supporto per elenchi donatori in formato Excel (`.xlsx`, `.xls`) e CSV, con rilevamento automatico delle colonne, normalizzazione dei numeri telefonici italiani e conservazione dei campi personalizzati.
- **Compositore Messaggi & Modelli Dinamici**: supporto per tag personalizzati (`[nome]`, `[cognome]`, ecc.), allegati grafici (JPG, JPEG, PNG) archiviati in modo permanente nell'area dati dell'applicazione, e gestione preset salvabili.
- **Invio Umanizzato & Anti-Ban**: cadenza controllata con ritardi minimi/massimi configurabili, pause periodiche ogni blocco di messaggi, controlli in tempo reale di avvio/pausa/arresto e barra di avanzamento.
- **Centro Promemoria Compleanni**: verifica giornaliera della lista compleanni all'avvio, notifiche Windows dedicate, avviso visivo con badge rosso persistente, e procedura guidata per la preparazione della sessione di auguri senza invio automatico.
- **Centro Notifiche Integrato**: visualizzazione degli avvisi interni e di sistema, gestione dello stato di lettura, eliminazione di singole notifiche e cancellazione totale dell'elenco.
- **Reportistica & Esportazione Esiti**: generazione automatica del report completo della sessione in Excel (`.xlsx`), file di dettaglio dedicato agli invii falliti (`esito_falliti.csv`) e archiviazione storica dei log operativi.
- **Segnalazione Errori & Invio Log via Email**: pulsante rapido per l'invio via email allo sviluppatore (`danilo.corsi@outlook.it`) con generazione automatica del file `.txt`, composizione della bozza `.eml` con allegato MIME ed evidenziazione del file in Esplora Risorse.
- **Interfaccia Grafica Moderna & Accessibile**: GUI realizzata in React 19 e Vite con set di icone vettoriali Lucide, modalità Tutorial Interattivo per simulazioni protette senza invii reali, e manuale operativo integrato.
- **Ripristino Errori Interfaccia (Error Boundary)**: gestione integrata degli errori runtime React con schermata di failover per evitare blocchi dell'interfaccia e consentire il riavvio o l'invio immediato dei log.
- **Sistema di Aggiornamento Automatico**: auto-updater integrato (`electron-updater`) con verifica su GitHub Releases, indicatore visivo di nuove versioni e installazione guidata in un click.
- **Workflow CI/CD**: pipeline GitHub Actions per la compilazione automatizzata dell'installer Windows NSIS (`.exe`) e pubblicazione delle release ufficiali.
