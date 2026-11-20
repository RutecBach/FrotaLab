import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const backend = join(root, 'back-end');
const frontend = join(root, 'front-end');
process.chdir(root);
if (!existsSync(join(backend, '.env'))) {
  const setup = spawn(process.execPath, ['scripts/configure.mjs'], {
    stdio: 'inherit',
    cwd: backend,
    windowsHide: true,
  });
  await once(setup, 'exit');
}
process.loadEnvFile(join(backend, '.env'));
const children = [];
let stopping = false;
function start(args, cwd = backend) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    windowsHide: true,
    cwd,
  });
  children.push(child);
  child.on('exit', (code) => {
    if (code && !stopping) {
      console.error(`Um serviço encerrou com código ${code}.`);
      void stop();
    }
  });
  return child;
}
async function available() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 1000,
  });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children.reverse()) {
    if (process.platform === 'win32')
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(), 1000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
if (!(await available())) {
  start(['database/start.mjs']);
  let ready = false;
  for (let n = 0; n < 30; n++) {
    await delay(1000);
    if (await available()) {
      ready = true;
      break;
    }
  }
  if (!ready) throw new Error('PostgreSQL indisponível. Verifique DATABASE_URL ou inicie o banco.');
}
const prepare = start(['-r', 'ts-node/register', 'api/src/persistence/prepare.ts']);
const [code] = await once(prepare, 'exit');
if (code) process.exit(code);
start(['scripts/erp-demo.mjs']);
start(['-r', 'ts-node/register', 'api/src/main.ts']);
start([join(root, 'scripts/next.mjs'), 'dev'], frontend);
console.log(
  `FrotaLab: http://localhost:3000 · API: http://localhost:${process.env.API_PORT || 3001}/api/docs`,
);
