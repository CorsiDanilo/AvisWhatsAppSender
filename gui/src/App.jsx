import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Guide from './Guide'

const templates = {
  'Promemoria donazione':
    'Ciao [nome],\nti ricordiamo il tuo prossimo appuntamento per la donazione.\nGrazie per il tuo prezioso gesto! 🩸',
  'Ringraziamento':
    'Ciao [nome],\nAVIS ti ringrazia di cuore per la tua donazione.\nIl tuo gesto è prezioso! 🩸',
  'Comunicazione generale':
    'Gentile donatore,\nti informiamo che domenica si terrà una raccolta straordinaria.\nAVIS Comunale',
}

const fallbackPresets = Object.entries(templates).map(([name, message]) => ({
  name,
  message,
  settings: { minDelayMs: 15000, maxDelayMs: 35000, pauseAfter: 40, pauseMinutes: 15 },
}))

const initialState = {
  connection: 'disconnected',
  qrDataUrl: '',
  donors: [],
  queue: 'idle',
  progress: { current: 0, total: 0, sent: 0, failed: 0, skipped: 0 },
  logs: [],
  fileName: '',
  imageName: '',
  imageDataUrl: '',
  settings: { minDelayMs: 15000, maxDelayMs: 35000, pauseAfter: 40, pauseMinutes: 15 },
  presets: fallbackPresets,
}

function displayName(donor) {
  return [donor.name, donor.surname].filter(Boolean).join(' ') || 'Senza nome'
}

function previewMessage(message, donor) {
  if (!donor) return message
  return message
    .replaceAll('[nome]', donor.name || '')
    .replaceAll('[cognome]', donor.surname || '')
}

function App() {
  const [state, setState] = useState(initialState)
  const [message, setMessage] = useState(fallbackPresets[0].message)
  const [selectedPreset, setSelectedPreset] = useState(fallbackPresets[0].name)
  const [presetName, setPresetName] = useState(fallbackPresets[0].name)
  const [options, setOptions] = useState({
    minDelayMs: 15000,
    maxDelayMs: 35000,
    pauseAfter: 40,
    pauseMinutes: 15,
  })
  const [error, setError] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const messageRef = useRef(null)
  const api = window.whatsappSender

  useEffect(() => {
    if (!api) return undefined
    api.getState().then((next) => {
      setState(next)
      if (next.settings) setOptions(next.settings)
      const firstPreset = next.presets?.[0]
      if (firstPreset) {
        setSelectedPreset(firstPreset.name)
        setPresetName(firstPreset.name)
        setMessage(firstPreset.message)
        if (firstPreset.settings) setOptions(firstPreset.settings)
      }
    }).catch((reason) => setError(reason.message))
    return api.onState(setState)
  }, [api])

  const counts = useMemo(() => {
    return state.donors.reduce(
      (result, donor) => {
        result[donor.status] = (result[donor.status] || 0) + 1
        return result
      },
      {},
    )
  }, [state.donors])

  const currentDonor = state.donors.find((donor) => donor.selected !== false && donor.valid && donor.status === 'pending')
  const selectedCount = state.donors.filter((donor) => donor.selected !== false).length
  const pendingSelectedCount = state.donors.filter((donor) => donor.selected !== false && donor.status === 'pending').length
  const canStart = state.connection === 'ready' && selectedCount > 0 && message.trim().length > 0
  const isRunning = state.queue === 'running'
  const isPaused = state.queue === 'paused'

  async function call(command) {
    setError('')
    try {
      setState(await command())
    } catch (reason) {
      setError(reason.message || 'Operazione non riuscita')
    }
  }

  async function resetInterface() {
    if (!window.confirm('Resettare lista, messaggio, foto e stato della sessione? WhatsApp resterà collegato.')) return
    await call(async () => {
      const next = await api.reset()
      const firstPreset = (next.presets?.length ? next.presets : fallbackPresets)[0]
      setSelectedPreset(firstPreset.name)
      setPresetName(firstPreset.name)
      setMessage(firstPreset.message)
      setOptions(firstPreset.settings)
      return next
    })
  }

  function changePreset(name) {
    const preset = (state.presets?.length ? state.presets : fallbackPresets).find((item) => item.name === name)
    if (!preset) return
    setSelectedPreset(preset.name)
    setPresetName(preset.name)
    setMessage(preset.message)
    setOptions(preset.settings)
  }

  async function saveCurrentPreset() {
    if (!presetName.trim()) {
      setError('Inserisci un nome per il preset.')
      return
    }
    await call(async () => {
      const name = presetName.trim()
      const next = await api.savePreset({ name, message, settings: options })
      setSelectedPreset(name)
      setPresetName(name)
      return next
    })
  }

  async function deleteCurrentPreset() {
    if (!presetName.trim() || !window.confirm(`Eliminare il preset "${presetName}"?`)) return
    await call(async () => {
      const next = await api.deletePreset(presetName.trim())
      const firstPreset = (next.presets?.length ? next.presets : fallbackPresets)[0]
      setSelectedPreset(firstPreset?.name || '')
      setPresetName(firstPreset?.name || '')
      setMessage(firstPreset?.message || '')
      if (firstPreset?.settings) setOptions(firstPreset.settings)
      return next
    })
  }

  function newPreset() {
    setSelectedPreset('')
    setPresetName('Nuovo preset')
    setMessage('')
  }

  function updateOption(name, value) {
    setOptions((current) => ({ ...current, [name]: value }))
  }

  function insertToken(token) {
    const input = messageRef.current
    if (!input) return
    const start = input.selectionStart
    const end = input.selectionEnd
    setMessage(`${message.slice(0, start)}${token}${message.slice(end)}`)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const connectionText = {
    disconnected: 'Non connesso',
    connecting: 'Connessione…',
    qr: 'Scansiona il QR',
    authenticated: 'Autenticato',
    ready: 'Pronto',
    error: 'Errore connessione',
  }[state.connection] || state.connection

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>AVIS Sender</strong>
            <span>Comunicazioni WhatsApp</span>
          </div>
        </div>
        <div className={`connection connection-${state.connection}`}>
          <span className="status-dot" />
          {connectionText}
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <section className="panel file-panel">
            <div className="eyebrow">01 · Destinatari</div>
            <h2>Carica una lista</h2>
            <p className="muted">CSV o Excel con colonne Nome, Cognome e Telefono.</p>
            <button className="button button-secondary full" onClick={() => call(() => api.selectCsv())}>
              <span>↥</span> Seleziona file
            </button>
            {state.fileName && <div className="file-name">✓ {state.fileName}</div>}
          </section>

          <section className="panel attachment-panel">
            <div className="eyebrow">01b · Allegato</div>
            <h2>Foto opzionale</h2>
            <p className="muted">La stessa foto verrà inviata a tutti, con il testo come didascalia.</p>
            <button className="button button-secondary full" onClick={() => call(() => api.selectImage())}>
              <span>▧</span> Seleziona foto
            </button>
            {state.imageName && (
              <div className="attachment-preview">
                {state.imageDataUrl && <img src={state.imageDataUrl} alt="Anteprima allegato" />}
                <div className="attachment-details"><strong>{state.imageName}</strong><button className="remove-attachment" onClick={() => call(() => api.clearImage())}>Rimuovi</button></div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="eyebrow">02 · Messaggio</div>
            <div className="section-heading">
              <h2>Modello</h2>
              <select value={selectedPreset} onChange={(event) => changePreset(event.target.value)}>
                {(state.presets?.length ? state.presets : fallbackPresets).map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
              </select>
            </div>
            <input className="preset-name" value={presetName} onChange={(event) => setPresetName(event.target.value)} aria-label="Nome preset" placeholder="Nome del preset" />
            <textarea
              ref={messageRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows="8"
              aria-label="Messaggio"
            />
            <div className="token-row">
              <button className="token" onClick={() => insertToken('[nome]')}>+ nome</button>
              <button className="token" onClick={() => insertToken('[cognome]')}>+ cognome</button>
            </div>
            <div className="preview">
              <span className="preview-label">Anteprima</span>
              <p>{previewMessage(message, currentDonor) || 'Scrivi un messaggio…'}</p>
            </div>
            <div className="preset-actions">
              <button className="button button-secondary" onClick={saveCurrentPreset}>Salva preset</button>
              <button className="button button-secondary" onClick={newPreset}>Nuovo</button>
              <button className="button button-danger" onClick={deleteCurrentPreset}>Elimina</button>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="eyebrow">03 · Ritmo invio</div>
            <div className="settings-grid">
              <label>Min. secondi<input type="number" min="0" value={options.minDelayMs / 1000} onChange={(event) => updateOption('minDelayMs', Number(event.target.value) * 1000)} /></label>
              <label>Max. secondi<input type="number" min="0" value={options.maxDelayMs / 1000} onChange={(event) => updateOption('maxDelayMs', Number(event.target.value) * 1000)} /></label>
              <label>Dopo messaggi<input type="number" min="0" value={options.pauseAfter} onChange={(event) => updateOption('pauseAfter', Number(event.target.value))} /></label>
              <label>Pausa minuti<input type="number" min="0" value={options.pauseMinutes} onChange={(event) => updateOption('pauseMinutes', Number(event.target.value))} /></label>
            </div>
            <button className="button button-secondary full save-settings" onClick={() => call(() => api.saveSettings(options))}>Salva ritmo</button>
          </section>
        </aside>

        <section className="content">
          <div className="content-heading">
            <div>
              <div className="eyebrow">Pannello di controllo</div>
              <h1>Invio assistito</h1>
            </div>
            <div className="heading-actions">
              <button className="button button-secondary" onClick={() => setShowGuide(true)}>Guida</button>
              <button className="button button-secondary" onClick={resetInterface} disabled={isRunning || isPaused}>↺ Nuova sessione</button>
              <button className="button button-secondary" onClick={() => call(() => api.connect())} disabled={state.connection === 'connecting' || state.connection === 'ready'}>
                {state.connection === 'ready' ? '✓ WhatsApp collegato' : 'Collega WhatsApp'}
              </button>
            </div>
          </div>

          {state.qrDataUrl && state.connection === 'qr' && (
            <div className="qr-card">
              <img src={state.qrDataUrl} alt="QR code per collegare WhatsApp" />
              <div><strong>Collega il tuo account</strong><p>Apri WhatsApp → Dispositivi collegati → Collega un dispositivo.</p></div>
            </div>
          )}

          {error && <div className="alert">{error}</div>}

          <div className="stats-grid">
            <div className="stat-card"><span>Destinatari</span><strong>{state.donors.length}</strong><small>nel file selezionato</small></div>
            <div className="stat-card accent"><span>Inviati</span><strong>{counts.sent || 0}</strong><small>messaggi completati</small></div>
            <div className="stat-card"><span>Da verificare</span><strong>{pendingSelectedCount}</strong><small>selezionati e in attesa</small></div>
            <div className="stat-card warning"><span>Problemi</span><strong>{(counts.failed || 0) + (counts.skipped || 0)}</strong><small>falliti o scartati</small></div>
          </div>

          <div className="progress-panel panel">
            <div className="progress-heading"><div><span className="eyebrow">Stato sessione</span><h2>{state.queue === 'completed' ? 'Sessione completata' : state.queue === 'stopped' ? 'Sessione fermata' : 'Pronto per iniziare'}</h2></div><strong>{state.progress.current}/{state.progress.total || 0}</strong></div>
            <div className="progress-track"><div style={{ width: `${state.progress.total ? (state.progress.current / state.progress.total) * 100 : 0}%` }} /></div>
            <div className="controls">
              <button className="button button-primary" onClick={() => call(() => api.start({ ...options, pauseMs: options.pauseMinutes * 60 * 1000, message, presetName }))} disabled={!canStart || isRunning || isPaused}>▶ Avvia invio</button>
              {isRunning && <button className="button button-secondary" onClick={() => call(() => api.pause())}>Ⅱ Pausa</button>}
              {isPaused && <button className="button button-secondary" onClick={() => call(() => api.resume())}>▶ Riprendi</button>}
              {(isRunning || isPaused) && <button className="button button-danger" onClick={() => call(() => api.stop())}>■ Ferma</button>}
            </div>
          </div>

          <div className="lower-grid">
            <section className="panel recipients-panel">
              <div className="panel-heading"><div><span className="eyebrow">Lista</span><h2>Destinatari</h2></div><div className="list-actions"><button onClick={() => call(() => api.setAllSelected(true))} disabled={isRunning || isPaused}>Tutti</button><button onClick={() => call(() => api.setAllSelected(false))} disabled={isRunning || isPaused}>Nessuno</button><span className="count-pill">{selectedCount}/{state.donors.length}</span></div></div>
              <div className="recipient-list">
                {state.donors.length === 0 && <div className="empty">Carica un CSV o un Excel per vedere i destinatari.</div>}
                {state.donors.map((donor, index) => (
                  <div className="recipient" key={`${donor.phone}-${index}`}>
                    <input className="recipient-checkbox" type="checkbox" checked={donor.selected !== false} disabled={isRunning || isPaused} onChange={(event) => call(() => api.setSelection(index, event.target.checked))} aria-label={`Seleziona ${displayName(donor)}`} />
                    <div className="avatar">{(donor.name || '?')[0].toUpperCase()}</div>
                    <div className="recipient-info"><strong>{displayName(donor)}</strong><span>{donor.phone || donor.rawPhone || 'Numero mancante'}</span></div>
                    <span className={`badge badge-${donor.status}`}>{donor.status === 'pending' ? 'In attesa' : donor.status === 'sent' ? 'Inviato' : donor.status === 'skipped' ? 'Scartato' : 'Fallito'}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel log-panel">
              <div className="panel-heading"><div><span className="eyebrow">Attività</span><h2>Log sessione</h2></div></div>
              <div className="logs">{state.logs.length === 0 ? <div className="empty">Gli eventi della sessione appariranno qui.</div> : state.logs.map((entry, index) => <div className="log-entry" key={`${entry}-${index}`}>{entry}</div>)}</div>
            </section>
          </div>
        </section>
      </main>
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
    </div>
  )
}

export default App
