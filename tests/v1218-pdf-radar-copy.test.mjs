import test from "node:test";
import assert from "node:assert/strict";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const { RADAR_ATTENTION_COPY, sanitizeClientPdfCopy } = await transpileTestModule(
  "../src/lib/outcomes/client-pdf-copy.ts",
  import.meta.url,
  { prefix: "client-compass-pdf-copy" },
);

test("client PDF sanitizer removes the blanket good-shape claim", () => {
  const legacy = "<p>Most of the environment is in good shape. The items below deserve attention over time so they can be addressed thoughtfully and before they create unnecessary disruption.</p>";
  const sanitized = sanitizeClientPdfCopy(legacy);

  assert.doesNotMatch(sanitized, /Most of the environment is in good shape/i);
  assert.doesNotMatch(sanitized, /deserve attention over time/i);
  assert.match(sanitized, new RegExp(RADAR_ATTENTION_COPY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("client PDF sanitizer also removes a standalone good-shape sentence", () => {
  const sanitized = sanitizeClientPdfCopy("<p>Most of the environment is in good shape.</p>");
  assert.doesNotMatch(sanitized, /Most of the environment is in good shape/i);
});
