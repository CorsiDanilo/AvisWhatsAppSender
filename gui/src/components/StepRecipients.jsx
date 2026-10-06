import { useState, useMemo } from 'react'

function displayName(donor) {
  return [donor.name, donor.surname].filter(Boolean).join(' ') || 'Senza nome'
}

export default function StepRecipients({
  state,
  api,
  call,
  isRunning,
  isPaused,
  onNext,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'valid' | 'invalid'

  const selectedCount = useMemo(
    () => state.donors.filter((d) => d.selected !== false).length,
    [state.donors]
  )

  const filteredDonors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return state.donors
      .map((donor, originalIndex) => ({ ...donor, originalIndex }))
      .filter((donor) => {
        if (filterType === 'valid' && !donor.valid) return false
        if (filterType === 'invalid' && donor.valid) return false

        if (!query) return true
        const fullName = displayName(donor).toLowerCase()
        const phone = (donor.phone || donor.rawPhone || '').toLowerCase()
        return fullName.includes(query) || phone.includes(query)
      })
  }, [state.donors, searchQuery, filterType])

  return (
    <div className="step-container">
      <div className="step-intro">
        <div>
          <span className="eyebrow">Passo 1 di 3</span>
          <h2>Carica lista e seleziona donatori</h2>
          <p className="muted">
            Importa un file Excel (.xlsx/.xls) o CSV contenente le colonne <strong>Nome</strong>,{' '}
            <strong>Cognome</strong> e <strong>Telefono</strong>.
          </p>
        </div>
      </div>

      {/* File Upload Box */}
      <div className="step-file-upload-card">
        <div className="step-file-upload-left">
          <div className="upload-icon-circle">📊</div>
          <div>
            <strong>{state.fileName ? state.fileName : 'Nessun file selezionato'}</strong>
            <p className="subtle-note">
              {state.donors.length > 0
                ? `${state.donors.length} contatti importati con successo`
                : 'Formati supportati: Excel (.xlsx, .xls) o CSV'}
            </p>
          </div>
        </div>

        <div className="step-file-upload-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => call(() => api.selectCsv())}
            disabled={isRunning || isPaused}
          >
            <span>↥</span> {state.fileName ? 'Cambia file' : 'Seleziona file'}
          </button>
          {state.filePath && (
            <button
              type="button"
              className="button button-secondary"
              title="Mostra file in Esplora Risorse"
              onClick={() => api?.showItemInFolder?.(state.filePath)}
            >
              📁 Apri cartella
            </button>
          )}
        </div>
      </div>

      {/* Donors List Panel */}
      <div className="step-recipients-panel panel">
        <div className="recipients-toolbar">
          <div className="toolbar-search">
            <input
              type="text"
              placeholder="Cerca donatore o numero…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cerca donatori"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="toolbar-filters">
            <button
              type="button"
              className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              Tutti ({state.donors.length})
            </button>
            <button
              type="button"
              className={`filter-chip ${filterType === 'valid' ? 'active' : ''}`}
              onClick={() => setFilterType('valid')}
            >
              Validi ({state.donors.filter((d) => d.valid).length})
            </button>
            {state.donors.some((d) => !d.valid) && (
              <button
                type="button"
                className={`filter-chip warning ${filterType === 'invalid' ? 'active' : ''}`}
                onClick={() => setFilterType('invalid')}
              >
                Numeri non validi ({state.donors.filter((d) => !d.valid).length})
              </button>
            )}
          </div>

          <div className="toolbar-mass-actions">
            <button
              type="button"
              className="link-action-btn"
              onClick={() => call(() => api.setAllSelected(true))}
              disabled={isRunning || isPaused || state.donors.length === 0}
            >
              Seleziona tutti
            </button>
            <button
              type="button"
              className="link-action-btn"
              onClick={() => call(() => api.setAllSelected(false))}
              disabled={isRunning || isPaused || state.donors.length === 0}
            >
              Deseleziona tutti
            </button>
            <span className="count-pill">
              {selectedCount} di {state.donors.length} selezionati
            </span>
          </div>
        </div>

        {/* List Content */}
        <div className="step-recipient-list">
          {state.donors.length === 0 ? (
            <div className="empty-state-box">
              <span className="empty-icon">📋</span>
              <p>Carica un file Excel o CSV per visualizzare l'elenco dei donatori.</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => call(() => api.selectCsv())}
              >
                Seleziona file ora
              </button>
            </div>
          ) : filteredDonors.length === 0 ? (
            <div className="empty-state-box">
              <p>Nessun donatore corrisponde alla ricerca impostata.</p>
            </div>
          ) : (
            filteredDonors.map((donor) => {
              const isSelected = donor.selected !== false
              return (
                <div
                  key={`${donor.phone || donor.rawPhone}-${donor.originalIndex}`}
                  className={`recipient-card ${!donor.valid ? 'recipient-invalid' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="recipient-checkbox"
                    checked={isSelected}
                    disabled={isRunning || isPaused}
                    onChange={(e) => call(() => api.setSelection(donor.originalIndex, e.target.checked))}
                    aria-label={`Seleziona ${displayName(donor)}`}
                  />
                  <div className="avatar">{(donor.name || '?')[0].toUpperCase()}</div>
                  <div className="recipient-info">
                    <strong>{displayName(donor)}</strong>
                    <span>
                      {donor.phone || donor.rawPhone || 'Numero mancante'}
                      {!donor.valid && <em className="invalid-tag"> • Numero non valido</em>}
                    </span>
                  </div>
                  <span className={`badge badge-${donor.status}`}>
                    {donor.status === 'pending'
                      ? 'In attesa'
                      : donor.status === 'sent'
                      ? 'Inviato'
                      : donor.status === 'skipped'
                      ? 'Scartato'
                      : 'Fallito'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="step-actions-footer">
        <div />
        <button
          type="button"
          className="button button-primary next-step-btn"
          onClick={onNext}
          disabled={selectedCount === 0}
        >
          <span>Avanti: Messaggio & Ritmo</span> →
        </button>
      </div>
    </div>
  )
}
