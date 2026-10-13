import React, { useState } from 'react';
import { toUserError } from '../errorMessage';
import { getInitialImportMapping } from './importMapping.mjs';

function normalizePreviewName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\p{L}[\p{L}\p{M}]*/gu, (part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`);
}

function normalizePreviewHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function derivePreviewRow(row, { nameCol, surnameCol, phoneCol, oneColumnName, splitStrategy = 'lastWordIsName' }) {
  const rawName = String(row[nameCol] ?? '').trim().replace(/\s+/g, ' ');
  const parts = rawName ? rawName.split(' ') : [];
  let name = '';
  let surname = '';
  let warning = '';

  if (oneColumnName) {
    if (parts.length > 1) {
      if (splitStrategy === 'firstWordIsSurname') {
        surname = normalizePreviewName(parts.shift());
        const givenNames = normalizePreviewName(parts.join(' '));
        name = givenNames.split(' ')[0] || '';
      } else {
        name = normalizePreviewName(parts.pop());
        surname = normalizePreviewName(parts.join(' '));
      }
    } else {
      const givenNames = normalizePreviewName(parts[0] || '');
      name = givenNames;
      if (name) warning = 'Cognome non rilevato';
    }
  } else {
    const givenNames = normalizePreviewName(rawName);
    name = givenNames.split(' ')[0] || '';
    surname = normalizePreviewName(row[surnameCol]);
  }

  return {
    name,
    surname,
    phone: String(row[phoneCol] ?? '').trim() || '-',
    warning,
  };
}

function columnRole(header, phoneCol, nameCol, surnameCol, oneColumnName, customFields) {
  if (header === phoneCol) return 'Telefono';
  if (header === nameCol) return oneColumnName ? 'Nome completo' : 'Nome';
  if (header === surnameCol) return 'Cognome';
  if (customFields.includes(header) && normalizePreviewHeader(header) === 'datadinascita') return 'Data di nascita';
  return 'Campo aggiuntivo';
}

export default function ExcelPreviewModal({
  api,
  inspectionData,
  onConfirm,
  onCancel,
}) {
  const inspection = inspectionData?.inspection || {};
  const sheets = inspection.sheets || [];
  const initialMapping = getInitialImportMapping(inspection.headers, inspection.detectedMapping);
  const [currentSheet, setCurrentSheet] = useState(inspection.currentSheet || 'CSV');
  const [headers, setHeaders] = useState(inspection.headers || []);
  const [sampleRows, setSampleRows] = useState(inspection.sampleRows || []);
  const [nameCol, setNameCol] = useState(initialMapping.name);
  const [surnameCol, setSurnameCol] = useState(initialMapping.surname);
  const [phoneCol, setPhoneCol] = useState(initialMapping.phone);
  const [oneColumnName, setOneColumnName] = useState(initialMapping.nameAndSurnameInOneColumn);
  const [splitStrategy, setSplitStrategy] = useState(initialMapping.splitStrategy || 'lastWordIsName');
  const [selectedColumns, setSelectedColumns] = useState(initialMapping.selectedColumns);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [showManualMapping, setShowManualMapping] = useState(() => !initialMapping.name || !initialMapping.phone);

  const selectedMainColumns = [nameCol, phoneCol, oneColumnName ? '' : surnameCol].filter(Boolean);
  const customFields = selectedColumns.filter((column) => !selectedMainColumns.includes(column));
  const derivedRows = sampleRows.map((row) => derivePreviewRow(row, {
    nameCol,
    surnameCol,
    phoneCol,
    oneColumnName,
    splitStrategy,
  }));
  const hasNameWarnings = derivedRows.some((row) => row.warning);
  const isFormValid = Boolean(
    phoneCol &&
      nameCol &&
      selectedColumns.includes(phoneCol) &&
      selectedColumns.includes(nameCol)
  );
  const fileName = inspectionData?.filePath ? inspectionData.filePath.split(/[/\\]/).pop() : 'File';

  async function handleSheetChange(e) {
    const newSheet = e.target.value;
    setIsLoadingSheet(true);
    setSheetError('');
    try {
      const data = await api.inspectCsvSheet(inspectionData.filePath, newSheet);
      if (!data?.inspection) throw new Error('Foglio non disponibile');

      const nextInspection = data.inspection;
      const nextMapping = getInitialImportMapping(nextInspection.headers, nextInspection.detectedMapping);

      setCurrentSheet(newSheet);
      setHeaders(nextInspection.headers || []);
      setSampleRows(nextInspection.sampleRows || []);
      setNameCol(nextMapping.name);
      setSurnameCol(nextMapping.surname);
      setPhoneCol(nextMapping.phone);
      setSelectedColumns(nextMapping.selectedColumns);
      setOneColumnName(nextMapping.nameAndSurnameInOneColumn);
      setSplitStrategy(nextMapping.splitStrategy || 'lastWordIsName');
      setShowManualMapping(!nextMapping.name || !nextMapping.phone);
    } catch (err) {
      console.error(err);
      setSheetError(toUserError(err, 'import'));
    } finally {
      setIsLoadingSheet(false);
    }
  }

  function handleColumnChange(header, isChecked) {
    setSelectedColumns((current) => {
      if (isChecked) return current.includes(header) ? current : [...current, header];
      return current.filter((column) => column !== header);
    });
  }

  function handleMainColumnChange(field, value) {
    const currentValues = { name: nameCol, surname: surnameCol, phone: phoneCol };
    const setters = { name: setNameCol, surname: setSurnameCol, phone: setPhoneCol };
    const currentValue = currentValues[field];

    setters[field](value);
    if (field === 'surname' && oneColumnName) setOneColumnName(false);
    setSelectedColumns((current) => {
      const withoutPrevious = current.filter((column) => column !== currentValue);
      return value && !withoutPrevious.includes(value) ? [...withoutPrevious, value] : withoutPrevious;
    });
  }

  function handleOneColumnNameChange(isChecked) {
    setOneColumnName(isChecked);
    if (!surnameCol) return;

    setSelectedColumns((current) => {
      if (isChecked) return current.filter((column) => column !== surnameCol);
      return current.includes(surnameCol) ? current : [...current, surnameCol];
    });
  }

  function handleConfirm() {
    onConfirm(inspectionData.filePath, currentSheet, {
      name: nameCol,
      surname: surnameCol,
      phone: phoneCol,
      nameAndSurnameInOneColumn: oneColumnName,
      splitStrategy,
      customFields,
    });
  }

  return (
    <div
      className="guide-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="excel-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-preview-title"
      >
        <div className="excel-modal-header">
          <div>
            <span className="eyebrow">Configurazione colonne - Importazione</span>
            <h2 id="excel-preview-title">{fileName}</h2>
          </div>
          <button className="guide-close" onClick={onCancel} aria-label="Chiudi finestra anteprima">
            x
          </button>
        </div>

        <div className="excel-modal-body">
          {sheets.length > 1 && (
            <div className="excel-section-card excel-sheet-selector">
              <label htmlFor="excel-sheet-select">Foglio di lavoro Excel</label>
              <select
                id="excel-sheet-select"
                value={currentSheet}
                onChange={handleSheetChange}
                disabled={isLoadingSheet}
                className="excel-select"
              >
                {sheets.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet}
                  </option>
                ))}
              </select>
            </div>
          )}
          {sheetError && <div className="excel-sheet-error" role="alert">{sheetError}</div>}

          {isLoadingSheet ? (
            <div className="excel-empty-state">Caricamento e analisi del foglio in corso...</div>
          ) : headers.length === 0 ? (
            <div className="excel-section-card excel-empty-state">
              Nessuna colonna valorizzata rilevata in questo foglio. Seleziona un altro foglio o verifica il file.
            </div>
          ) : (
            <>
              <div className="excel-section-card">
                <div className="excel-section-title excel-selection-heading">
                  <span>Seleziona le colonne da importare</span>
                  <span className="excel-selection-count">{selectedColumns.length} selezionate</span>
                </div>
                <p className="excel-selection-help">
                  COGNOMEENOME e CELLULARE sono selezionate automaticamente se presenti. DATADINASCITA viene preselezionata ma resta facoltativa; le altre colonne diventano tag nel messaggio.
                </p>
                <div className="excel-mapping-tools">
                  <button type="button" className="link-btn" onClick={() => setShowManualMapping((current) => !current)}>
                    {showManualMapping ? 'Nascondi associazione colonne' : 'Modifica associazione colonne'}
                  </button>
                  <div className="excel-one-column-option">
                    <label className="excel-one-column-checkbox">
                      <input
                        type="checkbox"
                        checked={oneColumnName}
                        onChange={(e) => handleOneColumnNameChange(e.target.checked)}
                      />
                      <span>Cognome e nome nella stessa colonna</span>
                    </label>
                    {oneColumnName && (
                      <div className="excel-split-strategy-group" role="radiogroup" aria-label="Regola di estrazione nome e cognome">
                        <label className={`excel-strategy-radio ${splitStrategy === 'lastWordIsName' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="excelSplitStrategy"
                            value="lastWordIsName"
                            checked={splitStrategy === 'lastWordIsName'}
                            onChange={() => setSplitStrategy('lastWordIsName')}
                          />
                          <span><strong>Ultima parola = Nome</strong> (es. 'DE BONIS' + 'Mario')</span>
                        </label>
                        <label className={`excel-strategy-radio ${splitStrategy === 'firstWordIsSurname' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="excelSplitStrategy"
                            value="firstWordIsSurname"
                            checked={splitStrategy === 'firstWordIsSurname'}
                            onChange={() => setSplitStrategy('firstWordIsSurname')}
                          />
                          <span><strong>Prima parola = Cognome</strong> (es. 'ROSSI' + 'Maria Elena')</span>
                        </label>
                      </div>
                    )}
                  </div>
                  {showManualMapping && (
                    <div className={`excel-main-mapping-grid ${oneColumnName ? 'full-name' : ''}`}>
                      {oneColumnName ? (
                        <label>
                          <span>Nome completo <strong>*</strong></span>
                          <select
                            value={nameCol}
                            onChange={(e) => handleMainColumnChange('name', e.target.value)}
                            aria-invalid={!nameCol}
                            aria-describedby={!nameCol ? 'excel-name-error' : undefined}
                          >
                            <option value="">Seleziona colonna</option>
                            {headers.map((header) => (
                              <option key={header} value={header} disabled={header === phoneCol && header !== nameCol}>
                                {header}
                              </option>
                            ))}
                          </select>
                          {!nameCol && <span id="excel-name-error" className="excel-field-error">Seleziona la colonna del nome.</span>}
                        </label>
                      ) : (
                        <>
                          <label>
                            <span>Nome <strong>*</strong></span>
                            <select
                              value={nameCol}
                              onChange={(e) => handleMainColumnChange('name', e.target.value)}
                              aria-invalid={!nameCol}
                              aria-describedby={!nameCol ? 'excel-name-error' : undefined}
                            >
                              <option value="">Seleziona colonna</option>
                              {headers.map((header) => (
                                <option key={header} value={header} disabled={[phoneCol, surnameCol].includes(header) && header !== nameCol}>
                                  {header}
                                </option>
                              ))}
                            </select>
                            {!nameCol && <span id="excel-name-error" className="excel-field-error">Seleziona la colonna del nome.</span>}
                          </label>
                          <label>
                            <span>Cognome</span>
                            <select value={surnameCol} onChange={(e) => handleMainColumnChange('surname', e.target.value)}>
                              <option value="">Nessuna colonna</option>
                              {headers.map((header) => (
                                <option key={header} value={header} disabled={[nameCol, phoneCol].includes(header) && header !== surnameCol}>
                                  {header}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}
                      <label>
                        <span>Telefono <strong>*</strong></span>
                        <select
                          value={phoneCol}
                          onChange={(e) => handleMainColumnChange('phone', e.target.value)}
                          aria-invalid={!phoneCol}
                          aria-describedby={!phoneCol ? 'excel-phone-error' : undefined}
                        >
                          <option value="">Seleziona colonna</option>
                          {headers.map((header) => (
                            <option key={header} value={header} disabled={[nameCol, ...(oneColumnName ? [] : [surnameCol])].includes(header) && header !== phoneCol}>
                              {header}
                            </option>
                          ))}
                        </select>
                        {!phoneCol && <span id="excel-phone-error" className="excel-field-error">Seleziona la colonna del telefono.</span>}
                      </label>
                    </div>
                  )}
                </div>
                <div className="excel-column-options">
                  {headers.map((header) => {
                    const isSurnameDisabled = oneColumnName && header === surnameCol;
                    const isSelected = selectedColumns.includes(header) && !isSurnameDisabled;
                    const role = columnRole(header, phoneCol, nameCol, surnameCol, oneColumnName, customFields);

                    return (
                      <label
                        key={header}
                        className={`excel-column-option ${isSelected ? 'selected' : ''} ${isSurnameDisabled ? 'disabled' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isSurnameDisabled}
                          onChange={(e) => handleColumnChange(header, e.target.checked)}
                        />
                        <span className="excel-column-option-name">{header}</span>
                        <span className="excel-column-option-role">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="excel-section-card excel-preview-section">
                <div className="excel-section-title excel-preview-heading">
                  <span>Anteprima dati importati</span>
                  <span className="excel-preview-hint">Prime {sampleRows.length} righe dopo la normalizzazione</span>
                </div>
                {hasNameWarnings && (
                  <div className="excel-preview-warning" role="status">
                    Alcune righe non hanno un cognome rilevabile. Potrai correggerle dopo l’importazione.
                  </div>
                )}
                <div className="excel-table-wrapper">
                  <table className="excel-preview-table">
                    <thead>
                      <tr>
                        <th className="col-name">Nome</th>
                        <th className="col-name">Cognome</th>
                        <th className="col-phone">Telefono</th>
                        {customFields.map((header) => (
                          <th key={header} className="col-custom">
                            {normalizePreviewHeader(header) === 'datadinascita' ? 'Data di nascita' : header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {derivedRows.length === 0 ? (
                        <tr>
                          <td colSpan={3 + customFields.length} className="excel-table-empty">
                            Nessuna riga di dati disponibile
                          </td>
                        </tr>
                      ) : (
                        derivedRows.map((preview, index) => (
                          <tr key={index}>
                            <td>{preview.name || '-'}</td>
                            <td className={preview.warning ? 'excel-preview-warning-cell' : ''}>
                              {preview.surname || '-'}
                            </td>
                            <td>{preview.phone}</td>
                            {customFields.map((header) => (
                              <td key={header}>
                                {String(sampleRows[index][header] ?? '').trim() || '-'}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="excel-modal-footer">
          <button type="button" className="button button-secondary" onClick={onCancel}>
            Annulla
          </button>
          <div>
            {!isFormValid && <span className="excel-validation-message">Seleziona Nome e Telefono per continuare</span>}
            <button
              type="button"
              className="button button-primary"
              onClick={handleConfirm}
              disabled={!isFormValid || isLoadingSheet}
            >
              Conferma e importa donatori
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
