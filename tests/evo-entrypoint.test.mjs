import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const get=p=>readFileSync(join(root,p),'utf8');
test('EVO project entrypoint resolves the current GitHub identity and valid context paths',()=>{
  const project=JSON.parse(get('.evo/project.json'));
  const remote=execFileSync('git',['remote','get-url','origin'],{cwd:root,encoding:'utf8'}).trim();
  const repo=remote.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/)?.[1];
  assert.ok(repo,'a GitHub origin is required');
  assert.equal(project.repository,repo,'renamed repository must be reconciled');
  assert.ok(Array.isArray(project.context)&&project.context.length>0);
  for(const file of project.context){
    const absolute=resolve(root,file);
    assert.ok(absolute.startsWith(root+sep),'context must stay inside repository');
    assert.ok(existsSync(absolute),'missing context: '+file);
  }
});
test('EVO commands are project-scoped and preserve native/manual activation boundaries',()=>{
  const checks=JSON.parse(get('.evo/checks.json')).checks;
  assert.ok(Array.isArray(checks)&&checks.length>=1);
  for(const check of checks){
    assert.ok(check.id&&Array.isArray(check.argv)&&check.argv.length>=2);
    assert.ok(['node','npm'].includes(check.argv[0]));
    assert.ok(Array.isArray(check.paths)&&check.paths.length);
  }
  const agents=get('AGENTS.md'),claude=get('CLAUDE.md');
  assert.match(agents,/evo-harness\.mjs/);
  assert.match(agents,/CONNECTOR_MANUAL/);
  assert.match(claude,/AGENTS\.md/);
  assert.equal(existsSync(join(root,'scripts/evo-harness.mjs')),false,'do not fork the shared EVO core');
});
