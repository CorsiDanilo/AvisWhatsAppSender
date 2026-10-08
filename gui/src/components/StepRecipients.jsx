import { useState, useMemo } from 'react'
import ExcelPreviewModal from './ExcelPreviewModal'
import {
  createEmptyRecipientDraft,
  createRecipientDraft,
  getCustomFieldKeys,
} from './recipientEditor'
import { toUserError } from '../errorMessage'

function displayName(donor) {
  return [donor.name, donor.surname].filter(Boolean).join(' ') || 'Senza nome'
}

function RecipientEditor({
  draft,
  setDraft,
  customFieldKeys,
  isAdding,
  isSaving,
  error,
  onSave,
  onCancel,
}) {
  function setField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === 'name' ? { givenNames: value } : {}),
    }))
  }

  function setCustomField(field, value) {
    setDraft((current) => ({
      ...current,
      customFields: { ...current.customFields, [field]: value },
    }))
  }

  return (
    <div className="recipient-editor">
      <div className="recipient-editor-grid">
        <label>
          Nome
          <input
            type="text"
            value={draft.name}
            onChange={(event) => setField('name', event.target.value)}
            autoFocus={isAdding}
          />
        </label>
        <label>
          Cognome
          <input
            type="text"
            value={draft.surname}
            onChange={(event) => setField('surname', event.target.value)}
          />
        </label>
        <label>
          Telefono
          <input
            type="text"
            inputMode="tel"
            value={draft.phone}
            onChange={(event) => setField('phone', event.target.value)}
          />
        </label>
        {customFieldKeys.map((field) => (
          <label key={field}>
            {field}
            <input
              type="text"
              value={draft.customFields[field] || ''}
              onChange={(event) => setCustomField(field, event.target.value)}
            />
          </label>
        ))}
      </div>
      {error && <div className="recipient-editor-error" role="alert">{error}</div>}
      <div className="recipient-editor-actions">
        <button type="button" className="button button-primary button-small" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Salvataggio…' : isAdding ? 'Aggiungi riga' : 'Salva modifiche'}
        </button>
        <button type="button" className="button button-secondary button-small" onClick={onCancel} disabled={isSaving}>
          Annulla
        </button>
      </div>
    </div>
  )
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
  const [inspectionData, setInspectionData] = useState(null)
  const [editingIndex, setEditingIndex] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editingDraft, setEditingDraft] = useState(null)
  const [editorError, setEditorError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSelectFile() {
    try {
      const data = await api.inspectCsv()
      if (data) {
        setInspectionData(data)
      }
    } catch (err) {
      console.error('Errore durante l\'ispezione del file:', err)
      alert(toUserError(err, 'import'))
    }
  }

  async function handleConfirmMapping(filePath, sheetName, mapping) {
    try {
      await call(() => api.loadCsvMapped(filePath, sheetName, mapping))
      setInspectionData(null)
    } catch (err) {
      console.error('Errore durante l\'importazione dei dati:', err)
    }
  }

  async function handleReconfigure() {
    if (!state.filePath) return
    try {
      const data = await api.inspectCsvSheet(state.filePath, state.sheetName)
      if (data) setInspectionData(data)
    } catch (err) {
      console.error('Errore durante la riapertura della configurazione:', err)
      alert(toUserError(err, 'import'))
    }
  }

  const selectedCount = useMemo(
    () => state.donors.filter((d) => d.selected !== false).length,
    [state.donors]
  )

  const customFieldKeys = useMemo(
    () => getCustomFieldKeys(state.donors),
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

  function openEditor(index) {
    setEditingIndex(index)
    setIsAdding(false)
    setEditorError('')
    setEditingDraft(createRecipientDraft(state.donors[index], customFieldKeys))
  }

  function openAddEditor() {
    setEditingIndex(null)
    setIsAdding(true)
    setEditorError('')
    setEditingDraft(createEmptyRecipientDraft(customFieldKeys))
  }

  function closeEditor() {
    setEditingIndex(null)
    setIsAdding(false)
    setEditingDraft(null)
    setEditorError('')
  }

  async function saveEditor() {
    if (!editingDraft) return
    setIsSaving(true)
    setEditorError('')
    try {
      if (isAdding) {
        await call(() => api.addDonor(editingDraft, customFieldKeys))
      } else {
        await call(() => api.updateDonor(editingIndex, editingDraft))
      }
      closeEditor()
    } catch (err) {
      setEditorError(toUserError(err))
    } finally {
      setIsSaving(false)
    }
  }

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
            onClick={handleSelectFile}
            disabled={isRunning || isPaused}
          >
            <span>↥</span> {state.fileName ? 'Cambia file' : 'Seleziona file'}
          </button>
          {state.fileName && (
            <button
              type="button"
              className="button button-secondary"
              onClick={handleReconfigure}
              disabled={isRunning || isPaused}
            >
              ⚙️ Riconfigura colonne
            </button>
          )}
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
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={openAddEditor}
              disabled={isRunning || isPaused || isAdding || editingIndex !== null}
            >
              + Aggiungi destinatario
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="step-recipient-list">
          {isAdding && editingDraft && (
            <div className="recipient-add-card">
              <div className="recipient-add-heading">
                <strong>Nuovo destinatario</strong>
                <span>I dati vengono salvati solo nella sessione corrente.</span>
              </div>
              <RecipientEditor
                draft={editingDraft}
                setDraft={setEditingDraft}
                customFieldKeys={customFieldKeys}
                isAdding
                isSaving={isSaving}
                error={editorError}
                onSave={saveEditor}
                onCancel={closeEditor}
              />
            </div>
          )}
          {!isAdding && state.donors.length === 0 ? (
            <div className="empty-state-box">
              <span className="empty-icon">📋</span>
              <p>Carica un file Excel o CSV per visualizzare l'elenco dei donatori.</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleSelectFile}
              >
                Seleziona file ora
              </button>
            </div>
          ) : !isAdding && filteredDonors.length === 0 ? (
            <div className="empty-state-box">
              <p>Nessun donatore corrisponde alla ricerca impostata.</p>
            </div>
          ) : !isAdding && (
            filteredDonors.map((donor) => {
              const isSelected = donor.selected !== false
              const isEditing = editingIndex === donor.originalIndex && editingDraft
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
                  {isEditing ? (
                    <RecipientEditor
                      draft={editingDraft}
                      setDraft={setEditingDraft}
                      customFieldKeys={customFieldKeys}
                      isAdding={false}
                      isSaving={isSaving}
                      error={editorError}
                      onSave={saveEditor}
                      onCancel={closeEditor}
                    />
                  ) : (
                    <>
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
                      <button
                        type="button"
                        className="link-action-btn recipient-edit-button"
                        onClick={() => openEditor(donor.originalIndex)}
                        disabled={isRunning || isPaused || isAdding || editingIndex !== null}
                      >
                        Modifica
                      </button>
                    </>
                  )}
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

      {inspectionData && (
        <ExcelPreviewModal
          api={api}
          inspectionData={inspectionData}
          onConfirm={handleConfirmMapping}
          onCancel={() => setInspectionData(null)}
        />
      )}
    </div>
  )
}
