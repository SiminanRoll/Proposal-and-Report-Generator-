import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const config = fs.readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const store = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");

test("Next.js is configured for a static export", () => {
  assert.match(config, /output:\s*"export"/);
  assert.match(config, /trailingSlash:\s*true/);
  assert.doesNotMatch(config, /standalone/);
});

test("there are no server API routes or Docker deployment files", () => {
  assert.equal(fs.existsSync(new URL("../src/app/api", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../Dockerfile", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../.dockerignore", import.meta.url)), false);
  assert.equal(packageJson.scripts.start, undefined);
});

test("local projects can be backed up and restored", () => {
  assert.match(store, /exportProjectsBackup/);
  assert.match(store, /importProjectsBackup/);
  assert.match(store, /localStorage/);
});

test("build copies the PDF worker into the static public output", () => {
  assert.match(packageJson.scripts.build, /prepare:pdf-worker/);
  assert.ok(packageJson.scripts["prepare:pdf-worker"]);
  assert.equal(fs.existsSync(new URL("../scripts/copy-pdf-worker.mjs", import.meta.url)), true);
});
