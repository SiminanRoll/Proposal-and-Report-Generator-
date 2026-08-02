import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const forbiddenExtensions = new Set([".py", ".pyw", ".bat", ".ps1"]);
const forbidden = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (forbiddenExtensions.has(path.extname(entry.name).toLowerCase())) forbidden.push(full);
  }
}
walk(fileURLToPath(new URL("..", import.meta.url)));

test("web source contains no Python or launcher scripts", () => {
  assert.deepEqual(forbidden, []);
});
