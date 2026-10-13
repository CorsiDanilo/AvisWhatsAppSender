# Test e verifica rilascio

La verifica standard non apre WhatsApp Web e non invia messaggi reali. Usa client e filesystem simulati per controllare le funzionalità backend, la gestione della sessione WhatsApp, il bridge Electron e i flussi principali della GUI.

## Comandi

- `npm test`: test backend, sender e controller WhatsApp.
- `npm run test:gui`: test React/Vitest con ambiente DOM simulato.
- `npm run verify-release`: suite completa prima del rilascio; include test, coverage, lint, build GUI e controllo sintattico di Electron/sender.

La coverage viene prodotta dai comandi `npm run test:coverage` e `npm run test:gui:coverage`.

La matrice dettagliata delle funzionalità coperte è disponibile in [test-matrix.md](test-matrix.md).

## Limite intenzionale

La suite automatica non può verificare il collegamento reale a WhatsApp Web, il QR, la rete, i timeout del browser o i limiti applicati dal servizio senza rendere il rilascio dipendente da un account e da una sessione reale. Questi aspetti vanno verificati con uno smoke test manuale controllato su un numero dedicato dopo il rilascio.
