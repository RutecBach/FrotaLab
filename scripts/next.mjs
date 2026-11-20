// Executa o Next com as opções de front-end/package.json, sem depender do pnpm.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const frontend = fileURLToPath(new URL('../front-end/', import.meta.url));
const name = process.argv[2];
const manifest = `${frontend}package.json`;
const command = JSON.parse(readFileSync(manifest, 'utf8')).scripts[name];
if (!command?.startsWith('next ')) throw new Error(`Script do Next desconhecido: ${name}`);
process.chdir(frontend);
const require = createRequire(manifest);
const bin = require.resolve('next/dist/bin/next');
process.argv = [process.argv[0], bin, ...command.split(/\s+/).slice(1)];
require(bin);
