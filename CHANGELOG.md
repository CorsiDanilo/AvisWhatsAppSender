# Changelog

All notable changes to the **AVIS WhatsApp Sender** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
