import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const name = `core-financial-test-${randomUUID()}`;
const password = randomBytes(24).toString('hex');
const evidenceDir = resolve(process.env.FINANCIAL_EVIDENCE_DIR || 'docs/integration-evidence');
const env = { ...process.env, NODE_ENV: 'test', VITE_API_BASE_URL: '/api/v1', JWT_ACCESS_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'), NOTIFICATIONS_API_URL: '', NOTIFICATIONS_API_TOKEN: '', RATE_LIMIT_MAX: '10000' };
env.FINANCIAL_EVIDENCE_DIR = evidenceDir;
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
function gitShort(ref) {
  const result = spawnSync('git', ['rev-parse', '--short', ref], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}
const gitState = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' });
const workingTree = gitState.status === 0 ? (gitState.stdout.trim() ? 'modified' : 'clean') : 'unknown';
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { child?.kill(signal); cleanup(); process.exit(130); });
try {
  mkdirSync(evidenceDir, { recursive: true });
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
  await run('npm', ['run', 'test', '--workspace=@smart-campus/api', '--', '--reporter=default', '--reporter=json', `--outputFile=${resolve(evidenceDir, 'api-tests.json')}`]);
  await run('npm', ['run', 'test:web']);
  if (env.PLAYWRIGHT_MODULE) await run('node', ['scripts/financial-browser.mjs']);
  const report = JSON.parse(readFileSync(resolve(evidenceDir, 'api-tests.json'), 'utf8'));
  const baseCore = process.env.CORE_BASE_SHA || gitShort('MERGE_HEAD') || gitShort('origin/main') || gitShort('HEAD');
  writeFileSync(resolve(evidenceDir, 'summary.json'), JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), commit: gitShort('HEAD'), workingTree, baseCore, database: 'PostgreSQL 15 descartável; migrações oficiais + financeiras; seed oficial', apiPassed: report.numPassedTests, apiFailed: report.numFailedTests, web: 'passed', build: 'passed', browser: env.PLAYWRIGHT_MODULE ? 'passed' : 'not executed', success: report.success }, null, 2) + '\n');
  console.log(`Integração validada. Evidências: ${evidenceDir}.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { cleanup(); }
