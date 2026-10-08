import { Folder, FileText, Download, Cake, HelpCircle, ExternalLink, Image, Save, RefreshCw, CheckCircle, Package, ArrowRight, Play, BookOpen, AlertCircle, Mail } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toUserError } from '../errorMessage'
import ReactMarkdown from 'react-markdown'
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
  const effectiveOutputDir = state.settings?.outputDir || state.defaultOutputDir || 'Desktop / AVIS WhatsApp Sender'
  const effectiveLogDir = state.settings?.logDir || state.defaultLogDir || 'Cartella log predefinita'

  useEffect(() => { if (isOpen) { setUserTab(null); setStatusMsg('') } }, [isOpen, initialTab]);

  if (!isOpen) return null

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
            className={`settings-tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => { setUserTab('storage'); setStatusMsg('') }}
          >
            <Folder className="tab-icon" size={16} /> Cartelle e Archiviazione
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
              <span className="tab-update-badge" title="Nuova versione disponibile">?</span>
            )}
            {state.updater?.status === 'downloaded' && (
              <span className="tab-update-badge ready" title="Pronto da installare">?</span>
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

          {activeTab === 'storage' && (
            <div className="settings-storage-section">
              <p className="muted" style={{ marginTop: 0 }}>
                Configura dove vengono salvati gli esiti delle sessioni (file CSV e JSON) e i log diagnostici per l'assistenza.
              </p>

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
                    title="Invia il log della giornata per email allo sviluppatore (danilo.corsi@outlook.it)"
                    onClick={async () => {
                      setStatusMsg('Preparazione email in corso...')
                      try {
                        await api.sendDeveloperReport()
                        setStatusMsg('Client di posta aperto! I log sono stati copiati ed evidenziati.')
                      } catch {
                        setStatusMsg('Impossibile aprire il client di posta.')
                      }
                    }}
                  >
                    <Mail size={16} /> Invia log di oggi per email
                  </button>
                </div>
              </div>

              {/* Notifiche Windows */}
              <div className="storage-card">
                <div className="storage-card-header">
                  <div>
                    <strong>Notifiche Windows</strong>
                    <p className="subtle-note">Ricevi aggiornamenti su WhatsApp, importazioni, invii ed errori importanti.</p>
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
                <p className="subtle-note" style={{ marginBottom: 0 }}>
                  Le notifiche sono attive di default e vengono salvate automaticamente.
                </p>
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
                  <label className="settings-checkbox-row birthday-autostart-row">
                    <input
                      type="checkbox"
                      checked={state.settings?.startWithWindows !== false}
                      onChange={(event) => call(() => api.setStartWithWindows(event.target.checked))}
                    />
                    <span>Avvia AVIS Sender con Windows</span>
                  </label>
                </section>

                <section className="storage-card birthday-settings-card">
                  <div className="birthday-card-heading">
                    <span className="birthday-card-icon" aria-hidden="true"><FileText size={24} /></span>
                    <div>
                      <h3>Preset auguri</h3>
                      <p className="subtle-note">Il messaggio viene caricato quando prepari la sessione.</p>
                    </div>
                  </div>
                  <label className="settings-field-label" htmlFor="birthday-preset-select">Modello predefinito</label>
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
                      <span className="subtle-note">Opzionale — JPG, JPEG o PNG</span>
                    </div>
                    <div className={`preset-attachment-box ${presetForm.attachmentFileName ? 'has-attachment' : ''}`}>
                      <div className="preset-attachment-copy">
                        <span className="preset-attachment-icon" aria-hidden="true"><Image size={16} /></span>
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
                    <div style={{ flex: 1 }}>
                      <div className="available-header">
                        <strong>Nuova versione disponibile: v{state.updater.availableVersion}</strong>
                      </div>
                      {state.updater.releaseNotes ? (
                        <div className="release-notes-wrapper">
                          <span className="eyebrow">Novità del rilascio:</span>
                          <div className="release-notes-content">
                            <ReactMarkdown>{state.updater.releaseNotes}</ReactMarkdown>
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
  )
}



