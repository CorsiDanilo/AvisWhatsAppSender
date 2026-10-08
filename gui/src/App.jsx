import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Gift, HelpCircle, Settings, Bell, Download, CheckCircle, RefreshCw, X, ChevronDown, GraduationCap, Mail, AlertCircle } from 'lucide-react'
import './App.css'
import Guide from './Guide'
import SettingsModal from './components/SettingsModal'
import QrModal from './components/QrModal'
import StepperNav from './components/StepperNav'
import StepRecipients from './components/StepRecipients'
import StepComposer from './components/StepComposer'
import StepSummary from './components/StepSummary'
import SendingDashboard from './components/SendingDashboard'
import BirthdayCenter from './components/BirthdayCenter'
import NotificationCenter from './components/NotificationCenter'
import { toUserError } from './errorMessage'
import avisLogo from './assets/avis-logo.png'
import { WelcomeModal, TutorialDock } from './components/InteractiveTutorial'
import {
  TUTORIAL_STEPS,
  TUTORIAL_DONORS,
  TUTORIAL_MESSAGE,
} from './components/tutorialData'

const templates = {
  'Promemoria donazione':
    'Ciao [nome],\nti ricordiamo il tuo prossimo appuntamento per la donazione.\nGrazie per il tuo prezioso gesto! ❤️\n\nTi ricordiamo di salvare questo numero tra i tuoi contatti per ricevere i promemoria delle donazioni.',
  'Ringraziamento':
    'Ciao [nome],\nAVIS ti ringrazia di cuore per la tua donazione.\nIl tuo gesto è prezioso! ❤️\n\nTi ricordiamo di salvare questo numero tra i tuoi contatti per ricevere i promemoria delle donazioni.',
  'Comunicazione generale':
    'Gentile donatore,\nti informiamo che domenica si terrà una raccolta straordinaria.\nAVIS Comunale\n\nTi ricordiamo di salvare questo numero tra i tuoi contatti per ricevere i promemoria delle donazioni.',
  'Auguri di compleanno':
    'Ciao [nome],\n\nAVIS ti augura buon compleanno!\nTi auguriamo una splendida giornata.\n\nGrazie per il tuo prezioso gesto.',
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
  settings: {
    minDelayMs: 20000,
    maxDelayMs: 40000,
    pauseAfter: 35,
    pauseMinutes: 15,
    outputDir: '',
    logDir: '',
    notificationsEnabled: true,
    startWithWindows: true,
    birthdayEnabled: true,
    birthdaySourceFilePath: '',
    birthdayPresetName: 'Auguri di compleanno',
  },
  presets: fallbackPresets,
  defaultOutputDir: '',
  defaultLogDir: '',
  userDataDir: '',
  lastOutcomeDir: '',
  notifications: {
    items: [],
    unreadCount: 0,
  },
  birthdays: {
    status: 'not-configured',
    dateKey: '',
    sourcePath: '',
    sourceFileName: '',
    sourceModifiedAt: null,
    lastCheckedAt: null,
    matches: [],
    invalidRows: [],
    pendingCount: 0,
    notificationPending: false,
    sessionPrepared: false,
    error: '',
  },
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
  const [rawError, setRawError] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('storage')
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [showQrBanner, setShowQrBanner] = useState(true)
const [showBirthdayCenter, setShowBirthdayCenter] = useState(false)
  const [showNotificationCenter, setShowNotificationCenter] = useState(false)
  const [hasAutoOpenedUpdate, setHasAutoOpenedUpdate] = useState(false)

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
          if (api.loadPresetAttachment) {
            api.loadPresetAttachment(firstPreset.attachment || null)
              .then(setState)
              .catch((reason) => setError(toUserError(reason)))
          }
        }
      })
      .catch((reason) => setError(toUserError(reason)))
    return api.onState(setState)
  }, [api])

  useEffect(() => {
if (!api?.onOpenBirthdays) return undefined
    return api.onOpenBirthdays(() => setShowBirthdayCenter(true))
  }, [api])

  useEffect(() => {
    if (state.birthdays?.notificationPending) setShowBirthdayCenter(true)
  }, [state.birthdays?.notificationPending])
  useEffect(() => {
    if (state.updater?.status === 'available' && !hasAutoOpenedUpdate && !isTutorialActive) {
      setSettingsTab('updates')
      setShowSettings(true)
      setHasAutoOpenedUpdate(true)
    }
  }, [state.updater?.status, hasAutoOpenedUpdate, isTutorialActive])

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
    setRawError('')
    setReportStatus('')
    try {
      const next = await command()
      if (next && typeof next === 'object' && ('donors' in next || 'connection' in next)) {
        setState(next)
      }
      return next
    } catch (reason) {
      setError(toUserError(reason))
      setRawError(reason?.message || String(reason || ''))
      throw reason
    }
  }

  async function handleSendErrorReport(userMsg, rawMsg) {
    setReportStatus('Apertura client di posta...')
    try {
      const context = rawMsg ? `${userMsg} [Dettaglio tecnico: ${rawMsg}]` : userMsg
      await api?.sendDeveloperReport?.(context)
      setReportStatus('Client di posta aperto! File di log di oggi evidenziato ed estratto copiato negli appunti.')
    } catch {
      setReportStatus('Impossibile aprire il client di posta predefinito.')
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
      return api.loadPresetAttachment
        ? api.loadPresetAttachment(firstPreset.attachment || null)
        : next
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
              `[${nowTime}] ✅ Messaggio inviato a ${donor.name} ${donor.surname} (${donor.phone}) [SIMULATO]`,
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
                '✅ Sessione simulata completata con successo!',
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

  function handleBirthdayPrepared(next) {
    const presetName = next.settings?.birthdayPresetName || 'Auguri di compleanno'
    const preset = (next.presets || []).find((item) => item.name === presetName)
      || (next.presets || []).find((item) => item.name === 'Auguri di compleanno')
      || (next.presets || [])[0]
    if (preset) {
      setSelectedPreset(preset.name)
      setPresetName(preset.name)
      setMessage(preset.message)
      if (preset.settings) setOptions(preset.settings)
      if (api.loadPresetAttachment) {
        call(() => api.loadPresetAttachment(preset.attachment || null))
      }
    }
    setCurrentStep(1)
    setManualSendingView(false)
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
      updateDonor: async (index, patch) => {
        setState((p) => {
          const nextDonors = [...p.donors]
          if (!nextDonors[index]) return p
          const donor = nextDonors[index]
          const givenNames = String(patch.givenNames || patch.name || donor.givenNames || donor.name || '').trim().replace(/\s+/g, ' ')
          nextDonors[index] = {
            ...donor,
            name: givenNames.split(' ')[0] || '',
            givenNames,
            surname: String(patch.surname ?? donor.surname ?? '').trim(),
            rawPhone: String(patch.phone ?? donor.rawPhone ?? donor.phone ?? '').trim(),
            phone: String(patch.phone ?? donor.rawPhone ?? donor.phone ?? '').trim(),
            customFields: { ...(donor.customFields || {}), ...(patch.customFields || {}) },
          }
          return { ...p, donors: nextDonors }
        })
      },
      addDonor: async (input, customFieldKeys = []) => {
        setState((p) => {
          const customFields = {}
          customFieldKeys.forEach((key) => { customFields[key] = input.customFields?.[key] || '' })
          const givenNames = String(input.name || '').trim().replace(/\s+/g, ' ')
          const phone = String(input.phone || '').trim()
          return {
            ...p,
            donors: [...p.donors, {
              name: givenNames.split(' ')[0] || '',
              givenNames,
              surname: String(input.surname || '').trim(),
              rawPhone: phone,
              phone,
              valid: Boolean(phone),
              reason: phone ? '' : 'Numero di telefono mancante',
              warning: givenNames && !input.surname ? 'Cognome non rilevato' : '',
              status: 'pending',
              selected: true,
              customFields,
            }],
            progress: { ...p.progress, total: p.donors.length + 1 },
          }
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
      connecting: 'Connessione...',
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
          <img className="brand-logo" src={avisLogo} alt="AVIS" />
          <div>
            <strong>Sender</strong>
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
              className="button button-secondary topbar-btn topbar-icon-btn topbar-session-btn"
              onClick={resetInterface}
              disabled={isSendingActive}
              title="Azzera la sessione mantenendo WhatsApp collegato"
              aria-label="Nuova sessione"
            >
              <Plus className="topbar-icon" size={18} /> <span className="new-session-label">Nuova sessione</span>
            </button>
            <button
              type="button"
              className="button button-secondary topbar-btn topbar-icon-btn topbar-labeled-btn topbar-attention-btn"
              onClick={() => setShowBirthdayCenter(true)}
              title="Controlla i compleanni dei donatori"
              aria-label="Apri compleanni dei donatori"
            >
              <Gift className="topbar-icon" size={18} /> <span>Compleanni</span>
              {state.birthdays?.pendingCount > 0 && !state.birthdays?.sessionPrepared && (
                <span className="topbar-attention-dot" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="button button-secondary topbar-btn topbar-icon-btn topbar-labeled-btn"
              onClick={() => setShowGuide(true)}
              title="Apri la guida"
              aria-label="Apri la guida"
            >
              <HelpCircle className="topbar-icon" size={18} /> <span>Guida</span>
            </button>
            <span className="topbar-divider" role="separator" aria-hidden="true" />
            <button
              type="button"
              className="button button-secondary topbar-btn topbar-icon-btn"
              onClick={() => {
                setSettingsTab(state.updater?.status === 'available' ? 'updates' : 'storage')
                setShowSettings(true)
              }}
              title="Apri impostazioni"
              aria-label="Apri impostazioni"
            >
              <Settings className="topbar-icon" size={18} />
              {state.updater?.status === 'available' && (
                <span className="topbar-update-dot" title="Nuova versione disponibile" />
              )}
            </button>
            <button
              type="button"
              className="button button-secondary topbar-btn topbar-icon-btn topbar-attention-btn"
              onClick={() => setShowNotificationCenter(true)}
              title="Apri il centro notifiche"
              aria-label={`Apri notifiche${state.notifications?.unreadCount ? `, ${state.notifications.unreadCount} non lette` : ''}`}
            >
              <Bell className="topbar-icon" size={18} />
              {state.notifications?.unreadCount > 0 && (
                <span className="topbar-attention-dot" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="wizard-layout">
        {error && (
          <div className="alert global-alert error-report-banner" role="alert">
            <div className="error-report-content">
              <span className="error-report-icon"><AlertCircle size={20} /></span>
              <div className="error-report-text">
                <strong>Si è verificato un errore</strong>
                <p>{error}</p>
                {reportStatus && <p className="error-report-status">{reportStatus}</p>}
              </div>
            </div>
            <div className="error-report-actions">
              <button
                type="button"
                className="button button-small button-secondary error-report-btn"
                onClick={() => handleSendErrorReport(error, rawError)}
                title="Prepara un'email con i log e i dettagli dell'errore per lo sviluppatore (danilo.corsi@outlook.it)"
              >
                <Mail size={15} /> Invia log allo sviluppatore
              </button>
              <button
                type="button"
                className="link-btn error-report-dismiss"
                onClick={() => { setError(''); setRawError(''); setReportStatus(''); }}
                title="Ignora avviso"
              >
                <X size={16} /> Chiudi
              </button>
            </div>
          </div>
        )}

        {state.birthdays?.sessionPrepared && !isSendingActive && state.donors.length > 0 && (
          <div className="birthday-session-banner" role="status">
            <div>
              <strong>Sessione auguri di compleanno pronta</strong>
              <span>Controlla i destinatari, il messaggio e il riepilogo prima di inviare.</span>
            </div>
            <button type="button" className="link-btn" onClick={() => setShowBirthdayCenter(true)}>
              Rivedi compleanni
            </button>
          </div>
        )}

        {/* Banner Tutorial Attivo */}
        {isTutorialActive && (
          <div className="tutorial-top-banner">
            <div className="tutorial-banner-content">
              <span className="tutorial-banner-icon"><GraduationCap size={24} /></span>
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
              <X size={16} /> Esci dal Tutorial
            </button>
          </div>
        )}

        {/* Banner Notifica Nuovo Aggiornamento Disponibile */}
        {!isTutorialActive && state.updater?.status === 'available' && dismissedUpdateVersion !== state.updater.availableVersion && (
          <div className="update-top-banner">
            <div className="update-banner-info">
              <span className="update-banner-icon"><Download size={24} /></span>
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
                <X size={16} /> Chiudi
              </button>
            </div>
          </div>
        )}

        {/* Banner Notifica Aggiornamento Scaricato (Pronto) */}
        {state.updater?.status === 'downloaded' && (
          <div className="update-top-banner update-banner-ready">
            <div className="update-banner-info">
              <span className="update-banner-icon"><CheckCircle size={24} /></span>
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
                <span className="eyebrow">Azione richiesta — WhatsApp non connesso</span>
                <h3>Scansiona il codice QR con il tuo telefono</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  Apri <strong>WhatsApp</strong> sul telefono &rarr; <strong>Dispositivi collegati</strong> &rarr; <strong>Collega un dispositivo</strong>.
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
                <span><RefreshCw size={16} /></span> Rigenera QR code
              </button>
              <button
                type="button"
                className="link-btn top-qr-dismiss"
                onClick={() => setShowQrBanner(false)}
                title="Nascondi questo riquadro (puoi riaprirlo cliccando su 'Scansiona il QR' in alto)"
              >
                <ChevronDown size={16} /> Riduci
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

      <BirthdayCenter
        isOpen={showBirthdayCenter}
        state={state}
        api={api}
        call={call}
        onClose={() => setShowBirthdayCenter(false)}
        onPrepared={handleBirthdayPrepared}
        onConfigure={() => {
          setSettingsTab('birthdays')
          setShowSettings(true)
        }}
      />

      <NotificationCenter
        isOpen={showNotificationCenter}
        state={state}
        api={api}
        call={call}
        onClose={() => setShowNotificationCenter(false)}
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



