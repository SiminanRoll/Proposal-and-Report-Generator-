import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const src = join(root, "src");
const exposed = [];
const SOURCE_EXT = /\.(?:tsx?|jsx?|mjs)$/;
function walk(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
      exposed.push({ path: relative(root, path), code: readFileSync(path, "utf8") });
    }
  }
}
walk(src);

test("no browser-app source imports server-only GHL adapter or Node service", () => {
  for (const { path, code } of exposed) {
    assert.doesNotMatch(code, /(?:from\s*|import\s*\(|require\s*\()[^\n]*services\/ghl-read-api/,
      path + " must not bundle server-only GHL credentials");
    assert.doesNotMatch(code, /(?:from\s*|import\s*\(|require\s*\()[^\n]*ghl-provider\.mjs/,
      path + " must not bundle the GHL token adapter");
  }
});

test("no client-side access to the private GHL key or an exposed NEXT_PUBLIC token", () => {
  for (const { path, code } of exposed) {
    assert.doesNotMatch(code, /NEXT_PUBLIC_(?:GHL|LEADCONNECTOR)/i, path);
    assert.doesNotMatch(code, /process\.env\.GHL_PRIVATE_INTEGRATION_TOKEN/, path);
    assert.doesNotMatch(code, /process\.env\[\s*["']GHL_PRIVATE_INTEGRATION_TOKEN["']\s*\]/, path);
  }
});

test("standalone GHL provider cannot accidentally gain a task-write path", () => {
  const provider = readFileSync(join(root, "services/ghl-read-api/ghl-provider.mjs"), "utf8");
  assert.doesNotMatch(provider, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
  assert.doesNotMatch(provider, /fetch\s*\(\s*["']https?:\/\//);
  assert.match(provider, /method:\s*["']GET["']/);
});

test("preflight remains local and existing workflow is the only intended task writer", () => {
  const provider = readFileSync(join(root, "src/lib/compass/ghl-task-intake-preflight.mjs"), "utf8");
  assert.doesNotMatch(provider, /fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/);
  const handler = readFileSync(join(root, "services/ghl-read-api/handler.mjs"), "utf8");
  assert.doesNotMatch(handler, /createTask|addTask|workflowTrigger/);
});
