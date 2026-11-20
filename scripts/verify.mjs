import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await mkdir('.cache/checks', { recursive: true });
const steps = [
  ['rules', 'back-end', ['-r', 'ts-node/register', '--test', 'api/test/rules.test.ts']],
  [
    'api',
    'back-end',
    ['-r', 'ts-node/register', '--test', '--test-concurrency=1', 'api/test/api.test.ts'],
  ],
  [
    'modules',
    'back-end',
    ['-r', 'ts-node/register', '--test', '--test-concurrency=1', 'api/test/modules.test.ts'],
  ],
  ['api-build', 'back-end', ['node_modules/typescript/bin/tsc']],
  ['web-build', 'front-end', ['../scripts/next.mjs', 'build']],
  ['browser', 'front-end', ['node_modules/@playwright/test/cli.js', 'test']],
];
const results = [];
const testCounts = {};
for (const [name, directory, args] of steps) {
  const begun = Date.now();
  let log = '';
  const child = spawn(process.execPath, args, {
    windowsHide: true,
    cwd: join(root, directory),
    env: {
      ...process.env,
      INTEGRATION_WORKER: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const code = await new Promise((resolve) => child.on('exit', resolve));
  await writeFile(`.cache/checks/${name}.log`, log);
  const plain = log.replace(/\x1b\[[0-9;]*m/g, '');
  const count = plain.match(/tests (\d+)/)?.[1] ?? plain.match(/(\d+) passed/)?.[1];
  if (count) testCounts[name] = Number(count);
  results.push({
    name,
    exitCode: code,
    durationSeconds: Math.round((Date.now() - begun) / 1000),
    log: `.cache/checks/${name}.log`,
  });
  console.log(`${name}: ${code === 0 ? 'PASS' : 'FAIL'} (${results.at(-1).durationSeconds}s)`);
}
const report = {
  checkedAt: new Date().toISOString(),
  timezone: 'America/Sao_Paulo',
  allPassed: results.every((r) => r.exitCode === 0),
  results,
  testCounts,
  totalTests: Object.values(testCounts).reduce((total, count) => total + count, 0),
};
await mkdir('docs/verificacao', { recursive: true });
await writeFile('docs/verificacao/verificacao.json', JSON.stringify(report, null, 2));
if (!report.allPassed) process.exitCode = 1;
