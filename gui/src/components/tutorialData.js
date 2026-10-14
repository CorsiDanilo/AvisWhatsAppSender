export const TUTORIAL_DONORS = [
  {
    name: 'Nome',
    surname: 'Cognome',
    phone: '393331234567',
    rawPhone: '333 1234567',
    valid: true,
    selected: true,
    status: 'pending',
    customFields: { Gruppo: 'A Positivo', Donazioni: '12' },
  },
  {
    name: 'Nome Alternativo',
    surname: 'Cognome Alternativo',
    phone: '393479876543',
    rawPhone: '347 9876543',
    valid: true,
    selected: true,
    status: 'pending',
    customFields: { Gruppo: '0 Negativo', Donazioni: '5' },
  },
  {
    name: 'Nome Non Valido',
    surname: 'Cognome Non Valido',
    phone: '',
    rawPhone: '06 1234567',
    valid: false,
    reason: 'Numero di telefono non valido',
    selected: false,
    status: 'skipped',
    customFields: { Gruppo: 'B Positivo', Donazioni: '1' },
  },
  {
    name: 'Nome Secondo',
    surname: 'Cognome Secondo',
    phone: '393281122334',
    rawPhone: '+39 328 1122334',
    valid: true,
    selected: true,
    status: 'pending',
    customFields: { Gruppo: 'AB Positivo', Donazioni: '8' },
  },
  {
    name: 'Nome Terzo',
    surname: 'Cognome Terzo',
    phone: '393395566778',
    rawPhone: '339 5566778',
    valid: true,
    selected: true,
    status: 'pending',
    customFields: { Gruppo: '0 Positivo', Donazioni: '15' },
  },
]

export const TUTORIAL_MESSAGE = `Gentile [nome] [cognome],
ti ricordiamo il tuo appuntamento per la donazione di sangue AVIS Comunale! 🩸
Gruppo donatore: [Gruppo].

Grazie di cuore per la tua preziosa generosità!
AVIS Comunale`

export const TUTORIAL_STEPS = [
  {
    stepIndex: 1,
    title: '1. Connessione a WhatsApp & Sicurezza',
    subtitle: 'Verifica dello stato di collegamento',
    description:
      'In alto a destra trovi lo stato della connessione WhatsApp. Se è la prima volta, un click su "Collega WhatsApp" mostrerà il QR Code da scansionare col telefono. Una volta collegato, la sessione resta memorizzata. Se serve, "Riconnetti WhatsApp" ricarica la sessione esistente mentre "Azzera sessione" richiede un nuovo QR Code; gli errori iniziali vengono ritentati automaticamente e una disconnessione durante l’invio mette in pausa la coda.',
    actionLabel: 'Vai a Destinatari & File →',
    targetWizardStep: 1,
  },
  {
    stepIndex: 2,
    title: '2. Caricamento Lista, Filtri e Mappatura',
    subtitle: 'Importazione Excel o CSV intelligente',
    description:
      'Qui vedi la lista dei donatori importata. L\'applicazione mostra fino a 5 righe di anteprima, supporta CSV ed Excel con più fogli, riconosce le colonne più comuni e permette di scegliere come dividere una colonna unica nome/cognome. Normalizza i numeri (aggiungendo il prefisso 39), segnala le righe senza cognome rilevabile e scarta i numeri fissi o non validi. Puoi usare ricerca, filtri e selezione singola o multipla; la sezione Compleanni usa una lista dedicata e prepara gli auguri solo dopo una conferma manuale.',
    actionLabel: 'Vai a Composizione Messaggio →',
    targetWizardStep: 2,
  },
  {
    stepIndex: 3,
    title: '3. Composizione Messaggio, Tag e Foto',
    subtitle: 'Personalizzazione dinamica e ritmo anti-ban',
    description:
      'Usa i pulsanti [nome], [cognome] e i tag delle colonne personalizzate per personalizzare il testo. A destra vedi l\'anteprima in tempo reale come apparirà su WhatsApp, con fallback neutri se un dato manca. Puoi allegare una foto direttamente all’invio o a un preset, regolare intervallo minimo/massimo e pausa programmata, quindi controllare la durata stimata.',
    actionLabel: 'Vai al Riepilogo Generale →',
    targetWizardStep: 3,
  },
  {
    stepIndex: 4,
    title: '4. Riepilogo Generale Pre-Invio',
    subtitle: 'Ultimo controllo prima della partenza',
    description:
      'Il riepilogo ti mostra i destinatari effettivi pronti all\'invio, la stima della durata totale e l\'anteprima finale. Puoi scegliere l\'azione da eseguire sul PC al termine (spegni, sospendi, iberna), attivare i destinatari del report WhatsApp e aggiungerne uno al volo. I contatti con esito da verificare bloccano una nuova sessione finché non controlli WhatsApp; nessun messaggio parte finché non confermi con il pulsante verde di avvio.',
    actionLabel: 'Prova la Simulazione di Invio 🚀',
    targetWizardStep: 'simulation',
  },
  {
    stepIndex: 5,
    title: '5. Dashboard Operativa & Simulazione Live',
    subtitle: 'Monitoraggio in tempo reale a rischio zero',
    description:
      'Questa è la dashboard di invio: i contatti vengono elaborati uno alla volta con intervalli casuali e pause programmate. Puoi mettere in Pausa, Riprendere o Fermare in qualsiasi istante e vedi gli stati Inviato, Fallito, Scartato e Da verificare. In caso di timeout il destinatario non viene ritentato automaticamente: verifica WhatsApp prima di riprendere. Al termine trovi esito.csv, esito.json e, se necessario, esito_falliti.csv nella cartella degli esiti; notifiche, log diagnostici giornalieri e aggiornamenti restano disponibili nelle Impostazioni.',
    actionLabel: 'Concludi Tutorial 🎉',
    targetWizardStep: 'simulation',
  },
]
