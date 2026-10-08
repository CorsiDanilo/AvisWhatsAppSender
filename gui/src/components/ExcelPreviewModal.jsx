import React, { useState } from 'react';
import { toUserError } from '../errorMessage';

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

function derivePreviewRow(row, { nameCol, surnameCol, phoneCol, oneColumnName }) {
  const rawName = String(row[nameCol] ?? '').trim().replace(/\s+/g, ' ');
  const parts = rawName ? rawName.split(' ') : [];
  let name = '';
  let surname = '';
  let warning = '';

  if (oneColumnName) {
    surname = parts.length > 1 ? normalizePreviewName(parts.pop()) : '';
    const givenNames = normalizePreviewName(parts.join(' ') || rawName);
    name = givenNames.split(' ')[0] || '';
    if (name && !surname) warning = 'Cognome non rilevato';
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
  const detectedMapping = inspection.detectedMapping || {};
  const [currentSheet, setCurrentSheet] = useState(inspection.currentSheet || 'CSV');
  const [headers, setHeaders] = useState(inspection.headers || []);
  const [sampleRows, setSampleRows] = useState(inspection.sampleRows || []);
  const [nameCol, setNameCol] = useState(detectedMapping.name || '');
  const [surnameCol, setSurnameCol] = useState(detectedMapping.surname || '');
  const [phoneCol, setPhoneCol] = useState(detectedMapping.phone || '');
  const [oneColumnName, setOneColumnName] = useState(Boolean(detectedMapping.nameAndSurnameInOneColumn));
  const [selectedColumns, setSelectedColumns] = useState(() => {
    const detectedColumns = [
      detectedMapping.name,
      detectedMapping.surname,
      detectedMapping.phone,
      ...(detectedMapping.customFields || []),
    ].filter(Boolean);
    return (inspection.headers || []).filter((header) => detectedColumns.includes(header));
  });
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [showManualMapping, setShowManualMapping] = useState(() => !detectedMapping.name || !detectedMapping.phone);

  const selectedMainColumns = [nameCol, phoneCol, oneColumnName ? '' : surnameCol].filter(Boolean);
  const customFields = selectedColumns.filter((column) => !selectedMainColumns.includes(column));
  const derivedRows = sampleRows.map((row) => derivePreviewRow(row, {
    nameCol,
    surnameCol,
    phoneCol,
    oneColumnName,
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
      const nextMapping = nextInspection.detectedMapping || {};
      const detectedColumns = [
        nextMapping.name,
        nextMapping.surname,
        nextMapping.phone,
        ...(nextMapping.customFields || []),
      ].filter(Boolean);

      setCurrentSheet(newSheet);
      setHeaders(nextInspection.headers || []);
      setSampleRows(nextInspection.sampleRows || []);
      setNameCol(nextMapping.name || '');
      setSurnameCol(nextMapping.surname || '');
      setPhoneCol(nextMapping.phone || '');
      setSelectedColumns((nextInspection.headers || []).filter((header) => detectedColumns.includes(header)));
      setOneColumnName(Boolean(nextMapping.nameAndSurnameInOneColumn));
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
                  Nome, cognome e telefono sono selezionati automaticamente. Le altre colonne selezionate saranno disponibili come tag nel messaggio.
                </p>
                <div className="excel-mapping-tools">
                  <button type="button" className="link-btn" onClick={() => setShowManualMapping((current) => !current)}>
                    {showManualMapping ? 'Nascondi associazione colonne' : 'Modifica associazione colonne'}
                  </button>
                  <div className="excel-one-column-option">
                    <label>
                      <input
                        type="checkbox"
                        checked={oneColumnName}
                        onChange={(e) => handleOneColumnNameChange(e.target.checked)}
                      />
                      <span>Nome e cognome nella stessa colonna — ultima parola = cognome</span>
                    </label>
                  </div>
                  {showManualMapping && (
                    <div className={`excel-main-mapping-grid ${oneColumnName ? 'full-name' : ''}`}>
                      {oneColumnName ? (
                        <label>
                          Nome completo <strong>*</strong>
                          <select value={nameCol} onChange={(e) => handleMainColumnChange('name', e.target.value)}>
                            <option value="">Seleziona colonna</option>
                            {headers.map((header) => (
                              <option key={header} value={header} disabled={header === phoneCol && header !== nameCol}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <>
                          <label>
                            Nome <strong>*</strong>
                            <select value={nameCol} onChange={(e) => handleMainColumnChange('name', e.target.value)}>
                              <option value="">Seleziona colonna</option>
                              {headers.map((header) => (
                                <option key={header} value={header} disabled={[phoneCol, surnameCol].includes(header) && header !== nameCol}>
                                  {header}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Cognome
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
                        Telefono <strong>*</strong>
                        <select value={phoneCol} onChange={(e) => handleMainColumnChange('phone', e.target.value)}>
                          <option value="">Seleziona colonna</option>
                          {headers.map((header) => (
                            <option key={header} value={header} disabled={[nameCol, ...(oneColumnName ? [] : [surnameCol])].includes(header) && header !== phoneCol}>
                              {header}
                            </option>
                          ))}
                        </select>
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
