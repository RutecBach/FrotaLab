export function localDateTime(value: string | Date): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}
// Mesma regra de today() em back-end/api/src/rules.ts: os dois pacotes não compartilham código.
export function civilToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function initialDateTime(field: string, now = new Date()): string {
  const offset = field === 'occurredAt' ? 0 : field === 'scheduledEnd' ? 14400000 : 3600000;
  return localDateTime(new Date(Math.ceil((now.getTime() + offset) / 1000) * 1000));
}
