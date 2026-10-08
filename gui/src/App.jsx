import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Guide from './Guide'
import SettingsModal from './components/SettingsModal'
import QrModal from './components/QrModal'
import StepperNav from './components/StepperNav'
import StepRecipients from './components/StepRecipients'
import StepComposer from './components/StepComposer'
import StepSummary from './components/StepSummary'
import SendingDashboard from './components/SendingDashboard'
import { WelcomeModal, TutorialDock } from './components/InteractiveTutorial'
import {
  TUTORIAL_STEPS,
  TUTORIAL_DONORS,
  TUTORIAL_MESSAGE,
} from './components/tutorialData'

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
  const [settingsTab, setSettingsTab] = useState('storage')
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [showQrBanner, setShowQrBanner] = useState(true)

  // Tutorial & Simulation states
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    try {
      return !localStorage.getItem('avis_tutorial_seen')
    } catch {
      return false
    }
  })
  const [isTutorialActive, setIsTutorialActive] = useState(false)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(1)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationDone, setSimulationDone] = useState(false)
  const realStateBackupRef = useRef(null)
  const simulationTimersRef = useRef([])

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
  const isSendingActive = isRunning || isPaused || isSimulating
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
      if (next && typeof next === 'object' && ('donors' in next || 'connection' in next)) {
        setState(next)
      }
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

  function clearSimulationTimers() {
    simulationTimersRef.current.forEach((id) => clearTimeout(id))
    simulationTimersRef.current = []
  }

  function startTutorial() {
    clearSimulationTimers()
    realStateBackupRef.current = {
      state,
      currentStep,
      manualSendingView,
      message,
      options,
      selectedPreset,
      presetName,
    }

    setIsTutorialActive(true)
    setTutorialStepIndex(1)
    setCurrentStep(1)
    setManualSendingView(false)
    setIsSimulating(false)
    setSimulationDone(false)

    setState((prev) => ({
      ...prev,
      connection: 'ready',
      qrDataUrl: '',
      donors: TUTORIAL_DONORS.map((d) => ({ ...d })),
      queue: 'idle',
      progress: { current: 0, total: 4, sent: 0, failed: 0, skipped: 1 },
      logs: ['[TUTORIAL] Dati di esempio caricati con successo.'],
      fileName: 'Donatori_AVIS_Ottobre.xlsx',
      filePath: 'C:\\Users\\AVIS\\Desktop\\Donatori_AVIS_Ottobre.xlsx',
      sheetName: 'Donatori Attivi',
      imageName: '',
      imagePath: '',
      imageDataUrl: '',
      lastOutcomeDir: '',
    }))

    setMessage(TUTORIAL_MESSAGE)
  }

  function exitTutorial() {
    clearSimulationTimers()
    setIsTutorialActive(false)
    setIsSimulating(false)
    setSimulationDone(false)
    setTutorialStepIndex(1)

    if (realStateBackupRef.current) {
      const backup = realStateBackupRef.current
      setState(backup.state)
      setCurrentStep(backup.currentStep)
      setManualSendingView(backup.manualSendingView)
      setMessage(backup.message)
      setOptions(backup.options)
      setSelectedPreset(backup.selectedPreset)
      setPresetName(backup.presetName)
      realStateBackupRef.current = null
    } else {
      if (api) {
        api.getState().then(setState).catch(console.error)
      }
      setCurrentStep(1)
      setManualSendingView(false)
    }
  }

  function startSimulation() {
    clearSimulationTimers()
    setIsSimulating(true)
    setSimulationDone(false)

    setState((prev) => ({
      ...prev,
      queue: 'running',
      progress: { current: 0, total: 4, sent: 0, failed: 0, skipped: 1 },
      logs: ['[SIMULAZIONE] Inizio sessione demo in modalità protetta. Nessun messaggio reale inviato a WhatsApp.'],
      donors: TUTORIAL_DONORS.map((d) => ({
        ...d,
        status: d.valid ? 'pending' : 'skipped',
      })),
    }))

    const validDonors = TUTORIAL_DONORS.filter((d) => d.valid)
    validDonors.forEach((donor, idx) => {
      const t = setTimeout(() => {
        setState((prev) => {
          const nextDonors = prev.donors.map((d) =>
            d.phone === donor.phone ? { ...d, status: 'sent' } : d
          )
          const sentCount = idx + 1
          const nowTime = new Date().toLocaleTimeString('it-IT')
          return {
            ...prev,
            progress: {
              ...prev.progress,
              current: sentCount,
              sent: sentCount,
            },
            logs: [
              ...prev.logs,
              `[${nowTime}] ✓ Messaggio inviato a ${donor.name} ${donor.surname} (${donor.phone}) [SIMULATO]`,
            ],
            donors: nextDonors,
          }
        })

        if (idx === validDonors.length - 1) {
          const finishTimer = setTimeout(() => {
            setState((prev) => ({
              ...prev,
              queue: 'completed',
              lastOutcomeDir: 'Desktop / AVIS WhatsApp Sender / Demo_Simulazione_Esito',
              logs: [
                ...prev.logs,
                '========================================',
                '🎉 Sessione simulata completata con successo!',
                'Report generati (fittizi): esito.csv, esito.json',
              ],
            }))
            setIsSimulating(false)
            setSimulationDone(true)
          }, 1000)
          simulationTimersRef.current.push(finishTimer)
        }
      }, (idx + 1) * 1400)

      simulationTimersRef.current.push(t)
    })
  }

  function handleTutorialNext() {
    if (tutorialStepIndex === 1) {
      setTutorialStepIndex(2)
      setCurrentStep(1)
      setManualSendingView(false)
    } else if (tutorialStepIndex === 2) {
      setTutorialStepIndex(3)
      setCurrentStep(2)
      setManualSendingView(false)
    } else if (tutorialStepIndex === 3) {
      setTutorialStepIndex(4)
      setCurrentStep(3)
      setManualSendingView(false)
    } else if (tutorialStepIndex === 4) {
      setTutorialStepIndex(5)
      setManualSendingView(true)
      startSimulation()
    } else if (tutorialStepIndex === 5) {
      exitTutorial()
    }
  }

  function handleTutorialPrev() {
    if (tutorialStepIndex === 2) {
      setTutorialStepIndex(1)
      setCurrentStep(1)
      setManualSendingView(false)
    } else if (tutorialStepIndex === 3) {
      setTutorialStepIndex(2)
      setCurrentStep(1)
      setManualSendingView(false)
    } else if (tutorialStepIndex === 4) {
      setTutorialStepIndex(3)
      setCurrentStep(2)
      setManualSendingView(false)
    } else if (tutorialStepIndex === 5) {
      clearSimulationTimers()
      setIsSimulating(false)
      setTutorialStepIndex(4)
      setCurrentStep(3)
      setManualSendingView(false)
    }
  }

  async function handleStart() {
    if (isTutorialActive) {
      setManualSendingView(true)
      setTutorialStepIndex(5)
      startSimulation()
      return
    }

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

  const effectiveApi = useMemo(() => {
    if (!isTutorialActive) return api
    return {
      ...api,
      connect: async () => {
        setState((p) => ({ ...p, connection: 'ready' }))
      },
      reconnect: async () => {
        setState((p) => ({ ...p, connection: 'ready' }))
      },
      start: async () => {
        startSimulation()
      },
      pause: async () => {
        setState((p) => ({
          ...p,
          queue: 'paused',
          logs: [...p.logs, "[SIMULAZIONE] Sessione messa in pausa dall'operatore."],
        }))
      },
      resume: async () => {
        setState((p) => ({
          ...p,
          queue: 'running',
          logs: [...p.logs, '[SIMULAZIONE] Sessione ripresa.'],
        }))
      },
      stop: async () => {
        clearSimulationTimers()
        setIsSimulating(false)
        setState((p) => ({
          ...p,
          queue: 'stopped',
          logs: [...p.logs, "[SIMULAZIONE] Sessione interrotta dall'operatore."],
        }))
      },
      setSelection: async (index, selected) => {
        setState((p) => {
          const nextDonors = [...p.donors]
          if (nextDonors[index]) nextDonors[index] = { ...nextDonors[index], selected }
          return { ...p, donors: nextDonors }
        })
      },
      setAllSelected: async (selected) => {
        setState((p) => ({
          ...p,
          donors: p.donors.map((d) => ({ ...d, selected })),
        }))
      },
      openLastOutcome: async () => {
        alert('Modalità tutorial: nella versione reale questa azione apre la cartella degli esiti archiviata sul tuo PC.')
      },
    }
  }, [isTutorialActive, api])

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
              onClick={() => {
                setSettingsTab(state.updater?.status === 'available' ? 'updates' : 'storage')
                setShowSettings(true)
              }}
              title="Cartelle e Modelli salvati"
            >
              ⚙️ Impostazioni
              {state.updater?.status === 'available' && (
                <span className="topbar-update-dot" title="Nuova versione disponibile" />
              )}
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

        {/* Banner Tutorial Attivo */}
        {isTutorialActive && (
          <div className="tutorial-top-banner">
            <div className="tutorial-banner-content">
              <span className="tutorial-banner-icon">🎓</span>
              <div>
                <strong>Modalità Tutorial Interattivo Attiva</strong>
                <span className="tutorial-banner-sub">
                  Ambiente di simulazione protetto: nessun messaggio WhatsApp viene inviato.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={exitTutorial}
            >
              ✕ Esci dal Tutorial
            </button>
          </div>
        )}

        {/* Banner Notifica Nuovo Aggiornamento Disponibile */}
        {!isTutorialActive && state.updater?.status === 'available' && dismissedUpdateVersion !== state.updater.availableVersion && (
          <div className="update-top-banner">
            <div className="update-banner-info">
              <span className="update-banner-icon">✨</span>
              <div>
                <strong>Nuova versione disponibile: v{state.updater.availableVersion}</strong>
                <span className="update-banner-sub">
                  È disponibile una versione aggiornata dell'applicazione.
                </span>
              </div>
            </div>
            <div className="update-banner-actions">
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => {
                  setSettingsTab('updates')
                  setShowSettings(true)
                }}
              >
                Visualizza e aggiorna
              </button>
              <button
                type="button"
                className="link-btn update-banner-dismiss"
                onClick={() => setDismissedUpdateVersion(state.updater.availableVersion)}
                title="Ignora questo avviso per ora"
              >
                ✕ Chiudi
              </button>
            </div>
          </div>
        )}

        {/* Banner Notifica Aggiornamento Scaricato (Pronto) */}
        {state.updater?.status === 'downloaded' && (
          <div className="update-top-banner update-banner-ready">
            <div className="update-banner-info">
              <span className="update-banner-icon">🚀</span>
              <div>
                <strong>Aggiornamento v{state.updater.availableVersion} scaricato con successo!</strong>
                <span className="update-banner-sub">
                  Riavvia ora l'applicazione per completare l'installazione.
                </span>
              </div>
            </div>
            <div className="update-banner-actions">
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => api?.installUpdate?.()}
              >
                Riavvia e aggiorna ora
              </button>
            </div>
          </div>
        )}

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
            api={effectiveApi}
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
                  api={effectiveApi}
                  call={call}
                  isRunning={isRunning}
                  isPaused={isPaused}
                  onNext={() => setCurrentStep(2)}
                />
              )}

              {currentStep === 2 && (
                <StepComposer
                  state={state}
                  api={effectiveApi}
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
                  api={effectiveApi}
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
        onClose={() => { setShowSettings(false); setSettingsTab('storage') }}
        state={state}
        api={api}
        call={call}
        options={options}
        setOptions={setOptions}
        selectedPreset={selectedPreset}
        setSelectedPreset={setSelectedPreset}
        setPresetName={setPresetName}
        setMessage={setMessage}
        initialTab={settingsTab}
        onStartTutorial={() => {
          setShowSettings(false)
          startTutorial()
        }}
        onOpenGuide={() => {
          setShowSettings(false)
          setShowGuide(true)
        }}
      />

      <QrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        state={state}
        api={api}
        call={call}
      />

      {showGuide && (
        <Guide
          onClose={() => setShowGuide(false)}
          onStartTutorial={() => {
            setShowGuide(false)
            startTutorial()
          }}
        />
      )}

      {/* Welcome Modal al primo avvio */}
      {showWelcomeModal && (
        <WelcomeModal
          onStartTour={() => {
            try { localStorage.setItem('avis_tutorial_seen', 'true') } catch {}
            setShowWelcomeModal(false)
            startTutorial()
          }}
          onSkip={() => {
            try { localStorage.setItem('avis_tutorial_seen', 'true') } catch {}
            setShowWelcomeModal(false)
          }}
        />
      )}

      {/* Floating Tutorial Dock */}
      {isTutorialActive && (
        <TutorialDock
          currentStepIndex={tutorialStepIndex}
          totalSteps={TUTORIAL_STEPS.length}
          stepData={TUTORIAL_STEPS[tutorialStepIndex - 1]}
          onNext={handleTutorialNext}
          onPrev={handleTutorialPrev}
          onExit={exitTutorial}
          isSimulating={isSimulating}
          onStartSimulation={startSimulation}
          simulationDone={simulationDone}
        />
      )}
    </div>
  )
}

export default App
