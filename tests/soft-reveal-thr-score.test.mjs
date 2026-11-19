import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const ui = read("../src/components/hipaa-presentation.tsx");
const css = read("../src/components/security-review-premium.module.css");
const scoreSource = read("../src/lib/outcomes/client-report-score.ts");
const pdfSource = read("../src/lib/outcomes/export-html.ts");
const presentationSource = read("../src/components/outcome-experience.tsx");

async function scoringUnderTest() {
  const ts = (await import("typescript")).default;
  const strippedImports = scoreSource.replace(/^import[^\n]*\n/gm, "");
  const js = ts.transpileModule(strippedImports, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText;
  const stubs = 