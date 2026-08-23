import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = path.join(root, "public", "captains-log-dashboard");
const read = (name) => fs.readFileSync(path.join(dashboard, name), "utf8");
const index = read("index.html");
const premium = read("premium.js");
const app = read("premium_app.js");
const polish = read("dashboard-polish.js");
const version = JSON.parse(read("version.json"));

test("the public dashboard directory remains the authoritative static surface", () => {
  assert.equal(fs.existsSync(dashboard), true);
  assert.match(index, /data-dashboard-version="1\.2\.76"/);
  assert.equal(version.version, "1.2.76");
  assert.match(index, /premium\.js\?v=1\.2\.76/);
});

test("dashboard authentication remains on the existing protected Supabase boundary", () => {
  assert.match(premium, /const PUBLISHABLE_KEY='sb_publishable_/);
  assert.match(premium, /server-runner-dashboard-web/);
  assert.match(premium, /Authorization:'Bearer '\+s\.access_token/);
  assert.match(premium, /grant_type=password/);
  assert.match(premium, /grant_type=refresh_token/);
  assert.match(premium, /document\.querySelector\('\.shell'\).*display','none'/);
  assert.doesNotMatch(premium, /SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|OSS_WEBHOOK_SECRET|SERVER_RUNNER_DASHBOARD_SECRET/);
});

test("all existing Detail Dashboard views remain present", () => {
  for (const view of ["overview", "opportunities", "social", "permits", "npi", "intent", "runs"]) {
    assert.match(index, new RegExp(`data-view="${view}"`));
    assert.match(index, new RegExp(`id="${view}"`));
  }
});

test("the five supported ranges and refresh behavior remain stable", () => {
  for (const days of [1, 7, 30, 90, 365]) assert.match(index, new RegExp(`data-days="${days}"`));
  assert.match(app, /fetch\(`\/api\/status\?days=\$\{S\.days\}`/);
  assert.match(app, /setInterval\(load,60000\)/);
  assert.match(app, /cache:'no-store'/);
});

test("legacy bubble values remain hidden from user-facing tier copy", () => {
  assert.match(polish, /replace\(\/\\bBUBBLE\\b\/g,'WARM'\)/);
  assert.match(polish, /lead-tag\.bubble/);
  assert.match(polish, /classList\.add\('warm'\)/);
});
