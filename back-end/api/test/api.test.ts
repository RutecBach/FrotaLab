import 'dotenv/config';
import { strict as a } from 'node:assert';
import { after, before, test } from 'node:test';
import { fixture, vehicle, key } from './helpers';
import { Vehicle, Driver, User } from '../src/persistence/entities';
import { seed } from '../src/persistence/seed';
import { createDataSource } from '../src/persistence/data-source';
let f: Awaited<ReturnType<typeof fixture>>;
before(async () => {
  f = await fixture();
});
after(async () => {
  await f?.close();
});

test('RF01: autenticação real, bloqueio por perfil, CSRF e logout revogam sessão', async () => {
  a.equal((await fetch(`${f.base}/api/vehicles`)).status, 401);
  const driver = await f.login('motorista');
  a.equal((await driver('/users')).status, 403);
  const manager = await f.login('gestor');
  a.equal((await manager('/vehicles', 'POST', vehicle())).status, 201);
  const admin = await f.login();
  a.equal((await admin('/auth/logout', 'POST', {})).status, 201);
  a.equal((await admin('/auth/me')).status, 401);
});
test('RF02: veículo persiste e placa duplicada é recusada', async () => {
  const admin = await f.login();
  const payload = vehicle();
  const created = await admin('/vehicles', 'POST', payload);
  a.equal(created.status, 201);
  a.equal((await admin('/vehicles', 'POST', payload)).status, 409);
  a.equal(
    (await f.ds.getRepository(Vehicle).findOneByOrFail({ id: created.data.id })).plate,
    payload.plate,
  );
  const reopened = createDataSource((f.ds.options as any).url);
  await reopened.initialize();
  try {
    a.equal(
      (await reopened.getRepository(Vehicle).findOneByOrFail({ id: created.data.id })).plate,
      payload.plate,
    );
  } finally {
    await reopened.destroy();
  }
  a.equal(
    (await admin(`/vehicles/${created.data.id}`, 'PATCH', { active: false })).data.active,
    false,
  );
});
test('RF03-RF04: vencimento e concorrência não permitem atribuições inválidas', async () => {
  const admin = await f.login();
  const centers = (await admin('/centers')).data.items;
  const drivers = (await admin('/drivers')).data.items;
  const v = (await admin('/vehicles', 'POST', vehicle())).data;
  const input = {
    name: `Rota ${key()}`,
    centerId: centers[0].id,
    scheduledStart: new Date(Date.now() + 3600000).toISOString(),
    scheduledEnd: new Date(Date.now() + 7200000).toISOString(),
    deliveryIds: [],
  };
  const r1 = (await admin('/routes', 'POST', input)).data;
  const r2 = (await admin('/routes', 'POST', input)).data;
  const expired = drivers.find((d: any) => d.licenseUntil < new Date().toISOString().slice(0, 10));
  a.equal(
    (await admin(`/routes/${r1.id}/assign`, 'POST', { vehicleId: v.id, driverId: expired.id }))
      .status,
    409,
  );
  const d = drivers.find((d: any) => d.email === 'motorista2@frotalab.test');
  const results = await Promise.all(
    [r1, r2].map((r) =>
      admin(`/routes/${r.id}/assign`, 'POST', { vehicleId: v.id, driverId: d.id }),
    ),
  );
  a.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  a.equal((await admin(`/vehicles/${v.id}`, 'PATCH', { active: false })).status, 409);
  a.equal((await admin(`/drivers/${d.id}`, 'PATCH', { active: false })).status, 409);
  a.equal((await admin(`/users/${d.userId}`, 'PATCH', { active: false })).status, 409);
});
test('RF06-RF07: motorista não opera rota alheia e abastecimento valida valores', async () => {
  const admin = await f.login();
  const driver = await f.login('motorista');
  const routes = (await admin('/routes')).data.items;
  const foreign = routes.find((r: any) => r.status === 'DRAFT');
  a.equal((await driver(`/routes/${foreign.id}/start`, 'POST', { odometer: 100 })).status, 403);
  a.equal(
    (
      await driver('/fuel', 'POST', {
        routeId: foreign.id,
        occurredAt: new Date().toISOString(),
        odometer: 100,
        liters: -1,
        totalCents: 100,
      })
    ).status,
    400,
  );
});
test('gestor não altera conta promovida por meio do antigo cadastro de motorista', async () => {
  const admin = await f.login();
  const manager = await f.login('gestor');
  const alias = `promoted-${key()}`;
  const created = await admin('/drivers', 'POST', {
    name: 'Motorista promovido',
    email: `${alias}@frotalab.test`,
    password: 'FrotaLab@2026',
    licenseNumber: `LIC-${key()}`,
    categories: ['B'],
    licenseUntil: '2035-12-31',
  });
  a.equal(created.status, 201);
  a.equal((await admin(`/users/${created.data.userId}`, 'PATCH', { role: 'ADMIN' })).status, 200);
  a.equal(
    (
      await manager(`/drivers/${created.data.id}`, 'PATCH', {
        password: 'Takeover@2026',
        email: `changed-${alias}@frotalab.test`,
      })
    ).status,
    403,
  );
  const account = (await admin('/users')).data.items.find((u: any) => u.id === created.data.userId);
  a.equal(account.email, `${alias}@frotalab.test`);
  a.equal(account.role, 'ADMIN');
});
test('alteração da senha pelo cadastro de motorista revoga as sessões existentes', async () => {
  const admin = await f.login();
  const manager = await f.login('gestor');
  const alias = `reset-${key()}`;
  const created = (
    await admin('/drivers', 'POST', {
      name: 'Motorista de teste',
      email: `${alias}@frotalab.test`,
      password: 'FrotaLab@2026',
      licenseNumber: `LIC-${key()}`,
      categories: ['B'],
      licenseUntil: '2035-12-31',
    })
  ).data;
  const session = await f.login(alias);
  a.equal((await session('/auth/me')).status, 200);
  a.equal(
    (await manager(`/drivers/${created.id}`, 'PATCH', { password: 'NovaSenha@2026' })).status,
    200,
  );
  a.equal((await session('/auth/me')).status, 401);
});
test('carga inicial preserva dados depois de alterar o e-mail do administrador', async () => {
  const admin = await f.login();
  const account = (await admin('/auth/me')).data.user;
  const usersBefore = await f.ds.getRepository(User).count();
  const vehiclesBefore = await f.ds.getRepository(Vehicle).count();
  a.equal(
    (await admin(`/users/${account.id}`, 'PATCH', { email: `renamed-${key()}@frotalab.test` }))
      .status,
    200,
  );
  try {
    await seed(f.ds);
    a.equal(await f.ds.getRepository(User).count(), usersBefore);
    a.equal(await f.ds.getRepository(Vehicle).count(), vehiclesBefore);
  } finally {
    await f.ds.getRepository(User).update(account.id, { email: 'admin@frotalab.test' });
  }
});
