import { useState } from 'react'
import { Mail, Copy, Check } from 'lucide-react'

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
        if (deliveryMethod === 'gmail-smtp') {
          setStatusMessage('Log inviato allo sviluppatore tramite Gmail AVIS.')
          return
        }
      }
      if (method === 'clipboard') {
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
            {/* Opzione 1: Gmail AVIS */}
            <button
              type="button"
              className="report-option-card report-option-recommended"
              onClick={() => handleSelectMethod('gmail-smtp')}
              disabled={submitting}
            >
              <div className="report-card-icon report-icon-gmail">
                <Mail size={24} />
              </div>
              <div className="report-card-info">
                <div className="report-card-title-row">
                  <strong>Invia tramite Gmail AVIS</strong>
                  <span className="report-badge-recommended">Consigliato</span>
                </div>
                <p>
                  Invia direttamente allo sviluppatore il report e il log giornaliero allegato.
                </p>
              </div>
            </button>

            {/* Opzione 2: Copia negli appunti & Apri cartella */}
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
