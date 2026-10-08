export default function Guide({ onClose, onStartTutorial }) {
  return (
    <div
      className="guide-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <div className="guide-header">
          <div>
            <span className="eyebrow">Manuale operativo completo</span>
            <h2 id="guide-title">Guida all'uso di AVIS Sender</h2>
          </div>
          <button className="guide-close" onClick={onClose} aria-label="Chiudi guida">
            ×
          </button>
        </div>

        <div className="guide-content">
          {/* Box di lancio rapido del tutorial interattivo */}
          {onStartTutorial && (
            <div className="guide-tutorial-cta">
              <div className="guide-tutorial-cta-icon">🎓</div>
              <div className="guide-tutorial-cta-body">
                <strong>Preferisci una prova pratica guidata?</strong>
                <p>
                  Avvia il <strong>Tutorial Interattivo</strong> per provare tutte le schermate e la dashboard di invio in modalità simulata protetta, senza inviare alcun messaggio reale.
                </p>
                <button
                  type="button"
                  className="button button-primary button-small"
                  onClick={() => {
                    onClose()
                    onStartTutorial()
                  }}
                >
                  🚀 Avvia Tutorial Interattivo
                </button>
              </div>
            </div>
          )}

          <h3>1. Preparazione della lista donatori (Excel o CSV)</h3>
          <p>
            Puoi caricare file in formato <strong>Excel (.xlsx, .xls)</strong> oppure <strong>CSV</strong>.
            I file devono includere almeno una colonna con i numeri di telefono. Possono essere presenti anche colonne per <strong>Nome</strong>, <strong>Cognome</strong> o qualsiasi informazione aggiuntiva utile (es. <em>Gruppo Sanguigno</em>, <em>Sede</em>, <em>Data Ultima Donazione</em>).
          </p>
          <div className="guide-note">
            <strong>Supporto Multi-Foglio:</strong> Se il file Excel contiene più fogli di lavoro (sheet), l'applicazione ti consente di selezionare esattamente quale foglio leggere dall'anteprima di caricamento.
          </div>

          <h3>2. Mappatura intelligente delle colonne</h3>
          <p>
            Al caricamento del file, si apre automaticamente la finestra di anteprima dei dati con le prime 10 righe.
            Il sistema riconosce in automatico i nomi delle intestazioni più comuni (es. <em>Cellulare</em>, <em>Telefono</em>, <em>Mobile</em>, <em>Nominativo</em>). Puoi:
          </p>
          <ul>
            <li>Assegnare la colonna obbligatoria per il <strong>Telefono</strong>.</li>
            <li>Assegnare le colonne per <strong>Nome</strong> e <strong>Cognome</strong>.</li>
            <li>Selezionare colonne personalizzate aggiuntive (es. <em>Gruppo</em>): i loro valori diventeranno utilizzabili come tag dinamici nel testo (es. <code>[Gruppo]</code>).</li>
            <li>In qualsiasi momento, puoi riaprire la configurazione cliccando su <strong>“Riconfigura colonne”</strong> nello Step 1.</li>
          </ul>

          <h3>3. Validazione e normalizzazione automatica dei numeri</h3>
          <p>
            L'applicazione controlla e pulisce ogni contatto:
          </p>
          <ul>
            <li>Rimuove spazi, trattini, punti e caratteri non numerici.</li>
            <li>Se il prefisso internazionale manca, applica in automatico il prefisso italiano <strong>39</strong> (es. da <code>333 1234567</code> a <code>393331234567</code>).</li>
            <li>Rileva e scarta automaticamente numeri non validi, numeri fissi o contatti incompleti, contrassegnandoli con badge rosso ed escludendoli dall'invio per evitare errori.</li>
          </ul>

          <h3>4. Ricerca e filtri sui destinatari</h3>
          <p>
            Nello Step 1 (Destinatari) hai a disposizione:
          </p>
          <ul>
            <li><strong>Filtri rapidi:</strong> Mostra tutti i contatti, solo quelli con numero valido o solo quelli scartati.</li>
            <li><strong>Ricerca istantanea:</strong> Filtra velocemente per nome, cognome o parte del numero di telefono.</li>
            <li><strong>Selezione multipla o singola:</strong> Seleziona o deseleziona tutti i contatti con un click, oppure escludi singoli donatori togliendo la spunta dalla casella.</li>
          </ul>

          <h3>5. Collegamento a WhatsApp Web & QR Code</h3>
          <p>
            Premi <strong>“Collega WhatsApp”</strong> (o clicca sull'indicatore di stato in alto a destra).
            Quando viene generato il QR code:
          </p>
          <ol>
            <li>Apri WhatsApp sul tuo smartphone.</li>
            <li>Vai in <strong>Impostazioni → Dispositivi collegati → Collega un dispositivo</strong>.</li>
            <li>Inquadra il codice a schermo e attendi lo stato verde <strong>“Pronto”</strong>.</li>
          </ol>
          <div className="guide-note">
            <strong>Sessione persistente:</strong> Il collegamento rimane memorizzato nella cartella dati dell'applicazione. Ai successivi avvii, l'app si riconnetterà in automatico senza richiedere nuovamente la scansione del QR code.
          </div>

          <h3>6. Modelli, preset e tag dinamici</h3>
          <p>
            Puoi selezionare un modello predefinito dal menu a tendina oppure aprirne la gestione completa da <strong>⚙️ Impostazioni → Modelli & Preset</strong> per creare, modificare o eliminare template.
          </p>
          <p>
            Puoi personalizzare ogni messaggio inserendo:
          </p>
          <ul>
            <li><code>[nome]</code>: sostituito con il nome del donatore (o con "Donatore" se mancante).</li>
            <li><code>[cognome]</code>: sostituito con il cognome del donatore.</li>
            <li>Qualsiasi tag mappato dalle colonne Excel personalizzate (es. <code>[Gruppo]</code>, <code>[DataUltima]</code>).</li>
          </ul>
          <p>
            A destra dell'area di scrittura trovi l'<strong>anteprima smartphone in tempo reale</strong> con il fumetto in stile WhatsApp, renderizzata sul primo donatore valido selezionato.
          </p>

          <div className="guide-note">
            <strong>Allegati nei preset:</strong> dalla sezione <strong>Impostazioni → Modelli & Preset</strong> puoi associare a ogni modello un'immagine JPG, JPEG o PNG. L'app ne conserva una copia nella propria cartella dati e la ricarica automaticamente quando selezioni il preset.
          </div>

          <h3>7. Promemoria compleanni</h3>
          <p>
            In <strong>Impostazioni → Compleanni</strong> puoi selezionare direttamente una lista CSV o Excel dedicata. La lista deve contenere nome, telefono e data di nascita (ad esempio una colonna <code>DATADINASCITA</code>).
          </p>
          <ul>
            <li>All'avvio l'app controlla la lista e, se trova compleanni, mostra una notifica Windows e un pallino rosso sul pulsante <strong>🎂 Compleanni</strong>.</li>
            <li>Puoi controllare la lista in qualsiasi momento dalla barra superiore o dall'icona nell'area di notifica di Windows.</li>
            <li>Con <strong>Prepara gli auguri</strong> vengono importati soltanto i donatori interessati e viene caricato il preset selezionato.</li>
          </ul>
          <div className="guide-note">
            <strong>Invio sempre manuale:</strong> il promemoria non invia messaggi da solo. Prima dell'invio puoi controllare o modificare destinatari, testo, allegato e riepilogo come per ogni altra sessione.
          </div>

          <h3>8. Foto e allegati grafici</h3>
          <p>
            Cliccando su <strong>“Seleziona foto”</strong> puoi allegare un'immagine nei formati standard (JPG, JPEG o PNG) fino a 16 MB.
            La foto viene inviata come messaggio con immagine, e il testo personalizzato farà da didascalia (caption). Puoi vedere l'anteprima dell'immagine direttamente nell'interfaccia e rimuoverla con un clic prima dell'invio.
          </p>

          <h3>9. Ritmo di invio anti-ban e protezione numero</h3>
          <p>
            Per evitare che WhatsApp consideri l'attività come spam automatizzato, il sistema implementa un algoritmo di sicurezza con ritmi naturali e variabili:
          </p>
          <ul>
            <li><strong>Intervallo minimo e massimo (in secondi):</strong> Il tempo effettivo tra un messaggio e l'altro varia in modo casuale all'interno di questo intervallo (es. tra 20 e 40 secondi).</li>
            <li><strong>Pausa programmata:</strong> Ogni X messaggi (es. 35 messaggi), il sistema sospende automaticamente l'invio per Y minuti (es. 15 minuti) prima di riprendere.</li>
          </ul>
          <div className="guide-note">
            Nello Step 2 e nello Step 3 viene mostrata la <strong>stima del tempo totale di trasmissione</strong> calcolata in tempo reale in base al ritmo scelto e al numero di donatori pronti.
          </div>

          <h3>10. Riepilogo pre-invio e verifica sicurezza</h3>
          <p>
            Lo Step 3 (Riepilogo) riassume tutti i parametri della sessione:
          </p>
          <ul>
            <li>Numero di donatori validi pronti per la ricezione e avviso su eventuali numeri scartati.</li>
            <li>Anteprima finale del messaggio e della foto allegata.</li>
            <li>Parametri del ritmo e durata stimata dell'invio.</li>
            <li>Pulsanti <strong>“✏️ Modifica”</strong> per tornare rapidamente allo Step desiderato e modificare i dati.</li>
          </ul>

          <h3>11. Dashboard operativa in tempo reale</h3>
          <p>
            Durante l'invio, l'applicazione mostra la schermata di monitoraggio con:
          </p>
          <ul>
            <li><strong>Barra di avanzamento percentuale</strong> e indicazione del donatore attualmente in lavorazione.</li>
            <li><strong>Contatori in tempo reale:</strong> inviati con successo, in attesa, falliti o scartati.</li>
            <li><strong>Comandi di controllo:</strong> puoi mettere la sessione in <strong>Pausa</strong>, <strong>Riprendere</strong> o <strong>Fermare</strong> l'invio in qualsiasi momento.</li>
            <li><strong>Log diagnostici live:</strong> eventi e comunicazioni di rete visualizzati in tempo reale (gli errori vengono evidenziati in rosso).</li>
          </ul>

          <h3>12. Archiviazione esiti e reportistica</h3>
          <p>
            Al termine dell'invio (o in caso di interruzione), l'applicazione crea automaticamente una cartella datata contenente i report completi:
          </p>
          <ul>
            <li><code>esito.csv</code>: foglio di calcolo con tutti i dettagli, orario di invio ed esito di ciascun contatto (inviato, scartato, errore).</li>
            <li><code>esito.json</code>: report strutturato leggibile da sistemi gestionali.</li>
          </ul>
          <p>
            Un comodo pulsante <strong>“📁 Apri esito in Esplora Risorse”</strong> consente di aprire direttamente la cartella generata senza doverla cercare manualmente.
          </p>

          <h3>13. Gestione cartelle, notifiche e avvio</h3>
          <p>
            Dal menu <strong>⚙️ Impostazioni → Cartelle e Archiviazione</strong> puoi:
          </p>
          <ul>
            <li>Cambiare la cartella in cui salvare gli esiti (predefinita sul Desktop: <code>AVIS WhatsApp Sender</code>).</li>
            <li>Cambiare la cartella in cui archiviare i log diagnostici.</li>
            <li>Aprire le rispettive cartelle o la cartella dati dell'applicazione direttamente in Esplora Risorse.</li>
            <li>Ripristinare i percorsi predefiniti in qualunque momento.</li>
            <li>Attivare o disattivare le notifiche Windows.</li>
          </ul>

          <p>
            Il pulsante <strong>🔔</strong> nella barra superiore apre il centro notifiche: gli avvisi restano disponibili, possono essere segnati come letti o non letti e quelli letti vengono raccolti nella scheda <strong>Già lette</strong>.
          </p>

          <h3>14. Aggiornamenti automatici da GitHub</h3>
          <p>
            L'applicazione verifica periodicamente se sono state rilasciate nuove versioni su GitHub:
          </p>
          <ul>
            <li>Se è disponibile una nuova versione, compare un banner in alto con il pulsante <strong>“Visualizza e aggiorna”</strong>.</li>
            <li>Nella scheda <strong>🔄 Aggiornamenti</strong> delle Impostazioni puoi visualizzare le novità della versione (note di rilascio), verificare manualmente gli aggiornamenti con <strong>“Controlla ora”</strong>, scaricare l'aggiornamento e applicarlo con <strong>“Riavvia e aggiorna ora”</strong>.</li>
          </ul>

          <h3>15. Nuova sessione</h3>
          <p>
            Il pulsante <strong>“↺ Nuova sessione”</strong> nella barra superiore pulisce la lista dei contatti, il messaggio e l'immagine allegata, consentendo di iniziare un nuovo invio da zero. Il collegamento WhatsApp, i modelli salvati e le impostazioni di ritmo rimangono invariati.
          </p>

          <p className="guide-note">
            <strong>Buone pratiche AVIS:</strong> Invia comunicazioni esclusivamente ai donatori che hanno rilasciato il proprio consenso. Invita sempre i donatori a <em>salvare il numero WhatsApp della sede AVIS</em> nella rubrica del proprio smartphone: questo garantisce la corretta ricezione e previene segnalazioni involontarie di spam.
          </p>
        </div>
      </section>
    </div>
  )
}
