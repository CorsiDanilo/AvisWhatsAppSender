import React from 'react'
import { AlertTriangle, RefreshCw, Mail } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, reportStatus: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo)
  }

  handleSendReport = async () => {
    this.setState({ reportStatus: 'Apertura client di posta...' })
    try {
      if (window.whatsappSender?.sendDeveloperReport) {
        await window.whatsappSender.sendDeveloperReport(
          `React UI Crash: ${this.state.error?.message || ''}\n\nStack:\n${this.state.error?.stack || ''}`
        )
        this.setState({ reportStatus: 'Client di posta aperto! I file di log sono stati evidenziati sul tuo computer.' })
      } else {
        this.setState({ reportStatus: 'Impossibile inviare la segnalazione.' })
      }
    } catch {
      this.setState({ reportStatus: 'Errore durante l\'apertura del client di posta.' })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '540px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: '#0f172a' }}>
              Si è verificato un errore imprevisto
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>
              L'interfaccia dell'applicazione ha riscontrato un problema. Puoi ricaricare la schermata o inviare il log allo sviluppatore per permettergli di risolvere il guasto.
            </p>
            {this.state.error && (
              <div style={{
                background: '#f1f5f9',
                padding: '12px',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#334155',
                maxHeight: '120px',
                overflowY: 'auto',
                marginBottom: '20px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            {this.state.reportStatus && (
              <p style={{ fontSize: '13px', color: '#16a34a', margin: '0 0 16px' }}>
                {this.state.reportStatus}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => window.location.reload()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
              >
                <RefreshCw size={16} /> Ricarica applicazione
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={this.handleSendReport}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
              >
                <Mail size={16} /> Invia log allo sviluppatore
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

