import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Signal dashboard polling pauses while hidden and dedupes overlapping loads", async () => {
  const source = await readFile("public/captains-log-dashboard/premium_app.js", "utf8");

  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /let dashboardLoadPromise=null/);
  assert.match(source, /document\.visibilityState==='hidden'/);
  assert.match(source, /document\.addEventListener\('visibilitychange'/);
  assert.match(source, /document\.visibilityState==='visible'/);
  assert.match(source, /if\(dashboardLoadPromise\)return dashboardLoadPromise/);
  assert.match(source, /dashboardLoadPromise=null/);
  assert.doesNotMatch(source, /setInterval\(load,60000\)/);
  assert.match(source, /setInterval\(refreshWhenVisible,60000\)/);
});

test("manual and range refreshes remain explicit user-triggered reads", async () => {
  const source = await readFile("public/captains-log-dashboard/premium_app.js", "utf8");

  assert.match(source, /rangeButtons[\s\S]*load\(true\)/);
  assert.match(source, /\$\('refresh'\)\.addEventListener\('click',\(\)=>load\(true\)\)/);
});
