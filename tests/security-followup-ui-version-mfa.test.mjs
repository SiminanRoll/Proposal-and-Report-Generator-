import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));

test("every visible build number is derived from the patch-bumped package", () => {
  const pkg = json("../package.json");
  const lock = json("../package-lock.json");
  const source = read("../src/lib/app-version.ts");
  const appShell = read("../src/components/app-shell.tsx");
  const presentation = read("../src/components/outcome-experience.tsx");
  assert.equal(pkg.version, "1.3.15");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.match(source, /import packageMetadata from "..\/..\/package.json"/);
  assert.match(source, /export const APP_VERSION = packageMetadata\.version/);
  assert.match(appShell, /v\{APP_VERSION\}/);
  assert.match(presentation, /Application version \$\{APP_VERSION\}/);
  assert.match(presentation, /v\{APP_VERSION\}/);
});

test("SEC-04 covers both local-server and cloud practice software with clear MFA guidance", () => {
  const questions = read("../src/lib/hipaa/questions.ts");
  const sec04 = questions.match(/id: "SEC-04"[\s\S]*?(?=\n  \},\n  \{\n    id: "SEC-05")/)?.[0] || "";
  assert.ok(sec04);
  assert.match(sec04, /title: "Practice software access and MFA"/);
  assert.match(sec04, /\[\[core-software\]\]/);
  assert.match(sec04, /cloud-hosted software and sign-ins from outside the office/);
  assert.match(sec04, /Local server access may work differently/);
  assert.match(sec04, /Cloud-hosted practice software and offsite access should use MFA/);
  assert.match(sec04, /ask your software vendor to enable it/);
  assert.match(sec04, /"Is the practice-management system local or cloud-hosted\?"/);
  assert.match(sec04, /regulationMappings: \["45 CFR 164\.312\(d\)"\]/);
});

test("open security items use integrated cards, not bright white questionnaire forms", () => {
  const editor = read("../src/components/security-follow-up-owner-editor.tsx");
  const css = read("../src/components/security-review-premium.module.css");
  const recap = read("../src/components/hipaa-presentation.tsx");
  assert.match(recap, /<h2>Next steps<\/h2>/);
  assert.match(recap, /\{advantageFollowUps\} Advantage/);
  assert.match(recap, /\{clientFollowUps\} Your team/);
  assert.match(editor, /aria-pressed=\{owner === "advantage"\}/);
  assert.match(editor, /aria-pressed=\{owner === "client"\}/);
  assert.match(editor, /owner === "client" \? "Your team to confirm" : "Advantage to verify"/);
  assert.match(editor, /onBlur=\{commitAction\}/);
  assert.match(editor, /dirty && draft !== answer\.recommendedAction/);
  assert.match(css, /\.followUpOwnerCard\{[^\n]*rgba\(234,251,255,\.10\)/);
  assert.match(css, /\.followUpOwnerCard\[data-owner="client"\]/);
  assert.match(css, /@media\(max-width:800px\)\{\.followUpRoutingGrid\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(css, /\.followUpOwnerCard\{[^\n]*background:#f5faff/);
});

test("owner changes preserve an unsaved drafted action in a single update", () => {
  const editor = read("../src/components/security-follow-up-owner-editor.tsx");
  assert.match(editor, /const pendingText = dirty && draft !== answer\.recommendedAction \? \{ recommendedAction: draft \} : \{\}/);
  assert.match(editor, /\{ \.\.\.pendingText, \.\.\.patch \}/);
  assert.match(editor, /onClick=\{\(\) => update\(\{ followUpOwner: "client" \}\)\}/);
});
