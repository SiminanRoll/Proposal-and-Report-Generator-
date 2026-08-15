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
const ordinaryCode = sources.filter((row) => !row.path.endsWith(`${path.sep}captains-log-cloud.ts`)).map((row) => row.code).join("\n");
const captainsLogCloud = sources.find((row) => row.path.endsWith(`${path.sep}captains-log-cloud.ts`))?.code || "";
const technologyPublisher = sources.find((row) => row.path.endsWith(`${path.sep}company-technology-summary-runtime.tsx`))?.code || "";

test("source processing code has one explicit authenticated Supabase transport and no legacy Desktop bridge", () => {
  assert.doesNotMatch(ordinaryCode, /\bfetch\s*\(/);
  assert.doesNotMatch(ordinaryCode, /XMLHttpRequest|WebSocket|sendBeacon|FormData\s*\(/);
  assert.match(captainsLogCloud, /auth\/v1\/token/);
  assert.match(captainsLogCloud, /rest\/v1/);
  assert.doesNotMatch(captainsLogCloud, /XMLHttpRequest|WebSocket|sendBeacon|FormData\s*\(/);
  assert.doesNotMatch(code, /client_compass_request|client_compass_response|127\.0\.0\.1:8769|captainslog:\/\//);
});

test("shared technology publishing is aggregate-only", () => {
  assert.match(technologyPublisher, /healthy_count/);
  assert.match(technologyPublisher, /planning_count/);
  assert.match(technologyPublisher, /replace_count/);
  assert.match(technologyPublisher, /estimated_replacement_need/);
  assert.match(technologyPublisher, /last_quote_date/);
  assert.doesNotMatch(technologyPublisher, /device_name|serial_number|ip_address|os_name|model_name/);
});

test("source documents are read from browser file buffers", () => {
  assert.match(code, /file\.arrayBuffer\(\)/);
  assert.match(code, /new TextDecoder/);
});
