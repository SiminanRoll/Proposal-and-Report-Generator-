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
    else if (/\.(ts|tsx)$/.test(entry.name)) sources.push({ path: full, code: fs.readFileSync(full, "utf8") });
  }
}
walk(root);
const code = sources.map((row) => row.code).join("\n");
const ordinaryCode = sources.filter((row) => !row.path.endsWith(`${path.sep}captains-log-bridge.ts`)).map((row) => row.code).join("\n");
const captainsLogBridge = sources.find((row) => row.path.endsWith(`${path.sep}captains-log-bridge.ts`))?.code || "";

test("source processing code contains no outbound data transport except the explicit loopback Captain's Log bridge", () => {
  assert.doesNotMatch(ordinaryCode, /\bfetch\s*\(/);
  assert.doesNotMatch(ordinaryCode, /XMLHttpRequest|WebSocket|sendBeacon|FormData\s*\(/);
  assert.match(captainsLogBridge, /http:\/\/127\.0\.0\.1:8769\/v1\//);
  assert.doesNotMatch(captainsLogBridge, /https?:\/\/(?!127\.0\.0\.1:8769)/);
  assert.doesNotMatch(captainsLogBridge, /XMLHttpRequest|WebSocket|sendBeacon|FormData\s*\(/);
});

test("source documents are read from browser file buffers", () => {
  assert.match(code, /file\.arrayBuffer\(\)/);
  assert.match(code, /new TextDecoder/);
});
