import { HelpCircle } from 'lucide-react'

const GUIDE = {
  providerName: 'Gmail',
  accountLabel: 'Account Google',
  note: 'Google mostra la password per le app una sola volta: conservala in modo sicuro e non inserirla nei log o nei messaggi.',
  securityLink: 'https://myaccount.google.com/security',
  appPasswordsLink: 'https://myaccount.google.com/apppasswords',
}

export default function EmailGuideDialog({ api, onClose }) {
  const openExternal = (event, url) => {
    event.preventDefault()
    api?.openExternalUrl?.(url)
  }

  const guideLink = (url, label) => (
    <a className="email-guide-inline-link" href={url} onClick={(event) => openExternal(event, url)}>
      {label}
    </a>
  )

  const steps = [
    <>Apri il tuo <strong>Account Google</strong> e vai in <strong>Sicurezza</strong>.</>,
    <>Attiva la <strong>verifica in due passaggi</strong> se non è già attiva.</>,
    <>Nella stessa pagina apri <strong>Password per le app</strong> oppure {guideLink(GUIDE.appPasswordsLink, 'Password per le app Google')}, quindi conferma nuovamente l’accesso. Puoi anche usare {guideLink(GUIDE.securityLink, 'Apri la pagina di sicurezza Google')}.</>,
    <>Inserisci come nome app <strong>AVIS WhatsApp Sender</strong>, poi premi <strong>Genera</strong>.</>,
    <>Copia la password di 16 caratteri e incollala qui. Gli eventuali spazi verranno ignorati.</>,
  ]

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
            {steps.map((step, index) => <li key={index}>{step}</li>)}
          </ol>
          <div className="email-guide-note"><strong>Nota:</strong> {GUIDE.note}</div>
        </div>
        <footer className="email-guide-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>Ho capito</button>
        </footer>
      </section>
    </div>
  )
}
