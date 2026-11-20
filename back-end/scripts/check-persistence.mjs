import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
process.loadEnvFile('.env');
import pg from 'pg';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const tables = ['users', 'vehicles', 'drivers', 'routes', 'deliveries', 'documents'];
  const rows = {};
  for (const table of tables)
    rows[table] = (await client.query(`SELECT id FROM ${table} ORDER BY id`)).rows.map((r) => r.id);
  const documents = (await client.query('SELECT id,"storageKey" FROM documents')).rows;
  const files = {};
  for (const doc of documents) {
    if (!/^[a-f0-9-]{36}\.(pdf|png|jpe?g)$/.test(doc.storageKey))
      throw new Error('Chave de documento inválida.');
    files[doc.id] = createHash('sha256')
      .update(await readFile(resolve(process.env.UPLOAD_DIR || 'storage/uploads', doc.storageKey)))
      .digest('hex');
  }
  const snapshot = { rows, files };
  await mkdir('../.cache/tmp', { recursive: true });
  if (process.argv[2] === 'snapshot') {
    await writeFile('../.cache/tmp/persistence-snapshot.json', JSON.stringify(snapshot));
    console.log('Referência de persistência salva.');
  } else {
    const before = JSON.parse(await readFile('../.cache/tmp/persistence-snapshot.json', 'utf8'));
    const recordsPreserved = tables.every((t) =>
      before.rows[t].every((id) => rows[t].includes(id)),
    );
    const filesPreserved = Object.entries(before.files).every(([id, hash]) => files[id] === hash);
    const report = {
      checkedAt: new Date().toISOString(),
      recordsPreserved,
      filesPreserved,
      countsBefore: Object.fromEntries(tables.map((t) => [t, before.rows[t].length])),
      countsAfter: Object.fromEntries(tables.map((t) => [t, rows[t].length])),
      documentsChecked: Object.keys(before.files).length,
    };
    await mkdir('../docs/verificacao', { recursive: true });
    await writeFile('../docs/verificacao/persistencia.json', JSON.stringify(report, null, 2));
    if (!recordsPreserved || !filesPreserved) throw new Error('Falha de persistência.');
    console.log('Reinicialização validada: registros e anexos preservados.');
  }
} finally {
  await client.end();
}
