import { useState } from 'react'

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
}) {
  const [activeTab, setActiveTab] = useState('storage') // 'storage' | 'presets'
  const initialPreset = (state.presets || []).find((p) => p.name === selectedPreset) || state.presets?.[0] || null
  const [editingPreset, setEditingPreset] = useState(initialPreset)
  const [presetForm, setPresetForm] = useState({
    name: initialPreset?.name || 'Nuovo preset',
    message: initialPreset?.message || '',
    settings: { ...(initialPreset?.settings || options) },
  })
  const [statusMsg, setStatusMsg] = useState('')

  const effectiveOutputDir = state.settings?.outputDir || state.defaultOutputDir || 'Desktop / AVIS WhatsApp Sender'
  const effectiveLogDir = state.settings?.logDir || state.defaultLogDir || 'Cartella log predefinita'

  if (!isOpen) return null

  function handleSelectPreset(preset) {
    setStatusMsg('')
    setEditingPreset(preset)
    setPresetForm({
      name: preset.name,
      message: preset.message,
      settings: { ...(preset.settings || options) },
    })
  }

  function handleNewPreset() {
    setStatusMsg('')
    setEditingPreset(null)
    setPresetForm({
      name: 'Nuovo Modello',
      message: 'Gentile [nome],\n\nAVIS Comunale',
      settings: { minDelayMs: 15000, maxDelayMs: 35000, pauseAfter: 40, pauseMinutes: 15 },
    })
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
      }
      const next = await api.savePreset(payload)
      setSelectedPreset(payload.name)
      setPresetName(payload.name)
      setMessage(payload.message)
      if (payload.settings) setOptions(payload.settings)
      setStatusMsg(`Preset "${payload.name}" salvato con successo!`)
      return next
    })
  }

  async function handleDeletePreset(name) {
    if (!window.confirm(`Sei sicuro di voler eliminare il preset "${name}"?`)) return
    await call(async () => {
      const next = await api.deletePreset(name)
      const first = next.presets?.[0]
      if (first) {
        setSelectedPreset(first.name)
        setPresetName(first.name)
        setMessage(first.message)
        if (first.settings) setOptions(first.settings)
      }
      setStatusMsg(`Preset "${name}" eliminato.`)
      return next
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
            ×
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => { setActiveTab('storage'); setStatusMsg('') }}
          >
            📁 Cartelle e Archiviazione
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => { setActiveTab('presets'); setStatusMsg('') }}
          >
            📋 Modelli & Preset ({state.presets?.length || 0})
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
                    Sfoglia cartella…
                  </button>
                  <button
                    className="button button-secondary"
                    title="Apri cartella esiti in Esplora Risorse"
                    onClick={() => api?.openOutputDir?.()}
                  >
                    📁 Apri in Esplora Risorse
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
                    Sfoglia cartella…
                  </button>
                  <button
                    className="button button-secondary"
                    title="Apri cartella log in Esplora Risorse"
                    onClick={() => api?.openLogsDir?.()}
                  >
                    📁 Apri cartella log
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
                    📁 Apri cartella dati app
                  </button>
                </div>
              </div>
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
                          >
                            🗑
                          </button>
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
                          value={(presetForm.settings?.minDelayMs || 15000) / 1000}
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
                          value={(presetForm.settings?.maxDelayMs || 35000) / 1000}
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
                          value={presetForm.settings?.pauseAfter || 40}
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

                  <div className="presets-edit-actions">
                    <button className="button button-primary" onClick={handleSavePreset}>
                      💾 Salva Modello
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
        </div>

        <div className="settings-footer">
          <button className="button button-secondary" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
