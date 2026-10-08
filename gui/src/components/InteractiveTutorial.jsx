import React from 'react'

export function WelcomeModal({ onStartTour, onSkip }) {
  return (
    <div className="guide-backdrop welcome-backdrop" role="presentation">
      <div className="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="welcome-badge">AVIS WhatsApp Sender</div>
        <div className="welcome-icon">🩸</div>
        <h2 id="welcome-title">Benvenuto nell'applicazione!</h2>
        <p className="welcome-description">
          Vuoi fare una breve panoramica interattiva guidata delle funzionalità?
          Potrai provare tutte le schermate in <strong>modalità simulata protetta</strong>, toccando con mano la gestione delle liste, i messaggi personalizzati e la dashboard di invio <strong>senza inviare alcun messaggio reale</strong>.
        </p>

        <div className="welcome-features-list">
          <div className="welcome-feature-item">
            <span>📊</span>
            <div>
              <strong>Importazione Excel & CSV</strong>
              <small>Mappatura automatica colonne e controllo numeri</small>
            </div>
          </div>
          <div className="welcome-feature-item">
            <span>💬</span>
            <div>
              <strong>Messaggi con Tag [nome] & Foto</strong>
              <small>Anteprima smartphone in tempo reale</small>
            </div>
          </div>
          <div className="welcome-feature-item">
            <span>🛡️</span>
            <div>
              <strong>Ritmo Anti-Ban & Report</strong>
              <small>Intervalli intelligenti ed esito esportato su Desktop</small>
            </div>
          </div>
        </div>

        <div className="welcome-actions">
          <button type="button" className="button button-primary welcome-btn-primary" onClick={onStartTour}>
            🚀 Inizia il Tutorial Interattivo
          </button>
          <button type="button" className="button button-secondary welcome-btn-skip" onClick={onSkip}>
            Salta per ora ed entra subito
          </button>
        </div>
        <p className="welcome-note">
          Potrai sempre riaprire questo tutorial in qualsiasi momento dal menu <strong>⚙️ Impostazioni</strong> o dalla <strong>Guida</strong>.
        </p>
      </div>
    </div>
  )
}

export function TutorialDock({
  currentStepIndex,
  totalSteps,
  stepData,
  onNext,
  onPrev,
  onExit,
  isSimulating,
  onStartSimulation,
  simulationDone,
}) {
  return (
    <div className="tutorial-dock-container">
      <div className="tutorial-dock-card">
        <div className="tutorial-dock-header">
          <div className="tutorial-dock-badge">
            <span className="tutorial-sparkle">🎓</span>
            <span>Tutorial Interattivo · Passo {currentStepIndex} di {totalSteps}</span>
          </div>
          <button
            type="button"
            className="tutorial-dock-close"
            onClick={onExit}
            title="Esci dalla modalità tutorial e torna alla schermata normale"
            aria-label="Chiudi tutorial"
          >
            ✕ Esci
          </button>
        </div>

        <div className="tutorial-dock-body">
          <div className="tutorial-dock-text">
            <h3>{stepData.title}</h3>
            <p>{stepData.description}</p>
          </div>

          <div className="tutorial-dock-actions">
            {currentStepIndex > 1 && (
              <button
                type="button"
                className="button button-secondary tutorial-nav-btn"
                onClick={onPrev}
                disabled={isSimulating}
              >
                ← Precedente
              </button>
            )}

            {currentStepIndex === 5 && !simulationDone && (
              <button
                type="button"
                className={`button button-primary tutorial-nav-btn ${isSimulating ? 'simulating-pulse' : ''}`}
                onClick={onStartSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? '⏳ Simulazione in corso…' : '▶ Avvia Simulazione Invio'}
              </button>
            )}

            {currentStepIndex === 5 && simulationDone ? (
              <button
                type="button"
                className="button button-primary tutorial-nav-btn complete-btn"
                onClick={onExit}
              >
                🎉 Completa Tutorial & Inizia
              </button>
            ) : currentStepIndex < 5 ? (
              <button
                type="button"
                className="button button-primary tutorial-nav-btn"
                onClick={onNext}
              >
                {stepData.actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
