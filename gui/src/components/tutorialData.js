export const TUTORIAL_DONORS = [
  {
    name: 'Mario',
    surname: 'Rossi',
    phone: '393331234567',
    rawPhone: '333 1234567',
    valid: true,
    selected: true,
    status: 'pending',
    customFields: { Gruppo: 'A Positivo', Donazioni: '12' },
  },
  {
    name: 'Laura',
    surname: 'Bianchi',
    phone: '393479876543',
    rawPhone: '347 9876543',
    valid: true,
    selected: true,
    status: 'pending',
    customFields: { Gruppo: '0 Negativo', Donazioni: '5' },
  },
  {
    name: 'Giuseppe',
    surname: 'Verdi',
    phone: '',
    rawPhone: '06 1234567',
    valid: false,
    selected: false,
    status: 'skipped',
    customFields: { Gruppo: 'B Positivo', Donazioni: '1' },
  },
  {
    name: 'Anna',
    surname: 'Neri',
    phone: '393281122334',
    rawPhone: '+39 328 1122334',
    valid: true,
    selected: true,
    status: 'pending',
    customFields: { Gruppo: 'AB Positivo', Donazioni: '8' },
  },
  {
    name: 'Marco',
    surname: 'Gialli',
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
      'In alto a destra trovi lo stato della connessione WhatsApp. Se è la prima volta, un click su "Collega WhatsApp" mostrerà il QR Code da scansionare col telefono. Una volta collegato, la sessione resta memorizzata.',
    actionLabel: 'Vai a Destinatari & File →',
    targetWizardStep: 1,
  },
  {
    stepIndex: 2,
    title: '2. Caricamento Lista, Filtri e Mappatura',
    subtitle: 'Importazione Excel o CSV intelligente',
    description:
      'Qui vedi la lista dei donatori importata. L\'applicazione normalizza i numeri (aggiungendo il prefisso 39) e scarta i numeri fissi o non validi (come Giuseppe Verdi). Puoi usare la barra di ricerca o filtrare solo i validi.',
    actionLabel: 'Vai a Composizione Messaggio →',
    targetWizardStep: 2,
  },
  {
    stepIndex: 3,
    title: '3. Composizione Messaggio, Tag e Foto',
    subtitle: 'Personalizzazione dinamica e ritmo anti-ban',
    description:
      'Usa i pulsanti [nome] e [cognome] per personalizzare il testo. A destra vedi l\'anteprima in tempo reale come apparirà su WhatsApp! Puoi anche allegare una foto (inviata come didascalia) e regolare i secondi di attesa tra i messaggi.',
    actionLabel: 'Vai al Riepilogo Generale →',
    targetWizardStep: 3,
  },
  {
    stepIndex: 4,
    title: '4. Riepilogo Generale Pre-Invio',
    subtitle: 'Ultimo controllo prima della partenza',
    description:
      'Il riepilogo ti mostra i destinatari effettivi pronti all\'invio, la stima della durata totale e l\'anteprima finale. Nessun messaggio parte finché non confermi con il pulsante verde di avvio.',
    actionLabel: 'Prova la Simulazione di Invio 🚀',
    targetWizardStep: 'simulation',
  },
  {
    stepIndex: 5,
    title: '5. Dashboard Operativa & Simulazione Live',
    subtitle: 'Monitoraggio in tempo reale a rischio zero',
    description:
      'Questa è la dashboard di invio: i contatti vengono elaborati uno alla volta con intervalli casuali per proteggere il numero. Puoi mettere in Pausa, Riprendere o Fermare in qualsiasi istante. Al termine i report vengono salvati sul Desktop.',
    actionLabel: 'Concludi Tutorial 🎉',
    targetWizardStep: 'simulation',
  },
]
