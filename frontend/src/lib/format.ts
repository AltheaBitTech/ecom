/** Money is stored in the smallest currency unit (cents/paise) end to end. */
export function formatMoney(cents: number, currency = 'INR', locale = 'en-IN'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** Human-readable date/time for admin lists and order detail. */
export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: opts ? undefined : 'short',
    ...opts,
  }).format(value);
}
