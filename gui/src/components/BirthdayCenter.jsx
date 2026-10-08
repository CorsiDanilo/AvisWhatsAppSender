function displayName(donor) {
  return [donor.name, donor.surname].filter(Boolean).join(' ') || 'Senza nome'
}

function BirthdayCenter({ isOpen, state, api, call, onClose, onPrepared, onConfigure }) {
  if (!isOpen) return null

  const birthdays = state.birthdays || {}
  const matches = birthdays.matches || []
  const invalidRows = birthdays.invalidRows || []
  const isLoading = birthdays.status === 'loading'

  async function checkNow() {
    await call(() => api.checkBirthdays({ force: true, notify: false }))
  }

  async function prepare() {
    if (state.donors.length > 0) {
      const confirmed = window.confirm(
        'La lista corrente verrà sostituita con i compleanni di oggi. Vuoi continuare?'
      )
      if (!confirmed) return
    }

    const next = await call(() => api.prepareBirthdaySession())
    onPrepared(next)
    onClose()
  }

  async function postpone() {
    await call(() => api.dismissBirthdayReminder())
    onClose()
  }

  async function toggleInhibition() {
    await call(() => api.toggleBirthdayInhibition())
  }

  return (
    <div className="guide-backdrop birthday-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        className="birthday-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="birthday-dialog-title"
      >
        <header className="birthday-dialog-header">
          <div>
            <span className="eyebrow">Promemoria donatori</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 id="birthday-dialog-title" style={{ margin: 0 }}>Compleanni di oggi</h2>
              <button 
                type="button" 
                className="button button-secondary topbar-icon-btn" 
                onClick={checkNow} 
                disabled={isLoading} 
                title="Controlla ora" 
                aria-label="Controlla ora"
                style={{ padding: '4px 8px', minHeight: 'unset', fontSize: '1.1rem' }}
              >
                ↺
              </button>
            </div>
            <p className="muted birthday-dialog-date">
              {birthdays.dateKey || 'Controllo non ancora eseguito'}
            </p>
          </div>
          <button type="button" className="guide-close" onClick={onClose} aria-label="Chiudi compleanni">
            ×
          </button>
        </header>

        <div className="birthday-dialog-body">
          {birthdays.error && (
            <div className="alert" role="alert">
              {birthdays.status === 'not-configured' ? (
                <button type="button" className="link-btn birthday-configure-link" onClick={() => {
                  onClose()
                  onConfigure()
                }}>
                  Configura il file della lista compleanni.
                </button>
              ) : birthdays.error}
            </div>
          )}
          {birthdays.status === 'not-configured' && (
            <div className="birthday-empty-state">
              <strong>Lista compleanni non configurata</strong>
              <p>Seleziona il file CSV o Excel da controllare nelle Impostazioni.</p>
            </div>
          )}
          {birthdays.status === 'empty' && !birthdays.error && (
            <div className="birthday-empty-state">
              <strong>Nessun compleanno da gestire oggi</strong>
              <p>Puoi comunque aggiornare il controllo manualmente.</p>
            </div>
          )}
          {matches.length > 0 && (
            <>
              <div className="birthday-summary">
                <strong>{matches.length} {matches.length === 1 ? 'persona' : 'persone'} da ricordare</strong>
                <span>{birthdays.sourceFileName || 'Sorgente non disponibile'}</span>
              </div>
              <div className="birthday-list" aria-label="Donatori con compleanno oggi">
                {matches.map((donor, index) => (
                  <div className="birthday-row" key={`${donor.phone || donor.rawPhone || 'row'}-${index}`}>
                    <div className="birthday-row-avatar" aria-hidden="true">
                      {(donor.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="birthday-row-info">
                      <strong>{displayName(donor)}</strong>
                      <span>{donor.phone || donor.rawPhone || 'Numero mancante'}</span>
                    </div>
                    {!donor.valid && <span className="badge badge-failed">Telefono da verificare</span>}
                  </div>
                ))}
              </div>
            </>
          )}
          {invalidRows.length > 0 && (
            <p className="birthday-warning" role="status">
              {invalidRows.length} {invalidRows.length === 1 ? 'riga ha' : 'righe hanno'} una data di nascita non valida e non è stata inclusa.
            </p>
          )}
        </div>

        <footer className="birthday-dialog-footer" style={{ justifyContent: 'flex-end' }}>
          <div className="birthday-dialog-actions">
            {matches.length > 0 && (
              <button type="button" className="button button-secondary" onClick={toggleInhibition} disabled={isLoading}>
                {birthdays.sessionPrepared ? 'Riattiva avvisi compleanni' : 'Ho già inviato / Non inviare oggi'}
              </button>
            )}
            <button type="button" className="button button-primary" onClick={prepare} disabled={!matches.length || isLoading}>
              Prepara gli auguri
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export default BirthdayCenter
