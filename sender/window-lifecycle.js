function showWindow(window, afterShow) {
  if (!window || window.isDestroyed()) return false;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  afterShow?.();
  return true;
}

function handleWindowClose(event, { isQuitting, hideWindow, audit } = {}) {
  if (isQuitting) return false;
  event?.preventDefault();
  hideWindow?.();
  audit?.('window.hidden_to_tray');
  return true;
}

module.exports = { handleWindowClose, showWindow };
