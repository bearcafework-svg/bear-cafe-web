/**
 * Format a date string to Thai locale with Bangkok timezone.
 * Output: "วว/ดด/ปปปป นน:นน น."
 */
export function formatThaiDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date) + ' น.';
}
