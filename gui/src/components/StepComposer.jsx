import { useRef, useState, useMemo, useEffect } from 'react'
import { formatEstimatedDuration } from './duration.mjs'

function previewMessage(message, donor) {
  if (!donor) return message
  let result = message
    .replaceAll('[nome]', donor.name || 'Nome')
    .replaceAll('[cognome]', donor.surname || 'Cognome')
  if (donor.customFields) {
    for (const [key, value] of Object.entries(donor.customFields)) {
      result = result.replaceAll(`[${key}]`, value)
    }
  }
  return result
}

function formatSnippet(text, maxLen = 75) {
  if (!text) return ''
  const single = String(text).replace(/\s+/g, ' ').trim()
  if (single.length <= maxLen) return single
  return single.slice(0, maxLen) + '…'
}

function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getAttachmentIcon(badge, kind) {
  if (kind === 'audio' || badge === 'AUDIO') return '🎵'
  if (kind === 'video' || badge === 'VIDEO') return '🎬'
  switch (badge) {
    case 'PDF': return '📄'
    case 'DOC': return '📝'
    case 'XLS': return '📊'
    case 'PPT': return '📑'
    case 'ZIP': return '🗜️'
    case 'TXT': return '📃'
    default: return '📎'
  }
}

function renderAttachmentPreviewMedia(att) {
  if (!att) return null
  if (att.dataUrl) {
    return (
      <div className="preview-media-box">
        <img src={att.dataUrl} alt="Anteprima foto allegata" className="preview-media-img" />
        <span className="preview-media-tag">📷 {att.name}</span>
      </div>
    )
  }
  return (
    <div className="preview-doc-box">
      <div className={`preview-doc-badge badge-${(att.badge || 'doc').toLowerCase()}`}>
        {att.badge || 'DOC'}
      </div>
      <div className="preview-doc-info">
        <strong className="preview-doc-name" title={att.name}>{att.name}</strong>
        <span className="preview-doc-sub">
          {att.size ? `${formatFileSize(att.size)} • ` : ''}
          {att.label || 'Documento allegato'}
        </span>
      </div>
    </div>
  )
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
  const searchContainerRef = useRef(null)
  const [previewSearch, setPreviewSearch] = useState('')
  const [previewIndex, setPreviewIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const previewCandidates = useMemo(() => {
    const list = (state.donors || []).filter((d) => d.selected !== false && d.valid)
    if (!previewSearch.trim()) return list
    const q = previewSearch.trim().toLowerCase()
    return list.filter((d) => {
      const full = `${d.name || ''} ${d.surname || ''}`.toLowerCase()
      const phone = String(d.phone || d.rawPhone || '').toLowerCase()
      return full.includes(q) || phone.includes(q)
    })
  }, [state.donors, previewSearch])

  const activePreviewDonor = useMemo(() => {
    if (previewCandidates.length === 0) return firstSelectedDonor || null
    const safeIdx = Math.min(Math.max(0, previewIndex), previewCandidates.length - 1)
    return previewCandidates[safeIdx]
  }, [previewCandidates, previewIndex, firstSelectedDonor])

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelectSuggestion(donor) {
    const fullName = `${donor.name || ''} ${donor.surname || ''}`.trim()
    setPreviewSearch(fullName)
    setPreviewIndex(0)
    setShowSuggestions(false)
  }

  function handleSearchKeyDown(e) {
    if (!showSuggestions || previewCandidates.length === 0) {
      if (e.key === 'ArrowDown' && previewCandidates.length > 0) {
        setShowSuggestions(true)
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPreviewIndex((prev) => (prev < previewCandidates.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPreviewIndex((prev) => (prev > 0 ? prev - 1 : previewCandidates.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activePreviewDonor) {
        handleSelectSuggestion(activePreviewDonor)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  function changePreset(name) {
    const preset = (state.presets || []).find((item) => item.name === name)
    if (!preset) return
    setSelectedPreset(preset.name)
    setPresetName(preset.name)
    setMessage(preset.message)
    if (preset.settings) setOptions((current) => ({ ...current, ...preset.settings }))
    call(() => api.loadPresetAttachment(preset.attachment || null))
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

  // Attachments resolution
  const rawAttachments = state.attachments && state.attachments.length > 0
    ? state.attachments
    : (state.imageName ? [{
        path: state.imagePath,
        name: state.imageName,
        type: state.attachmentType,
        size: state.attachmentSize,
        badge: state.attachmentBadge,
        label: state.attachmentLabel,
        dataUrl: state.imageDataUrl,
      }] : [])
  const attachmentCount = rawAttachments.length
  const totalAttachmentBytes = rawAttachments.reduce((sum, item) => sum + (item.size || 0), 0)
  const isHeavyTotal = totalAttachmentBytes > 50 * 1024 * 1024
  const attachmentPosition = state.attachmentPosition || 'first'

  // Calculate estimated total time
  const selectedCount = state.donors.filter((d) => d.selected !== false && d.valid).length
  const avgDelaySec = ((options.minDelayMs + options.maxDelayMs) / 2) / 1000
  const pauseCount = options.pauseAfter > 0 ? Math.floor(selectedCount / options.pauseAfter) : 0
  const totalMinutesEst = Math.round((selectedCount * avgDelaySec + pauseCount * options.pauseMinutes * 60) / 60)
  const estimatedDuration = formatEstimatedDuration(totalMinutesEst)

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
                <div className="preview-title-row">
                  <span className="preview-label">Anteprima rendering reale</span>
                  {previewCandidates.length > 1 && (
                    <div className="preview-nav-controls">
                      <button
                        type="button"
                        className="preview-nav-btn"
                        onClick={() => setPreviewIndex((prev) => (prev > 0 ? prev - 1 : previewCandidates.length - 1))}
                        title="Donatore precedente"
                        aria-label="Donatore precedente"
                      >
                        ◀
                      </button>
                      <span className="preview-nav-count">
                        {Math.min(previewIndex + 1, previewCandidates.length)} di {previewCandidates.length}
                      </span>
                      <button
                        type="button"
                        className="preview-nav-btn"
                        onClick={() => setPreviewIndex((prev) => (prev < previewCandidates.length - 1 ? prev + 1 : 0))}
                        title="Donatore successivo"
                        aria-label="Donatore successivo"
                      >
                        ▶
                      </button>
                    </div>
                  )}
                </div>

                <div className="preview-search-row" ref={searchContainerRef}>
                  <input
                    type="text"
                    className="preview-search-input"
                    placeholder="🔍 Cerca donatore per verificare il messaggio (es. nome o cognome)..."
                    value={previewSearch}
                    onFocus={() => {
                      if (previewSearch.trim().length > 0) setShowSuggestions(true)
                    }}
                    onChange={(e) => {
                      setPreviewSearch(e.target.value)
                      setPreviewIndex(0)
                      setShowSuggestions(true)
                    }}
                    onKeyDown={handleSearchKeyDown}
                    aria-label="Cerca donatore per anteprima"
                    aria-expanded={showSuggestions}
                    aria-autocomplete="list"
                  />
                  {previewSearch && (
                    <button
                      type="button"
                      className="preview-search-clear"
                      onClick={() => {
                        setPreviewSearch('')
                        setPreviewIndex(0)
                        setShowSuggestions(false)
                      }}
                      title="Cancella ricerca"
                    >
                      ×
                    </button>
                  )}

                  {showSuggestions && previewSearch.trim().length > 0 && previewCandidates.length > 0 && (
                    <div className="preview-suggestions-dropdown" role="listbox">
                      {previewCandidates.slice(0, 6).map((donor, idx) => {
                        const isSelected = activePreviewDonor === donor
                        const renderedSnippet = formatSnippet(previewMessage(message, donor))
                        return (
                          <button
                            key={`${donor.phone || donor.rawPhone || ''}-${donor.name}-${idx}`}
                            type="button"
                            className={`preview-suggestion-item ${isSelected ? 'active' : ''}`}
                            onClick={() => handleSelectSuggestion(donor)}
                            onMouseEnter={() => setPreviewIndex(idx)}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="preview-suggestion-header">
                              <span className="preview-suggestion-name">
                                👤 {donor.name} {donor.surname || ''}
                              </span>
                              {(donor.phone || donor.rawPhone) && (
                                <span className="preview-suggestion-phone">
                                  {donor.phone || donor.rawPhone}
                                </span>
                              )}
                            </div>
                            <div className="preview-suggestion-snippet">
                              💬 {renderedSnippet || 'Messaggio vuoto'}
                            </div>
                          </button>
                        )
                      })}
                      {previewCandidates.length > 6 && (
                        <div className="preview-suggestions-footer">
                          +{previewCandidates.length - 6} altri donatori (continua a digitare per affinare)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="preview-donor-hint">
                  {activePreviewDonor ? (
                    <span>
                      Esempio con: <strong>{activePreviewDonor.name} {activePreviewDonor.surname || ''}</strong> ({activePreviewDonor.phone || activePreviewDonor.rawPhone || 'senza numero'})
                    </span>
                  ) : (
                    <span>Nessun donatore corrispondente trovato</span>
                  )}
                </div>
              </div>
              {/* WhatsApp Live Preview Bubbles */}
              {attachmentCount === 0 && (
                <div className="preview-bubble">
                  <p className="preview-text-content">
                    {previewMessage(message, activePreviewDonor) || 'Scrivi un messaggio per vedere l’anteprima…'}
                  </p>
                </div>
              )}

              {attachmentCount === 1 && (
                <div className="preview-bubble has-attached-media">
                  {renderAttachmentPreviewMedia(rawAttachments[0])}
                  <p className="preview-text-content">
                    {previewMessage(message, activePreviewDonor) || 'Scrivi un messaggio per vedere l’anteprima…'}
                  </p>
                </div>
              )}

              {attachmentCount > 1 && (
                <div className="preview-multi-bubbles-container">
                  {attachmentPosition === 'first' && (
                    <>
                      <div className="preview-bubble has-attached-media">
                        <div className="preview-attachment-bubble-header">
                          <span className="preview-bubble-step-badge">1° Invio (con didascalia)</span>
                        </div>
                        {renderAttachmentPreviewMedia(rawAttachments[0])}
                        <p className="preview-text-content">
                          {previewMessage(message, activePreviewDonor) || 'Scrivi un messaggio per vedere l’anteprima…'}
                        </p>
                      </div>

                      <div className="preview-bubble followup-media-bubble">
                        <div className="preview-attachment-bubble-header">
                          <span className="preview-bubble-step-badge">Invii a seguire ({attachmentCount - 1} allegati)</span>
                        </div>
                        <div className="preview-attachments-mini-gallery">
                          {rawAttachments.slice(1).map((att, idx) => (
                            <div key={idx} className="preview-gallery-item">
                              <span className={`preview-mini-badge badge-${(att.badge || 'doc').toLowerCase()}`}>
                                {att.badge || 'DOC'}
                              </span>
                              <span className="preview-mini-name">{att.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {attachmentPosition === 'last' && (
                    <>
                      <div className="preview-bubble followup-media-bubble">
                        <div className="preview-attachment-bubble-header">
                          <span className="preview-bubble-step-badge">1° Invio ({attachmentCount - 1} allegati)</span>
                        </div>
                        <div className="preview-attachments-mini-gallery">
                          {rawAttachments.slice(0, attachmentCount - 1).map((att, idx) => (
                            <div key={idx} className="preview-gallery-item">
                              <span className={`preview-mini-badge badge-${(att.badge || 'doc').toLowerCase()}`}>
                                {att.badge || 'DOC'}
                              </span>
                              <span className="preview-mini-name">{att.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="preview-bubble has-attached-media">
                        <div className="preview-attachment-bubble-header">
                          <span className="preview-bubble-step-badge">Ultimo Invio (con didascalia)</span>
                        </div>
                        {renderAttachmentPreviewMedia(rawAttachments[attachmentCount - 1])}
                        <p className="preview-text-content">
                          {previewMessage(message, activePreviewDonor) || 'Scrivi un messaggio per vedere l’anteprima…'}
                        </p>
                      </div>
                    </>
                  )}

                  {attachmentPosition === 'separate' && (
                    <>
                      <div className="preview-bubble followup-media-bubble">
                        <div className="preview-attachment-bubble-header">
                          <span className="preview-bubble-step-badge">1° Invio ({attachmentCount} allegati in sequenza)</span>
                        </div>
                        <div className="preview-attachments-mini-gallery">
                          {rawAttachments.map((att, idx) => (
                            <div key={idx} className="preview-gallery-item">
                              <span className={`preview-mini-badge badge-${(att.badge || 'doc').toLowerCase()}`}>
                                {att.badge || 'DOC'}
                              </span>
                              <span className="preview-mini-name">{att.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="preview-bubble">
                        <div className="preview-attachment-bubble-header">
                          <span className="preview-bubble-step-badge">2° Invio (messaggio separato)</span>
                        </div>
                        <p className="preview-text-content">
                          {previewMessage(message, activePreviewDonor) || 'Scrivi un messaggio per vedere l’anteprima…'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Attachment & Rhythm */}
        <div className="composer-side-column">
          {/* Attachment Box */}
          <div className="panel composer-attachment-panel">
            <div className="panel-header-with-badge">
              <div>
                <span className="eyebrow">Allegato opzionale</span>
                <h3>{attachmentCount > 1 ? `Allegati (${attachmentCount})` : 'Foto, Video, Audio o Documento'}</h3>
              </div>
              {attachmentCount > 1 && (
                <span className={`attachment-total-badge ${isHeavyTotal ? 'is-warning' : ''}`} title={isHeavyTotal ? 'Attenzione: peso complessivo elevato (>50 MB)' : undefined}>
                  Totale: {formatFileSize(totalAttachmentBytes)} {isHeavyTotal && '⚠️'}
                </span>
              )}
            </div>
            <p className="muted" style={{ margin: '6px 0 12px' }}>
              {attachmentCount > 1
                ? 'I file verranno inviati in sequenza ai destinatari WhatsApp.'
                : 'Verrà inviato insieme al messaggio WhatsApp (con didascalia ove supportata).'}
            </p>

            {isHeavyTotal && (
              <div className="attachment-heavy-warning">
                ⚠️ <strong>Attenzione:</strong> Il peso complessivo degli allegati supera i 50 MB. L’invio potrebbe richiedere più tempo; assicurati di avere una connessione internet stabile.
              </div>
            )}

            {attachmentCount === 0 && (
              <button
                type="button"
                className="button button-secondary full"
                onClick={() => call(() => api.selectImage())}
              >
                <span>📎</span> Seleziona allegato (tutti i file)
              </button>
            )}

            {attachmentCount === 1 && (
              <div className="single-attachment-wrapper">
                <div className="attachment-card-active">
                  {rawAttachments[0].dataUrl ? (
                    <img src={rawAttachments[0].dataUrl} alt="Anteprima allegato" className="attachment-thumbnail" />
                  ) : (
                    <div className={`attachment-doc-thumbnail thumb-${(rawAttachments[0].badge || 'doc').toLowerCase()}`}>
                      <span className="doc-thumbnail-icon">{getAttachmentIcon(rawAttachments[0].badge, rawAttachments[0].type)}</span>
                      <span className="doc-thumbnail-badge">{rawAttachments[0].badge || 'DOC'}</span>
                    </div>
                  )}
                  <div className="attachment-active-details">
                    <strong title={rawAttachments[0].path}>{rawAttachments[0].name}</strong>
                    {rawAttachments[0].size > 0 && (
                      <span className="attachment-size-note">{formatFileSize(rawAttachments[0].size)}</span>
                    )}
                    <div className="attachment-active-buttons">
                      {rawAttachments[0].path && (
                        <button
                          type="button"
                          className="open-file-btn"
                          onClick={() => api?.showItemInFolder?.(rawAttachments[0].path)}
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

                <button
                  type="button"
                  className="button button-secondary full add-more-attachments-btn"
                  style={{ marginTop: '10px' }}
                  onClick={() => call(() => api.selectImage())}
                >
                  <span>➕</span> Aggiungi un altro file
                </button>
              </div>
            )}

            {attachmentCount > 1 && (
              <div className="multi-attachments-wrapper">
                <div className="multi-attachments-list">
                  {rawAttachments.map((att, idx) => (
                    <div key={`${att.path || att.name}-${idx}`} className="multi-attachment-item">
                      <div className="multi-attachment-reorder">
                        <button
                          type="button"
                          className="reorder-btn"
                          disabled={idx === 0}
                          onClick={() => call(() => api.reorderAttachments(idx, idx - 1))}
                          title="Sposta su"
                          aria-label={`Sposta su ${att.name}`}
                        >
                          ▲
                        </button>
                        <span className="attachment-index">{idx + 1}</span>
                        <button
                          type="button"
                          className="reorder-btn"
                          disabled={idx === rawAttachments.length - 1}
                          onClick={() => call(() => api.reorderAttachments(idx, idx + 1))}
                          title="Sposta giù"
                          aria-label={`Sposta giù ${att.name}`}
                        >
                          ▼
                        </button>
                      </div>

                      {att.dataUrl ? (
                        <img src={att.dataUrl} alt="" className="multi-attachment-thumb" />
                      ) : (
                        <div className={`multi-attachment-doc-badge badge-${(att.badge || 'doc').toLowerCase()}`}>
                          {att.badge || 'DOC'}
                        </div>
                      )}

                      <div className="multi-attachment-info">
                        <span className="multi-attachment-name" title={att.path || att.name}>
                          {att.name}
                        </span>
                        <span className="multi-attachment-size">
                          {formatFileSize(att.size)}
                        </span>
                      </div>

                      <div className="multi-attachment-actions">
                        {att.path && (
                          <button
                            type="button"
                            className="icon-action-btn"
                            onClick={() => api?.showItemInFolder?.(att.path)}
                            title="Mostra nella cartella"
                          >
                            📁
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-action-btn remove-btn"
                          onClick={() => call(() => api.removeAttachment(idx))}
                          title="Rimuovi allegato"
                          aria-label={`Rimuovi ${att.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="multi-attachments-bar">
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => call(() => api.selectImage())}
                  >
                    <span>➕</span> Aggiungi file
                  </button>
                  <button
                    type="button"
                    className="link-btn-danger"
                    onClick={() => call(() => api.clearImage())}
                  >
                    Rimuovi tutti
                  </button>
                </div>

                <div className="attachment-position-container">
                  <div className="position-label-header">
                    <span className="eyebrow">Posizione messaggio</span>
                    <span className="position-sublabel">Scegli come associare il testo:</span>
                  </div>

                  <div className="position-options-grid">
                    <label
                      className={`position-option-card ${attachmentPosition === 'first' ? 'selected' : ''}`}
                      onClick={() => call(() => api.setAttachmentPosition('first'))}
                    >
                      <input
                        type="radio"
                        name="attachmentPosition"
                        value="first"
                        checked={attachmentPosition === 'first'}
                        onChange={() => {}}
                      />
                      <div className="position-option-text">
                        <strong>Didascalia 1° allegato</strong>
                        <span className="muted">Testo sul primo file inviato</span>
                      </div>
                    </label>

                    <label
                      className={`position-option-card ${attachmentPosition === 'last' ? 'selected' : ''}`}
                      onClick={() => call(() => api.setAttachmentPosition('last'))}
                    >
                      <input
                        type="radio"
                        name="attachmentPosition"
                        value="last"
                        checked={attachmentPosition === 'last'}
                        onChange={() => {}}
                      />
                      <div className="position-option-text">
                        <strong>Didascalia ultimo allegato</strong>
                        <span className="muted">Testo sull'ultimo file inviato</span>
                      </div>
                    </label>

                    <label
                      className={`position-option-card ${attachmentPosition === 'separate' ? 'selected' : ''}`}
                      onClick={() => call(() => api.setAttachmentPosition('separate'))}
                    >
                      <input
                        type="radio"
                        name="attachmentPosition"
                        value="separate"
                        checked={attachmentPosition === 'separate'}
                        onChange={() => {}}
                      />
                      <div className="position-option-text">
                        <strong>Messaggio a parte</strong>
                        <span className="muted">Tutti gli allegati, poi il messaggio</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
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
              <span>⏱ Stima durata: <strong>~{estimatedDuration}</strong> per {selectedCount} contatti</span>
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
