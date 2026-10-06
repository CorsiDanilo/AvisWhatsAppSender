function Guide({ onClose }) {
  return (
    <div className="guide-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <div className="guide-header">
          <div><span className="eyebrow">Manuale operativo</span><h2 id="guide-title">Come usare AVIS Sender</h2></div>
          <button className="guide-close" onClick={onClose} aria-label="Chiudi guida">×</button>
        </div>
        <div className="guide-content">
          <h3>1. Preparazione della lista</h3>
          <p>Prepara un file CSV oppure Excel (.xlsx/.xls) con le colonne <strong>Nome</strong>, <strong>Cognome</strong> e <strong>Telefono</strong>. Se il file Excel contiene più fogli, viene letto il primo. I numeri devono contenere il prefisso internazionale, ad esempio 393331234567 per un numero italiano. Carica il file dal pulsante “Seleziona file”.</p>

          <h3>2. Collegamento a WhatsApp</h3>
          <p>Premi “Collega WhatsApp”. Quando appare il QR code, apri WhatsApp sul telefono, vai in <strong>Impostazioni → Dispositivi collegati → Collega un dispositivo</strong> e inquadra il codice. Attendi lo stato “Pronto”.</p>

          <h3>3. Modelli e preset</h3>
          <p>Scegli un preset dal menu o clicca su <strong>⚙️ Impostazioni</strong> per creare, modificare o eliminare i modelli salvati e i rispettivi ritmi. Puoi inserire i tag <code>[nome]</code> o <code>[cognome]</code> per personalizzare automaticamente il testo.</p>

          <h3>4. Foto allegata</h3>
          <p>Con “Seleziona foto” puoi allegare una sola immagine JPG, JPEG o PNG, fino a 16 MB. La foto viene inviata insieme al testo come didascalia. Puoi rimuoverla prima dell’invio.</p>

          <h3>5. Flusso a passi guidati</h3>
          <p>L’applicazione ti guida in 3 passi: <strong>1. Destinatari</strong> (caricamento e selezione), <strong>2. Messaggio & Ritmo</strong> (testo, eventuale foto e intervalli) e <strong>3. Riepilogo</strong> (controllo generale e avvio). Puoi sempre tornare indietro o cliccare sugli step per modificare i dati.</p>

          <h3>6. Ritmo di invio</h3>
          <p>Imposta l’intervallo minimo e massimo tra i messaggi, quanti messaggi inviare prima di una pausa e la durata della pausa. Il valore effettivo varia in modo casuale per proteggere il numero.</p>

          <h3>7. Avvio e controllo</h3>
          <p>Durante l'invio puoi monitorare in tempo reale i messaggi inviati, il donatore in elaborazione, i log e usare i pulsanti Pausa, Riprendi e Ferma.</p>

          <h3>8. Esiti, cartelle e impostazioni</h3>
          <p>Al termine, l’esito viene salvato nella cartella configurata (predefinita sul Desktop in <code>AVIS WhatsApp Sender\&lt;Preset&gt;_&lt;DataOra&gt;</code>) con i file <code>esito.json</code> ed <code>esito.csv</code>. Puoi cambiare la cartella degli esiti e dei log in qualunque momento dal menu <strong>⚙️ Impostazioni</strong> in alto.</p>

          <h3>9. Nuova sessione</h3>
          <p>Premi “Nuova sessione” per rimuovere lista, foto, messaggio e stato della sessione. Il collegamento WhatsApp, i preset e il ritmo salvato restano disponibili.</p>

          <p className="guide-note"><strong>Buona pratica:</strong> invia comunicazioni solo a persone che hanno dato il consenso e verifica sempre lista, testo e destinatari prima di avviare.</p>
        </div>
      </section>
    </div>
  )
}

export default Guide
