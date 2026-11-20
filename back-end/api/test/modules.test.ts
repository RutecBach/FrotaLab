import 'dotenv/config';
import { strict as a } from 'node:assert';
import { after, before, test } from 'node:test';
import { fixture, key, vehicle } from './helpers';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AuditEvent,
  Document,
  Route,
  IntegrationJob,
  Position,
  Delivery,
} from '../src/persistence/entities';
let f: Awaited<ReturnType<typeof fixture>>;
before(async () => {
  f = await fixture();
});
after(async () => {
  await f?.close();
});
test('RF08-RF10: manutenção registra serviço, custo e alerta preventivo', async () => {
  const admin = await f.login();
  const mechanic = await f.login('mecanico');
  const v = (await admin('/vehicles', 'POST', vehicle())).data;
  a.equal(
    (
      await admin('/maintenance-plans', 'POST', {
        vehicleId: v.id,
        description: 'Revisão de teste',
        dueKm: 100,
        intervalKm: 1000,
      })
    ).status,
    201,
  );
  a.ok((await admin('/alerts')).data.items.some((x: any) => x.entityId === v.id));
  const order = (
    await admin('/maintenance-orders', 'POST', {
      vehicleId: v.id,
      description: 'Troca',
      type: 'PREVENTIVE',
      blocking: true,
    })
  ).data;
  a.equal((await mechanic(`/maintenance-orders/${order.id}/start`, 'POST', {})).status, 201);
  a.equal(
    (
      await mechanic(`/maintenance-orders/${order.id}/services`, 'POST', {
        description: 'Óleo e filtro',
        parts: 'Filtro',
        partsCents: 5000,
        laborCents: 3000,
      })
    ).status,
    201,
  );
  a.equal(
    (await mechanic(`/maintenance-orders/${order.id}/complete`, 'POST', {})).data.status,
    'COMPLETED',
  );
});
test('RF13: anexo falso rejeitado e arquivo válido tem download protegido', async () => {
  const admin = await f.login();
  const driver = await f.login('motorista');
  const v = (await admin('/vehicles')).data.items[0];
  const form = (content: string) => {
    const d = new FormData();
    d.set('file', new Blob([content], { type: 'application/pdf' }), 'documento.pdf');
    d.set('vehicleId', v.id);
    d.set('type', 'REGISTRATION');
    return d;
  };
  a.equal((await admin('/documents', 'POST', form('<script>teste</script>'))).status, 400);
  const saved = await admin('/documents', 'POST', form('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'));
  a.equal(saved.status, 201);
  a.equal((await fetch(`${f.base}/api/documents/${saved.data.id}/download`)).status, 401);
  a.equal((await driver(`/documents/${saved.data.id}/download`)).status, 403);
  a.equal((await admin(`/documents/${saved.data.id}/download`)).status, 200);
});
test('RF05: coordenadas inválidas e rota alheia não entram no rastreamento', async () => {
  const driver = await f.login('motorista');
  const admin = await f.login();
  const route = (await admin('/routes')).data.items.find((r: any) => r.status === 'DRAFT');
  a.equal(
    (
      await driver('/positions', 'POST', {
        routeId: route.id,
        latitude: 200,
        longitude: 0,
        accuracy: 1,
        recordedAt: new Date().toISOString(),
        source: 'device',
      })
    ).status,
    400,
  );
  a.equal(
    (
      await driver('/positions', 'POST', {
        routeId: route.id,
        latitude: -24,
        longitude: -54,
        accuracy: 1,
        recordedAt: new Date().toISOString(),
        source: 'device',
      })
    ).status,
    403,
  );
});
test('RF11-RF12: relatórios refletem despesas e exportação tem os mesmos filtros', async () => {
  const admin = await f.login();
  const data = (await admin('/reports/financial?from=2020-01-01&to=2035-12-31')).data;
  a.ok(data.summary.totalCents >= 8000);
  const csv = await admin('/reports/financial.csv?from=2020-01-01&to=2035-12-31');
  a.equal(csv.status, 200);
  a.ok(csv.data.includes('8000') || csv.data.includes('5000'));
  a.equal((await admin('/reports/financial?from=2035-01-01&to=2020-01-01')).status, 400);
});
test('RF04-RF07 e ERP: viagem completa, posição real, despesas e reenvio idempotente', async () => {
  const admin = await f.login();
  const driver = await f.login('motorista2');
  const center = (await admin('/centers')).data.items[0];
  const person = (await admin('/drivers')).data.items.find(
    (d: any) => d.email === 'motorista2@frotalab.test',
  );
  const v = (await admin('/vehicles', 'POST', vehicle())).data;
  const delivery = (
    await admin('/deliveries', 'POST', {
      reference: `FLOW-${Date.now()}`,
      recipient: 'Destinatário de teste',
      address: 'Santa Helena',
      latitude: -24.85,
      longitude: -54.33,
      weightKg: 100,
      deadline: new Date(Date.now() + 3600000).toISOString(),
    })
  ).data;
  const route = (
    await admin('/routes', 'POST', {
      name: 'Fluxo completo de teste',
      centerId: center.id,
      scheduledStart: new Date(Date.now() - 7200000).toISOString(),
      scheduledEnd: new Date(Date.now() + 1800000).toISOString(),
      deliveryIds: [delivery.id],
    })
  ).data;
  a.equal(
    (await admin(`/routes/${route.id}/assign`, 'POST', { vehicleId: v.id, driverId: person.id }))
      .status,
    201,
  );
  a.equal((await driver(`/routes/${route.id}/start`, 'POST', { odometer: 100 })).status, 201);
  const position = await driver('/positions', 'POST', {
    routeId: route.id,
    latitude: -24.85,
    longitude: -54.33,
    accuracy: 5,
    recordedAt: new Date().toISOString(),
    source: 'device',
  });
  a.equal(position.status, 201);
  a.equal(
    (await f.ds.getRepository(Position).findOneByOrFail({ id: position.data.id })).source,
    'device',
  );
  a.equal(
    (
      await driver('/positions', 'POST', {
        routeId: route.id,
        latitude: -24.84,
        longitude: -54.33,
        accuracy: 5,
        recordedAt: new Date().toISOString(),
        source: 'device',
      })
    ).status,
    409,
  );
  a.equal(
    (
      await driver('/fuel', 'POST', {
        routeId: route.id,
        occurredAt: new Date().toISOString(),
        odometer: 110,
        liters: 20,
        totalCents: 12345,
      })
    ).status,
    201,
  );
  a.equal((await driver(`/routes/${route.id}/complete`, 'POST', { odometer: 120 })).status, 409);
  a.equal((await driver(`/deliveries/${delivery.id}/complete`, 'POST', {})).status, 201);
  a.equal((await driver(`/routes/${route.id}/complete`, 'POST', { odometer: 120 })).status, 201);
  const job = await f.ds
    .getRepository(IntegrationJob)
    .findOneByOrFail({ eventId: `route.completed:${route.id}` });
  const old = process.env.ERP_URL;
  process.env.ERP_URL = 'http://127.0.0.1:1/events';
  a.equal((await admin(`/integrations/${job.id}/retry`, 'POST', {})).data.status, 'PENDING');
  a.equal((await f.ds.getRepository(Route).findOneByOrFail({ id: route.id })).status, 'COMPLETED');
  const received = new Set<string>();
  let attempts = 0;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const data = JSON.parse(body);
    a.equal(req.headers.authorization, `Bearer ${process.env.ERP_SECRET}`);
    a.equal(req.headers['idempotency-key'], data.eventId);
    received.add(data.eventId);
    attempts++;
    res.writeHead(attempts === 1 ? 500 : 200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  process.env.ERP_URL = `http://127.0.0.1:${(server.address() as any).port}/events`;
  try {
    a.equal((await admin(`/integrations/${job.id}/retry`, 'POST', {})).data.status, 'PENDING');
    a.equal((await admin(`/integrations/${job.id}/retry`, 'POST', {})).data.status, 'SENT');
    a.equal(received.size, 1);
    a.equal(attempts, 2);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env.ERP_URL = old;
  }
});
test('RF08-RF11: manutenção avulsa pode concluir e veículo bloqueado não é disponível', async () => {
  const admin = await f.login();
  const mechanic = await f.login('mecanico');
  const v = (await admin('/vehicles', 'POST', vehicle())).data;
  const before = (await admin('/dashboard')).data.availableVehicles;
  const order = (
    await admin('/maintenance-orders', 'POST', {
      vehicleId: v.id,
      type: 'CORRECTIVE',
      description: 'Indisponibilidade de teste',
      blocking: true,
    })
  ).data;
  a.equal((await admin('/dashboard')).data.availableVehicles, before - 1);
  const plan = (
    await admin('/maintenance-plans', 'POST', {
      vehicleId: v.id,
      description: 'Revisão sem repetição',
      dueKm: 100,
    })
  ).data;
  const planned = (
    await admin('/maintenance-orders', 'POST', {
      vehicleId: v.id,
      planId: plan.id,
      type: 'PREVENTIVE',
      description: 'Revisão avulsa',
      blocking: false,
    })
  ).data;
  a.equal((await mechanic(`/maintenance-orders/${planned.id}/start`, 'POST', {})).status, 201);
  a.equal(
    (
      await mechanic(`/maintenance-orders/${planned.id}/services`, 'POST', {
        description: 'Inspeção',
        partsCents: 0,
        laborCents: 1000,
      })
    ).status,
    201,
  );
  a.equal((await mechanic(`/maintenance-orders/${planned.id}/complete`, 'POST', {})).status, 201);
  a.ok(!(await admin('/alerts')).data.items.some((x: any) => x.id === `plan:${plan.id}`));
});
test('RF08: plano aceita ativação parcial sem perder os limites de revisão', async () => {
  const admin = await f.login();
  const v = (await admin('/vehicles', 'POST', vehicle())).data;
  const plan = (
    await admin('/maintenance-plans', 'POST', {
      vehicleId: v.id,
      description: 'Plano com ativação',
      dueKm: 1000,
    })
  ).data;
  const disabled = await admin(`/maintenance-plans/${plan.id}`, 'PATCH', { active: false });
  a.equal(disabled.status, 200);
  a.equal(disabled.data.active, false);
  a.equal(disabled.data.dueKm, 1000);
  const enabled = await admin(`/maintenance-plans/${plan.id}`, 'PATCH', { active: true });
  a.equal(enabled.status, 200);
  a.equal(enabled.data.active, true);
});
test('RF12: relatório histórico mostra o estado no fim do período, sem conclusão futura', async () => {
  const admin = await f.login();
  const repo = f.ds.getRepository(Delivery);
  for (const [reference, status, deadline] of [
    ['HIST-PONTUAL', 'DELIVERED', '2026-06-03T10:00:00Z'],
    ['HIST-CANCELADA', 'CANCELLED', '2026-05-30T10:00:00Z'],
  ]) {
    await repo.save({
      reference,
      recipient: 'Teste histórico',
      address: 'Santa Helena',
      latitude: -24.85,
      longitude: -54.33,
      weightKg: 10,
      deadline: new Date(deadline),
      status,
      createdAt: new Date('2026-05-01T12:00:00Z'),
      completedAt: status === 'DELIVERED' ? new Date('2026-06-02T10:00:00Z') : null,
      cancelledAt: status === 'CANCELLED' ? new Date('2026-06-02T10:00:00Z') : null,
    });
  }
  const report = (await admin('/reports/operational?from=2026-05-01&to=2026-05-31')).data;
  for (const ref of ['HIST-PONTUAL', 'HIST-CANCELADA']) {
    const row = report.items.find((d: any) => d.reference === ref);
    a.equal(row.status, 'PENDING');
    a.equal(row.completedAt, null);
    a.equal(row.late, ref === 'HIST-CANCELADA');
  }
  const csv = await admin('/reports/operational.csv?from=2026-05-01&to=2026-05-31');
  a.ok(!csv.data.includes('DELIVERED'));
  a.ok(!csv.data.includes('CANCELLED'));
});
test('RF08: início rejeita revisão atingida pela nova leitura do hodômetro', async () => {
  const admin = await f.login();
  const driver = await f.login('motorista2');
  const v = (await admin('/vehicles', 'POST', vehicle())).data;
  const center = (await admin('/centers')).data.items[0];
  const person = (await admin('/drivers')).data.items.find(
    (d: any) => d.email === 'motorista2@frotalab.test',
  );
  await admin('/maintenance-plans', 'POST', {
    vehicleId: v.id,
    description: 'Revisão ao atingir 110 km',
    dueKm: 110,
  });
  const route = (
    await admin('/routes', 'POST', {
      name: 'Leitura inicial e revisão',
      centerId: center.id,
      scheduledStart: new Date(Date.now() + 1200000).toISOString(),
      scheduledEnd: new Date(Date.now() + 3600000).toISOString(),
      deliveryIds: [],
    })
  ).data;
  a.equal(
    (await admin(`/routes/${route.id}/assign`, 'POST', { vehicleId: v.id, driverId: person.id }))
      .status,
    201,
  );
  a.equal((await driver(`/routes/${route.id}/start`, 'POST', { odometer: 110 })).status, 409);
  a.equal((await f.ds.getRepository(Route).findOneByOrFail({ id: route.id })).status, 'ASSIGNED');
});

const pdf = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF';
function attachment(vehicleId: string, name: string, content: BlobPart = pdf) {
  const body = new FormData();
  body.set('file', new Blob([content], { type: 'application/pdf' }), name);
  body.set('vehicleId', vehicleId);
  body.set('type', 'OTHER');
  return body;
}
const delivery = (weightKg: number) => ({
  reference: `REV-${key()}`,
  recipient: 'Destinatário de teste',
  address: 'Rua de teste, 10',
  latitude: -24.85,
  longitude: -54.33,
  weightKg,
  deadline: new Date(Date.now() + 86400000).toISOString(),
});
const schedule = (hoursAhead: number) => ({
  scheduledStart: new Date(Date.now() + hoursAhead * 3600000).toISOString(),
  scheduledEnd: new Date(Date.now() + (hoursAhead + 1) * 3600000).toISOString(),
});
test('RF13: nome de arquivo acentuado é preservado no cadastro do anexo', async () => {
  const admin = await f.login();
  const v = (await admin('/vehicles')).data.items[0];
  const saved = await admin('/documents', 'POST', attachment(v.id, 'Habilitação São João.pdf'));
  a.equal(saved.status, 201);
  a.equal(saved.data.originalName, 'Habilitação São João.pdf');
});
test('RF13: anexo acima do limite é recusado com mensagem em português', async () => {
  const admin = await f.login();
  const v = (await admin('/vehicles')).data.items[0];
  const large = new Uint8Array(10 * 1024 * 1024 + 1);
  const saved = await admin('/documents', 'POST', attachment(v.id, 'grande.pdf', large));
  a.equal(saved.status, 413);
  a.equal(saved.data.message, 'Envie um arquivo de até 10 MB.');
});
test('RF13: arquivo ausente do armazenamento responde 404 no download', async () => {
  const admin = await f.login();
  const v = (await admin('/vehicles')).data.items[0];
  const saved = await admin('/documents', 'POST', attachment(v.id, 'removido.pdf'));
  const row = await f.ds.getRepository(Document).findOneByOrFail({ id: saved.data.id });
  await unlink(resolve(process.env.UPLOAD_DIR || 'storage/uploads', row.storageKey));
  const response = await admin(`/documents/${saved.data.id}/download`);
  a.equal(response.status, 404);
  a.equal(response.data.message, 'Arquivo do documento não encontrado.');
});
test('busca filtra motoristas, abastecimentos, planos e ordens de manutenção', async () => {
  const admin = await f.login();
  const drivers = (await admin('/drivers?q=Carla')).data;
  a.deepEqual(
    drivers.items.map((d: any) => d.name),
    ['Carla Mendes'],
  );
  const v = (await admin('/vehicles', 'POST', vehicle())).data;
  const mark = key();
  await admin('/maintenance-plans', 'POST', {
    vehicleId: v.id,
    description: `Plano ${mark}`,
    dueKm: 99999,
  });
  await admin('/maintenance-orders', 'POST', {
    vehicleId: v.id,
    description: `Ordem ${mark}`,
    type: 'CORRECTIVE',
    blocking: false,
  });
  a.equal((await admin(`/maintenance-plans?q=${mark}`)).data.total, 1);
  a.equal((await admin(`/maintenance-orders?q=${mark}`)).data.total, 1);
  a.equal((await admin(`/maintenance-orders?q=${v.plate}`)).data.total, 1);
  a.equal((await admin(`/maintenance-plans?q=${v.plate}`)).data.total, 1);
  a.equal((await admin(`/fuel?q=${mark}`)).data.total, 0);
});
test('RF01: edição sem mudança de senha, perfil ou situação mantém a sessão', async () => {
  const admin = await f.login();
  const name = `edicao-${key()}`;
  const account = {
    name: 'Conta original',
    email: `${name}@frotalab.test`,
    password: process.env.SEED_PASSWORD || 'FrotaLab@2026',
    role: 'OPERATOR',
  };
  const created = (await admin('/users', 'POST', account)).data;
  const session = await f.login(name);
  await admin(`/users/${created.id}`, 'PATCH', {
    name: 'Conta renomeada',
    email: account.email,
    role: 'OPERATOR',
  });
  a.equal((await session('/auth/me')).status, 200);
  await admin(`/users/${created.id}`, 'PATCH', { role: 'MANAGER' });
  a.equal((await session('/auth/me')).status, 401);
});
test('RF01: desativar a conta reflete no cadastro do motorista vinculado', async () => {
  const admin = await f.login();
  const name = `vinculo-${key()}`;
  const created = (
    await admin('/drivers', 'POST', {
      name: 'Motorista vinculado',
      email: `${name}@frotalab.test`,
      password: 'FrotaLab@2026',
      licenseNumber: `CNH${key()}`,
      categories: ['B'],
      licenseUntil: '2035-12-31',
    })
  ).data;
  a.equal((await admin(`/users/${created.userId}`, 'PATCH', { active: false })).status, 200);
  const found = (await admin('/drivers?limit=200')).data.items.find(
    (d: any) => d.id === created.id,
  );
  a.equal(found.active, false);
});
test('RF03: cancelar rota gera um único registro de auditoria com o motivo', async () => {
  const admin = await f.login();
  const center = (await admin('/centers')).data.items[0];
  const route = (
    await admin('/routes', 'POST', {
      name: 'Rota cancelada',
      centerId: center.id,
      ...schedule(30),
      deliveryIds: [],
    })
  ).data;
  a.equal((await admin(`/routes/${route.id}/cancel`, 'POST', { reason: 'Teste' })).status, 201);
  const events = await f.ds
    .getRepository(AuditEvent)
    .findBy({ entityId: route.id, action: 'CANCEL' });
  a.equal(events.length, 1);
  a.deepEqual(events[0].detail, { reason: 'Teste' });
});
test('RF03: carga cancelada não conta na capacidade do veículo', async () => {
  const admin = await f.login();
  const center = (await admin('/centers')).data.items[0];
  const person = (await admin('/drivers')).data.items.find(
    (d: any) => d.email === 'motorista2@frotalab.test',
  );
  const large = (await admin('/vehicles', 'POST', { ...vehicle(), capacityKg: 2000 })).data;
  const small = (await admin('/vehicles', 'POST', { ...vehicle(), capacityKg: 500 })).data;
  const heavy = (await admin('/deliveries', 'POST', delivery(1500))).data;
  const light = (await admin('/deliveries', 'POST', delivery(400))).data;
  const route = (
    await admin('/routes', 'POST', {
      name: 'Carga reduzida',
      centerId: center.id,
      ...schedule(40),
      deliveryIds: [heavy.id, light.id],
    })
  ).data;
  const assign = (vehicleId: string) =>
    admin(`/routes/${route.id}/assign`, 'POST', { vehicleId, driverId: person.id });
  a.equal((await assign(large.id)).status, 201);
  await admin(`/deliveries/${heavy.id}/cancel`, 'POST', { reason: 'Pedido cancelado' });
  a.equal((await assign(small.id)).status, 201);
});
test('paginação fora do intervalo seguro é recusada sem erro interno', async () => {
  const admin = await f.login();
  a.equal((await admin('/vehicles?page=99999999999999999999')).status, 400);
});
test('validação da API responde em português', async () => {
  const admin = await f.login();
  const response = await admin('/users', 'POST', {
    name: 'Senha curta',
    email: `curta-${key()}@frotalab.test`,
    password: 'curta',
    role: 'OPERATOR',
  });
  a.equal(response.status, 400);
  a.doesNotMatch(response.data.message, /Too small|expected/i);
});
