import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
process.loadEnvFile('.env');
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

if (!process.env.ERP_SECRET) throw new Error('Configure ERP_SECRET.');
const root = resolve('storage/erp');
await mkdir(root, { recursive: true });
const file = resolve(root, 'events.json');
let events = {};
try {
  events = JSON.parse(await readFile(file, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
let queue = Promise.resolve();
createServer(async (req, res) => {
  const reply = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  if (req.method !== 'POST' || req.url !== '/events')
    return reply(404, { message: 'Não encontrado' });
  if (req.headers.authorization !== `Bearer ${process.env.ERP_SECRET}`)
    return reply(401, { message: 'Credencial inválida' });
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100000) return reply(413, { message: 'Evento muito grande' });
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return reply(400, { message: 'JSON inválido' });
  }
  if (
    typeof data.eventId !== 'string' ||
    data.eventId.length > 150 ||
    data.eventId !== req.headers['idempotency-key']
  )
    return reply(400, { message: 'Identificador inválido' });
  queue = queue
    .then(async () => {
      const duplicate = Object.hasOwn(events, data.eventId);
      if (!duplicate) {
        events[data.eventId] = { ...data, receivedAt: new Date().toISOString() };
        await writeFile(`${file}.tmp`, JSON.stringify(events, null, 2));
        await rename(`${file}.tmp`, file);
      }
      reply(200, { accepted: true, duplicate, eventId: data.eventId });
    })
    .catch(() => reply(500, { message: 'Falha de persistência' }));
}).listen(3002, '127.0.0.1', () =>
  console.log('ERP de demonstração disponível em 127.0.0.1:3002.'),
);
