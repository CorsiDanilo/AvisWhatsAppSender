import { useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  FileText,
  Mail,
  MessageSquare,
  Monitor,
  Pencil,
  Plus,
  Smartphone,
  Users,
} from 'lucide-react'
import { formatEstimatedDuration } from './duration.mjs'
import { normalizeReportPhone, formatReportPhoneDisplay } from './reportRecipients.mjs'

function previewMessage(message, donor) {
  if (!donor) return message
  return message
    .replaceAll('[nome]', donor.name || 'Nome')
    .replaceAll('[cognome]', donor.surname || 'Cognome')
}

function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SummarySection({ id, number, icon: Icon, title, summary, expanded, onToggle, onEdit, editLabel, children }) {
  return (
    <section className="panel summary-section">
      <div className="summary-section-header">
        <button
          type="button"
          className="summary-section-toggle"
          aria-expanded={expanded}
          aria-controls={`${id}-content`}
          onClick={onToggle}
        >
          <span className="summary-section-number">{number}</span>
          <span className="summary-section-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
          <span className="summary-section-heading">
            <span className="eyebrow">{title}</span>
            <strong>{summary}</strong>
          </span>
          <ChevronDown className="summary-section-chevron" size={18} aria-hidden="true" />
          <span className="sr-only">{expanded ? 'Comprimi sezione' : 'Espandi sezione'}</span>
        </button>
        {onEdit && (
          <button
            type="button"
            className="link-btn summary-edit-btn"
            onClick={onEdit}
            aria-label={editLabel}
          >
            <Pencil size={14} aria-hidden="true" />
            Modifica
          </button>
        )}
      </div>
      {expanded && (
        <div id={`${id}-content`} className="summary-section-content">
          {children}
        </div>
      )}
    </section>
  )
}

function ReportRecipientList({ recipients, type, onToggle, onRemove }) {
  if (recipients.length === 0) {
    return <p className="summary-empty-note">Nessun destinatario configurato per questo canale.</p>
  }

  return (
    <div className="report-recipients-list summary-report-list">
      {recipients.map((recipient) => {
        const enabled = recipient.enabled !== false
        const detail = type === 'email' ? recipient.email : formatReportPhoneDisplay(recipient.phone)
        return (
          <div key={recipient.id} className={`report-recipient-card ${enabled ? 'is-active' : 'is-inactive'}`}>
            <div className="report-recipient-left">
              <input
                type="checkbox"
                className="report-recipient-checkbox"
                checked={enabled}
                onChange={() => onToggle?.(recipient.id)}
                aria-label={`${enabled ? 'Escludi' : 'Includi'} ${recipient.label}`}
              />
              <div>
                <span className="report-recipient-label-tag">{recipient.label}</span>{' '}
                <strong className="report-recipient-phone">{detail}</strong>
              </div>
            </div>
            <button
              type="button"
              className="link-btn report-recipient-delete-btn"
              onClick={() => onRemove?.(recipient.id)}
              aria-label={`Rimuovi ${recipient.label}`}
            >
              Rimuovi
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function StepSummary({
  state,
  message,
  selectedPreset,
  options,
  setOptions,
  canStart,
  firstSelectedDonor,
  sessionReportRecipients = null,
  sessionReportEmailRecipients = null,
  reportDeliveryMode,
  onReportDeliveryModeChange,
  onToggleSessionRecipient,
  onAddSessionRecipient,
  onRemoveSessionRecipient,
  onToggleSessionEmailRecipient,
  onAddSessionEmailRecipient,
  onRemoveSessionEmailRecipient,
  onBack,
  onGoToStep,
  onStart,
  onOpenSettings,
}) {
  const [expandedSections, setExpandedSections] = useState({ recipients: true, content: true, actions: true })
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showEmailAdd, setShowEmailAdd] = useState(false)
  const [quickLabel, setQuickLabel] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickError, setQuickError] = useState('')
  const [emailLabel, setEmailLabel] = useState('')
  const [emailAddress, setEmailAddress] = useState('')
  const [emailError, setEmailError] = useState('')
  const selectedDonors = state.donors.filter((donor) => donor.selected !== false)
  const validSelectedDonors = selectedDonors.filter((donor) => donor.valid)
  const invalidSelectedDonors = selectedDonors.filter((donor) => !donor.valid)
  const avgDelaySec = ((options.minDelayMs + options.maxDelayMs) / 2) / 1000
  const pauseCount = options.pauseAfter > 0 ? Math.floor(validSelectedDonors.length / options.pauseAfter) : 0
  const totalMinutesEst = Math.round((validSelectedDonors.length * avgDelaySec + pauseCount * options.pauseMinutes * 60) / 60)
  const estimatedDuration = formatEstimatedDuration(totalMinutesEst)
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
  const attachmentPosition = state.attachmentPosition || 'first'
  const positionLabel = attachmentPosition === 'first'
    ? 'Didascalia del primo allegato'
    : attachmentPosition === 'last'
      ? 'Didascalia dell’ultimo allegato'
      : 'Messaggio a parte (dopo gli allegati)'
  const reportRecipients = Array.isArray(sessionReportRecipients)
    ? sessionReportRecipients
    : (state.settings?.reportRecipients || [])
  const emailRecipients = Array.isArray(sessionReportEmailRecipients)
    ? sessionReportEmailRecipients
    : (state.settings?.reportEmailRecipients || [])
  const activeReportDeliveryMode = reportDeliveryMode ?? state.settings?.reportDeliveryMode ?? 'none'
  const activePostSessionAction = options.postSessionAction ?? state.settings?.postSessionAction ?? 'none'
  const reportModeLabels = {
    none: 'Nessun report',
    whatsapp: 'Solo WhatsApp',
    email: 'Solo e-mail',
    both: 'WhatsApp + e-mail',
  }

  function toggleSection(section) {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }))
  }

  function handleReportModeChange(value) {
    onReportDeliveryModeChange?.(value)
  }

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

    const newRecipient = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      phone,
      enabled: true,
    }
    onAddSessionRecipient?.(newRecipient)
    setQuickLabel('')
    setQuickPhone('')
    setQuickError('')
    setShowQuickAdd(false)
  }

  function handleAddEmailRecipient() {
    const label = emailLabel.trim()
    const email = emailAddress.trim().toLowerCase()
    if (!label || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Inserisci un nome e un indirizzo e-mail valido.')
      return
    }

    const newRecipient = {
      id: `report_email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      email,
      enabled: true,
    }
    onAddSessionEmailRecipient?.(newRecipient)
    setEmailLabel('')
    setEmailAddress('')
    setEmailError('')
    setShowEmailAdd(false)
  }

  function updatePostSessionAction(value) {
    setOptions?.((current) => ({ ...current, postSessionAction: value }))
  }

  return (
    <div className="step-container">
      <div className="step-intro">
        <div>
          <span className="eyebrow">Passo 3 di 3</span>
          <h2>Riepilogo generale e avvio sessione</h2>
          <p className="muted">
            Verifica i dettagli prima di iniziare. Le prime due sezioni sono in sola lettura: usa Modifica per tornare allo step corretto.
          </p>
        </div>
      </div>

      <div className="summary-sections">
        <SummarySection
          id="summary-recipients"
          number="01"
          icon={Users}
          title="Destinatari"
          summary={`${validSelectedDonors.length} contatti pronti`}
          expanded={expandedSections.recipients}
          onToggle={() => toggleSection('recipients')}
          onEdit={() => onGoToStep(1)}
          editLabel="Modifica destinatari"
        >
          <div className="summary-section-meta">
            <span>File sorgente</span>
            <strong>{state.fileName || 'Nessun file'}</strong>
          </div>
          {invalidSelectedDonors.length > 0 && (
            <div className="summary-warning-pill">
              <AlertTriangle size={15} aria-hidden="true" />
              {invalidSelectedDonors.length} contatti selezionati con dati non validi e non inviabili.
            </div>
          )}
          <div className="summary-donor-list" aria-label="Lista destinatari in sola lettura">
            {selectedDonors.length === 0 ? (
              <p className="summary-empty-note">Nessun destinatario selezionato.</p>
            ) : selectedDonors.map((donor, index) => {
              const name = [donor.name, donor.surname].filter(Boolean).join(' ') || 'Senza nome'
              return (
                <div key={`${donor.phone || donor.rawPhone || name}-${index}`} className="summary-donor-row">
                  <span className="avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
                  <span className="summary-donor-copy">
                    <strong>{name}</strong>
                    <span>{donor.phone || donor.rawPhone || 'Numero non disponibile'}</span>
                  </span>
                  <span className={`summary-donor-status ${donor.valid ? 'is-valid' : 'is-invalid'}`}>
                    {donor.valid ? 'Pronto' : 'Non valido'}
                  </span>
                </div>
              )
            })}
          </div>
        </SummarySection>

        <SummarySection
          id="summary-content"
          number="02"
          icon={MessageSquare}
          title="Contenuto e tempistiche"
          summary={`${attachmentCount ? `${attachmentCount} allegat${attachmentCount === 1 ? 'o' : 'i'}` : 'Solo testo'} · ~${estimatedDuration}`}
          expanded={expandedSections.content}
          onToggle={() => toggleSection('content')}
          onEdit={() => onGoToStep(2)}
          editLabel="Modifica messaggio, allegati e tempistiche"
        >
          <div className="summary-content-columns">
            <div className="summary-content-column">
              <div className="summary-column-heading">
                <MessageSquare size={16} aria-hidden="true" />
                <strong>Messaggio</strong>
              </div>
              <span className="subtle-note">
                Modello: <strong>{selectedPreset}</strong> · Esempio per {firstSelectedDonor?.name || 'il donatore'}
              </span>
              <div className="summary-text-box">
                {attachmentCount === 1 && (
                  rawAttachments[0].dataUrl ? (
                    <div className="summary-image-preview-wrapper">
                      <img src={rawAttachments[0].dataUrl} alt="Allegato" className="summary-image-preview-img" />
                    </div>
                  ) : (
                    <div className="summary-doc-preview-wrapper">
                      <span className={`summary-doc-badge badge-${(rawAttachments[0].badge || 'doc').toLowerCase()}`}>
                        {rawAttachments[0].badge || 'DOC'}
                      </span>
                      <strong className="summary-doc-name">{rawAttachments[0].name}</strong>
                      {rawAttachments[0].size > 0 && <span className="summary-doc-size">({formatFileSize(rawAttachments[0].size)})</span>}
                    </div>
                  )
                )}
                {attachmentCount > 1 && (
                  <div className="summary-multi-preview-bar">
                    <span className="summary-multi-count-tag"><FileText size={13} aria-hidden="true" /> {attachmentCount} file ({formatFileSize(totalAttachmentBytes)})</span>
                    <span className="summary-multi-pos-tag">{positionLabel}</span>
                  </div>
                )}
                <p className="summary-caption-text">{previewMessage(message, firstSelectedDonor)}</p>
              </div>
              <div className="summary-attachment-list">
                <span className="subtle-note">Allegati</span>
                {attachmentCount === 0 && <span className="muted">Nessun allegato</span>}
                {rawAttachments.map((attachment, index) => (
                  <span key={`${attachment.name}-${index}`} className="summary-attachment-chip" title={attachment.name}>
                    <span className={`chip-badge badge-${(attachment.badge || 'doc').toLowerCase()}`}>{attachment.badge || 'DOC'}</span>
                    <span className="chip-name">{attachment.name}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="summary-content-column summary-rhythm-column">
              <div className="summary-column-heading">
                <Clock3 size={16} aria-hidden="true" />
                <strong>Ritmo anti-ban</strong>
              </div>
              <p className="muted">Pausa casuale tra i messaggi e pausa programmata per proteggere il numero.</p>
              <ul className="summary-param-list">
                <li><span>Intervallo tra messaggi</span><strong>{options.minDelayMs / 1000}s – {options.maxDelayMs / 1000}s</strong></li>
                <li><span>Pausa programmata</span><strong>{options.pauseMinutes} min ogni {options.pauseAfter} messaggi</strong></li>
                <li><span>Durata stimata</span><strong>~{estimatedDuration}</strong></li>
              </ul>
            </div>
          </div>
        </SummarySection>

        <SummarySection
          id="summary-actions"
          number="03"
          icon={Clock3}
          title="Azioni finali"
          summary={`${reportModeLabels[activeReportDeliveryMode]} · ${activePostSessionAction === 'none' ? 'PC acceso' : 'Azione PC programmata'}`}
          expanded={expandedSections.actions}
          onToggle={() => toggleSection('actions')}
        >
          <div className="summary-actions-grid">
            <div className="summary-report-panel">
              <div className="summary-report-heading">
                <div className="summary-column-heading">
                  <Mail size={16} aria-hidden="true" />
                  <strong>Invio selettivo del report</strong>
                </div>
                {onOpenSettings && (
                  <button type="button" className="link-btn summary-settings-link" onClick={() => onOpenSettings('communications')}>
                    Gestisci impostazioni e-mail e rubrica
                  </button>
                )}
              </div>
              <label className="summary-field-label" htmlFor="summary-report-delivery-mode">Canale di invio del report</label>
              <select
                id="summary-report-delivery-mode"
                className="preset-input-field"
                value={activeReportDeliveryMode}
                onChange={(event) => handleReportModeChange(event.target.value)}
              >
                <option value="none">Non inviare il report</option>
                <option value="whatsapp">Solo WhatsApp</option>
                <option value="email">Solo e-mail</option>
                <option value="both">WhatsApp + e-mail</option>
              </select>

              {['whatsapp', 'both'].includes(activeReportDeliveryMode) && (
                <div className="summary-report-channel">
                  <div className="summary-report-channel-header">
                    <span><Smartphone size={15} aria-hidden="true" /> Numeri WhatsApp</span>
                    <button type="button" className="link-btn" onClick={() => setShowQuickAdd((current) => !current)}>
                      <Plus size={14} aria-hidden="true" /> {showQuickAdd ? 'Chiudi' : 'Aggiungi numero'}
                    </button>
                  </div>
                  {showQuickAdd && (
                    <div className="report-recipient-add-box summary-inline-add">
                      <div className="summary-inline-add-grid">
                        <label>Etichetta<input type="text" placeholder="Etichetta (es. Segreteria)" value={quickLabel} onChange={(event) => { setQuickLabel(event.target.value); setQuickError('') }} /></label>
                        <label>Numero di cellulare<input type="tel" placeholder="Cellulare (es. 3331234567)" value={quickPhone} onChange={(event) => { setQuickPhone(event.target.value); setQuickError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddQuickRecipient() } }} /></label>
                        <button type="button" className="button button-primary button-mini" onClick={handleAddQuickRecipient}>Salva</button>
                      </div>
                      {quickError && <p className="report-error-text" role="alert">{quickError}</p>}
                    </div>
                  )}
                  <ReportRecipientList recipients={reportRecipients} type="phone" onToggle={onToggleSessionRecipient} onRemove={onRemoveSessionRecipient} />
                </div>
              )}

              {['email', 'both'].includes(activeReportDeliveryMode) && (
                <div className="summary-report-channel">
                  <div className="summary-report-channel-header">
                    <span><Mail size={15} aria-hidden="true" /> Destinatari e-mail</span>
                    <button type="button" className="link-btn" onClick={() => setShowEmailAdd((current) => !current)}>
                      <Plus size={14} aria-hidden="true" /> {showEmailAdd ? 'Chiudi' : 'Aggiungi e-mail'}
                    </button>
                  </div>
                  {showEmailAdd && (
                    <div className="report-recipient-add-box summary-inline-add">
                      <div className="summary-inline-add-grid">
                        <label>Etichetta e-mail<input type="text" placeholder="es. Ufficio" value={emailLabel} onChange={(event) => { setEmailLabel(event.target.value); setEmailError('') }} /></label>
                        <label>Indirizzo e-mail<input type="email" placeholder="ufficio@avis.it" value={emailAddress} onChange={(event) => { setEmailAddress(event.target.value); setEmailError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddEmailRecipient() } }} /></label>
                        <button type="button" className="button button-primary button-mini" onClick={handleAddEmailRecipient}>Salva e-mail</button>
                      </div>
                      {emailError && <p className="report-error-text" role="alert">{emailError}</p>}
                    </div>
                  )}
                  <ReportRecipientList recipients={emailRecipients} type="email" onToggle={onToggleSessionEmailRecipient} onRemove={onRemoveSessionEmailRecipient} />
                </div>
              )}

              {activeReportDeliveryMode === 'none' && (
                <p className="summary-empty-note">Il report finale non verrà inviato a nessun destinatario.</p>
              )}
              <div className="summary-pc-panel summary-report-channel">
              <div className="summary-column-heading">
                <Monitor size={16} aria-hidden="true" />
                <strong>Azione sul PC</strong>
              </div>
              <label className="summary-field-label" htmlFor="summary-post-session-select">Azione per il PC al termine:</label>
              <select
                id="summary-post-session-select"
                className="preset-input-field"
                value={activePostSessionAction}
                onChange={(event) => updatePostSessionAction(event.target.value)}
              >
                <option value="none">Nessuna azione (lascia il PC acceso)</option>
                <option value="sleep">Sospendi il PC (standby)</option>
                <option value="hibernate">Iberna il PC</option>
                <option value="shutdown">Spegni il PC</option>
              </select>
              {activePostSessionAction !== 'none' ? (
                <div className="summary-warning-pill">
                  <AlertTriangle size={15} aria-hidden="true" />
                  Avrai 60 secondi per annullare l&apos;azione prima che venga eseguita.
                </div>
              ) : (
                <p className="summary-empty-note">Il computer rimarrà acceso normalmente.</p>
              )}
            </div>
          </div>
          </div>
        </SummarySection>
      </div>

      <div className="step-actions-footer">
        <button type="button" className="button button-secondary" onClick={onBack}>Indietro: Messaggio e ritmo</button>
        <button type="button" className="button button-primary start-button-large" onClick={onStart} disabled={!canStart}>Avvia invio messaggi</button>
      </div>
    </div>
  )
}
