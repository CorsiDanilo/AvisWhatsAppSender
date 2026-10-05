function capitalize(value) {
  const text = String(value ?? '').trim();
  return text ? `${text[0].toUpperCase()}${text.slice(1).toLowerCase()}` : '';
}

function renderTemplate(template, donor) {
  const name = capitalize(donor?.name);
  const surname = capitalize(donor?.surname);

  return String(template ?? '')
    .replaceAll('[nome]', name)
    .replaceAll('[cognome]', surname);
}

module.exports = { renderTemplate };
