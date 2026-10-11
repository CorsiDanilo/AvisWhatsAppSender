export function formatEstimatedDuration(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes} minuti`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = hours === 1 ? 'ora' : 'ore';

  if (minutes === 0) return `${hours} ${hourLabel}`;

  return `${hours} ${hourLabel} e ${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}`;
}
