import { FileText, Download, Cake, HelpCircle, ExternalLink, Image, Save, RefreshCw, CheckCircle, Play, BookOpen, AlertCircle, Mail, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toUserError } from '../errorMessage'
import ReactMarkdown from 'react-markdown'
import { normalizeReleaseNotes } from '../releaseNotes.mjs'
import { normalizeReportPhone, formatReportPhoneDisplay } from './reportRecipients.mjs'
import EmailGuideDialog from './EmailGuideDialog'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function providerConfigured(state) {
  if (state.emailCredentialsByProvider && Object.prototype.hasOwnProperty.call(state.emailCredentialsByProvider, 'gmail')) {
    return state.emailCredentialsByProvider.gmail === true
  }
  return state.emailCredentialsConfigured === true
}

export default function SettingsModal({
  isOpen,
  onClose,
  state,
  api,
  call,
  options,
  setOptions,
  selectedPreset,
  setSelectedPreset,
  setPresetName,
  setMessage,
  initialTab = 'storage',
  onStartTutorial,
  onOpenGuide,
  onOpenDeveloperReport,
}) {
  const [userTab, setUserTab] = useState(null)
  const activeTab = userTab ?? initialTab
  const initialPreset = (state.presets || []).find((p) => p.name === selectedPreset) || state.presets?.[0] || null
  const [editingPreset, setEditingPreset] = useState(initialPreset)
  const [presetForm, setPresetForm] = useState({
    name: initialPreset?.name || 'Nuovo preset',
    message: initialPreset?.message || '',
    settings: { ...(initialPreset?.settings || options) },
    attachment: initialPreset?.attachment || null,
    attachmentSourcePath: '',
    attachmentFileName: initialPreset?.attachment?.fileName || '',
  })
  const [statusMsg, setStatusMsg] = useState('')
  const [newRecipientLabel, setNewRecipientLabel] = useState('')
  const [newRecipientPhone, setNewRecipientPhone] = useState('')
  const [recipientError, setRecipientError] = useState('')
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(state.settings?.emailNotificationsEnabled === true)
  const initialProviderConfigured = state.emailCredentialsByProvider?.gmail === true
    || (state.emailCredentialsByProvider == null && state.emailCredentialsConfigured === true)
  const [gmailAddress, setGmailAddress] = useState(initialProviderConfigured
    ? (state.settings?.emailAddresses?.gmail || state.settings?.gmailAddress || '')
    : '')
  const [gmailPassword, setGmailPassword] = useState('')
  const [gmailPasswordSaved, setGmailPasswordSaved] = useState(initialProviderConfigured)
  const [gmailSaveInProgress, setGmailSaveInProgress] = useState(false)
  const [newEmailLabel, setNewEmailLabel] = useState('')
  const [newEmailAddress, setNewEmailAddress] = useState('')
  const [newReportEmailLabel, setNewReportEmailLabel] = useState('')
  const [newReportEmailAddress, setNewReportEmailAddress] = useState('')
  const [reportEmailError, setReportEmailError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailTestStatus, setEmailTestStatus] = useState(null)
  const [emailTestInProgress, setEmailTestInProgress] = useState(false)
  const [showEmailGuide, setShowEmailGuide] = useState(false)
  const [showGmailForm, setShowGmailForm] = useState(!initialProviderConfigured)
  const [reportDeliveryMode, setReportDeliveryMode] = useState(state.settings?.reportDeliveryMode || 'none')
  const emailAddressDirtyRef = useRef(false)
  const initialEmailSyncRef = useRef(true)
  const gmailConfiguredRef = useRef(initialProviderConfigured)
  const providerLabel = 'Gmail'
  const effectiveOutputDir = state.settings?.outputDir || state.defaultOutputDir || 'Desktop / AVIS WhatsApp Sender'
  const effectiveLogDir = state.settings?.logDir || state.defaultLogDir || 'Cartella log predefinita'

  // Synchronize the form with persisted settings received asynchronously from Electron.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setEmailNotificationsEnabled(state.settings?.emailNotificationsEnabled === true)
    setReportDeliveryMode(state.settings?.reportDeliveryMode || 'none')
    const configured = providerConfigured(state)
    const persistedAddress = state.settings?.emailAddresses?.gmail || state.settings?.gmailAddress || ''
    if (!emailAddressDirtyRef.current) {
      // Keep an address editable before credentials are saved; provider changes
      // are the only action that intentionally clears an unconfigured address.
      // oxlint-disable-next-line react/set-state-in-effect
      setGmailAddress(configured || !initialEmailSyncRef.current ? persistedAddress : '')
    }
    initialEmailSyncRef.current = false
    // oxlint-disable-next-line react/set-state-in-effect
    setGmailPasswordSaved(configured)
    if (!configured) {
      // oxlint-disable-next-line react/set-state-in-effect
      setShowGmailForm(true)
    } else if (!gmailConfiguredRef.current) {
      // Show the compact card when persisted credentials arrive asynchronously.
      // oxlint-disable-next-line react/set-state-in-effect
      setShowGmailForm(false)
    }
    gmailConfiguredRef.current = configured
  }, [
    state,
    state.settings?.emailNotificationsEnabled,
    state.settings?.gmailAddress,
    state.settings?.emailAddresses,
    state.emailCredentialsConfigured,
    state.emailCredentialsByProvider,
  ])

  const [prevProps, setPrevProps] = useState({ isOpen, initialTab })
  if (prevProps.isOpen !== isOpen || prevProps.initialTab !== initialTab) {
    setPrevProps({ isOpen, initialTab })
    if (isOpen) {
      setUserTab(null)
      setStatusMsg('')
    }
  }

  if (!isOpen) return null

  function handleAddRecipient() {
    const label = newRecipientLabel.trim()
    if (!label) {
      setRecipientError('Inserisci un’etichetta per identificare il contatto (es. Segreteria).')
      return
    }

    const phoneResult = normalizeReportPhone(newRecipientPhone)
    if (!phoneResult.valid) {
      setRecipientError(phoneResult.error)
      return
    }

    const currentList = Array.isArray(state.settings?.reportRecipients) ? state.settings.reportRecipients : []
    const updated = [
      ...currentList,
      {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        phone: phoneResult.phone,
        enabled: true,
      },
    ]

    call(() => api.saveSettings({ reportRecipients: updated }))
    setNewRecipientLabel('')
    setNewRecipientPhone('')
    setRecipientError('')
  }

  function saveEmailSettings(patch) {
    return call(() => api.saveSettings(patch))
  }

  function handleEmailNotificationsChange(enabled) {
    setEmailNotificationsEnabled(enabled)
    saveEmailSettings({ emailNotificationsEnabled: enabled })
  }

  function handleGmailAddressChange(value) {
    emailAddressDirtyRef.current = true
    setGmailAddress(value)
    if (EMAIL_RE.test(value.trim())) saveEmailSettings({ gmailAddress: value })
  }

  async function handleSaveGmailPassword() {
    const address = gmailAddress.trim().toLowerCase()
    if (!EMAIL_RE.test(address)) {
      setEmailError(`Inserisci un indirizzo e-mail ${providerLabel} valido.`)
      return
    }
    if (!gmailPassword.trim()) {
      setEmailError(`Inserisci la password per app generata da ${providerLabel}.`)
      return
    }
    const wasConfigured = gmailPasswordSaved
    setGmailSaveInProgress(true)
    try {
      await call(() => api.saveSettings({ gmailAddress: address }))
      await call(() => api.saveEmailPassword
        ? api.saveEmailPassword(gmailPassword)
        : api.saveGmailPassword(gmailPassword))
      setGmailPasswordSaved(true)
      setShowGmailForm(false)
      setEmailError('')
      setStatusMsg(wasConfigured
        ? `Provider ${providerLabel} aggiornato e salvato in modo cifrato sul PC.`
        : `Provider ${providerLabel} salvato in modo cifrato sul PC.`)
    } catch {
      setEmailError(`Impossibile salvare il provider ${providerLabel}. Riprova.`)
    } finally {
      setGmailSaveInProgress(false)
    }
  }

  function handleEditGmailProvider() {
    setShowGmailForm(true)
    setEmailError('')
    setStatusMsg('')
  }

  async function handleRemoveGmailProvider() {
    try {
      await call(() => api.clearGmailPassword())
      await call(() => api.saveSettings({ gmailAddress: '' }))
      emailAddressDirtyRef.current = false
      setGmailAddress('')
      setGmailPassword('')
      setGmailPasswordSaved(false)
      setShowGmailForm(true)
      setEmailError('')
      setStatusMsg('Provider Gmail rimosso.')
    } catch {
      // L'errore viene mostrato dal gestore centrale dell'applicazione.
    }
  }

  async function handleEmailTest() {
    const address = gmailAddress.trim().toLowerCase()
    if (!EMAIL_RE.test(address)) {
      setEmailError(`Inserisci prima l'indirizzo ${providerLabel} AVIS.`)
      setEmailTestStatus({ type: 'error', message: `Inserisci prima l'indirizzo ${providerLabel} AVIS.` })
      return
    }
    if (!gmailPasswordSaved) {
      const message = `Salva prima il provider ${providerLabel}.`
      setEmailError(message)
      setEmailTestStatus({ type: 'error', message })
      return
    }
    setEmailError('')
    setEmailTestInProgress(true)
    setEmailTestStatus({ type: 'pending', message: 'Invio e-mail di prova in corso…' })
    try {
      await call(() => api.sendEmailTest(address))
      setEmailError('')
      setStatusMsg(`E-mail di prova inviata a ${address}.`)
      setEmailTestStatus({ type: 'success', message: 'E-mail inviata correttamente.' })
    } catch {
      setEmailTestStatus({
        type: 'error',
        message: `Invio non riuscito. Controlla la Password per app ${providerLabel} e riprova.`,
      })
    } finally {
      setEmailTestInProgress(false)
    }
  }

  function handleAddEmailRecipient() {
    const label = newEmailLabel.trim()
    const email = newEmailAddress.trim().toLowerCase()
    if (!label || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Inserisci un nome e un indirizzo e-mail valido.')
      return
    }
    const currentList = Array.isArray(state.settings?.emailRecipients) ? state.settings.emailRecipients : []
    saveEmailSettings({
      emailRecipients: [...currentList, {
        id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        email,
        enabled: true,
      }],
    })
    setNewEmailLabel('')
    setNewEmailAddress('')
    setEmailError('')
  }

  function handleAddReportEmailRecipient() {
    const label = newReportEmailLabel.trim()
    const email = newReportEmailAddress.trim().toLowerCase()
    if (!label || !EMAIL_RE.test(email)) {
      setReportEmailError('Inserisci un nome e un indirizzo e-mail valido.')
      return
    }
    const currentList = Array.isArray(state.settings?.reportEmailRecipients) ? state.settings.reportEmailRecipients : []
    saveEmailSettings({
      reportEmailRecipients: [...currentList, {
        id: `report_email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        email,
        enabled: true,
      }],
    })
    setNewReportEmailLabel('')
    setNewReportEmailAddress('')
    setReportEmailError('')
  }

  function handleSelectPreset(preset) {
    setStatusMsg('')
    setEditingPreset(preset)
    setPresetForm({
      name: preset.name,
      message: preset.message,
      settings: { ...(preset.settings || options) },
      attachment: preset.attachment || null,
      attachmentSourcePath: '',
      attachmentFileName: preset.attachment?.fileName || '',
    })
  }

  function handleNewPreset() {
    setStatusMsg('')
    setEditingPreset(null)
    setPresetForm({
      name: 'Nuovo Modello',
      message: 'Gentile [nome],\n\nAVIS Comunale\n\nTi ricordiamo di salvare questo numero tra i tuoi contatti per ricevere i promemoria delle donazioni.',
      settings: { minDelayMs: 20000, maxDelayMs: 40000, pauseAfter: 35, pauseMinutes: 15 },
      attachment: null,
      attachmentSourcePath: '',
      attachmentFileName: '',
    })
  }

  async function handlePresetAttachment() {
    try {
      const selected = await call(() => api.selectPresetAttachment())
      if (!selected) return
      setPresetForm((current) => ({
        ...current,
        attachmentSourcePath: selected.sourcePath,
        attachmentFileName: selected.fileName,
      }))
      setStatusMsg('Allegato selezionato. Salva il modello per conservarlo.')
    } catch {
      // L'errore viene mostrato dal gestore centrale dell'applicazione.
    }
  }

  function handleRemovePresetAttachment() {
    setPresetForm((current) => ({
      ...current,
      attachment: null,
      attachmentSourcePath: '',
      attachmentFileName: '',
    }))
    setStatusMsg('Allegato rimosso dal modello. Salva il modello per confermare.')
  }

  async function handleNotificationsChange(enabled) {
    try {
      await call(() => api.saveSettings({ notificationsEnabled: enabled }))
    } catch {
      // L'errore viene mostrato dal gestore centrale dell'applicazione.
    }
  }

  async function saveBirthdaySettings(patch) {
    try {
      await call(() => api.saveSettings(patch))
      setStatusMsg('Impostazioni compleanni salvate.')
    } catch {
      // L'errore viene mostrato dal gestore centrale dell'applicazione.
    }
  }

  async function handleBirthdaySource() {
    try {
      await call(() => api.selectBirthdaySource())
      setStatusMsg('File compleanni aggiornato.')
    } catch {
      // L'errore viene mostrato dal gestore centrale dell'applicazione.
    }
  }

  async function handleBirthdayCheck() {
    try {
      await call(() => api.checkBirthdays({ force: true, notify: false }))
      setStatusMsg('Controllo compleanni completato.')
    } catch {
      // L'errore viene mostrato dal gestore centrale dell'applicazione.
    }
  }

  async function handleSavePreset() {
    if (!presetForm.name.trim()) {
      setStatusMsg('Inserisci un nome per il preset.')
      return
    }
    await call(async () => {
      const payload = {
        name: presetForm.name.trim(),
        message: presetForm.message,
        settings: presetForm.settings,
        attachment: presetForm.attachment,
        attachmentSourcePath: presetForm.attachmentSourcePath,
      }
      const next = await api.savePreset(payload)
      const savedPreset = next.presets?.find((preset) => preset.name === payload.name)
      const withAttachment = await api.loadPresetAttachment(savedPreset?.attachment || null)
      setSelectedPreset(payload.name)
      setPresetName(payload.name)
      setMessage(payload.message)
      if (payload.settings) setOptions(payload.settings)
      setStatusMsg(`Preset "${payload.name}" salvato con successo!`)
      return withAttachment
    })
  }

  async function handleDeletePreset(name) {
    if (!window.confirm(`Sei sicuro di voler eliminare il preset "${name}"?`)) return
    await call(async () => {
      const next = await api.deletePreset(name)
      const first = next.presets?.[0]
      const withAttachment = await api.loadPresetAttachment(first?.attachment || null)
      if (first) {
        setSelectedPreset(first.name)
        setPresetName(first.name)
        setMessage(first.message)
        if (first.settings) setOptions(first.settings)
      }
      setStatusMsg(`Preset "${name}" eliminato.`)
      return withAttachment
    })
  }

  function insertToken(token) {
    setPresetForm((prev) => ({
      ...prev,
      message: prev.message + token,
    }))
  }

  return (
    <>
      <div
      className="guide-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-header">
          <div className="settings-header-title">
            <span className="eyebrow">Configurazione di sistema</span>
            <h2 id="settings-title">Impostazioni & Modelli</h2>
          </div>
          <button className="guide-close" onClick={onClose} aria-label="Chiudi impostazioni">
            &times;
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab-btn ${activeTab === 'general' || activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => { setUserTab('general'); setStatusMsg('') }}
          >
            <SlidersHorizontal className="tab-icon" size={16} /> Generali
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'communications' ? 'active' : ''}`}
            onClick={() => { setUserTab('communications'); setStatusMsg('') }}
          >
            <Mail className="tab-icon" size={16} /> Comunicazioni
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => { setUserTab('presets'); setStatusMsg('') }}
          >
            <FileText className="tab-icon" size={16} /> Modelli & Preset
          </button>
          <button
            className={`settings-tab-btn settings-tab-updates ${activeTab === 'updates' ? 'active' : ''}`}
            onClick={() => { setUserTab('updates'); setStatusMsg('') }}
          >
            <Download className="tab-icon" size={16} /> Aggiornamenti
            {state.updater?.status === 'available' && (
              <span className="tab-update-badge" title="Nuova versione disponibile">●</span>
            )}
            {state.updater?.status === 'downloaded' && (
              <span className="tab-update-badge ready" title="Pronto da installare">●</span>
            )}
          </button>
          <button
            className={`settings-tab-btn settings-tab-birthdays ${activeTab === 'birthdays' ? 'active' : ''}`}
            onClick={() => { setUserTab('birthdays'); setStatusMsg('') }}
          >
            <Cake className="tab-icon" size={16} /> Compleanni
          </button>
          <button
            className={`settings-tab-btn settings-tab-tutorial ${activeTab === 'tutorial' ? 'active' : ''}`}
            onClick={() => { setUserTab('tutorial'); setStatusMsg('') }}
          >
            <HelpCircle className="tab-icon" size={16} /> Guida & Tutorial
          </button>
        </div>

        <div className="settings-body">
          {statusMsg && <div className="settings-status-alert">{statusMsg}</div>}

          {(activeTab === 'general' || activeTab === 'storage' || activeTab === 'communications') && (
            <div className="settings-storage-section">
              <p className="muted" style={{ marginTop: 0 }}>
                Configura le opzioni di sistema, le automazioni al termine dell'invio e le cartelle di archiviazione.
              </p>

              {/* Sistema & Avvio */}
              <div className="storage-card">
                <div className="storage-card-header">
                  <div>
                    <strong>Sistema & Notifiche</strong>
                    <p className="subtle-note">Gestisci l'avvio automatico e gli avvisi desktop.</p>
                  </div>
                </div>

                <label className="settings-checkbox-row" style={{ marginTop: '10px' }}>
                  <input
                    type="checkbox"
                    checked={state.settings?.startWithWindows !== false}
                    onChange={(event) => call(() => api.setStartWithWindows(event.target.checked))}
                  />
                  <span>Avvia AVIS Sender con Windows</span>
                </label>
                <p className="subtle-note" style={{ margin: '2px 0 12px 24px' }}>
                  Avvia l'app all'accesso al computer per controllare i promemoria e rimanere pronta nella barra delle applicazioni.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                  <div>
                    <strong style={{ fontSize: '13px' }}>Notifiche Windows</strong>
                    <p className="subtle-note" style={{ margin: '2px 0 0' }}>
                      Ricevi avvisi su desktop per connessione WhatsApp, completamento invii ed errori.
                    </p>
                  </div>
                  <label className="settings-toggle" title="Attiva o disattiva le notifiche Windows">
                    <input
                      type="checkbox"
                      checked={state.settings?.notificationsEnabled !== false}
                      onChange={(event) => handleNotificationsChange(event.target.checked)}
                    />
                    <span className="settings-toggle-track" aria-hidden="true" />
                    <span className="sr-only">Attiva notifiche Windows</span>
                  </label>
                </div>
              </div>

              {activeTab === 'communications' && (
                <>
              {/* Automazioni di fine sessione */}
              <div className="storage-card">
                <div className="storage-card-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Report di fine invio</h3>
                    <p className="subtle-note">Configura uno o più numeri a cui recapitare automaticamente l'esito al termine dell'invio.</p>
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="report-delivery-mode">Canale di invio del report</label>
                  <select
                    id="report-delivery-mode"
                    className="preset-input-field"
                    value={reportDeliveryMode}
                    onChange={(event) => {
                      setReportDeliveryMode(event.target.value)
                      saveEmailSettings({ reportDeliveryMode: event.target.value })
                    }}
                  >
                    <option value="none">Non inviare il report</option>
                    <option value="whatsapp">Solo WhatsApp</option>
                    <option value="email">Solo e-mail</option>
                    <option value="both">WhatsApp + e-mail</option>
                  </select>
                </div>

                {['whatsapp', 'both'].includes(reportDeliveryMode) && <>
                <strong style={{ fontSize: '13px' }}>Destinatari WhatsApp del report</strong>
                {/* Lista destinatari configurati */}
                {(!state.settings?.reportRecipients || state.settings.reportRecipients.length === 0) ? (
                  <div className="report-recipients-empty">
                    <p className="subtle-note" style={{ margin: 0 }}>
                      ⚪ Nessun destinatario configurato. Il report finale non verrà inviato. Aggiungi uno o più numeri qui sotto con una label identificativa.
                    </p>
                  </div>
                ) : (
                  <div className="report-recipients-list">
                    {state.settings.reportRecipients.map((rec) => (
                      <div
                        key={rec.id}
                        className={`report-recipient-card ${rec.enabled !== false ? 'is-active' : 'is-inactive'}`}
                      >
                        <div className="report-recipient-left">
                          <input
                            type="checkbox"
                            id={`rec-toggle-${rec.id}`}
                            className="report-recipient-checkbox"
                            checked={rec.enabled !== false}
                            onChange={(e) => {
                              const updated = (state.settings?.reportRecipients || []).map((r) =>
                                r.id === rec.id ? { ...r, enabled: e.target.checked } : r
                              )
                              call(() => api.saveSettings({ reportRecipients: updated }))
                            }}
                            title="Attivo come valore predefinito"
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="report-recipient-label-tag">
                                🏷️ {rec.label}
                              </span>
                              <strong className="report-recipient-phone">
                                {formatReportPhoneDisplay(rec.phone)}
                              </strong>
                            </div>
                            <span className="subtle-note" style={{ fontSize: '11px' }}>
                              {rec.enabled !== false ? 'Incluso di default' : 'Escluso di default'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="link-btn report-recipient-delete-btn"
                          onClick={() => {
                            const updated = (state.settings?.reportRecipients || []).filter((r) => r.id !== rec.id)
                            call(() => api.saveSettings({ reportRecipients: updated }))
                          }}
                          title={`Elimina ${rec.label}`}
                        >
                          🗑️ Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form aggiunta nuovo destinatario */}
                <div className="report-recipient-add-box">
                  <span className="report-recipient-add-title">
                    ➕ Aggiungi un destinatario
                  </span>
                  <div className="report-recipient-add-grid">
                    <div>
                      <input
                        type="text"
                        placeholder="Etichetta (es. Presidente, Segreteria)"
                        className="preset-input-field"
                        style={{ width: '100%', fontSize: '12px' }}
                        value={newRecipientLabel}
                        onChange={(e) => {
                          setNewRecipientLabel(e.target.value)
                          if (recipientError) setRecipientError('')
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="Numero (es. 3331234567)"
                        className="preset-input-field"
                        style={{ width: '100%', fontSize: '12px' }}
                        value={newRecipientPhone}
                        onChange={(e) => {
                          setNewRecipientPhone(e.target.value)
                          if (recipientError) setRecipientError('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddRecipient()
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ padding: '6px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      onClick={handleAddRecipient}
                    >
                      + Aggiungi
                    </button>
                  </div>
                  {recipientError && (
                    <p className="report-error-text">
                      ⚠️ {recipientError}
                    </p>
                  )}
                </div>

                </>}

                {['email', 'both'].includes(reportDeliveryMode) && (
                  <div style={{ paddingTop: '14px', marginTop: '14px', borderTop: '1px solid var(--line)' }}>
                    <strong style={{ fontSize: '13px' }}>Destinatari del report via e-mail</strong>
                    {(!state.settings?.reportEmailRecipients || state.settings.reportEmailRecipients.length === 0) ? (
                      <p className="subtle-note" style={{ margin: '6px 0' }}>Nessun destinatario configurato.</p>
                    ) : (
                      <div className="report-recipients-list">
                        {state.settings.reportEmailRecipients.map((recipient) => (
                          <div key={recipient.id} className={`report-recipient-card ${recipient.enabled !== false ? 'is-active' : 'is-inactive'}`}>
                            <div className="report-recipient-left">
                              <input type="checkbox" className="report-recipient-checkbox" checked={recipient.enabled !== false} aria-label={`Attiva destinatario report e-mail ${recipient.label}`} onChange={(event) => saveEmailSettings({ reportEmailRecipients: state.settings.reportEmailRecipients.map((item) => item.id === recipient.id ? { ...item, enabled: event.target.checked } : item) })} />
                              <div><span className="report-recipient-label-tag">{recipient.label}</span> <strong className="report-recipient-phone">{recipient.email}</strong></div>
                            </div>
                            <button type="button" className="link-btn report-recipient-delete-btn" onClick={() => saveEmailSettings({ reportEmailRecipients: state.settings.reportEmailRecipients.filter((item) => item.id !== recipient.id) })}>Rimuovi</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="report-recipient-add-grid" style={{ marginTop: '10px' }}>
                      <input type="text" className="preset-input-field" placeholder="Nome destinatario e-mail" value={newReportEmailLabel} onChange={(event) => { setNewReportEmailLabel(event.target.value); setReportEmailError('') }} />
                      <input type="email" className="preset-input-field" placeholder="E-mail del destinatario" value={newReportEmailAddress} onChange={(event) => { setNewReportEmailAddress(event.target.value); setReportEmailError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddReportEmailRecipient() } }} />
                      <button type="button" className="button button-primary" onClick={handleAddReportEmailRecipient}>Aggiungi destinatario e-mail</button>
                    </div>
                    {reportEmailError && <p className="report-error-text">{reportEmailError}</p>}
                  </div>
                )}

                <div style={{ paddingTop: '14px', marginTop: '14px', borderTop: '1px solid var(--line)' }}>
                  <label className="settings-field-label" htmlFor="post-session-action-select">
                    Azione per il PC al termine:
                  </label>
                  <select
                    id="post-session-action-select"
                    className="preset-input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={state.settings?.postSessionAction || 'none'}
                    onChange={(event) => {
                      const val = event.target.value
                      call(() => api.saveSettings({ postSessionAction: val }))
                      if (setOptions) setOptions((prev) => ({ ...prev, postSessionAction: val }))
                    }}
                  >
                    <option value="none">Nessuna azione (lascia il PC acceso)</option>
                    <option value="sleep">💤 Sospendi il PC (Standby)</option>
                    <option value="hibernate">🌙 Iberna il PC</option>
                    <option value="shutdown">🔌 Spegni il PC</option>
                  </select>
                  <p className="subtle-note" style={{ marginTop: '6px', marginBottom: 0 }}>
                    {state.settings?.postSessionAction && state.settings?.postSessionAction !== 'none'
                      ? 'Prima dell’esecuzione avrai 60 secondi per annullare l’azione dalla schermata. Potrai modificare la scelta per ogni singolo invio nello step finale.'
                      : 'Nessuna azione energetica programmata. Puoi comunque attivarla per una singola sessione nello step di riepilogo.'}
                  </p>
                </div>
              </div>

              <div className="storage-card">
                <div className="storage-card-header">
                  <div>
                    <strong>Comunicazioni e-mail: emergenze e log</strong>
                    <p className="subtle-note">Usa lo stesso account per i recap di emergenza, gli avvisi di spegnimento e l’invio dei log allo sviluppatore.</p>
                  </div>
                </div>

                <label className="settings-checkbox-row" style={{ marginTop: '10px' }}>
                  <input
                    type="checkbox"
                    checked={emailNotificationsEnabled}
                    onChange={(event) => handleEmailNotificationsChange(event.target.checked)}
                  />
                  <span>Attiva notifiche e-mail per le emergenze</span>
                </label>

                <div className="field-group" style={{ marginTop: '14px' }}>
                  <div className="field-label-row">
                    <label>Provider e-mail: Gmail</label>
                    <button
                      type="button"
                      className="email-guide-trigger"
                      onClick={() => setShowEmailGuide(true)}
                      aria-label="Come creo una password per app"
                    >
                      <HelpCircle size={14} aria-hidden="true" /> Come creo una password per app?
                    </button>
                  </div>
                </div>
                {showGmailForm ? (
                  <>
                    <div className="field-group">
                      <label htmlFor="gmail-address">Indirizzo e-mail mittente</label>
                      <input
                        id="gmail-address"
                        type="email"
                        className="preset-input-field"
                        value={gmailAddress}
                        placeholder="avis@example.org"
                        onChange={(event) => handleGmailAddressChange(event.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="gmail-app-password">Password per app {providerLabel}</label>
                      <input
                        id="gmail-app-password"
                        type="password"
                        className="preset-input-field"
                        value={gmailPassword}
                        placeholder={gmailPasswordSaved ? '•••••••••••••••• (password salvata)' : 'Password per app Gmail'}
                        autoComplete="new-password"
                        onChange={(event) => {
                          setGmailPasswordSaved(false)
                          setGmailPassword(event.target.value)
                          if (emailError) setEmailError('')
                        }}
                      />
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ marginTop: '8px', width: '100%' }}
                        onClick={handleSaveGmailPassword}
                        disabled={gmailSaveInProgress}
                      >
                        {gmailSaveInProgress ? 'Salvataggio…' : 'Salva provider'}
                      </button>
                      <p className="subtle-note" style={{ margin: '6px 0 0' }}>
                        La password resta cifrata da Windows e non viene inclusa nelle impostazioni o nei log.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="report-recipient-card email-provider-card is-active">
                    <div className="report-recipient-left">
                      <div className="email-provider-mark" aria-hidden="true"><Mail size={14} /></div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="report-recipient-label-tag">Gmail</span>
                          <strong className="report-recipient-phone">{gmailAddress}</strong>
                        </div>
                        <span className="subtle-note" style={{ fontSize: '11px' }}>
                          Password per app salvata in modo cifrato
                        </span>
                      </div>
                    </div>
                    <div className="email-provider-actions">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={handleEditGmailProvider}
                        aria-label="Modifica provider Gmail"
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        className="link-btn report-recipient-delete-btn"
                        onClick={handleRemoveGmailProvider}
                        aria-label="Rimuovi provider Gmail"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </div>
                )}
                <div className="field-group">
                  <button type="button" className="button button-secondary" style={{ marginTop: '10px' }} onClick={handleEmailTest} disabled={emailTestInProgress}>
                    {emailTestInProgress ? 'Invio in corso…' : 'Invia e-mail di prova'}
                  </button>
                  {emailTestStatus && (
                    <div
                      role={emailTestStatus.type === 'error' ? 'alert' : 'status'}
                      aria-live="polite"
                      className={`settings-status-alert ${emailTestStatus.type === 'error' ? 'error-box' : ''}`}
                      style={{ marginTop: '10px', marginBottom: 0 }}
                    >
                      {emailTestStatus.message}
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: '14px', marginTop: '14px', borderTop: '1px solid var(--line)' }}>
                  <strong style={{ fontSize: '13px' }}>Destinatari del recap di emergenza</strong>
                  {(!state.settings?.emailRecipients || state.settings.emailRecipients.length === 0) ? (
                    <p className="subtle-note" style={{ margin: '6px 0' }}>Nessun destinatario configurato.</p>
                  ) : (
                    <div className="report-recipients-list">
                      {state.settings.emailRecipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className={`report-recipient-card ${recipient.enabled !== false ? 'is-active' : 'is-inactive'}`}
                        >
                          <div className="report-recipient-left">
                            <input
                              type="checkbox"
                              id={`email-rec-toggle-${recipient.id}`}
                              className="report-recipient-checkbox"
                              checked={recipient.enabled !== false}
                              onChange={(event) => {
                                const updated = state.settings.emailRecipients.map((item) => (
                                  item.id === recipient.id ? { ...item, enabled: event.target.checked } : item
                                ))
                                saveEmailSettings({ emailRecipients: updated })
                              }}
                              aria-label={`Attiva destinatario ${recipient.label}`}
                              title="Attivo come destinatario di emergenza"
                            />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="report-recipient-label-tag">🏷️ {recipient.label}</span>
                                <strong className="report-recipient-phone">{recipient.email}</strong>
                              </div>
                              <span className="subtle-note" style={{ fontSize: '11px' }}>
                                {recipient.enabled !== false ? 'Incluso di default' : 'Escluso di default'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="link-btn report-recipient-delete-btn"
                            onClick={() => saveEmailSettings({ emailRecipients: state.settings.emailRecipients.filter((item) => item.id !== recipient.id) })}
                            title={`Elimina ${recipient.label}`}
                          >
                            🗑️ Rimuovi
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="report-recipient-add-grid" style={{ marginTop: '10px' }}>
                    <input
                      type="text"
                      className="preset-input-field"
                      placeholder="Nome destinatario e-mail"
                      value={newEmailLabel}
                      onChange={(event) => setNewEmailLabel(event.target.value)}
                    />
                    <input
                      type="email"
                      className="preset-input-field"
                      placeholder="E-mail del destinatario"
                      value={newEmailAddress}
                      onChange={(event) => setNewEmailAddress(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleAddEmailRecipient()
                        }
                      }}
                    />
                    <button type="button" className="button button-primary" onClick={handleAddEmailRecipient}>
                      Aggiungi destinatario e-mail
                    </button>
                  </div>
                </div>
                {emailError && <p className="report-error-text">⚠️ {emailError}</p>}
              </div>

                </>
              )}

              {(activeTab === 'general' || activeTab === 'storage') && <>
              {/* Cartella Esiti */}
              <div className="storage-card">
                <div className="storage-card-header">
                  <div>
                    <strong>Cartella Esiti Sessioni</strong>
                    <p className="subtle-note">Dove vengono archiviati i report di fine invio.</p>
                  </div>
                  {Boolean(state.settings?.outputDir) && (
                    <button
                      className="link-btn"
                      title="Ripristina cartella predefinita sul Desktop"
                      onClick={() => call(() => api.resetOutputDir())}
                    >
                      Ripristina predefinita
                    </button>
                  )}
                </div>
                <div className="storage-path" title={effectiveOutputDir}>
                  {effectiveOutputDir}
                </div>
                <div className="storage-actions">
                  <button className="button button-secondary" onClick={() => call(() => api.selectOutputDir())}>
                    Sfoglia cartella...
                  </button>
                  <button
                    className="button button-secondary"
                    title="Apri cartella esiti in Esplora Risorse"
                    onClick={() => api?.openOutputDir?.()}
                  >
                    <ExternalLink size={16} /> Apri in Esplora Risorse
                  </button>
                </div>
              </div>

              {/* Cartella Log */}
              <div className="storage-card">
                <div className="storage-card-header">
                  <div>
                    <strong>Cartella Log Diagnostici</strong>
                    <p className="subtle-note">File di diagnostica ed eventi operativi registrati.</p>
                  </div>
                  {Boolean(state.settings?.logDir) && (
                    <button
                      className="link-btn"
                      title="Ripristina cartella log predefinita"
                      onClick={() => call(() => api.resetLogsDir())}
                    >
                      Ripristina predefinita
                    </button>
                  )}
                </div>
                <div className="storage-path" title={effectiveLogDir}>
                  {effectiveLogDir}
                </div>
                <div className="storage-actions">
                  <button className="button button-secondary" onClick={() => call(() => api.selectLogsDir())}>
                    Sfoglia cartella...
                  </button>
                  <button
                    className="button button-secondary"
                    title="Apri cartella log in Esplora Risorse"
                    onClick={() => api?.openLogsDir?.()}
                  >
                    <ExternalLink size={16} /> Apri cartella log
                  </button>
                  <button
                    className="button button-secondary"
                    title="Invia il log della giornata per email allo sviluppatore"
                    onClick={() => {
                      if (onOpenDeveloperReport) {
                        onOpenDeveloperReport('')
                      } else {
                        api?.sendDeveloperReport?.()
                      }
                    }}
                  >
                    <Mail size={16} /> Invia log di oggi per email
                  </button>
                </div>
              </div>

              {/* Dati applicazione */}
              <div className="storage-card subtle">
                <div className="storage-card-header">
                  <div>
                    <strong>Dati e sessioni dell'Applicazione</strong>
                    <p className="subtle-note">Sessione WhatsApp Web e file di configurazione locale.</p>
                  </div>
                  <button
                    className="button button-secondary"
                    onClick={() => api?.openUserDataDir?.()}
                  >
                    <ExternalLink size={16} /> Apri cartella dati app
                  </button>
                </div>
              </div>
              </>}
            </div>
          )}

          {activeTab === 'birthdays' && (
            <div className="settings-birthdays-section">
              <section className="birthday-settings-hero">
                <span className="birthday-settings-hero-icon" aria-hidden="true"><Cake size={48} /></span>
                <div className="birthday-settings-hero-copy">
                  <span className="eyebrow">Promemoria donatori</span>
                  <h3>Auguri di compleanno</h3>
                  <p>Controlla ogni giorno la lista dei donatori e prepara gli auguri senza avviare automaticamente l'invio.</p>
                </div>
                <div className={`birthday-settings-status ${state.birthdays?.pendingCount > 0 && !state.birthdays?.sessionPrepared ? 'is-pending' : ''}`}>
                  <strong>{state.birthdays?.pendingCount > 0 && !state.birthdays?.sessionPrepared ? `${state.birthdays.pendingCount} da gestire` : 'Nessun promemoria'}</strong>
                  <span>{state.birthdays?.lastCheckedAt ? `Controllato ${new Date(state.birthdays.lastCheckedAt).toLocaleDateString('it-IT')}` : 'In attesa del primo controllo'}</span>
                </div>
              </section>

              <div className="birthday-settings-grid">
                <section className="storage-card birthday-settings-card">
                  <div className="birthday-card-heading">
                    <span className="birthday-card-icon" aria-hidden="true"><FileText size={24} /></span>
                    <div>
                      <h3>Controllo automatico</h3>
                      <p className="subtle-note">Viene eseguito all'avvio dell'applicazione.</p>
                    </div>
                  </div>
                  <div className="birthday-card-toggle-row">
                    <span>Attiva promemoria</span>
                    <label className="settings-toggle" title="Attiva il controllo compleanni">
                      <input
                        type="checkbox"
                        checked={state.settings?.birthdayEnabled !== false}
                        onChange={(event) => saveBirthdaySettings({ birthdayEnabled: event.target.checked })}
                      />
                      <span className="settings-toggle-track" aria-hidden="true" />
                      <span className="sr-only">Attiva controllo compleanni</span>
                    </label>
                  </div>
                </section>

                <section className="storage-card birthday-settings-card">
                  <div className="birthday-card-heading">
                    <span className="birthday-card-icon" aria-hidden="true"><FileText size={24} /></span>
                    <div>
                      <h3>Preset auguri</h3>
                      <p className="subtle-note">Il messaggio viene caricato quando prepari la sessione.</p>
                    </div>
                  </div>
                  <div className="birthday-card-field-row">
                    <label className="eyebrow birthday-preset-eyebrow" htmlFor="birthday-preset-select">
                      Modello predefinito
                    </label>
                    <div className="birthday-select-wrap">
                      <select
                        id="birthday-preset-select"
                        value={state.settings?.birthdayPresetName || 'Auguri di compleanno'}
                        onChange={(event) => saveBirthdaySettings({ birthdayPresetName: event.target.value })}
                      >
                        {(state.presets || []).map((preset) => (
                          <option key={preset.name} value={preset.name}>{preset.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="storage-card birthday-settings-card birthday-source-card">
                  <div className="birthday-card-heading">
                    <span className="birthday-card-icon" aria-hidden="true"><FileText size={24} /></span>
                    <div>
                      <h3>File sorgente</h3>
                      <p className="subtle-note">Scegli il file CSV o Excel da controllare ogni giorno.</p>
                    </div>
                  </div>
                  <span className="birthday-source-path-label">File da controllare</span>
                  <div className="storage-path" title={state.settings?.birthdaySourceFilePath || 'Nessun file selezionato'}>
                    {state.settings?.birthdaySourceFilePath || 'Nessun file selezionato'}
                  </div>
                  <div className="storage-actions">
                    <button type="button" className="button button-secondary" onClick={handleBirthdaySource}>
                      Seleziona file...
                    </button>
                    {state.settings?.birthdaySourceFilePath && (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => api.showItemInFolder(state.settings.birthdaySourceFilePath)}
                      >
                        Mostra file
                      </button>
                    )}
                    <button type="button" className="button button-secondary" onClick={handleBirthdayCheck}>
                      Controlla ora
                    </button>
                  </div>
                </section>
              </div>

              {state.birthdays?.error && (
                <div className="settings-status-alert error-box">
                  {state.birthdays.status === 'not-configured' ? (
                    <button type="button" className="link-btn birthday-configure-link" onClick={handleBirthdaySource}>
                      Configura il file della lista compleanni.
                    </button>
                  ) : state.birthdays.error}
                </div>
              )}
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="settings-presets-section">
              <div className="presets-master-detail">
                {/* Master list */}
                <div className="presets-list-panel">
                  <div className="presets-list-header">
                    <span className="eyebrow">Modelli salvati</span>
                    <button className="button button-secondary mini" onClick={handleNewPreset}>
                      + Nuovo
                    </button>
                  </div>
                  <div className="presets-list-scroll">
                    {(state.presets || []).map((preset) => {
                      const isSelected = editingPreset?.name === preset.name
                      return (
                        <div
                          key={preset.name}
                          className={`preset-item-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectPreset(preset)}
                        >
                          <div className="preset-item-info">
                            <strong>{preset.name}</strong>
                            <span>{preset.message.slice(0, 45).replace(/\n/g, ' ')}...</span>
                          </div>
                          <button
                            className="preset-delete-icon"
                            title={`Elimina ${preset.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePreset(preset.name)
                            }}
                          ><ExternalLink size={16} /></button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Detail editor */}
                <div className="presets-edit-panel">
                  <div className="eyebrow">
                    {editingPreset ? `Modifica: ${editingPreset.name}` : 'Crea nuovo preset'}
                  </div>

                  <div className="field-group">
                    <label>Nome del Modello</label>
                    <input
                      className="preset-input-field"
                      value={presetForm.name}
                      onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })}
                      placeholder="es. Promemoria donazione estiva"
                    />
                  </div>

                  <div className="field-group">
                    <div className="field-label-row">
                      <label>Testo del Messaggio</label>
                      <div className="token-row-inline">
                        <button className="token mini" type="button" onClick={() => insertToken('[nome]')}>+ [nome]</button>
                        <button className="token mini" type="button" onClick={() => insertToken('[cognome]')}>+ [cognome]</button>
                      </div>
                    </div>
                    <textarea
                      className="preset-textarea"
                      rows="6"
                      value={presetForm.message}
                      onChange={(e) => setPresetForm({ ...presetForm, message: e.target.value })}
                      placeholder="Scrivi qui il messaggio template..."
                    />
                  </div>

                  <div className="field-group">
                    <label>Ritmo preferito per questo modello</label>
                    <div className="preset-rhythm-grid">
                      <div>
                        <span>Min. secondi</span>
                        <input
                          type="number"
                          min="1"
                          value={(presetForm.settings?.minDelayMs || 20000) / 1000}
                          onChange={(e) =>
                            setPresetForm({
                              ...presetForm,
                              settings: { ...presetForm.settings, minDelayMs: Number(e.target.value) * 1000 },
                            })
                          }
                        />
                      </div>
                      <div>
                        <span>Max. secondi</span>
                        <input
                          type="number"
                          min="1"
                          value={(presetForm.settings?.maxDelayMs || 40000) / 1000}
                          onChange={(e) =>
                            setPresetForm({
                              ...presetForm,
                              settings: { ...presetForm.settings, maxDelayMs: Number(e.target.value) * 1000 },
                            })
                          }
                        />
                      </div>
                      <div>
                        <span>Pausa ogni</span>
                        <input
                          type="number"
                          min="1"
                          value={presetForm.settings?.pauseAfter || 35}
                          onChange={(e) =>
                            setPresetForm({
                              ...presetForm,
                              settings: { ...presetForm.settings, pauseAfter: Number(e.target.value) },
                            })
                          }
                        />
                      </div>
                      <div>
                        <span>Minuti pausa</span>
                        <input
                          type="number"
                          min="1"
                          value={presetForm.settings?.pauseMinutes || 15}
                          onChange={(e) =>
                            setPresetForm({
                              ...presetForm,
                              settings: { ...presetForm.settings, pauseMinutes: Number(e.target.value) },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="field-group preset-attachment-field">
                    <div className="field-label-row">
                      <label htmlFor="preset-attachment">Allegato del modello</label>
                      <span className="subtle-note">Opzionale — JPG, PNG o PDF</span>
                    </div>
                    <div className={`preset-attachment-box ${presetForm.attachmentFileName ? 'has-attachment' : ''}`}>
                      <div className="preset-attachment-copy">
                        <span className="preset-attachment-icon" aria-hidden="true">
                          {presetForm.attachmentFileName?.toLowerCase().endsWith('.pdf') ? (
                            <FileText size={16} />
                          ) : (
                            <Image size={16} />
                          )}
                        </span>
                        <div>
                          <strong>{presetForm.attachmentFileName || 'Nessun allegato salvato'}</strong>
                          <span>
                            {presetForm.attachmentSourcePath
                              ? 'Pronto per il salvataggio nel modello.'
                              : "L'allegato verrà copiato nella cartella dati dell'app."}
                          </span>
                        </div>
                      </div>
                      <div className="preset-attachment-actions">
                        <button type="button" className="button button-secondary" onClick={handlePresetAttachment}>
                          {presetForm.attachmentFileName ? 'Sostituisci' : 'Aggiungi allegato'}
                        </button>
                        {presetForm.attachmentFileName && (
                          <button type="button" className="link-btn" onClick={handleRemovePresetAttachment}>
                            Rimuovi
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="presets-edit-actions">
                    <button className="button button-primary" onClick={handleSavePreset}>
                      <Save size={16} /> Salva Modello
                    </button>
                    {editingPreset && (
                      <button
                        className="button button-danger"
                        onClick={() => handleDeletePreset(editingPreset.name)}
                      >
                        Elimina
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <div className="settings-updates-section">
              <p className="muted" style={{ marginTop: 0 }}>
                Verifica se sono disponibili nuove versioni dell'applicazione rilasciate su GitHub e aggiorna in tutta sicurezza.
              </p>

              <div className="update-status-card">
                <div className="update-card-header">
                  <div>
                    <span className="eyebrow">Versione Corrente</span>
                    <h3 style={{ margin: '4px 0 0' }}>v{state.updater?.currentVersion || '1.0.0'}</h3>
                  </div>
                  <div className="update-header-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={state.updater?.status === 'checking' || state.updater?.status === 'downloading'}
                      onClick={() => api?.checkForUpdates?.()}
                    >
                      {state.updater?.status === 'checking' ? <><RefreshCw size={16} className="spinning" /> Verifica in corso...</> : <><RefreshCw size={16} /> Controlla ora</>}
                    </button>
                  </div>
                </div>

                {state.updater?.lastChecked && (
                  <p className="subtle-note" style={{ marginTop: '8px' }}>
                    Ultimo controllo: {new Date(state.updater.lastChecked).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                )}

                {state.updater?.status === 'not-available' && (
                  <div className="update-box success-box">
                    <div className="update-box-icon"><CheckCircle size={24} className="success-icon" /></div>
                    <div>
                      <strong>L'applicazione è aggiornata!</strong>
                      <p className="muted" style={{ margin: '2px 0 0' }}>
                        Stai già utilizzando l'ultima versione.
                      </p>
                    </div>
                  </div>
                )}

                {state.updater?.status === 'error' && (
                  <div className="update-box error-box">
                    <div className="update-box-icon"><AlertCircle size={32} /></div>
                    <div>
                      <strong>Impossibile verificare gli aggiornamenti</strong>
                      <p className="subtle-note" style={{ margin: '2px 0 0', color: '#b91c1c' }}>
                        {toUserError(state.updater?.error || 'update', 'update')}
                      </p>
                    </div>
                  </div>
                )}

                {state.updater?.status === 'available' && (
                  <div className="update-box available-box">
                    <div className="update-box-icon"><Download size={32} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="available-header">
                        <strong>Nuova versione disponibile: v{state.updater.availableVersion}</strong>
                      </div>
                      {state.updater.releaseNotes ? (
                        <div className="release-notes-wrapper">
                          <span className="eyebrow">Novità del rilascio:</span>
                          <div className="release-notes-content">
                            <ReactMarkdown>{normalizeReleaseNotes(state.updater.releaseNotes)}</ReactMarkdown>
                          </div>
                        </div>
                      ) : null}
                      <div style={{ marginTop: '12px' }}>
                        <button
                          type="button"
                          className="button button-primary"
                          onClick={() => api?.downloadUpdate?.()}
                        >
                          <Download size={16} /> Scarica e aggiorna
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {state.updater?.status === 'downloading' && (
                  <div className="update-box downloading-box">
                    <div className="downloading-header">
                      <strong>Download di v{state.updater.availableVersion} in corso...</strong>
                      <span className="download-percent">{state.updater.progress}%</span>
                    </div>
                    <div className="download-progress-bar-bg">
                      <div
                        className="download-progress-bar-fill"
                        style={{ width: `${Math.max(2, state.updater.progress)}%` }}
                      />
                    </div>
                    <div className="download-meta subtle-note">
                      {state.updater.transferred > 0 && state.updater.total > 0 && (
                        <span>
                          {(state.updater.transferred / (1024 * 1024)).toFixed(1)} MB di {(state.updater.total / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      )}
                      {state.updater.bytesPerSecond > 0 && (
                        <span> - {(state.updater.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s</span>
                      )}
                    </div>
                  </div>
                )}

                {state.updater?.status === 'downloaded' && (
                  <div className="update-box ready-box">
                    <div className="update-box-icon"><CheckCircle size={32} /></div>
                    <div style={{ flex: 1 }}>
                      <strong>Aggiornamento scaricato con successo!</strong>
                      <p className="muted" style={{ margin: '4px 0 12px' }}>
                        La versione <strong>v{state.updater.availableVersion}</strong> è pronta. Riavvia l'applicazione per applicarla.
                      </p>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => api.installUpdate()}
                      >
                        <RefreshCw size={16} /> Riavvia e aggiorna ora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tutorial' && (
            <div className="settings-tutorial-section">
              <p className="muted settings-tutorial-intro">
                Strumenti di supporto e simulazione per imparare a usare tutte le funzioni di AVIS WhatsApp Sender in totale sicurezza.
              </p>

              <div className="storage-card highlight-card settings-tutorial-card">
                <div className="storage-card-header">
                  <div>
                    <span className="eyebrow">Simulazione Interattiva Protetta</span>
                    <h3>Tutorial Passo-Passo</h3>
                    <p className="subtle-note">
                      Esplora tutte le schermate, prova la gestione dei destinatari e visualizza la simulazione d'invio in tempo reale a rischio zero: <strong>nessun messaggio viene realmente inviato</strong> a WhatsApp.
                    </p>
                  </div>
                </div>
                <div className="settings-tutorial-card-action">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      onClose()
                      onStartTutorial?.()
                    }}
                  >
                    <Play size={16} /> Avvia Tutorial Interattivo
                  </button>
                </div>
              </div>

              <div className="storage-card settings-tutorial-card">
                <div className="storage-card-header">
                  <div>
                    <span className="eyebrow">Documentazione & Regole</span>
                    <h3>Manuale Operativo Completo</h3>
                    <p className="subtle-note">
                      Consulta la guida scritta con tutte le istruzioni dettagliate su formati Excel, normalizzazione dei numeri, tag dinamici, ritmi anti-ban e aggiornamenti GitHub.
                    </p>
                  </div>
                </div>
                <div className="settings-tutorial-card-action">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      onClose()
                      onOpenGuide?.()
                    }}
                  >
                    <BookOpen size={16} /> Leggi il Manuale Operativo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <div />
          <button className="button button-secondary" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
      </div>
      {showEmailGuide && <EmailGuideDialog api={api} onClose={() => setShowEmailGuide(false)} />}
    </>
  )
}



