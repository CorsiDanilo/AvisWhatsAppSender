# AVIS WhatsApp Sender

Applicazione desktop per le sezioni AVIS che permette di preparare e inviare comunicazioni personalizzate ai donatori tramite WhatsApp Web.

[![Versione](https://img.shields.io/badge/versione-1.1.0-green.svg)](package.json)
[![Piattaforma](https://img.shields.io/badge/piattaforma-Windows-blue.svg)](https://github.com/CorsiDanilo/AvisWhatsAppSender)
[![CI Build](https://github.com/CorsiDanilo/AvisWhatsAppSender/actions/workflows/build_installer.yml/badge.svg)](https://github.com/CorsiDanilo/AvisWhatsAppSender/actions)

## Funzioni principali

- Importa liste di destinatari da file `.xlsx`, `.xls` e `.csv`, associa le colonne e normalizza i numeri di telefono.
- Crea modelli di messaggio con tag dinamici, ad esempio `[nome]`, `[cognome]` e le colonne personalizzate della lista.
- Salva preset completi: testo, ritmo di invio e un allegato immagine opzionale (`.jpg`, `.jpeg`, `.png`). L'allegato viene copiato nell'area dati interna dell'app, quindi resta disponibile anche se il file originale viene spostato.
- Mostra un'anteprima prima dell'invio e applica pause e ritardi configurabili tra i messaggi.
- Genera report di esito e log locali al termine di ogni sessione.
- Controlla gli aggiornamenti da GitHub e li rende disponibili dall'applicazione.

## Promemoria compleanni

L'applicazione può controllare ogni giorno una lista dedicata e ricordare agli operatori quali donatori compiono gli anni. Non invia mai gli auguri in automatico: prepara solamente una normale sessione di invio, che deve essere verificata e avviata dall'operatore.

### Configurazione della lista

In **Impostazioni → Compleanni** attiva il controllo, seleziona direttamente il file della lista (`.csv`, `.xlsx` o `.xls`) e scegli il preset da usare per il messaggio di auguri.

La lista deve contenere almeno le colonne per **nome**, **telefono** e **data di nascita**. Per la data di nascita sono riconosciute intestazioni come `DATADINASCITA`, `Nascita`, `BirthDate` e `DOB`; sono accettati i formati `GG/MM/AAAA`, `GG-MM-AAAA` e `AAAA-MM-GG`.

Al primo avvio dell'applicazione viene eseguito il controllo. Se ci sono compleanni, compare una notifica Windows e il promemoria resta disponibile dal pulsante **🎂 Compleanni** o dall'icona dell'app nell'area di notifica di Windows. Il pallino rosso resta visibile finché gli auguri non sono stati preparati.

Con **Prepara gli auguri** vengono importati soltanto i donatori che compiono gli anni, viene caricato il preset scelto e si torna alla normale procedura: controlla destinatari, testo, allegato e riepilogo prima di confermare l'invio.

## Notifiche e avvio automatico

Le notifiche Windows possono essere attivate o disattivate in **Impostazioni → Cartelle e Archiviazione**. Tutte le notifiche create dall'app restano consultabili dal pulsante **🔔** in alto a destra:

- le notifiche non lette mostrano un pallino rosso;
- possono essere segnate come lette o non lette;
- le notifiche lette sono conservate nella scheda **Già lette**, non vengono eliminate.

Nella sezione **Compleanni** è disponibile anche l'opzione per avviare AVIS WhatsApp Sender con Windows. Il controllo richiede che il file selezionato resti disponibile nel suo percorso.

## Uso rapido

1. Apri una nuova sessione e carica il file dei destinatari.
2. Controlla il riconoscimento delle colonne e seleziona i contatti validi.
3. Collega WhatsApp Web tramite QR code, se necessario.
4. Scegli o modifica il preset, controlla il testo e l'eventuale allegato.
5. Imposta il ritmo di invio, verifica il riepilogo e avvia solo dopo il controllo finale.

La sezione **Guida & Tutorial** contiene un tutorial simulato: nessun messaggio reale viene inviato durante la simulazione.

## Privacy e uso responsabile

I dati dei donatori, le credenziali di WhatsApp, i preset e gli allegati salvati rimangono sul computer dell'operatore. Utilizza l'applicazione solo per contatti che hanno dato il consenso a ricevere comunicazioni WhatsApp e rispetta le condizioni d'uso del servizio.

## Sviluppo e build locale

Requisiti: Node.js 20 o superiore, npm e Windows.

```bash
npm install
npm --prefix gui install
npm start
```

Per creare l'installer Windows NSIS:

```bash
npm run build:win
```

L'installer `.exe` e la cartella non compressa vengono generati in `dist/`.

## Rilascio

Per pubblicare una versione ufficiale, aggiorna la versione in `package.json` e il changelog, esegui le verifiche, quindi crea e pubblica il tag Git corrispondente. GitHub Actions genera l'installer e i metadati di aggiornamento dalla release.
