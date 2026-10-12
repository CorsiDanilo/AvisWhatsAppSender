import { useState } from 'react'
import { formatEstimatedDuration } from './duration.mjs'
import { normalizeReportPhone, formatReportPhoneDisplay } from './reportRecipients.mjs'

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
  setOptions,
  canStart,
  firstSelectedDonor,
  sessionReportRecipients = [],
  onToggleSessionRecipient,
  onAddSessionRecipient,
  onBack,
  onGoToStep,
  onStart,
  onOpenSettings,
}) {
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickLabel, setQuickLabel] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickError, setQuickError] = useState('')

  const api = window.whatsappSender

  function handleAddQuickRecipient() {
    const label = quickLabel.trim()
    if (!label) {
      setQuickError('Inserisci un’etichetta (es. Segreteria).')
      return
    }
    const { valid, phone, error } = normalizeReportPhone(quickPhone)
    if (!valid) {
      setQuickError(error || 'Inserisci un numero di cellulare valido.')
      return
    }

    const newRec = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      phone,
      enabled: true,
    }

    if (api?.saveSettings) {
      const currentList = Array.isArray(state.settings?.reportRecipients) ? state.settings.reportRecipients : []
      api.saveSettings({ reportRecipients: [...currentList, newRec] })
    }
    if (onAddSessionRecipient) {
      onAddSessionRecipient(newRec)
    }

    setQuickLabel('')
    setQuickPhone('')
    setQuickError('')
    setShowQuickAdd(false)
  }

  const selectedDonors = state.donors.filter((d) => d.selected !== false)
  const validSelectedDonors = selectedDonors.filter((d) => d.valid)
  const invalidSelectedDonors = selectedDonors.filter((d) => !d.valid)

  const avgDelaySec = ((options.minDelayMs + options.maxDelayMs) / 2) / 1000
  const pauseCount = options.pauseAfter > 0 ? Math.floor(validSelectedDonors.length / options.pauseAfter) : 0
  const totalMinutesEst = Math.round((validSelectedDonors.length * avgDelaySec + pauseCount * options.pauseMinutes * 60) / 60)
  const estimatedDuration = formatEstimatedDuration(totalMinutesEst)

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
                <strong>~{estimatedDuration}</strong>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 4: Azioni al completamento */}
        <div className="panel summary-card">
          <div className="summary-card-header">
            <div>
              <span className="eyebrow">04 · Azioni finali</span>
              <h3>Al termine dell'invio</h3>
            </div>
            {onOpenSettings && (
              <button
                type="button"
                className="link-btn"
                onClick={() => onOpenSettings('general')}
                title="Gestisci impostazioni e rubrica"
              >
                ⚙️ Gestisci rubrica
              </button>
            )}
          </div>
          <div className="summary-card-content">
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 650 }}>
                  📱 Destinatari Report WhatsApp:
                </span>
                <button
                  type="button"
                  className="link-btn"
                  style={{ fontSize: '11px', padding: 0 }}
                  onClick={() => setShowQuickAdd((prev) => !prev)}
                >
                  {showQuickAdd ? '✕ Chiudi' : '+ Aggiungi numero'}
                </button>
              </div>

              {/* Form rapido inline per aggiungere un contatto */}
              {showQuickAdd && (
                <div className="report-recipient-add-box" style={{ marginBottom: '10px' }}>
                  <div className="report-recipient-add-grid">
                    <input
                      type="text"
                      placeholder="Etichetta (es. Presidente)"
                      className="preset-input-field"
                      style={{ fontSize: '11px', padding: '6px 8px' }}
                      value={quickLabel}
                      onChange={(e) => {
                        setQuickLabel(e.target.value)
                        if (quickError) setQuickError('')
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="Cellulare (es. 333...)"
                      className="preset-input-field"
                      style={{ fontSize: '11px', padding: '6px 8px' }}
                      value={quickPhone}
                      onChange={(e) => {
                        setQuickPhone(e.target.value)
                        if (quickError) setQuickError('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddQuickRecipient()
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                      onClick={handleAddQuickRecipient}
                    >
                      Salva
                    </button>
                  </div>
                  {quickError && (
                    <p className="report-error-text" style={{ margin: '4px 0 0' }}>
                      ⚠️ {quickError}
                    </p>
                  )}
                </div>
              )}

              {/* Chip interattivi per ciascun destinatario */}
              {sessionReportRecipients.length === 0 ? (
                <p className="subtle-note" style={{ margin: 0, fontStyle: 'italic' }}>
                  ⚪ Nessun numero configurato per il report WhatsApp. Clicca "+ Aggiungi numero" per impostarne uno.
                </p>
              ) : (
                <div>
                  <div className="report-chips-wrapper">
                    {sessionReportRecipients.map((rec) => {
                      const isChecked = rec.enabled !== false
                      return (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => onToggleSessionRecipient && onToggleSessionRecipient(rec.id)}
                          className={`report-chip-btn ${isChecked ? 'is-active' : 'is-inactive'}`}
                          title={`Clicca per ${isChecked ? 'escludere' : 'includere'} questo numero dall'invio`}
                        >
                          <span>{isChecked ? '✅' : '⚪'}</span>
                          <span>🏷️ {rec.label}</span>
                          <span style={{ fontSize: '11px', opacity: 0.85 }}>
                            ({formatReportPhoneDisplay(rec.phone)})
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {sessionReportRecipients.filter((r) => r.enabled !== false).length > 0 ? (
                    <span className="subtle-note" style={{ fontSize: '11px', color: 'var(--green-dark)' }}>
                      📨 Il report finale verrà inviato a:{' '}
                      <strong>
                        {sessionReportRecipients
                          .filter((r) => r.enabled !== false)
                          .map((r) => r.label)
                          .join(', ')}
                      </strong>
                    </span>
                  ) : (
                    <span className="subtle-note" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      ⚪ Nessun destinatario selezionato per questa sessione (nessun messaggio di riepilogo).
                    </span>
                  )}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '12px' }}>
              <label
                className="settings-field-label"
                htmlFor="summary-post-session-select"
                style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 650 }}
              >
                Azione per il PC al termine:
              </label>
              <select
                id="summary-post-session-select"
                className="preset-input-field"
                style={{ width: '100%', marginTop: '2px', cursor: 'pointer' }}
                value={options.postSessionAction || state.settings?.postSessionAction || 'none'}
                onChange={(event) => {
                  const val = event.target.value
                  if (setOptions) {
                    setOptions((prev) => ({ ...prev, postSessionAction: val }))
                  }
                }}
              >
                <option value="none">Nessuna azione (lascia il PC acceso)</option>
                <option value="sleep">💤 Sospendi il PC (Standby)</option>
                <option value="hibernate">🌙 Iberna il PC</option>
                <option value="shutdown">🔌 Spegni il PC</option>
              </select>

              {(options.postSessionAction || state.settings?.postSessionAction) &&
              (options.postSessionAction || state.settings?.postSessionAction) !== 'none' ? (
                <div className="summary-warning-pill" style={{ marginTop: '8px' }}>
                  ⏳ Al termine dell'invio partirà un countdown di 60s per annullare prima dello spegnimento/sospensione (valido solo per questo invio).
                </div>
              ) : (
                <p className="subtle-note" style={{ marginTop: '6px', marginBottom: 0 }}>
                  Il computer rimarrà acceso normalmente al termine dell'invio.
                </p>
              )}
            </div>
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
