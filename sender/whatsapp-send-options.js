function buildWhatsAppSendOptions(options = {}) {
  return {
    waitUntilMsgSent: true,
    ...options,
    sendSeen: false,
  };
}

function ensureWhatsAppSendResult(result) {
  if (result) return result;
  const error = new Error('WhatsApp non ha confermato l’invio del messaggio.');
  error.code = 'SEND_NOT_CONFIRMED';
  throw error;
}

module.exports = { buildWhatsAppSendOptions, ensureWhatsAppSendResult };
