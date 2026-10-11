function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function getInitialImportMapping(headers = [], detectedMapping = {}) {
  const avisName = headers.find((header) => normalizeHeader(header) === 'cognomeenome');
  const avisPhone = headers.find((header) => normalizeHeader(header) === 'cellulare');
  const birthDate = headers.find((header) => normalizeHeader(header) === 'datadinascita');
  const mapping = avisName && avisPhone
    ? {
      name: avisName,
      surname: '',
      phone: avisPhone,
      nameAndSurnameInOneColumn: true,
      customFields: birthDate ? [birthDate] : [],
    }
    : detectedMapping;
  const name = mapping.name || '';
  const surname = mapping.surname || '';
  const phone = mapping.phone || '';
  const nameAndSurnameInOneColumn = Boolean(mapping.nameAndSurnameInOneColumn);
  const customFields = Array.isArray(mapping.customFields) ? mapping.customFields : [];

  if (!name || !phone) {
    return {
      name: '',
      surname: '',
      phone: '',
      nameAndSurnameInOneColumn: false,
      selectedColumns: [],
    };
  }

  return {
    name,
    surname,
    phone,
    nameAndSurnameInOneColumn,
    selectedColumns: [name, ...(nameAndSurnameInOneColumn ? [] : [surname]), ...customFields, phone].filter(Boolean),
  };
}
