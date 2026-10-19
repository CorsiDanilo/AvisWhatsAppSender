const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_PROVIDERS = new Set(['gmail']);

function normalizeEmailRecipients(value) {
  if (!Array.isArray(value)) return [];
  return value.reduce((recipients, item, index) => {
    const email = typeof item?.email === 'string' ? item.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) return recipients;
    const label = typeof item?.label === 'string' && item.label.trim() ? item.label.trim() : 'Destinatario';
    recipients.push({
      id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `email_${index}`,
      label,
      email,
      enabled: item?.enabled !== false,
    });
    return recipients;
  }, []);
}

function normalizeEmailSettings(settings = {}) {
  const emailProvider = 'gmail';
  const hasAddressMap = settings.emailAddresses && typeof settings.emailAddresses === 'object';
  const configuredAddresses = hasAddressMap
    ? settings.emailAddresses
    : {};
  const legacyAddress = typeof settings.gmailAddress === 'string' && EMAIL_RE.test(settings.gmailAddress.trim())
    ? settings.gmailAddress.trim().toLowerCase()
    : '';
  const emailAddresses = {
    gmail: typeof configuredAddresses.gmail === 'string' && EMAIL_RE.test(configuredAddresses.gmail.trim())
      ? configuredAddresses.gmail.trim().toLowerCase() : '',
  };
  // Only migrate the legacy single-address field when the new map is absent.
  // Once a map exists, an empty provider entry is intentional and must remain empty.
  if (!hasAddressMap && (!settings.emailProvider || settings.emailProvider === 'gmail') && !emailAddresses[emailProvider] && legacyAddress) {
    emailAddresses[emailProvider] = legacyAddress;
  }
  return {
    emailNotificationsEnabled: true,
    emailProvider,
    gmailAddress: emailAddresses[emailProvider] || '',
    emailAddresses,
    emailRecipients: normalizeEmailRecipients(settings.emailRecipients),
  };
}

module.exports = { EMAIL_PROVIDERS, normalizeEmailRecipients, normalizeEmailSettings };
