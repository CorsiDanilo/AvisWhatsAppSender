export function getCustomFieldKeys(donors = []) {
  return Array.from(new Set(
    donors.flatMap((donor) => Object.keys(donor.customFields || {}))
  ));
}

export function createRecipientDraft(donor = {}, customFieldKeys = []) {
  const customFields = {};
  for (const key of customFieldKeys) {
    customFields[key] = String(donor.customFields?.[key] ?? '').trim();
  }

  return {
    name: String(donor.name ?? ''),
    givenNames: String(donor.givenNames ?? donor.name ?? ''),
    surname: String(donor.surname ?? ''),
    phone: String(donor.rawPhone ?? donor.phone ?? ''),
    customFields,
  };
}

export function createEmptyRecipientDraft(customFieldKeys = []) {
  return createRecipientDraft({}, customFieldKeys);
}
