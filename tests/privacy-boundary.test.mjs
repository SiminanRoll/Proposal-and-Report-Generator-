import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src", import.meta.url));
const sources = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) sources.push(fs.readFileSync(full, "utf8"));
  }
}
walk(root);
const code = sources.join("\n");

test("source processing code contains no outbound data transport", () => {
  assert.doesNotMatch(code, /\bfetch\s*\(/);
  assert.doesNotMatch(code, /XMLHttpRequest|WebSocket|sendBeacon|FormData\s*\(/);
});

test("source documents are read from browser file buffers", () => {
  assert.match(code, /file\.arrayBuffer\(\)/);
  assert.match(code, /new TextDecoder/);
});
