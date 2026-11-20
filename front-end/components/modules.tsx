import { cash, civil, when, roleNames, statusNames } from '../lib/api';
export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
  hint?: string;
};
export type ModuleConfig = {
  title: string;
  description: string;
  singular: string;
  roles: string[];
  write: string[];
  fields: Field[];
  columns: { label: string; key: string; render?: (r: any) => React.ReactNode }[];
  editable?: boolean;
};
const manage = ['ADMIN', 'MANAGER'];
const dispatch = ['ADMIN', 'OPERATOR'];
const all = ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER', 'MECHANIC'];
const column = (key: string, label: string, render?: (r: any) => React.ReactNode) => ({
  key,
  label,
  render,
});
export const badge = (value: string) => (
  <span className={`badge badge-${value.toLowerCase()}`}>{statusNames[value] || value}</span>
);
const options = (values: string[]) =>
  values.map((value) => ({ value, label: statusNames[value] || value }));
export const modules: Record<string, ModuleConfig> = {
  vehicles: {
    title: 'Veículos',
    description: 'Cada veículo, seu histórico e sua disponibilidade.',
    singular: 'veículo',
    roles: all,
    write: manage,
    editable: true,
    fields: [
      { key: 'plate', label: 'Placa' },
      { key: 'model', label: 'Modelo' },
      {
        key: 'category',
        label: 'Categoria exigida',
        type: 'select',
        options: options(['A', 'B', 'C', 'D', 'E']),
      },
      { key: 'capacityKg', label: 'Capacidade (kg)', type: 'number' },
      { key: 'odometer', label: 'Hodômetro (km)', type: 'number', default: 0 },
      { key: 'registrationUntil', label: 'Documento válido até', type: 'date' },
      { key: 'insuranceUntil', label: 'Seguro válido até', type: 'date' },
    ],
    columns: [
      column('plate', 'Veículo', (r) => (
        <div className="cell-primary">
          <strong>{r.plate}</strong>
          <small>{r.model}</small>
        </div>
      )),
      column('category', 'Categoria'),
      column('odometer', 'Hodômetro', (r) => `${r.odometer.toLocaleString('pt-BR')} km`),
      column('capacityKg', 'Capacidade', (r) => `${r.capacityKg.toLocaleString('pt-BR')} kg`),
      column('insuranceUntil', 'Seguro até', (r) => civil(r.insuranceUntil)),
      column('active', 'Situação', (r) => (
        <span className={`badge ${r.active ? 'badge-completed' : 'badge-cancelled'}`}>
          {r.active ? 'Ativo' : 'Desativado'}
        </span>
      )),
    ],
  },
  drivers: {
    title: 'Motoristas',
    description: 'Pessoas habilitadas para colocar a operação em movimento.',
    singular: 'motorista',
    roles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    write: manage,
    editable: true,
    fields: [
      { key: 'name', label: 'Nome completo' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'password', label: 'Senha inicial', type: 'password' },
      { key: 'licenseNumber', label: 'Número da habilitação' },
      {
        key: 'categories',
        label: 'Categorias habilitadas',
        type: 'multi',
        options: options(['A', 'B', 'C', 'D', 'E']),
      },
      { key: 'licenseUntil', label: 'Habilitação válida até', type: 'date' },
    ],
    columns: [
      column('name', 'Motorista', (r) => (
        <div className="cell-primary">
          <strong>{r.name}</strong>
          <small>{r.email}</small>
        </div>
      )),
      column('licenseNumber', 'Habilitação'),
      column('categories', 'Categorias', (r) => r.categories.join(', ')),
      column('licenseUntil', 'Válida até', (r) => civil(r.licenseUntil)),
      column('active', 'Situação', (r) => (r.active ? 'Ativo' : 'Desativado')),
    ],
  },
  centers: {
    title: 'Centros de distribuição',
    description: 'Os pontos de partida das suas entregas.',
    singular: 'centro',
    roles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    write: manage,
    editable: true,
    fields: [
      { key: 'name', label: 'Nome do centro' },
      { key: 'address', label: 'Endereço' },
      { key: 'latitude', label: 'Latitude', type: 'decimal', default: -24.8589 },
      { key: 'longitude', label: 'Longitude', type: 'decimal', default: -54.3333 },
    ],
    columns: [
      column('name', 'Centro', (r) => (
        <div className="cell-primary">
          <strong>{r.name}</strong>
          <small>{r.address}</small>
        </div>
      )),
      column('latitude', 'Latitude'),
      column('longitude', 'Longitude'),
      column('active', 'Situação', (r) => (r.active ? 'Ativo' : 'Desativado')),
    ],
  },
  routes: {
    title: 'Rotas',
    description: 'Planeje paradas e distribua os recursos da operação.',
    singular: 'rota',
    roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER'],
    write: dispatch,
    editable: true,
    fields: [
      { key: 'name', label: 'Nome da rota' },
      { key: 'centerId', label: 'Centro de origem', type: 'select' },
      { key: 'scheduledStart', label: 'Início previsto', type: 'datetime-local' },
      { key: 'scheduledEnd', label: 'Fim previsto', type: 'datetime-local' },
      {
        key: 'deliveryIds',
        label: 'Entregas e ordem das paradas',
        type: 'ordered',
        required: false,
      },
    ],
    columns: [
      column('name', 'Rota', (r) => (
        <div className="cell-primary">
          <strong>{r.name}</strong>
          <small>{r.center?.name || 'Centro de distribuição'}</small>
        </div>
      )),
      column('driverName', 'Motorista', (r) => r.driverName || 'Não atribuído'),
      column('vehicle', 'Veículo', (r) => r.vehicle?.plate || 'Não atribuído'),
      column('scheduledStart', 'Saída prevista', (r) => when(r.scheduledStart)),
      column('deliveries', 'Paradas', (r) => r.deliveries.length),
      column('status', 'Situação', (r) => badge(r.status)),
    ],
  },
  deliveries: {
    title: 'Entregas',
    description: 'Do prazo combinado ao registro de conclusão.',
    singular: 'entrega',
    roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER'],
    write: dispatch,
    editable: true,
    fields: [
      { key: 'reference', label: 'Referência' },
      { key: 'recipient', label: 'Destinatário' },
      { key: 'address', label: 'Endereço de entrega' },
      { key: 'latitude', label: 'Latitude', type: 'decimal', default: -24.8589 },
      { key: 'longitude', label: 'Longitude', type: 'decimal', default: -54.3333 },
      { key: 'weightKg', label: 'Peso (kg)', type: 'number' },
      { key: 'deadline', label: 'Prazo de entrega', type: 'datetime-local' },
    ],
    columns: [
      column('reference', 'Entrega', (r) => (
        <div className="cell-primary">
          <strong>{r.reference}</strong>
          <small>{r.recipient}</small>
        </div>
      )),
      column('address', 'Destino'),
      column('weightKg', 'Peso', (r) => `${r.weightKg} kg`),
      column('deadline', 'Prazo', (r) => when(r.deadline)),
      column('status', 'Situação', (r) => (
        <div className="badge-pair">
          {badge(r.status)}
          {r.late && <span className="badge badge-late">Atrasada</span>}
        </div>
      )),
    ],
  },
  fuel: {
    title: 'Abastecimentos',
    description: 'Registros da viagem que compõem os custos da frota.',
    singular: 'abastecimento',
    roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER'],
    write: ['ADMIN', 'DRIVER'],
    fields: [
      { key: 'routeId', label: 'Rota em andamento', type: 'select' },
      { key: 'occurredAt', label: 'Data do abastecimento', type: 'datetime-local' },
      { key: 'odometer', label: 'Hodômetro (km)', type: 'number' },
      { key: 'liters', label: 'Litros', type: 'decimal' },
      { key: 'totalCents', label: 'Valor total (R$)', type: 'money' },
      { key: 'station', label: 'Posto', required: false },
    ],
    columns: [
      column('occurredAt', 'Data', (r) => when(r.occurredAt)),
      column('station', 'Posto', (r) => r.station || 'Não informado'),
      column('odometer', 'Hodômetro', (r) => `${r.odometer} km`),
      column('liters', 'Volume', (r) => `${r.liters} L`),
      column('totalCents', 'Valor', (r) => <strong>{cash(r.totalCents)}</strong>),
    ],
  },
  'maintenance-plans': {
    title: 'Revisões preventivas',
    description: 'Antecipe revisões por data e quilometragem.',
    singular: 'plano de revisão',
    roles: ['ADMIN', 'MANAGER', 'MECHANIC', 'OPERATOR'],
    write: manage,
    editable: true,
    fields: [
      { key: 'vehicleId', label: 'Veículo', type: 'select' },
      { key: 'description', label: 'Descrição da revisão' },
      { key: 'dueDate', label: 'Próxima revisão em', type: 'date', required: false },
      { key: 'dueKm', label: 'Próxima revisão (km)', type: 'number', required: false },
      { key: 'intervalDays', label: 'Repetir a cada (dias)', type: 'number', required: false },
      { key: 'intervalKm', label: 'Repetir a cada (km)', type: 'number', required: false },
      { key: 'active', label: 'Plano ativo', type: 'checkbox', default: true },
    ],
    columns: [
      column('description', 'Revisão'),
      column('vehiclePlate', 'Veículo'),
      column('dueDate', 'Data limite', (r) => civil(r.dueDate)),
      column('dueKm', 'Quilometragem limite', (r) => (r.dueKm == null ? '—' : `${r.dueKm} km`)),
    ],
  },
  'maintenance-orders': {
    title: 'Manutenções',
    description: 'Ordens de serviço e o cuidado diário com cada veículo.',
    singular: 'manutenção',
    roles: ['ADMIN', 'MANAGER', 'MECHANIC', 'OPERATOR'],
    write: manage,
    fields: [
      { key: 'vehicleId', label: 'Veículo', type: 'select' },
      { key: 'planId', label: 'Plano preventivo vinculado', type: 'select', required: false },
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: options(['PREVENTIVE', 'CORRECTIVE']),
      },
      { key: 'description', label: 'Descrição do problema' },
      {
        key: 'blocking',
        label: 'Veículo indisponível durante o serviço',
        type: 'checkbox',
        default: true,
      },
    ],
    columns: [
      column('description', 'Ordem de serviço', (r) => (
        <div className="cell-primary">
          <strong>{r.description}</strong>
          <small>
            {r.vehicle?.plate} · {r.vehicle?.model}
          </small>
        </div>
      )),
      column('type', 'Tipo', (r) => statusNames[r.type]),
      column('blocking', 'Disponibilidade', (r) =>
        r.blocking && r.status !== 'COMPLETED' ? 'Imobilizado' : 'Sem bloqueio',
      ),
      column('services', 'Custo registrado', (r) =>
        cash(r.services.reduce((t: number, s: any) => t + s.partsCents + s.laborCents, 0)),
      ),
      column('status', 'Situação', (r) => badge(r.status)),
    ],
  },
  users: {
    title: 'Usuários',
    description: 'Contas e permissões de cada pessoa na operação.',
    singular: 'usuário',
    roles: ['ADMIN'],
    write: ['ADMIN'],
    editable: true,
    fields: [
      { key: 'name', label: 'Nome completo' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'password', label: 'Senha inicial', type: 'password' },
      {
        key: 'role',
        label: 'Perfil de acesso',
        type: 'select',
        options: Object.entries(roleNames).map(([value, label]) => ({ value, label })),
      },
    ],
    columns: [
      column('name', 'Pessoa', (r) => (
        <div className="cell-primary">
          <strong>{r.name}</strong>
          <small>{r.email}</small>
        </div>
      )),
      column('role', 'Perfil', (r) => roleNames[r.role]),
      column('active', 'Situação', (r) => (r.active ? 'Ativo' : 'Desativado')),
    ],
  },
};
