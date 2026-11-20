export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};
let csrf = '';
export function setCsrf(token: string) {
  csrf = token;
}
export async function api(path: string, options: { method?: string; body?: unknown } = {}) {
  const form = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {
      ...(options.body && !form ? { 'Content-Type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
    },
    body:
      options.body == null
        ? undefined
        : form
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });
  if (
    response.status === 401 &&
    typeof window !== 'undefined' &&
    window.location.pathname !== '/login'
  ) {
    window.location.assign('/login');
    throw new Error('Sessão expirada.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null)
    throw new Error(data?.message || 'Não foi possível concluir a operação.');
  return data;
}
export const roleNames: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor de frota',
  OPERATOR: 'Operador logístico',
  DRIVER: 'Motorista',
  MECHANIC: 'Mecânico',
};
export const statusNames: Record<string, string> = {
  DRAFT: 'Em planejamento',
  ASSIGNED: 'Atribuída',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  PENDING: 'Pendente',
  DELIVERED: 'Entregue',
  OPEN: 'Aberta',
  PREVENTIVE: 'Preventiva',
  CORRECTIVE: 'Corretiva',
  SENT: 'Sincronizado',
  FAILED: 'Falha',
  device: 'Dispositivo',
  demo: 'Demonstração',
  REGISTRATION: 'Documento do veículo',
  INSURANCE: 'Seguro',
  LICENSE: 'Habilitação',
  OTHER: 'Outro',
  expired: 'Vencido',
  due: 'Próximo do vencimento',
};
export const cash = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
export const when = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
export const civil = (value: string | null | undefined) =>
  value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
