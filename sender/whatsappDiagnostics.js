function truncateDiagnosticText(value, maxLength = 500) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function summarizePageSnapshot(snapshot = {}) {
  return {
    url: truncateDiagnosticText(snapshot.url, 300),
    title: truncateDiagnosticText(snapshot.title, 200),
    readyState: truncateDiagnosticText(snapshot.readyState, 40),
    debugVersion: truncateDiagnosticText(snapshot.debugVersion, 100),
    online: typeof snapshot.online === 'boolean' ? snapshot.online : null,
  };
}

module.exports = { summarizePageSnapshot, truncateDiagnosticText };
