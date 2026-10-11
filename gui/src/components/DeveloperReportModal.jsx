import { useState } from 'react'
import { Globe, Mail, Copy, Check } from 'lucide-react'

export default function DeveloperReportModal({ isOpen, onClose, errorContext, api }) {
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  if (!isOpen) return null

  async function handleSelectMethod(method) {
    setSubmitting(true)
    setStatusMessage('')
    try {
      if (api?.sendDeveloperReport) {
        const result = await api.sendDeveloperReport({ errorContext, method })
        const deliveryMethod = result?.method || method
        if (deliveryMethod === 'mailto') {
          setStatusMessage('Client di posta aperto! Il log completo è stato copiato negli appunti e reso disponibile nella cartella dei log.')
          return
        }
      }
      if (method === 'gmail') {
        setStatusMessage('Bozza Gmail aperta con il log completo. Allega manualmente il file di log evidenziato nella cartella dei log.')
      } else if (method === 'eml') {
        setStatusMessage('Client di posta avviato! La bozza contiene il file di log allegato.')
      } else {
        setStatusMessage('Tutti i dettagli sono stati copiati negli appunti e la cartella dei log è stata aperta.')
      }
    } catch {
      setStatusMessage('Si è verificato un errore durante la preparazione della segnalazione.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="guide-backdrop report-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="report-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
        <div className="report-modal-header">
          <div>
            <span className="eyebrow">Assistenza e Sviluppo</span>
            <h2 id="report-modal-title">Invia log allo sviluppatore</h2>
          </div>
          <button className="guide-close" onClick={onClose} aria-label="Chiudi finestra">
            ×
          </button>
        </div>

        <div className="report-modal-body">
          <p className="report-modal-desc">
            Scegli come preferisci inviare la segnalazione diagnostica e il file di log della giornata allo sviluppatore:
          </p>

          <div className="report-options-grid">
            {/* Opzione 1: Gmail Web (Consigliato) */}
            <button
              type="button"
              className="report-option-card report-option-recommended"
              onClick={() => handleSelectMethod('gmail')}
              disabled={submitting}
            >
              <div className="report-card-icon report-icon-gmail">
                <Globe size={24} />
              </div>
              <div className="report-card-info">
                <div className="report-card-title-row">
                  <strong>Gmail (Browser Web)</strong>
                  <span className="report-badge-recommended">Consigliato</span>
                </div>
                <p>
                  Inserisce il log completo nella bozza Gmail. Il file di log viene aperto in Esplora Risorse e deve essere allegato manualmente.
                </p>
              </div>
            </button>

            {/* Opzione 2: Client di posta Windows */}
            <button
              type="button"
              className="report-option-card"
              onClick={() => handleSelectMethod('eml')}
              disabled={submitting}
            >
              <div className="report-card-icon report-icon-mail">
                <Mail size={24} />
              </div>
              <div className="report-card-info">
                <div className="report-card-title-row">
                  <strong>Client di Posta Windows</strong>
                </div>
                <p>
                  Apre l'applicazione di posta predefinita del computer (Outlook, Thunderbird, Posta) con il file di log già allegato.
                </p>
              </div>
            </button>

            {/* Opzione 3: Copia negli appunti & Apri cartella */}
            <button
              type="button"
              className="report-option-card"
              onClick={() => handleSelectMethod('clipboard')}
              disabled={submitting}
            >
              <div className="report-card-icon report-icon-copy">
                <Copy size={24} />
              </div>
              <div className="report-card-info">
                <div className="report-card-title-row">
                  <strong>Copia negli appunti & Apri cartella</strong>
                </div>
                <p>
                  Copia il resoconto negli appunti ed evidenzia il file di log in Esplora Risorse (ideale per inviarlo via WhatsApp o altre chat).
                </p>
              </div>
            </button>
          </div>

          {statusMessage && (
            <div className="report-status-banner">
              <Check size={18} className="report-status-icon" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        <div className="report-modal-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
