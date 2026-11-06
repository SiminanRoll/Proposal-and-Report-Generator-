import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
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

test("static-only Client Compass has no DigitalOcean GHL backend", () => {
  assert.equal(existsSync(join(root, "services/ghl-read-api")), false);
});

test("static client never uses private GHL token, webhook URL, or direct GHL API", () => {
  for (const { path, code } of exposed) {
    assert.doesNotMatch(code, /NEXT_PUBLIC_(?:GHL_PRIVATE|GHL_API|GHL_WEBHOOK|LEADCONNECTOR_TOKEN)/i, path);
    assert.doesNotMatch(code, /process\.env\.GHL_PRIVATE_INTEGRATION_TOKEN/, path);
    assert.doesNotMatch(code, /process\.env\.GHL_COORDINATION_TASK_INTAKE_WEBHOOK_URL/, path);
    assert.doesNotMatch(code, /CLIENT_COMPASS_WRITER_ACCESS_TOKEN|CLIENT_COMPASS_READER_ACCESS_TOKEN/, path);
    assert.doesNotMatch(code, /services\.leadconnectorhq\.com\/hooks\//i, path);
    assert.doesNotMatch(code, /(?:from\s*|import\s*\(|require\s*\()[^\n]*services\/ghl-read-api/, path);
  }
});

test("offline preflight and task dialog never call private backend or workflow webhook", () => {
  const provider = readFileSync(join(root, "src/lib/compass/ghl-task-intake-preflight.mjs"), "utf8");
  assert.doesNotMatch(provider, /fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/);
  const dialog = readFileSync(join(root, "src/components/ghl-task-preflight-dialog.tsx"), "utf8");
  assert.doesNotMatch(dialog, /fetch\s*\(|\/api\/ghl\/|webhook-trigger\/|GhlTaskReaderPanel|GhlTaskSubmitPanel/);
  assert.match(dialog, /NEXT_PUBLIC_GHL_TASK_REQUEST_FORM_URL/);
});
