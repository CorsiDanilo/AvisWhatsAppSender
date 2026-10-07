import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Guide from './Guide'
import SettingsModal from './components/SettingsModal'
import QrModal from './components/QrModal'
import StepperNav from './components/StepperNav'
import StepRecipients from './components/StepRecipients'
import StepComposer from './components/StepComposer'
import StepSummary from './components/StepSummary'
import SendingDashboard from './components/SendingDashboard'

const templates = {
  'Promemoria donazione':
    'Ciao [nome],\nti ricordiamo il tuo prossimo appuntamento per la donazione.\nGrazie per il tuo prezioso gesto! 🩸\n\nTi ricordiamo di salvare questo numero tra i tuoi contatti per ricevere i promemoria delle donazioni.',
  'Ringraziamento':
    'Ciao [nome],\nAVIS ti ringrazia di cuore per la tua donazione.\nIl tuo gesto è prezioso! 🩸\n\nTi ricordiamo di salvare questo numero tra i tuoi contatti per ricevere i promemoria delle donazioni.',
  'Comunicazione generale':
    'Gentile donatore,\nti informiamo che domenica si terrà una raccolta straordinaria.\nAVIS Comunale\n\nTi ricordiamo di salvare questo numero tra i tuoi contatti per ricevere i promemoria delle donazioni.',
}

const fallbackPresets = Object.entries(templates).map(([name, message]) => ({
  name,
  message,
  settings: { minDelayMs: 20000, maxDelayMs: 40000, pauseAfter: 35, pauseMinutes: 15 },
}))

const initialState = {
  connection: 'disconnected',
  qrDataUrl: '',
  donors: [],
  queue: 'idle',
  progress: { current: 0, total: 0, sent: 0, failed: 0, skipped: 0 },
  logs: [],
  fileName: '',
  filePath: '',
  sheetName: '',
  imageName: '',
  imagePath: '',
  imageDataUrl: '',
  settings: { minDelayMs: 20000, maxDelayMs: 40000, pauseAfter: 35, pauseMinutes: 15, outputDir: '', logDir: '' },
  presets: fallbackPresets,
  defaultOutputDir: '',
  defaultLogDir: '',
  userDataDir: '',
  lastOutcomeDir: '',
}

function App() {
  const [state, setState] = useState(initialState)
  const [currentStep, setCurrentStep] = useState(1)
  const [manualSendingView, setManualSendingView] = useState(false)
  const [message, setMessage] = useState(fallbackPresets[0].message)
  const [selectedPreset, setSelectedPreset] = useState(fallbackPresets[0].name)
  const [presetName, setPresetName] = useState(fallbackPresets[0].name)
  const [options, setOptions] = useState({
    minDelayMs: 20000,
    maxDelayMs: 40000,
    pauseAfter: 35,
    pauseMinutes: 15,
  })
  const [error, setError] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [showQrBanner, setShowQrBanner] = useState(true)

  const api = window.whatsappSender

  useEffect(() => {
    if (!api) return undefined
    api
      .getState()
      .then((next) => {
        setState(next)
        if (next.settings) setOptions(next.settings)
        const firstPreset = next.presets?.[0]
        if (firstPreset) {
          setSelectedPreset(firstPreset.name)
          setPresetName(firstPreset.name)
          setMessage(firstPreset.message)
          if (firstPreset.settings) setOptions(firstPreset.settings)
        }
      })
      .catch((reason) => setError(reason.message))
    return api.onState(setState)
  }, [api])

  const counts = useMemo(() => {
    return state.donors.reduce((result, donor) => {
      result[donor.status] = (result[donor.status] || 0) + 1
      return result
    }, {})
  }, [state.donors])

  const firstSelectedDonor = useMemo(() => {
    return state.donors.find((d) => d.selected !== false && d.valid)
  }, [state.donors])

  const selectedCount = state.donors.filter((donor) => donor.selected !== false).length
  const isRunning = state.queue === 'running'
  const isPaused = state.queue === 'paused'
  const isCompleted = state.queue === 'completed'
  const isStopped = state.queue === 'stopped'

  // Decide if we should show the sending dashboard
  const isSendingActive = isRunning || isPaused
  const showDashboard = isSendingActive || manualSendingView || ((isCompleted || isStopped) && state.progress.total > 0)

  const canStart = state.connection === 'ready' && selectedCount > 0 && message.trim().length > 0

  // Calculate highest reachable step
  const maxStepReached = useMemo(() => {
    if (selectedCount === 0) return 1
    if (!message.trim()) return 2
    return 3
  }, [selectedCount, message])

  async function call(command) {
    setError('')
    try {
      const next = await command()
      setState(next)
      return next
    } catch (reason) {
      setError(reason.message || 'Operazione non riuscita')
      throw reason
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
      setCurrentStep(1)
      setManualSendingView(false)
      return next
    })
  }

  async function handleStart() {
    try {
      setManualSendingView(true)
      await call(() =>
        api.start({
          ...options,
          pauseMs: options.pauseMinutes * 60 * 1000,
          message,
          presetName,
        })
      )
    } catch {
      // Error is set by call()
    }
  }

  const connectionText =
    {
      disconnected: 'Non connesso',
      connecting: 'Connessione…',
      qr: 'Scansiona il QR',
      authenticated: 'Autenticato',
      ready: 'Pronto',
      error: 'Errore connessione',
    }[state.connection] || state.connection

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>AVIS Sender</strong>
            <span>Comunicazioni WhatsApp</span>
          </div>
        </div>

        <div className="topbar-right">
          <div
            className={`connection connection-${state.connection}`}
            title="Stato WhatsApp (clicca per visualizzare il QR o riconnettere)"
            onClick={() => {
              if (state.connection === 'disconnected' || state.connection === 'error') {
                call(() => api.connect())
                setShowQrModal(true)
              } else if (state.connection === 'qr' || state.connection === 'connecting') {
                setShowQrBanner(true)
                setShowQrModal(true)
              }
            }}
            style={{ cursor: state.connection === 'ready' ? 'default' : 'pointer' }}
          >
            <span className="status-dot" />
            {connectionText}
            {state.connection !== 'ready' && <span className="connect-link-hint"> (mostra QR)</span>}
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="button button-secondary topbar-btn"
              onClick={() => setShowSettings(true)}
              title="Cartelle e Modelli salvati"
            >
              ⚙️ Impostazioni
            </button>
            <button
              type="button"
              className="button button-secondary topbar-btn"
              onClick={() => setShowGuide(true)}
            >
              Guida
            </button>
            <button
              type="button"
              className="button button-secondary topbar-btn"
              onClick={resetInterface}
              disabled={isSendingActive}
              title="Azzera la sessione mantenendo WhatsApp collegato"
            >
              ↺ Nuova sessione
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="wizard-layout">
        {error && <div className="alert global-alert">{error}</div>}

        {/* Banner QR Code visibile in qualsiasi step se il client è in attesa di scansione */}
        {state.connection === 'qr' && state.qrDataUrl && showQrBanner && !showDashboard && (
          <div className="top-qr-banner-card panel">
            <div className="top-qr-banner-left">
              <img src={state.qrDataUrl} alt="QR Code WhatsApp" className="top-qr-banner-img" />
              <div className="top-qr-banner-text">
                <span className="eyebrow">Azione richiesta • WhatsApp non connesso</span>
                <h3>Scansiona il codice QR con il tuo telefono</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  Apri <strong>WhatsApp</strong> sul telefono → <strong>Dispositivi collegati</strong> → <strong>Collega un dispositivo</strong>.
                </p>
              </div>
            </div>
            <div className="top-qr-banner-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => call(() => (api?.reconnect ? api.reconnect() : api.connect()))}
                title="Se il QR è scaduto o non risponde, clicca qui per generarne uno nuovo"
              >
                <span>🔄</span> Rigenera QR code
              </button>
              <button
                type="button"
                className="link-btn top-qr-dismiss"
                onClick={() => setShowQrBanner(false)}
                title="Nascondi questo riquadro (puoi riaprirlo cliccando su 'Scansiona il QR' in alto)"
              >
                ✕ Riduci
              </button>
            </div>
          </div>
        )}

        {showDashboard ? (
          <SendingDashboard
            state={state}
            counts={counts}
            isRunning={isRunning}
            isPaused={isPaused}
            call={call}
            api={api}
            onBackToEdit={() => {
              setManualSendingView(false)
              setCurrentStep(3)
            }}
          />
        ) : (
          <>
            {/* Stepper Navigation */}
            <StepperNav
              currentStep={currentStep}
              onSelectStep={(step) => setCurrentStep(step)}
              maxStepReached={maxStepReached}
              disabled={isSendingActive}
            />

            {/* Wizard Steps */}
            <div className="step-content-area">
              {currentStep === 1 && (
                <StepRecipients
                  state={state}
                  api={api}
                  call={call}
                  isRunning={isRunning}
                  isPaused={isPaused}
                  onNext={() => setCurrentStep(2)}
                />
              )}

              {currentStep === 2 && (
                <StepComposer
                  state={state}
                  api={api}
                  call={call}
                  message={message}
                  setMessage={setMessage}
                  selectedPreset={selectedPreset}
                  setSelectedPreset={setSelectedPreset}
                  setPresetName={setPresetName}
                  options={options}
                  setOptions={setOptions}
                  firstSelectedDonor={firstSelectedDonor}
                  onBack={() => setCurrentStep(1)}
                  onNext={() => setCurrentStep(3)}
                  onOpenSettings={() => setShowSettings(true)}
                />
              )}

              {currentStep === 3 && (
                <StepSummary
                  state={state}
                  message={message}
                  selectedPreset={selectedPreset}
                  options={options}
                  canStart={canStart}
                  firstSelectedDonor={firstSelectedDonor}
                  onBack={() => setCurrentStep(2)}
                  onGoToStep={(step) => setCurrentStep(step)}
                  onStart={handleStart}
                  api={api}
                  call={call}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        state={state}
        api={api}
        call={call}
        options={options}
        setOptions={setOptions}
        selectedPreset={selectedPreset}
        setSelectedPreset={setSelectedPreset}
        setPresetName={setPresetName}
        setMessage={setMessage}
      />

      <QrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        state={state}
        api={api}
        call={call}
      />

      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
    </div>
  )
}

export default App
