import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
if (!existsSync('.env')) {
  const content = readFileSync('.env.example', 'utf8')
    .replace(
      'replace-with-a-random-secret-of-at-least-32-characters',
      randomBytes(32).toString('hex'),
    )
    .replace('replace-with-a-local-demonstration-secret', randomBytes(24).toString('hex'));
  writeFileSync('.env', content, { mode: 0o600 });
  console.log('Configuração local criada com segredos aleatórios.');
} else console.log('Configuração existente preservada.');
