import { useEffect, useRef } from 'react'

export default function SendingDashboard({
  state,
  counts,
  isRunning,
  isPaused,
  call,
  api,
  onBackToEdit,
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
  const percent = state.progress.total
    ? Math.round((state.progress.current / state.progress.total) * 100)
    : 0

  const currentDonor = state.donors.find(
    (d) => d.selected !== false && d.valid && d.status === 'pending'
  )

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
              ✏️ Torna alla configurazione
            </button>
          )}
        </div>
      </div>

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
              (state.progress.skipped || counts.skipped || 0)}
          </strong>
          <small>problemi o non validi</small>
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
