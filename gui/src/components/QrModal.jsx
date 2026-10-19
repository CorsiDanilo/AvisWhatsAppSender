import { useState } from 'react'

export default function QrModal({ isOpen, onClose, state, api, call }) {
  const [regenerating, setRegenerating] = useState(false)
  const [resetting, setResetting] = useState(false)

  if (!isOpen) return null

  const isQrExpired = state.connection === 'qr_expired'
  const isQr = (state.connection === 'qr' || isQrExpired) && state.qrDataUrl
  const isConnecting = state.connection === 'connecting'

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      if (api?.reconnect) {
        await call(() => api.reconnect())
      } else {
        await call(() => api.connect())
      }
    } catch {
      // Error handled by call()
    } finally {
      setRegenerating(false)
    }
  }

  async function handleResetSession() {
    setResetting(true)
    try {
      if (api?.resetWhatsAppSession) {
        await call(() => api.resetWhatsAppSession())
      } else if (api?.reconnect) {
        await call(() => api.reconnect())
      }
    } catch {
      // Error handled by call()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div
      className="guide-backdrop qr-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="qr-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
        <div className="qr-modal-header">
          <div>
            <span className="eyebrow">Autenticazione WhatsApp Web</span>
            <h2 id="qr-modal-title">Collega il tuo WhatsApp</h2>
          </div>
          <button className="guide-close" onClick={onClose} aria-label="Chiudi finestra QR">
            ×
          </button>
        </div>

        <div className="qr-modal-body">
          {isQr ? (
            <div className="qr-modal-content">
              <div className="qr-image-wrapper">
                <div className={`qr-image-container ${isQrExpired ? 'is-expired' : ''}`}>
                  <img
                    src={state.qrDataUrl}
                    alt="Codice QR per WhatsApp"
                    className={`qr-large-image ${isQrExpired ? 'qr-large-image-expired' : ''}`}
                  />
                  {isQrExpired && (
                    <div className="qr-expired-overlay">
                      <button
                        type="button"
                        className="qr-reload-button"
                        onClick={handleRegenerate}
                        disabled={regenerating || resetting}
                        aria-label="Ricarica codice QR"
                      >
                        <span className="qr-reload-icon" aria-hidden="true">🔄</span>
                        <span className="qr-reload-text">Clicca per ricaricare il codice QR</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="qr-instructions">
                <h3>Come collegare:</h3>
                <ol>
                  <li>Apri <strong>WhatsApp</strong> sul tuo smartphone</li>
                  <li>Vai su <strong>Impostazioni</strong> (su iPhone) o tocca i <strong>tre puntini</strong> (su Android)</li>
                  <li>Seleziona <strong>Dispositivi collegati</strong></li>
                  <li>Tocca <strong>Collega un dispositivo</strong> e inquadra questo codice</li>
                </ol>
                {isQrExpired ? (
                  <div className="qr-tip-box qr-tip-box-expired">
                    <span>⚠️ Il codice QR è scaduto per inattività. Clicca sul pulsante per generarne uno nuovo.</span>
                  </div>
                ) : (
                  <div className="qr-tip-box">
                    <span>💡 Il codice QR scade automaticamente dopo circa 20 secondi. Dopo la scadenza, non viene creato automaticamente un altro codice: usa il pulsante di ricarica.</span>
                  </div>
                )}
              </div>
            </div>
          ) : regenerating ? (
            <div className="qr-loading-box">
              <div className="qr-spinner" />
              <h3>Riconnessione a WhatsApp in corso…</h3>
              <p className="muted">Il browser viene chiuso e riaperto. Non è necessario effettuare nuovamente il login.</p>
            </div>
          ) : resetting ? (
            <div className="qr-loading-box">
              <div className="qr-spinner" />
              <h3>Azzeramento sessione in corso…</h3>
              <p className="muted">Eliminazione dei dati di sessione locali e preparazione di un nuovo codice QR…</p>
            </div>
          ) : isConnecting ? (
            <div className="qr-loading-box">
              <div className="qr-spinner" />
              <h3>Connessione a WhatsApp in corso…</h3>
              <p className="muted">Verifica della sessione memorizzata nel browser…</p>
            </div>
          ) : state.connection === 'ready' ? (
            <div className="qr-success-box">
              <span className="big-check-icon">✓</span>
              <h3>WhatsApp è già collegato e pronto!</h3>
              <p className="muted">Puoi procedere all'invio dei messaggi.</p>
            </div>
          ) : state.connection === 'authenticated' ? (
            <div className="qr-loading-box">
              <div className="qr-spinner" />
              <h3>WhatsApp autenticato</h3>
              <p className="muted">La sessione è autenticata, ma WhatsApp Web non è ancora pronto per l'invio.</p>
            </div>
          ) : isQrExpired ? (
            <div className="qr-empty-box">
              <h3>Codice QR scaduto</h3>
              <p className="muted">Il tempo per scansionare il codice è terminato. Clicca su "Ricarica codice QR" per generarne uno nuovo.</p>
            </div>
          ) : (
            <div className="qr-empty-box">
              <h3>WhatsApp non è connesso</h3>
              <p className="muted">Premi il pulsante qui sotto per avviare il collegamento e generare il QR code.</p>
            </div>
          )}
        </div>

        <div className="qr-modal-footer">
          <div className="qr-modal-actions">
            <button
              type="button"
              className="button button-secondary regenerate-qr-btn"
              onClick={handleRegenerate}
              disabled={regenerating || resetting}
              title={isQrExpired ? "Richiedi un nuovo codice QR a WhatsApp" : "Riavvia il browser e ricarica la sessione WhatsApp esistente (non è necessario effettuare nuovamente il login)"}
            >
              <span>🔄</span> {regenerating ? 'Riconnessione in corso…' : isQrExpired ? 'Ricarica codice QR' : 'Riconnetti WhatsApp'}
            </button>
            <button
              type="button"
              className="button button-secondary reset-session-btn"
              onClick={handleResetSession}
              disabled={regenerating || resetting}
              title="Cancella i file di sessione memorizzati e rigenera un nuovo codice QR"
            >
              <span>🧹</span> {resetting ? 'Azzeramento in corso…' : 'Azzera sessione'}
            </button>
          </div>
          <button type="button" className="button button-primary" onClick={onClose}>
            {state.connection === 'ready' ? 'Fatto' : state.connection === 'authenticated' ? 'Chiudi e attendi' : 'Chiudi e continua'}
          </button>
        </div>
      </div>
    </div>
  )
}
