function buildWhatsAppSendOptions(options = {}) {
  return {
    ...options,
    waitUntilMsgSent: true,
    sendSeen: false,
  };
}

module.exports = { buildWhatsAppSendOptions };
