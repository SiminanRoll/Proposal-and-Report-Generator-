import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("HIPAA presentation tone uses the non-null scored assessment value", () => {
  const source = readFileSync("src/components/outcome-experience.tsx", "utf8");
  assert.doesNotMatch(source, /scoreTone\(scores\.hipaa\)/);
  assert.match(source, /scoreTone\(hipaa\.overall\)/);
});
