import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const name = `core-financial-test-${randomUUID()}`;
const password = randomBytes(24).toString('hex');
const env = { ...process.env, NODE_ENV: 'test', VITE_API_BASE_URL: '/api/v1', JWT_ACCESS_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'), NOTIFICATIONS_API_URL: '', NOTIFICATIONS_API_TOKEN: '', RATE_LIMIT_MAX: '10000' };
let created = false;
let child;
function run(cmd, args, capture = false) {
  return new Promise((resolve, reject) => {
    child = spawn(cmd, args, { env, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let out = '';
    if (capture) child.stdout.on('data', d => out += d);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd}: ${code}`)));
  });
}
function cleanup() { if (created) { spawnSync('docker', ['rm', '-f', '-v', name], { stdio: 'ignore' }); created = false; } }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { child?.kill(signal); cleanup(); process.exit(130); });
try {
  mkdirSync('docs/integration-evidence', { recursive: true });
  await run('docker', ['run', '-d', '--rm', '--name', name, '--label', 'smart-campus.disposable-test=true', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_DB=core_financial_test', '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:15-alpine'], true);
  created = true;
  for (let i = 0; ; i++) {
    try { await run('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], true); break; }
    catch (e) { if (i >= 40) throw e; await new Promise(r => setTimeout(r, 500)); }
  }
  const address = await run('docker', ['port', name, '5432/tcp'], true);
  if (!/^127\.0\.0\.1:\d+$/.test(address)) throw Error('Porta inesperada');
  env.DATABASE_URL = `postgresql://postgres:${password}@${address}/core_financial_test`;
  await run('npm', ['run', 'db:generate']);
  await run('npm', ['run', 'db:migrate']);
  await run('npm', ['run', 'db:seed']);
  await run('npm', ['run', 'build']);
  const startedAt = new Date().toISOString();
  await run('npm', ['run', 'test', '--workspace=@smart-campus/api', '--', '--reporter=default', '--reporter=json', '--outputFile=../../docs/integration-evidence/api-tests.json']);
  await run('npm', ['run', 'test:web']);
  if (env.PLAYWRIGHT_MODULE) await run('node', ['scripts/financial-browser.mjs']);
  const report = JSON.parse(readFileSync('docs/integration-evidence/api-tests.json', 'utf8'));
  writeFileSync('docs/integration-evidence/summary.json', JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), baseCore: '3343c24', database: 'PostgreSQL 15 descartável; migrações oficiais + financeiras; seed oficial', apiPassed: report.numPassedTests, apiFailed: report.numFailedTests, web: 'passed', build: 'passed', success: report.success }, null, 2) + '\n');
  console.log('Integração validada. Evidências: docs/integration-evidence.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { cleanup(); }
