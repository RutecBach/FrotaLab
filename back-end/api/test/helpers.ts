import { createDataSource } from '../src/persistence/data-source';
import { createApplication } from '../src/app';
import { seed } from '../src/persistence/seed';
import { randomUUID } from 'node:crypto';

export async function fixture() {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/frotalab_test';
  const admin = createDataSource();
  await admin.initialize();
  if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='frotalab_test'")).length)
    await admin.query('CREATE DATABASE frotalab_test');
  await admin.destroy();
  const ds = createDataSource(url.toString());
  await ds.initialize();
  if (!url.pathname.endsWith('_test')) throw new Error('Banco de teste inválido');
  await ds.query('DROP SCHEMA public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.runMigrations();
  await seed(ds);
  const app = await createApplication(ds, false);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function login(role = 'admin') {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${role}@frotalab.test`,
        password: process.env.SEED_PASSWORD || 'FrotaLab@2026',
      }),
    });
    const data = (await response.json()) as any;
    if (!response.ok) throw new Error(JSON.stringify(data));
    return async (path: string, method = 'GET', body?: unknown) => {
      const r = await fetch(`${base}/api${path}`, {
        method,
        headers: {
          cookie: response.headers.get('set-cookie')!.split(';')[0],
          'x-csrf-token': data.csrfToken,
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body == null ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      });
      return {
        status: r.status,
        data: (r.headers.get('content-type')?.includes('json')
          ? await r.json()
          : await r.text()) as any,
        headers: r.headers,
      };
    };
  }
  return {
    ds,
    app,
    base,
    login,
    close: async () => {
      await app.close();
      await ds.destroy();
    },
  };
}
export const key = () => randomUUID().slice(0, 8);
export const vehicle = () => ({
  plate: `TST${Math.floor(1000 + Math.random() * 9000)}`,
  model: 'Teste',
  category: 'B',
  capacityKg: 2000,
  odometer: 100,
  registrationUntil: '2035-12-31',
  insuranceUntil: '2035-12-31',
});
