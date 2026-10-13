# Matrice dei test

Questo documento descrive cosa viene verificato dalla suite automatica del progetto. I test sono divisi tra backend Node.js, bridge Electron e interfaccia React.

## Backend e sender

| Area | Cosa viene verificato | Test |
|---|---|---|
| Importazione destinatari | CSV con delimitatori diversi, Excel, colonne AVIS, mapping automatico, campi personalizzati, date Excel e gestione dei valori mancanti | [`test/recipients.test.js`](../test/recipients.test.js), [`test/import-mapping.test.js`](../test/import-mapping.test.js) |
| Editor destinatari | Creazione e modifica di un destinatario, validazione telefono, nomi composti, apostrofi, trattini e campi personalizzati | [`test/recipient-editor.test.js`](../test/recipient-editor.test.js) |
| Coda di invio | Avvio, pausa, ripresa, stop, destinatari falliti e stato `unknown` quando l’esito non è determinabile | [`test/queue.test.js`](../test/queue.test.js) |
| Timeout e retry | Timeout di consegna, completamento tardivo, retry degli errori transitori e interruzione per errori non ritentabili | [`test/send-timeout.test.js`](../test/send-timeout.test.js), [`test/retry.test.js`](../test/retry.test.js) |
| Sessione WhatsApp | Stati QR, autenticazione, `ready`, disconnessione, `auth_failure`, retry di inizializzazione, reset e protezione dagli eventi di client obsoleti | [`test/whatsapp-session.test.js`](../test/whatsapp-session.test.js) |
| Invio WhatsApp | Opzioni `waitUntilMsgSent` e `sendSeen`, controllo della disponibilità della sessione e report post-invio incerti | [`test/whatsapp-send-options.test.js`](../test/whatsapp-send-options.test.js), [`test/post-session.test.js`](../test/post-session.test.js) |
| Media | Estensioni supportate, file mancanti, directory, dimensione massima, payload immagine e caption | [`test/media.test.js`](../test/media.test.js) |
| Risultati | JSON di esito, CSV completo, CSV dei fallimenti, escaping dei valori e inclusione degli invii `unknown` | [`test/results.test.js`](../test/results.test.js) |
| Preset | Normalizzazione, preset predefiniti, preset compleanno, salvataggio, aggiornamento, cancellazione e JSON corrotto | [`test/presets.test.js`](../test/presets.test.js) |
| Allegati preset | Metadati sicuri, copia nel percorso applicativo e rimozione senza modificare il file sorgente | [`test/preset-attachments.test.js`](../test/preset-attachments.test.js) |
| Impostazioni | Valori predefiniti, limiti, file corrotti, notifiche, report destinatari e azioni di fine sessione | [`test/settings-notifications.test.js`](../test/settings-notifications.test.js) |
| Notifiche | Inserimento, conteggio non lette, lettura/non lettura, cancellazione singola e totale, persistenza | [`test/notifications.test.js`](../test/notifications.test.js) |
| Compleanni | Parsing date italiane, anni ignorati, 29 febbraio, righe non valide, sorgente, stato e promemoria giornaliero | [`test/birthdays.test.js`](../test/birthdays.test.js), [`test/birthday-source.test.js`](../test/birthday-source.test.js), [`test/birthday-state.test.js`](../test/birthday-state.test.js) |
| Log e diagnostica | Timestamp locale, rotazione log, mascheramento numeri di telefono, snapshot pagina e troncamento diagnostica | [`test/logger.test.js`](../test/logger.test.js), [`test/diagnostics.test.js`](../test/diagnostics.test.js), [`test/whatsapp-diagnostics.test.js`](../test/whatsapp-diagnostics.test.js) |
| Report sviluppatore | Messaggi, URL Gmail/mailto, EML, allegati e gestione dei log lunghi | [`test/developer-report.test.js`](../test/developer-report.test.js) |
| Errori utente | Traduzione di timeout WhatsApp, Puppeteer, importazione e aggiornamento in messaggi comprensibili | [`test/error-message.test.js`](../test/error-message.test.js) |
| Utility GUI condivise | Durate, mapping release notes e branding/icone | [`test/duration.test.js`](../test/duration.test.js), [`test/release-notes.test.js`](../test/release-notes.test.js), [`test/branding.test.js`](../test/branding.test.js) |
| Ciclo di vita finestra | Chiusura nel tray, riapertura, refresh compleanni e uscita esplicita | [`test/window-lifecycle.test.js`](../test/window-lifecycle.test.js) |

## Electron e bridge IPC

| Area | Cosa viene verificato | Test |
|---|---|---|
| API preload | Ogni metodo esposto da `window.whatsappSender`, canale IPC e argomenti inoltrati | [`test/preload.test.js`](../test/preload.test.js) |
| Listener IPC | Forward dello stato, evento apertura compleanni e funzioni di cleanup senza memory leak | [`test/preload.test.js`](../test/preload.test.js) |
| Contratto preload/main | Ogni canale `ipcRenderer.invoke` ha un corrispondente `registerHandler` in Electron | [`test/preload.test.js`](../test/preload.test.js) |
| Sintassi Electron | Controllo sintattico di `electron/main.cjs` e `electron/preload.cjs` | [`scripts/verify-release.cjs`](../scripts/verify-release.cjs) |

## Interfaccia React

| Area | Cosa viene verificato | Test |
|---|---|---|
| Avvio applicazione | Caricamento dello stato iniziale, registrazione listener e chiusura del tutorial iniziale | [`gui/src/App.test.jsx`](../gui/src/App.test.jsx) |
| Importazione | Anteprima file, mapping colonne, cambio foglio, normalizzazione nome/cognome e conferma importazione | [`gui/src/components/ExcelPreviewModal.test.jsx`](../gui/src/components/ExcelPreviewModal.test.jsx) |
| Destinatari | Ricerca, filtri, selezione massiva, selezione singola e aggiunta manuale | [`gui/src/components/StepRecipients.test.jsx`](../gui/src/components/StepRecipients.test.jsx) |
| Composizione messaggio | Preview personalizzata, ricerca destinatario, allegato foto e impostazioni ritmo | [`gui/src/components/StepComposer.test.jsx`](../gui/src/components/StepComposer.test.jsx) |
| Riepilogo | Rendering dei dati, validazione avvio, destinatario rapido del report e azione post-sessione | [`gui/src/components/StepSummary.test.jsx`](../gui/src/components/StepSummary.test.jsx) |
| Dashboard invio | Pausa, stop, ripresa condizionata a WhatsApp pronto, disconnessione e invio incerto | [`gui/src/components/SendingDashboard.test.jsx`](../gui/src/components/SendingDashboard.test.jsx) |
| Collegamento QR | Stato QR, riconnessione, reset sessione e chiusura modale | [`gui/src/components/QrModal.test.jsx`](../gui/src/components/QrModal.test.jsx) |
| Impostazioni | Toggle di sistema, notifiche, destinatari report, tab compleanni e controllo sorgente | [`gui/src/components/SettingsModal.test.jsx`](../gui/src/components/SettingsModal.test.jsx) |
| Compleanni | Controllo, preparazione sessione, inibizione degli avvisi e configurazione sorgente | [`gui/src/components/BirthdayCenter.test.jsx`](../gui/src/components/BirthdayCenter.test.jsx) |
| Notifiche | Filtri lette/non lette, azioni compleanni, lettura e cancellazione | [`gui/src/components/NotificationCenter.test.jsx`](../gui/src/components/NotificationCenter.test.jsx) |
| Report sviluppatore | Scelta del metodo di invio e visualizzazione dell’esito | [`gui/src/components/DeveloperReportModal.test.jsx`](../gui/src/components/DeveloperReportModal.test.jsx) |
| Error boundary | Visualizzazione errore e invio della segnalazione | [`gui/src/components/ErrorBoundary.test.jsx`](../gui/src/components/ErrorBoundary.test.jsx) |
| Navigazione e tutorial | Stepper, blocco navigazione durante l’invio, guida e tutorial interattivo | [`gui/src/components/StepperNav.test.jsx`](../gui/src/components/StepperNav.test.jsx), [`gui/src/Guide.test.jsx`](../gui/src/Guide.test.jsx), [`gui/src/components/InteractiveTutorial.test.jsx`](../gui/src/components/InteractiveTutorial.test.jsx) |

## Verifica prima del rilascio

Il comando consigliato è:

```bash
npm run verify-release
```

Esegue, in ordine:

1. test backend;
2. coverage backend;
3. test GUI;
4. coverage GUI;
5. lint GUI;
6. build di produzione della GUI;
7. controllo sintattico dei file Electron e sender.

## Cosa non viene simulato automaticamente

La suite non effettua un login reale, non apre WhatsApp Web e non invia messaggi a numeri reali. Non vengono quindi simulati direttamente:

- scansione e scadenza del QR reale;
- rete instabile o blocco del browser Puppeteer;
- rate limit e policy anti-abuso di WhatsApp;
- disconnessioni del telefono o del computer durante un invio reale;
- consegna effettiva del messaggio al server WhatsApp.

Questi casi richiedono uno smoke test manuale controllato, preferibilmente con un account e destinatari dedicati.
