# Changelog

All notable changes to the **AVIS WhatsApp Sender** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-10-12

### Summary

Release di ampliamento incentrata sull’automazione post-invio, sull'invio del resoconto su WhatsApp alla chat personale, sulla riorganizzazione delle impostazioni generali e sullo snellimento dell'interfaccia di riepilogo.

### Added

- **Automazioni di Fine Sessione**: opzione per spegnere, ibernare o sospendere automaticamente il PC al termine dell'invio.
- **Conto alla Rovescia di Sicurezza**: banner interattivo con timer di 60 secondi prima dell'esecuzione dell'azione sul PC, annullabile in qualsiasi momento con un clic.
- **Auto-Riepilogo su WhatsApp**: invio facoltativo del resoconto dell'invio (inviati, falliti, saltati, durata ed eventuali errori) direttamente alla propria chat personale ("Tu").
- **Scheda "Generali" nelle Impostazioni**: riorganizzazione della sezione con raggruppamento chiaro di sistema (avvio automatico con Windows, notifiche), automazioni post-invio e percorsi di archiviazione.

### Changed

- **Riepilogo Invio (Step 3)**: segue e mostra direttamente le impostazioni generali con collegamento rapido per la modifica (`✏️ Modifica`).
- **Snellimento Interfaccia**: rimossa la scheda dello stato connessione WhatsApp da Step 3, poiché già monitorata in tempo reale nella barra superiore.

### Fixed

- **Stato Connessione WhatsApp**: unificato lo stato connesso nella barra superiore e garantita l'apertura del modale di gestione al clic.
- **Riconoscimento Nomi Donatori**: impostata la logica di fallback su "Cognome Nome" per elenchi con colonna unica.

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
