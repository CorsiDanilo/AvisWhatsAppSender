import { useState } from 'react'

export default function QrModal({ isOpen, onClose, state, api, call }) {
  const [regenerating, setRegenerating] = useState(false)

  if (!isOpen) return null

  const isQr = state.connection === 'qr' && state.qrDataUrl
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
                <img src={state.qrDataUrl} alt="Codice QR per WhatsApp" className="qr-large-image" />
              </div>
              <div className="qr-instructions">
                <h3>Come collegare:</h3>
                <ol>
                  <li>Apri <strong>WhatsApp</strong> sul tuo smartphone</li>
                  <li>Vai su <strong>Impostazioni</strong> (su iPhone) o tocca i <strong>tre puntini</strong> (su Android)</li>
                  <li>Seleziona <strong>Dispositivi collegati</strong></li>
                  <li>Tocca <strong>Collega un dispositivo</strong> e inquadra questo codice</li>
                </ol>
                <div className="qr-tip-box">
                  <span>💡 Il codice QR scade automaticamente ogni ~20 secondi. Se non funziona o si blocca, rigeneralo subito:</span>
                </div>
              </div>
            </div>
          ) : isConnecting || regenerating ? (
            <div className="qr-loading-box">
              <div className="qr-spinner" />
              <h3>Generazione del codice QR in corso…</h3>
              <p className="muted">Avvio del browser e richiesta della sessione WhatsApp…</p>
            </div>
          ) : state.connection === 'ready' ? (
            <div className="qr-success-box">
              <span className="big-check-icon">✓</span>
              <h3>WhatsApp è già collegato e pronto!</h3>
              <p className="muted">Puoi procedere all'invio dei messaggi.</p>
            </div>
          ) : (
            <div className="qr-empty-box">
              <h3>WhatsApp non è connesso</h3>
              <p className="muted">Premi il pulsante qui sotto per avviare il collegamento e generare il QR code.</p>
            </div>
          )}
        </div>

        <div className="qr-modal-footer">
          {state.connection !== 'ready' && (
            <button
              type="button"
              className="button button-secondary regenerate-qr-btn"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <span>🔄</span> {regenerating ? 'Rigenerazione in corso…' : 'Rigenera codice QR'}
            </button>
          )}
          <button type="button" className="button button-primary" onClick={onClose}>
            {state.connection === 'ready' ? 'Fatto' : 'Chiudi e continua'}
          </button>
        </div>
      </div>
    </div>
  )
}
