import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("A360 PDF uses distinct l and I typography without shrinking client copy", () => {
  const exporter = fs.readFileSync(path.join(root, "src/lib/prospects/a360-readable-report-export.ts"), "utf8");
  const workspace = fs.readFileSync(path.join(root, "src/components/a360-conversation-workspace.tsx"), "utf8");

  assert.match(exporter, /font-family:\"Trebuchet MS\",Tahoma,Arial,sans-serif!important/);
  assert.match(exporter, /text-rendering:geometricPrecision/);
  assert.match(exporter, /strong,b\{font-weight:700\}/);
  assert.match(exporter, /\.cover p\{font-size:12\.5pt/);
  assert.ok(!exporter.includes("Segoe UI Variable Text"), "readable A360 export should not use Segoe UI Variable Text");
  assert.ok(!exporter.includes("body{font-family:Arial,Helvetica"), "A360 body should not fall back to the ambiguous Arial-first stack");
  assert.ok(workspace.includes("printReadableA360ConversationReport"), "A360 workspace must use the readable PDF exporter");
});
