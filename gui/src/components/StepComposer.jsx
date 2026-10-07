import { useRef } from 'react'

function previewMessage(message, donor) {
  if (!donor) return message
  let result = message
    .replaceAll('[nome]', donor.name || 'Mario')
    .replaceAll('[cognome]', donor.surname || 'Rossi')
  if (donor.customFields) {
    for (const [key, value] of Object.entries(donor.customFields)) {
      result = result.replaceAll(`[${key}]`, value)
    }
  }
  return result
}

export default function StepComposer({
  state,
  api,
  call,
  message,
  setMessage,
  selectedPreset,
  setSelectedPreset,
  setPresetName,
  options,
  setOptions,
  firstSelectedDonor,
  onBack,
  onNext,
  onOpenSettings,
}) {
  const messageRef = useRef(null)

  function changePreset(name) {
    const preset = (state.presets || []).find((item) => item.name === name)
    if (!preset) return
    setSelectedPreset(preset.name)
    setPresetName(preset.name)
    setMessage(preset.message)
    if (preset.settings) setOptions(preset.settings)
  }

  function insertToken(token) {
    const input = messageRef.current
    if (!input) return
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    setMessage(`${message.slice(0, start)}${token}${message.slice(end)}`)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + token.length, start + token.length)
    })
  }

  function updateOption(name, value) {
    setOptions((current) => ({ ...current, [name]: value }))
  }

  // Calculate estimated total time
  const selectedCount = state.donors.filter((d) => d.selected !== false && d.valid).length
  const avgDelaySec = ((options.minDelayMs + options.maxDelayMs) / 2) / 1000
  const pauseCount = options.pauseAfter > 0 ? Math.floor(selectedCount / options.pauseAfter) : 0
  const totalMinutesEst = Math.round((selectedCount * avgDelaySec + pauseCount * options.pauseMinutes * 60) / 60)

  return (
    <div className="step-container">
      <div className="step-intro">
        <div>
          <span className="eyebrow">Passo 2 di 3</span>
          <h2>Componi il messaggio, allega foto e imposta il ritmo</h2>
          <p className="muted">
            Personalizza il testo per i donatori, aggiungi un'immagine e regola i tempi di sicurezza anti-ban.
          </p>
        </div>
      </div>

      <div className="composer-grid">
        {/* Left Column: Message & Tokens */}
        <div className="composer-main-column">
          <div className="panel composer-message-panel">
            <div className="composer-header-row">
              <div className="field-label-group">
                <span className="eyebrow">Modello predefinito</span>
                <div className="preset-selector-row">
                  <select
                    value={selectedPreset}
                    onChange={(e) => changePreset(e.target.value)}
                    aria-label="Scegli modello"
                  >
                    {(state.presets || []).map((preset) => (
                      <option key={preset.name} value={preset.name}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="link-btn"
                    title="Gestisci o crea nuovi modelli nelle Impostazioni"
                    onClick={onOpenSettings}
                  >
                    ⚙️ Gestisci modelli
                  </button>
                </div>
              </div>

              <div className="tokens-container">
                <span className="token-label">Inserisci tag:</span>
                <button
                  type="button"
                  className="token"
                  onClick={() => insertToken('[nome]')}
                >
                  + [nome]
                </button>
                <button
                  type="button"
                  className="token"
                  onClick={() => insertToken('[cognome]')}
                >
                  + [cognome]
                </button>
                {firstSelectedDonor?.customFields && Object.keys(firstSelectedDonor.customFields).map(key => (
                  <button
                    key={key}
                    type="button"
                    className="token"
                    onClick={() => insertToken(`[${key}]`)}
                  >
                    + [{key}]
                  </button>
                ))}
              </div>
            </div>

            <textarea
              ref={messageRef}
              className="composer-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="7"
              placeholder="Scrivi qui il messaggio da inviare..."
              aria-label="Testo del messaggio"
            />

            {/* Live Preview */}
            <div className="composer-live-preview">
              <div className="preview-header">
                <span className="preview-label">Anteprima rendering reale</span>
                <span className="preview-donor-hint">
                  Esempio con: <strong>{firstSelectedDonor ? `${firstSelectedDonor.name} ${firstSelectedDonor.surname || ''}` : 'Donatore esempio'}</strong>
                </span>
              </div>
              <div className={`preview-bubble ${state.imageDataUrl ? 'has-attached-media' : ''}`}>
                {state.imageDataUrl && (
                  <div className="preview-media-box">
                    <img src={state.imageDataUrl} alt="Anteprima foto allegata" className="preview-media-img" />
                    <span className="preview-media-tag">📷 {state.imageName}</span>
                  </div>
                )}
                <p className="preview-text-content">
                  {previewMessage(message, firstSelectedDonor) || 'Scrivi un messaggio per vedere l’anteprima…'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Attachment & Rhythm */}
        <div className="composer-side-column">
          {/* Attachment Box */}
          <div className="panel composer-attachment-panel">
            <span className="eyebrow">Allegato multimediale</span>
            <h3>Foto opzionale</h3>
            <p className="muted" style={{ margin: '6px 0 12px' }}>
              Verrà inviata con il testo del messaggio come didascalia.
            </p>

            {state.imageName ? (
              <div className="attachment-card-active">
                {state.imageDataUrl && (
                  <img src={state.imageDataUrl} alt="Anteprima allegato" className="attachment-thumbnail" />
                )}
                <div className="attachment-active-details">
                  <strong title={state.imagePath}>{state.imageName}</strong>
                  <div className="attachment-active-buttons">
                    {state.imagePath && (
                      <button
                        type="button"
                        className="open-file-btn"
                        onClick={() => api?.showItemInFolder?.(state.imagePath)}
                      >
                        📁 Mostra
                      </button>
                    )}
                    <button
                      type="button"
                      className="remove-attachment"
                      onClick={() => call(() => api.clearImage())}
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="button button-secondary full"
                onClick={() => call(() => api.selectImage())}
              >
                <span>▧</span> Seleziona foto (JPG, PNG)
              </button>
            )}
          </div>

          {/* Rhythm Settings Box */}
          <div className="panel composer-rhythm-panel">
            <div className="rhythm-header">
              <span className="eyebrow">Sicurezza WhatsApp</span>
              <h3>Ritmo di invio</h3>
            </div>
            <p className="muted" style={{ margin: '4px 0 12px' }}>
              Pause casuali per simulare un invio umano e proteggere il numero.
            </p>

            <div className="settings-grid">
              <label>
                Min. secondi
                <input
                  type="number"
                  min="5"
                  value={options.minDelayMs / 1000}
                  onChange={(e) => updateOption('minDelayMs', Math.max(1, Number(e.target.value)) * 1000)}
                />
              </label>
              <label>
                Max. secondi
                <input
                  type="number"
                  min="5"
                  value={options.maxDelayMs / 1000}
                  onChange={(e) => updateOption('maxDelayMs', Math.max(1, Number(e.target.value)) * 1000)}
                />
              </label>
              <label>
                Dopo messaggi
                <input
                  type="number"
                  min="1"
                  value={options.pauseAfter}
                  onChange={(e) => updateOption('pauseAfter', Math.max(1, Number(e.target.value)))}
                />
              </label>
              <label>
                Pausa minuti
                <input
                  type="number"
                  min="1"
                  value={options.pauseMinutes}
                  onChange={(e) => updateOption('pauseMinutes', Math.max(1, Number(e.target.value)))}
                />
              </label>
            </div>

            <div className="rhythm-estimate-badge">
              <span>⏱ Stima durata: <strong>~{totalMinutesEst} minuti</strong> per {selectedCount} contatti</span>
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
          ← Indietro: Destinatari
        </button>
        <button
          type="button"
          className="button button-primary next-step-btn"
          onClick={onNext}
          disabled={!message.trim()}
        >
          <span>Avanti: Riepilogo & Avvio</span> →
        </button>
      </div>
    </div>
  )
}
