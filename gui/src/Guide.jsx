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

          <h3>3. Preset e messaggio</h3>
          <p>Scegli un preset dal menu, modifica il testo e usa <code>[nome]</code> o <code>[cognome]</code> per inserire automaticamente i dati del destinatario. Scrivi il nome del preset e premi “Salva preset” per aggiornare quello esistente o crearne uno nuovo. “Nuovo” prepara un preset vuoto; “Elimina” rimuove quello selezionato.</p>

          <h3>4. Foto allegata</h3>
          <p>Con “Seleziona foto” puoi allegare una sola immagine JPG, JPEG o PNG, fino a 16 MB. La foto viene inviata insieme al testo come didascalia. Puoi rimuoverla prima dell’invio.</p>

          <h3>5. Destinatari</h3>
          <p>Dopo aver caricato il CSV, usa “Tutti” o “Nessuno”, oppure seleziona manualmente i destinatari. Solo quelli spuntati e con numero valido vengono messi in coda.</p>

          <h3>6. Ritmo di invio</h3>
          <p>Imposta l’intervallo minimo e massimo tra i messaggi, quanti messaggi inviare prima di una pausa e la durata della pausa. Il valore effettivo tra minimo e massimo varia per ogni invio. “Salva ritmo” conserva le impostazioni per gli avvii successivi.</p>

          <h3>7. Avvio e controllo</h3>
          <p>Controlla l’anteprima, poi premi “Avvia invio”. Durante la coda puoi mettere in pausa, riprendere o fermare l’operazione. Non chiudere WhatsApp Web e non spegnere il computer durante l’invio.</p>

          <h3>8. Esiti e diagnostica</h3>
          <p>Al termine, o quando fermi la coda, l’esito viene salvato automaticamente sul Desktop in <code>AVIS WhatsApp Sender\&lt;Preset&gt;_&lt;DataOra&gt;</code>, con i file <code>esito.json</code> ed <code>esito.csv</code>. I log tecnici giornalieri sono conservati nella cartella dati dell’applicazione per 30 giorni.</p>

          <h3>9. Nuova sessione</h3>
          <p>Premi “Nuova sessione” per rimuovere lista, foto, messaggio e stato della sessione. Il collegamento WhatsApp, i preset e il ritmo salvato restano disponibili.</p>

          <p className="guide-note"><strong>Buona pratica:</strong> invia comunicazioni solo a persone che hanno dato il consenso e verifica sempre lista, testo e destinatari prima di avviare.</p>
        </div>
      </section>
    </div>
  )
}

export default Guide
