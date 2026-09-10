import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const codecSource = fs.readFileSync(new URL("../src/lib/projects/storage-codec.ts", import.meta.url), "utf8");
const storeSource = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");
const versionSource = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

function base64DataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
}

async function loadCodec() {
  const transpiled = ts.transpileModule(codecSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(base64DataUrl(transpiled));
}

test("large project JSON compresses and round-trips without losing report data", async () => {
  const { encodeProjectStorage, decodeProjectStorage, isCompressedProjectStorage } = await loadCodec();
  const projects = Array.from({ length: 80 }, (_, projectIndex) => ({
    schemaVersion: 2,
    id: `project-${projectIndex}`,
    type: "client-report",
    client: { name: `Dental Practice ${projectIndex}` },
    sources: Array.from({ length: 3 }, (_, sourceIndex) => ({
      kind: sourceIndex === 0 ? "scalepad-pdf" : "huntress-pdf",
      files: [{
        id: `file-${projectIndex}-${sourceIndex}`,
        analysis: {
          sourceType: sourceIndex === 0 ? "scalepad" : "huntress",
          rawTextPreview: "Royal Oak Dental monthly security and lifecycle summary. ".repeat(90),
          facts: Array.from({ length: 30 }, (_, factIndex) => ({
            key: `fact.${factIndex}`,
            value: `Repeated device and security evidence ${factIndex} for project ${projectIndex}`,
          })),
        },
      }],
    })),
    intelligence: {
      facts: Array.from({ length: 100 }, (_, factIndex) => ({
        key: `inventory.${factIndex}`,
        value: JSON.stringify({
          name: `PC-${factIndex}`,
          model: "OptiPlex 7090",
          os: "Windows 11 Pro",
          location: "Main Office",
          lifecycleStatus: factIndex % 4 === 0 ? "overdue" : "current",
        }),
      })),
    },
  }));
  const raw = JSON.stringify(projects);
  assert.ok(raw.length > 96 * 1024, "fixture must cross the compression threshold");

  const encoded = encodeProjectStorage(raw);
  assert.equal(isCompressedProjectStorage(encoded), true);
  assert.ok(encoded.length < raw.length * 0.7, `expected meaningful compression: ${encoded.length} vs ${raw.length}`);
  assert.equal(decodeProjectStorage(encoded), raw);
});

test("codec preserves unicode client/report text", async () => {
  const { encodeProjectStorage, decodeProjectStorage } = await loadCodec();
  const raw = JSON.stringify({
    client: "Clínica Dental — São José",
    summary: "HIPAA review ✓ · café · résumé · 日本語 ".repeat(5000),
  });
  const encoded = encodeProjectStorage(raw);
  assert.equal(decodeProjectStorage(encoded), raw);
});

test("project store reads compressed payloads, cleans stale legacy storage, and retries quota writes", () => {
  assert.match(storeSource, /decodeProjectStorage\(raw\)/);
  assert.match(storeSource, /encodeProjectStorage\(raw\)/);
  assert.match(storeSource, /isQuotaExceeded/);
  assert.match(storeSource, /window\.localStorage\.removeItem\(LEGACY_KEY\)/);
  assert.match(storeSource, /browser workspace is full/);
  assert.match(storeSource, /Your existing reports were kept intact/);
});

test("release advances to v1.2.95", () => {
  assert.match(versionSource, /1\.2\.95/);
});
