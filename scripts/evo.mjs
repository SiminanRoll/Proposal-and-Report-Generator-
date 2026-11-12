#!/usr/bin/env node
// EVO-008: tiny project-local adapter; authoritative implementation remains external.
import { existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.EVO_HOME,
  join(dirname(projectRoot), 'captains_log'),
].filter(Boolean);
const core = candidates.map(p => resolve(p)).find(p => existsSync(join(p, 'scripts/evo-harness.mjs')));
if (!core) {
  console.error(JSON.stringify({status:'BLOCKED',reason:'EVO_CORE_NOT_FOUND',detail:'Set EVO_HOME to a checked-out authoritative SiminanRoll/captains_log repository, or place it alongside Client Compass. No bundled or stale fallback is permitted.'}));
  process.exit(2);
}
const harness = realpathSync(join(core, 'scripts/evo-harness.mjs'));
const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/evo.mjs discover|start|check|recover|... [harness options]');
  process.exit(2);
}
const result = spawnSync(process.execPath,[harness,...args,'--workspace',projectRoot,'--evo-root',core],{
  cwd:projectRoot,env:process.env,stdio:'inherit',shell:false
});
if (result.error) {console.error(result.error.message);process.exit(2);}
process.exit(result.status ?? 2);
