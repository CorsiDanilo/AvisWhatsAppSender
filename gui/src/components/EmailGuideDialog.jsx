import { ExternalLink, HelpCircle } from 'lucide-react'

const GUIDE = {
  providerName: 'Gmail',
  accountLabel: 'Account Google',
  steps: [
    <>Apri il tuo <strong>Account Google</strong> e vai in <strong>Sicurezza</strong>.</>,
    <>Attiva la <strong>verifica in due passaggi</strong> se non è già attiva.</>,
    <>Nella stessa pagina apri <strong>Password per le app</strong> e conferma nuovamente l’accesso.</>,
    <>Inserisci come nome app <strong>AVIS WhatsApp Sender</strong>, poi premi <strong>Genera</strong>.</>,
    <>Copia la password di 16 caratteri e incollala qui. Gli eventuali spazi verranno ignorati.</>,
  ],
  note: 'Google mostra la password per le app una sola volta: conservala in modo sicuro e non inserirla nei log o nei messaggi.',
  link: 'https://myaccount.google.com/security',
}

export default function EmailGuideDialog({ api, onClose }) {
  return (
    <div
      className="guide-backdrop email-guide-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="email-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="email-guide-title">
        <header className="email-guide-header">
          <div className="email-guide-title-wrap">
            <span className="email-guide-icon" aria-hidden="true"><HelpCircle size={20} /></span>
            <div>
              <span className="eyebrow">Configurazione account</span>
              <h2 id="email-guide-title">Guida password per app {GUIDE.providerName}</h2>
            </div>
          </div>
          <button type="button" className="guide-close" onClick={onClose} aria-label="Chiudi guida password per app">&times;</button>
        </header>
        <div className="email-guide-body">
          <p className="email-guide-intro">
            Segui questi passaggi nell’{GUIDE.accountLabel}. La password per app è diversa dalla password principale e serve per autorizzare l’invio SMTP.
          </p>
          <ol className="email-guide-steps">
            {GUIDE.steps.map((step, index) => <li key={index}>{step}</li>)}
          </ol>
          <div className="email-guide-note"><strong>Nota:</strong> {GUIDE.note}</div>
          <a
            className="email-guide-link"
            href={GUIDE.link}
            onClick={(event) => {
              event.preventDefault()
              api?.openExternalUrl?.(GUIDE.link)
            }}
          >
            <ExternalLink size={15} aria-hidden="true" /> Apri la pagina di sicurezza Google
          </a>
        </div>
        <footer className="email-guide-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>Ho capito</button>
        </footer>
      </section>
    </div>
  )
}
