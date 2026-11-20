import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
process.loadEnvFile('.env');

const databaseDir = resolve('database/data');
mkdirSync(resolve('database'), { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'frotalab',
  password: 'frotalab_local',
  port: 54320,
  persistent: true,
  autoRehydrateSymlinks: true,
  onLog: () => {},
  onError: (message) => {
    if (!String(message).includes('NOTICE')) console.error(String(message));
  },
});
if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = 'frotalab'")).rowCount)
  await client.query('CREATE DATABASE frotalab');
await client.end();
console.log(
  'PostgreSQL disponível em 127.0.0.1:54320. Dados preservados em back-end/database/data.',
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60000);
