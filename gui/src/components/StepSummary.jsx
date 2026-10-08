function previewMessage(message, donor) {
  if (!donor) return message
  return message
    .replaceAll('[nome]', donor.name || 'Mario')
    .replaceAll('[cognome]', donor.surname || 'Rossi')
}

export default function StepSummary({
  state,
  message,
  selectedPreset,
  options,
  canStart,
  firstSelectedDonor,
  onBack,
  onGoToStep,
  onStart,
  api,
  call,
}) {
  const selectedDonors = state.donors.filter((d) => d.selected !== false)
  const validSelectedDonors = selectedDonors.filter((d) => d.valid)
  const invalidSelectedDonors = selectedDonors.filter((d) => !d.valid)

  const isConnected = state.connection === 'ready'
  const isConnecting = state.connection === 'connecting'
  const isQr = state.connection === 'qr'

  const avgDelaySec = ((options.minDelayMs + options.maxDelayMs) / 2) / 1000
  const pauseCount = options.pauseAfter > 0 ? Math.floor(validSelectedDonors.length / options.pauseAfter) : 0
  const totalMinutesEst = Math.round((validSelectedDonors.length * avgDelaySec + pauseCount * options.pauseMinutes * 60) / 60)

  return (
    <div className="step-container">
      <div className="step-intro">
        <div>
          <span className="eyebrow">Passo 3 di 3</span>
          <h2>Riepilogo generale e avvio sessione</h2>
          <p className="muted">
            Verifica con attenzione i dettagli prima di iniziare. Puoi cliccare su ogni sezione o tornare indietro per modificare.
          </p>
        </div>
      </div>

      <div className="summary-grid">
        {/* Card 1: Destinatari */}
        <div className="panel summary-card">
          <div className="summary-card-header">
            <div>
              <span className="eyebrow">01 · Destinatari</span>
              <h3>Lista & Destinatari</h3>
            </div>
            <button
              type="button"
              className="link-btn"
              onClick={() => onGoToStep(1)}
              title="Modifica selezione destinatari"
            >
              ✏️ Modifica
            </button>
          </div>
          <div className="summary-card-content">
            <div className="summary-metric">
              <strong>{validSelectedDonors.length}</strong>
              <span>contatti pronti per l'invio</span>
            </div>
            <p className="subtle-note" style={{ marginTop: '8px' }}>
              File sorgente: <strong>{state.fileName || 'Nessun file'}</strong>
            </p>
            {invalidSelectedDonors.length > 0 && (
              <div className="summary-warning-pill">
                ⚠️ {invalidSelectedDonors.length} contatti selezionati con numero non valido (verranno saltati)
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Contenuto del Messaggio & Foto */}
        <div className="panel summary-card">
          <div className="summary-card-header">
            <div>
              <span className="eyebrow">02 · Contenuto</span>
              <h3>Messaggio & Allegato</h3>
            </div>
            <button
              type="button"
              className="link-btn"
              onClick={() => onGoToStep(2)}
              title="Modifica messaggio o allegato"
            >
              ✏️ Modifica
            </button>
          </div>
          <div className="summary-card-content">
            <div className="summary-message-preview">
              <span className="subtle-note">
                Modello: <strong>{selectedPreset}</strong> • Render per {firstSelectedDonor?.name || 'il donatore'}:
              </span>
              <div className="summary-text-box">
                {state.imageDataUrl && (
                  <div className="summary-image-preview-wrapper">
                    <img src={state.imageDataUrl} alt="Foto allegata" className="summary-image-preview-img" />
                  </div>
                )}
                <p className="summary-caption-text">
                  {previewMessage(message, firstSelectedDonor)}
                </p>
              </div>
            </div>
            <div className="summary-attachment-row">
              <span className="subtle-note">Allegato foto:</span>
              {state.imageName ? (
                <div className="summary-attachment-badge">
                  {state.imageDataUrl && (
                    <img src={state.imageDataUrl} alt="Foto allegata" className="summary-thumb" />
                  )}
                  <span>📷 {state.imageName}</span>
                </div>
              ) : (
                <span className="muted">Nessuna foto allegata (solo testo)</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Ritmo e Sicurezza */}
        <div className="panel summary-card">
          <div className="summary-card-header">
            <div>
              <span className="eyebrow">03 · Tempistiche</span>
              <h3>Ritmo anti-ban</h3>
            </div>
            <button
              type="button"
              className="link-btn"
              onClick={() => onGoToStep(2)}
              title="Modifica ritmo invio"
            >
              ✏️ Modifica
            </button>
          </div>
          <div className="summary-card-content">
            <ul className="summary-param-list">
              <li>
                <span>Intervallo casuale tra messaggi:</span>
                <strong>{options.minDelayMs / 1000}s – {options.maxDelayMs / 1000}s</strong>
              </li>
              <li>
                <span>Pausa programmata:</span>
                <strong>{options.pauseMinutes} min ogni {options.pauseAfter} messaggi</strong>
              </li>
              <li>
                <span>Durata totale stimata:</span>
                <strong>~{totalMinutesEst} minuti</strong>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 4: Connessione WhatsApp Web */}
        <div className={`panel summary-card whatsapp-status-card ${isConnected ? 'ready' : 'not-ready'}`}>
          <div className="summary-card-header">
            <div>
              <span className="eyebrow">Stato Connessione</span>
              <h3>WhatsApp Web</h3>
            </div>
          </div>
          <div className="summary-card-content">
            {isConnected ? (
              <div className="whatsapp-connected-banner">
                <span className="big-check-icon">✓</span>
                <div>
                  <strong>WhatsApp è collegato e pronto</strong>
                  <p className="subtle-note">L'applicazione è sincronizzata con la sessione attiva.</p>
                </div>
              </div>
            ) : (
              <div className="whatsapp-connect-prompt">
                <p style={{ margin: '0 0 10px', fontSize: '13px' }}>
                  WhatsApp non è collegato. È necessario sincronizzare il dispositivo prima di iniziare.
                </p>
                <div className="whatsapp-prompt-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => call(() => api.connect())}
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Connessione in corso…' : 'Collega WhatsApp'}
                  </button>
                </div>

                {isQr && state.qrDataUrl && (
                  <div className="qr-inline-card">
                    <img src={state.qrDataUrl} alt="QR Code WhatsApp" />
                    <div className="qr-inline-content">
                      <strong>Inquadra il QR con il telefono</strong>
                      <p>WhatsApp → Dispositivi collegati → Collega un dispositivo.</p>
                      <button
                        type="button"
                        className="button button-secondary mini qr-inline-btn"
                        onClick={() => call(() => (api.reconnect ? api.reconnect() : api.connect()))}
                      >
                        <span>🔄</span> Rigenera QR code
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="step-actions-footer">
        <button
          type="button"
          className="button button-secondary"
          onClick={onBack}
        >
          ← Indietro: Messaggio & Ritmo
        </button>
        <button
          type="button"
          className="button button-primary start-button-large"
          onClick={onStart}
          disabled={!canStart}
        >
          <span>🚀 Avvia Invio Messaggi</span>
        </button>
      </div>
    </div>
  )
}
