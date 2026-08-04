import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const proposal = await readFile(new URL("../src/components/proposal-experience.tsx", import.meta.url), "utf8");

test("section-kicker icons have bounded dimensions", () => {
  assert.match(css, /\.section-kicker\s*>\s*svg\s*\{[^}]*width:\s*15px[^}]*height:\s*15px[^}]*flex:\s*0\s+0\s+15px/s);
});

test("proposal pricing still uses the bounded section-kicker icon", () => {
  assert.match(proposal, /className="section-kicker"\s*>\s*<SparkIcon\s*\/>\s*Proposal pricing/);
});
