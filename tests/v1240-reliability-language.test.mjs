import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const canonical = "Reliability & downtime prevention";
const deprecated = ["Reliability", "&", "downtime"].join(" ");

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [fullPath] : [];
  });
}

test("client-facing reliability language uses downtime prevention system-wide", () => {
  const a360 = fs.readFileSync(path.join(root, "src/lib/prospects/a360.ts"), "utf8");
  assert.ok(a360.includes(canonical), "canonical reliability priority is missing");

  const offenders = sourceFiles(srcRoot)
    .filter((file) => fs.readFileSync(file, "utf8").includes(deprecated))
    .map((file) => path.relative(root, file));

  assert.deepEqual(offenders, [], `deprecated reliability wording remains in: ${offenders.join(", ")}`);
});
