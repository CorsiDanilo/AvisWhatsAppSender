/**
 * Sanitizes and normalizes a phone number for report recipients.
 * @param {string} raw
 * @returns {{ valid: boolean, phone: string, error: string }}
 */
export function normalizeReportPhone(raw) {
  const rawDigits = String(raw || '').replace(/\D/g, '')
  if (!rawDigits) {
    return { valid: false, phone: '', error: 'Inserisci un numero di cellulare.' }
  }

  let phone = rawDigits
  if (phone.startsWith('00')) phone = phone.slice(2)
  if (phone.length === 10 && phone.startsWith('3')) {
    phone = `39${phone}`
  }

  if (phone.length < 9) {
    return { valid: false, phone: '', error: 'Inserisci un numero di cellulare valido.' }
  }

  return { valid: true, phone, error: '' }
}

/**
 * Formats a normalized phone number for display (e.g. +39 333 123 4567).
 * @param {string} phone
 * @returns {string}
 */
export function formatReportPhoneDisplay(phone) {
  if (!phone) return ''
  const str = String(phone).trim()
  if (str.startsWith('39') && str.length === 12) {
    return `+39 ${str.slice(2, 5)} ${str.slice(5, 8)} ${str.slice(8)}`
  }
  if (str.startsWith('39')) {
    return `+39 ${str.slice(2)}`
  }
  return str
}
