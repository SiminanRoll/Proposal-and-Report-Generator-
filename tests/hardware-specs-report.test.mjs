import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const specs = await transpileTestModule("../src/lib/outcomes/hardware-specs.ts", import.meta.url);
const presentation = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const pdfSource = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const pdfRenderer = fs.readFileSync(new URL("../src/lib/outcomes/client-inventory-pdf.ts", import.meta.url), "utf8");

test("CPU labels retain important model while removing redundant vendor/clock strings", () => {
  assert.equal(specs.compactCpuModel("Intel(R) Core(TM) i5-10500 CPU @ 3.10GHz"), "i5-10500");
  assert.equal(specs.compactCpuModel("Intel Core Ultra 7 155H"), "Core Ultra 7 155H");
  assert.equal(specs.compactCpuModel("AMD Ryzen 7 5700U with Radeon Graphics"), "Ryzen 7 5700U");
  assert.equal(specs.compactCpuModel("Intel(R) Xeon(R) CPU E5-2690 v4 @ 2.60GHz"), "Xeon E5-2690 v4");
  assert.equal(specs.compactCpuModel("Intel Xeon Gold 6230R"), "Xeon Gold 6230R");
  assert.equal(specs.compactCpuModel("Apple M2"), "Apple M2");
  assert.equal(specs.compactCpuModel(""), "");
});

test("RAM uses compact capacity units without guessing when its source is missing", () => {
  assert.equal(specs.compactRam("16GB"), "16 GB");
  assert.equal(specs.compactRam("16.00 GB RAM"), "16 GB");
  assert.equal(specs.compactRam("16,384 MB"), "16 GB");
  assert.equal(specs.compactRam("8192 MiB"), "8 GB");
  assert.equal(specs.compactRam("32 GB DDR4"), "32 GB DDR4");
  assert.equal(specs.compactRam(""), "");
});

test("THR presentation restores CPU and RAM in the former GPU column without adding a new column", () => {
  const header = presentation.match(/<th>Device<\/th>.*?<th>Age status<\/th>/s)?.[0];
  assert.ok(header, "THR hardware inventory header is available");
  assert.equal((header.match(/<th>/g) ?? []).length, 10, "no new columns / horizontal overflow");
  assert.match(header, /<th>CPU \/ RAM<\/th>/);
  assert.doesNotMatch(header, /<th>Video card<\/th>/);
  assert.match(presentation, /compactCpuModel\(device\.cpu\)/);
  assert.match(presentation, /compactRam\(device\.ram\)/);
  assert.match(presentation, /className="presentation-compute-specs"/);
  assert.match(presentation, /className="presentation-model-gpu"/, "GPU remains visible inside model cell");
});

test("PDF also restores CPU and RAM without widening or adding columns", () => {
  assert.match(pdfSource, /cpu: compactCpuModel\(device\.cpu\)/);
  assert.match(pdfSource, /ram: compactRam\(device\.ram\)/);
  assert.match(pdfRenderer, /<th>Equipment \/ specs<\/th>/);
  assert.match(pdfRenderer, /CPU \$\{cellText\(row\.cpu, "—"\)\} · RAM \$\{cellText\(row\.ram, "—"\)\}/);
  assert.equal((pdfRenderer.match(/<th>/g) ?? []).length, 5, "five-column PDF table stays five columns");
});
