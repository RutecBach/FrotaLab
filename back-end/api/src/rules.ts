export function today(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day'].map((k) => parts.find((p) => p.type === k)!.value).join('-');
}
export function expiryState(date: string, now = new Date()): 'expired' | 'due' | 'valid' {
  const current = today(now);
  if (date < current) return 'expired';
  const threshold = new Date(`${current}T12:00:00-03:00`);
  threshold.setUTCDate(threshold.getUTCDate() + 30);
  return date <= today(threshold) ? 'due' : 'valid';
}
export function deliveryLate(
  d: { status: string; deadline: string | Date; completedAt?: string | Date | null },
  now = new Date(),
): boolean {
  return (
    d.status !== 'CANCELLED' &&
    new Date(d.status === 'DELIVERED' ? d.completedAt! : now).getTime() >
      new Date(d.deadline).getTime()
  );
}
export function csvCell(value: unknown): string {
  let s = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
