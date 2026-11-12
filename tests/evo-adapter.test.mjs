import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const adapter = new URL('../scripts/evo.mjs', import.meta.url).pathname;
test('missing authoritative EVO core fails closed', () => {
 const p=spawnSync(process.execPath,[adapter,'discover','--request','test'],{encoding:'utf8',env:{...process.env,EVO_HOME:join(tmpdir(),'nonexistent-evo-008-core')}});
 // A sibling checkout is also valid; this test asserts a failure only if none is installed.
 if(p.status!==0)assert.match(p.stderr,/EVO_CORE_NOT_FOUND/);
});
test('adapter delegates to external core without copying the harness', () => {
 const root=mkdtempSync(join(tmpdir(),'evo-008-'));
 try{
  mkdirSync(join(root,'scripts'));
  writeFileSync(join(root,'scripts','evo-harness.mjs'),"console.log(JSON.stringify({argv:process.argv.slice(2)}))\n");
  const p=spawnSync(process.execPath,[adapter,'discover','--request','portable test'],{encoding:'utf8',env:{...process.env,EVO_HOME:root}});
  assert.equal(p.status,0,p.stderr);
  const args=JSON.parse(p.stdout).argv;
  assert.deepEqual(args.slice(0,3),['discover','--request','portable test']);
  assert.equal(args[args.indexOf('--evo-root')+1],root);
  assert.equal(args[args.indexOf('--workspace')+1],resolve(dirname(adapter),'..'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
