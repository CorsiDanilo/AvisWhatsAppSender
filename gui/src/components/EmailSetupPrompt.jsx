import { Mail, Settings } from 'lucide-react'

export default function EmailSetupPrompt({ onConfigure, onClose }) {
  return (
    <div className="guide-backdrop email-setup-backdrop" role="presentation">
      <section className="email-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="email-setup-title">
        <div className="email-setup-icon" aria-hidden="true"><Mail size={24} /></div>
        <span className="eyebrow">Configurazione necessaria</span>
        <h2 id="email-setup-title">Configura le comunicazioni e-mail</h2>
        <p>
          Per ricevere i recap di emergenza e inviare i log allo sviluppatore devi impostare un indirizzo mittente e una password per app cifrata.
        </p>
        <div className="email-setup-actions">
          <button type="button" className="button button-primary" onClick={onConfigure}>
            <Settings size={16} aria-hidden="true" /> Configura ora
          </button>
          <button type="button" className="button button-secondary" onClick={onClose}>Chiudi</button>
        </div>
      </section>
    </div>
  )
}
