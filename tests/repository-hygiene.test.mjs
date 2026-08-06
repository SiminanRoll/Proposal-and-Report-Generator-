import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootFiles = fs.readdirSync(root);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("repository root contains no generated build metadata or patch-note sprawl", () => {
  assert.equal(rootFiles.some((name) => /^VERSION_/.test(name)), false);
  assert.equal(rootFiles.some((name) => /_VERIFICATION\.txt$/.test(name)), false);
  assert.equal(rootFiles.includes("tsconfig.tsbuildinfo"), false);
  assert.equal(rootFiles.includes("CHANGELOG.md"), true);
});

test("retired hosted-sharing cleanup code is not part of the build", () => {
  assert.equal(fs.existsSync(path.join(root, "scripts", "clean-legacy-sharing.mjs")), false);
  assert.doesNotMatch(packageJson.scripts.build, /legacy-sharing/);
  assert.equal("postinstall" in packageJson.scripts, false);
});

test("declared package versions are pinned or use deterministic local compatibility packages", () => {
  for (const [name, version] of Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
    const exactVersion = /^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version);
    const localCompatibilityPackage = /^file:vendor\/[a-z0-9._-]+$/i.test(version);
    assert.equal(exactVersion || localCompatibilityPackage, true, `${name} should use an exact version or a deterministic vendor path`);
  }
});

test("the obsolete zod lint dependency chain is removed from the lockfile", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(packageJson.devDependencies["zod-validation-error"], undefined);
  assert.equal(packageJson.devDependencies["eslint-config-next"], undefined);
  assert.equal(lock.packages["node_modules/zod"], undefined);
  assert.equal(lock.packages["node_modules/zod-validation-error"], undefined);
  assert.match(packageJson.scripts.lint, /scripts\/lint\.mjs/);
});

test("repository includes professional contribution and quality controls", () => {
  assert.equal(fs.existsSync(path.join(root, ".editorconfig")), true);
  assert.equal(fs.existsSync(path.join(root, "LICENSE")), true);
  assert.equal(fs.existsSync(path.join(root, ".github", "workflows", "quality.yml")), true);
  assert.equal(fs.existsSync(path.join(root, "CONTRIBUTING.md")), true);
  assert.equal(fs.existsSync(path.join(root, "SECURITY.md")), true);
});

test("source does not retain patch-era version comments or obsolete handoff shims", () => {
  const css = fs.readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");
  const hipaaQuestions = fs.readFileSync(path.join(root, "src", "lib", "hipaa", "questions.ts"), "utf8");
  assert.doesNotMatch(css, /\/\*\s*v1\.0\./i);
  assert.doesNotMatch(hipaaQuestions, /hipaaClientHandoffQuestions/);
});


test("DigitalOcean uses the npm bundled with the selected Node runtime", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.engines?.node, "22.x");
  assert.equal(packageJson.engines?.npm, undefined);
  assert.equal(packageJson.packageManager, undefined);
});
