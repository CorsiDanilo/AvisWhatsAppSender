function maskPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  const visibleDigits = Math.min(4, digits.length);
  return `${'*'.repeat(digits.length - visibleDigits)}${digits.slice(-visibleDigits)}`;
}

function redactDiagnosticText(value) {
  return String(value ?? '').replace(/\+?\d[\d\s().-]{6,}\d/g, (candidate) => {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length < 8 || /^\d{4}-\d{2}-\d{2}$/.test(candidate.trim())) return candidate;
    return '<PHONE>';
  });
}

module.exports = { maskPhone, redactDiagnosticText };
