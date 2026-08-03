import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const engine = fs.readFileSync(new URL("../src/lib/hipaa/engine.ts", import.meta.url), "utf8");

test("HIPAA completion screen imports the answer completeness helper it calls", () => {
  assert.match(presentation, /import\s*\{[\s\S]*?answerIsComplete[\s\S]*?\}\s*from\s*["']@\/lib\/hipaa\/engine["']/);
  assert.match(presentation, /\.filter\(answerIsComplete\)/);
  assert.match(engine, /export function answerIsComplete\(/);
});
