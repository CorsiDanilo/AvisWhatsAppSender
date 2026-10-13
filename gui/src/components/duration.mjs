export function formatEstimatedDuration(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes} minuti`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = hours === 1 ? 'ora' : 'ore';

  if (minutes === 0) return `${hours} ${hourLabel}`;

  return `${hours} ${hourLabel} e ${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}`;
}

/**
 * Formats a number of remaining seconds as a human-readable Italian string.
 * Used for the live ETA indicator in the sending dashboard.
 *
 * @param {number} totalSeconds - Estimated seconds remaining (non-negative integer).
 * @returns {string} Formatted string, e.g. "Meno di un minuto", "~ 3 minuti", "~ 1 ora e 20 minuti".
 */
export function formatRemainingTime(totalSeconds) {
  if (totalSeconds <= 0) return 'Quasi terminato…';
  if (totalSeconds < 60) return 'Meno di un minuto';

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `~ ${totalMinutes} ${totalMinutes === 1 ? 'minuto' : 'minuti'}`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = hours === 1 ? 'ora' : 'ore';

  if (minutes === 0) return `~ ${hours} ${hourLabel}`;
  return `~ ${hours} ${hourLabel} e ${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}`;
}
