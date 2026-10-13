function capitalize(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\p{L}[\p{L}\p{M}]*/gu, (part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`);
}

function renderTemplate(template, donor) {
  const name = capitalize(donor?.name);
  const surname = capitalize(donor?.surname);

  let rendered = String(template ?? '')
    .replaceAll('[nome]', name)
    .replaceAll('[cognome]', surname);

  if (donor?.customFields) {
    for (const [key, value] of Object.entries(donor.customFields)) {
      rendered = rendered.replaceAll(`[${key}]`, value);
    }
  }

  return rendered;
}

module.exports = { renderTemplate };
