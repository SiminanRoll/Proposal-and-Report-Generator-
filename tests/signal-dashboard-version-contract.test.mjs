import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Signal Intelligence uses one release version for manifest, shell, and asset cache keys", async () => {
  const version = JSON.parse(await readFile("public/captains-log-dashboard/version.json", "utf8"));
  const html = await readFile("public/captains-log-dashboard/index.html", "utf8");
  const escaped = version.version.replaceAll(".", "\\.");

  assert.equal(version.version, "1.2.87");
  assert.equal(version.release, "performance-and-version-reconciliation");
  assert.match(html, new RegExp(`data-dashboard-version="${escaped}"`));
  assert.match(html, new RegExp(`<b>v${escaped}</b>`));
  assert.doesNotMatch(html, /1\.2\.80/);

  const cacheVersions = [...html.matchAll(/[?&]v=([0-9.]+)/g)].map(match => match[1]);
  assert.ok(cacheVersions.length >= 10, "expected versioned dashboard assets");
  assert.deepEqual([...new Set(cacheVersions)], [version.version]);
});
