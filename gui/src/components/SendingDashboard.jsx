import { useEffect, useRef, useMemo } from 'react'
import { formatRemainingTime } from './duration.mjs'

export default function SendingDashboard({
  state,
  counts,
  isRunning,
  isPaused,
  call,
  api,
  onBackToEdit,
  connectionState,
}) {
  const logContainerRef = useRef(null)

  // Auto-scroll logs to bottom as they arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [state.logs])

  const isCompleted = state.queue === 'completed'
  const isStopped = state.queue === 'stopped'
  const connectionReady = connectionState === 'ready'
  const pauseReason = state.queuePauseReason
  const isConnectionPaused = pauseReason?.startsWith('disconnected') || pauseReason?.startsWith('connection:') || pauseReason === 'qr' || pauseReason === 'auth-failure' || pauseReason === 'qr-generation-error'
  const isSendUncertain = pauseReason === 'send-uncertain'
  const percent = state.progress.total
    ? Math.round((state.progress.current / state.progress.total) * 100)
    : 0

  const currentDonor = state.donors.find(
    (d) => d.selected !== false && d.valid && d.status === 'pending'
  )

  // Live ETA: estimate remaining seconds based on pending donors and configured delays.
  const liveEta = useMemo(() => {
    if (!isRunning && !isPaused) return null
    const pendingValid = state.donors.filter(
      (d) => d.selected !== false && d.valid && d.status === 'pending'
    ).length
    if (pendingValid === 0) return null

    const settings = state.settings || {}
    const minDelay = settings.minDelayMs ?? 20000
    const maxDelay = settings.maxDelayMs ?? 40000
    const avgDelaySec = ((minDelay + maxDelay) / 2) / 1000

    const pauseAfter = settings.pauseAfter ?? 35
    const pauseMinutes = settings.pauseMinutes ?? 15
    const pauseSec = pauseMinutes * 60

    const alreadySent = (state.progress.sent || 0) + (state.progress.failed || 0) + (state.progress.unknown || 0)
    const sendOverheadSec = 2
    let remainingSec = pendingValid * sendOverheadSec
    for (let i = 0; i < pendingValid; i++) {
      if (i < pendingValid - 1) {
        remainingSec += avgDelaySec
      }
      const total = alreadySent + i + 1
      if (pauseAfter > 0 && total % pauseAfter === 0 && i < pendingValid - 1) {
        remainingSec += pauseSec
      }
    }
    return Math.round(remainingSec)
  }, [isRunning, isPaused, state.donors, state.progress, state.settings])

  return (
    <div className="sending-dashboard">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Monitoraggio Operativo</span>
          <h2>
            {isRunning
              ? 'Invio messaggi in corso…'
              : isPaused
              ? 'Invio in pausa'
              : isCompleted
              ? 'Sessione completata con successo!'
              : isStopped
              ? 'Sessione interrotta'
              : 'Stato sessione'}
          </h2>
        </div>

        <div className="dashboard-actions">
          {(isCompleted || isStopped) && (
            <button
              type="button"
              className="button button-secondary"
              onClick={onBackToEdit}
            >
              ← Ritorna alla schermata principale
            </button>
          )}
        </div>
      </div>

      {/* Banner disconnessione WhatsApp durante l'invio */}
      {isPaused && (isConnectionPaused || isSendUncertain) && (
        <div className="disconnect-alert-banner">
          <span className="disconnect-alert-icon">{isSendUncertain ? '🔎' : '⚠️'}</span>
          <div className="disconnect-alert-text">
            <strong>{isSendUncertain ? 'Esito di un invio da verificare' : 'WhatsApp non è pronto'}</strong>
            <p>
              {isSendUncertain
                ? 'Un messaggio potrebbe essere stato inviato. Verifica WhatsApp e poi premi Riprendi invio per continuare senza ritentare quel destinatario.'
                : 'L’invio è stato messo in pausa automaticamente. Riconnetti WhatsApp dalla schermata principale e attendi lo stato pronto prima di riprendere.'}
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="stats-grid">
        <div className="stat-card">
          <span>Destinatari totali</span>
          <strong>{state.progress.total || state.donors.length}</strong>
          <small>nella coda di invio</small>
        </div>
        <div className="stat-card accent">
          <span>Inviati con successo</span>
          <strong>{state.progress.sent || counts.sent || 0}</strong>
          <small>messaggi consegnati</small>
        </div>
        <div className="stat-card">
          <span>In attesa</span>
          <strong>
            {state.donors.filter((d) => d.selected !== false && d.status === 'pending').length}
          </strong>
          <small>in coda per l'invio</small>
        </div>
        <div className="stat-card warning">
          <span>Falliti / Saltati</span>
          <strong>
            {(state.progress.failed || counts.failed || 0) +
              (state.progress.skipped || counts.skipped || 0) +
              (state.progress.unknown || counts.unknown || 0)}
          </strong>
          <small>problemi o da verificare</small>
        </div>
      </div>

      {/* Progress & Controls Card */}
      <div className="panel live-progress-panel">
        <div className="progress-top-row">
          <div className="progress-info-left">
            <span className="progress-label">Avanzamento complessivo</span>
            <span className="progress-current-info">
              {isRunning && currentDonor ? (
                <>Invio a: <strong>{currentDonor.name} {currentDonor.surname || ''}</strong> ({currentDonor.phone})</>
              ) : isPaused ? (
                'In attesa di ripresa…'
              ) : isCompleted ? (
                'Tutti i messaggi sono stati elaborati'
              ) : (
                'Operazione terminata'
              )}
            </span>
          </div>
          <div className="progress-metric-right">
            <strong>{state.progress.current} / {state.progress.total || 0}</strong>
            <span>({percent}%)</span>
          </div>
        </div>

        <div className="progress-track-wrapper">
          <div className="progress-track">
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>

        {/* Live ETA indicator */}
        {liveEta !== null && (
          <div className={`live-eta-row${isPaused ? ' live-eta-paused' : ''}`}>
            <span className="live-eta-icon" role="img" aria-hidden="true">
              {isPaused ? '⏸' : '⏱'}
            </span>
            <span className="live-eta-label">
              {isPaused ? 'Invio in pausa — ' : 'Tempo rimanente stimato: '}
              <strong>{formatRemainingTime(liveEta)}</strong>
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="live-controls-row">
          {isRunning && (
            <button
              type="button"
              className="button button-secondary control-btn"
              onClick={() => call(() => api.pause())}
            >
              ⏸ Metti in Pausa
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              className="button button-primary control-btn"
              onClick={() => call(() => api.resume())}
              disabled={!connectionReady}
              title={connectionReady ? 'Riprendi l’invio' : 'Attendi che WhatsApp sia pronto'}
            >
              ▶ Riprendi invio
            </button>
          )}
          {(isRunning || isPaused) && (
            <button
              type="button"
              className="button button-danger control-btn"
              onClick={() => call(() => api.stop())}
            >
              ⏹ Ferma sessione
            </button>
          )}
        </div>

        {/* Banner conto alla rovescia spegnimento/sospensione */}
        {state.postSessionCountdown && (
          <div className="post-session-countdown-banner">
            <div className="countdown-info">
              <span className="countdown-icon" role="img" aria-label="Icona azione">
                {state.postSessionCountdown.action === 'shutdown' ? '🔌' : state.postSessionCountdown.action === 'hibernate' ? '🌙' : '💤'}
              </span>
              <div>
                <strong>
                  {state.postSessionCountdown.action === 'shutdown'
                    ? 'Spegnimento del PC programmato'
                    : state.postSessionCountdown.action === 'hibernate'
                    ? 'Ibernazione del PC programmata'
                    : 'Sospensione del PC programmata'}
                </strong>
                <p>
                  Il sistema entrerà in stato di {state.postSessionCountdown.action === 'shutdown' ? 'spegnimento' : state.postSessionCountdown.action === 'hibernate' ? 'ibernazione' : 'sospensione'} tra{' '}
                  <span className="countdown-seconds">{state.postSessionCountdown.secondsLeft} secondi</span>.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="button button-danger countdown-cancel-btn"
              onClick={() => call(() => api.cancelPostAction())}
            >
              ❌ Annulla operazione
            </button>
          </div>
        )}

        {/* Outcome banner if available */}
        {Boolean(state.lastOutcomeDir) && (
          <div className="outcome-card">
            <div className="outcome-text">
              <span className="eyebrow">Esito sessione archiviato</span>
              <div className="outcome-path" title={state.lastOutcomeDir}>
                {state.lastOutcomeDir}
              </div>
            </div>
            <button
              type="button"
              className="button button-secondary outcome-open-btn"
              onClick={() => api?.openLastOutcome?.()}
            >
              📁 Apri esito in Esplora Risorse
            </button>
          </div>
        )}
      </div>

      {/* Lower section: Logs & Recipients live status */}
      <div className="dashboard-lower-grid">
        {/* Live Logs */}
        <div className="panel dashboard-log-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Eventi in tempo reale</span>
              <h3>Log di trasmissione</h3>
            </div>
            <button
              type="button"
              className="link-btn"
              onClick={() => api?.openLogsDir?.()}
            >
              📁 Apri cartella log
            </button>
          </div>
          <div className="logs-console" ref={logContainerRef}>
            {state.logs.length === 0 ? (
              <div className="empty">In attesa di eventi…</div>
            ) : (
              state.logs.map((entry, index) => (
                <div
                  key={`${entry}-${index}`}
                  className={`log-line ${entry.includes('ERRORE') ? 'log-error' : ''}`}
                >
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Donors list */}
        <div className="panel dashboard-donors-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Stato Donatori</span>
              <h3>Dettaglio invio</h3>
            </div>
            <span className="count-pill">
              {state.donors.filter((d) => d.selected !== false).length} destinatari
            </span>
          </div>
          <div className="live-recipients-scroll">
            {state.donors
              .filter((d) => d.selected !== false)
              .map((donor, idx) => (
                <div key={`${donor.phone}-${idx}`} className="live-donor-row">
                  <div className="avatar">{(donor.name || '?')[0].toUpperCase()}</div>
                  <div className="donor-meta">
                    <strong>{donor.name} {donor.surname || ''}</strong>
                    <span>{donor.phone || donor.rawPhone}</span>
                  </div>
                  <span className={`badge badge-${donor.status}`}>
                    {donor.status === 'pending'
                      ? 'In attesa'
                      : donor.status === 'sent'
                      ? '✓ Inviato'
                      : donor.status === 'skipped'
                      ? 'Scartato'
                      : donor.status === 'unknown'
                      ? '⚠ Da verificare'
                      : '✕ Fallito'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
