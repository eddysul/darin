// Read-only aggregate inventory. Never prints object names, URLs or user data.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { QA_PROJECT_REF, PRODUCTION_PROJECT_REF, resolvePsqlBinary } from './lib/qa-project-config.mjs';
const target = process.argv[2];
if (!['qa', 'production'].includes(target)) throw new Error('expected qa or production');
const ref = target === 'qa' ? QA_PROJECT_REF : PRODUCTION_PROJECT_REF;
const user = target === 'qa' ? process.env.SUPABASE_DB_USER : 'postgres';
const host = target === 'qa' ? process.env.SUPABASE_DB_HOST : `db.${ref}.supabase.co`;
if (!process.env.SUPABASE_DB_PASSWORD || !host || !user ||
    (target === 'qa' ? !user.includes(ref) : process.env.SUPABASE_PROJECT_REF !== ref)) {
  throw new Error('database identity guard failed');
}
const result = spawnSync(resolvePsqlBinary(), ['-X', '-At', '-v', 'ON_ERROR_STOP=1'], {
  input: readFileSync(new URL('./fixtures/b04b-storage-preflight.sql', import.meta.url), 'utf8'),
  encoding: 'utf8', env: { ...process.env, PGHOST: host, PGUSER: user,
    PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, PGDATABASE: 'postgres',
    PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15',
    PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=30000' },
});
if (result.status !== 0) throw new Error(`read-only preflight failed: ${result.stderr}`);
console.log(JSON.stringify({ target, project: ref }));
console.log(result.stdout.trim());
