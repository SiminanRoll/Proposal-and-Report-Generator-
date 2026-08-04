import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("downloadable PDFs use a self-contained Advantage logo data URI", () => {
  const asset = readFileSync("src/lib/outcomes/pdf-assets.ts", "utf8");
  const exportHtml = readFileSync("src/lib/outcomes/export-html.ts", "utf8");
  const preMeeting = readFileSync("src/lib/outcomes/pre-meeting.ts", "utf8");
  assert.match(asset, /data:image\/png;base64,/);
  assert.match(exportHtml, /ADVANTAGE_LOGO_DATA_URI/);
  assert.match(preMeeting, /ADVANTAGE_LOGO_DATA_URI/);
  assert.doesNotMatch(exportHtml, /src="\/advantage-logo-full\.png"/);
  assert.doesNotMatch(preMeeting, /src="\/advantage-logo-full\.png"/);
});

test("PDF renderer does not use outbound image requests", () => {
  const renderer = readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
  assert.doesNotMatch(renderer, /\bfetch\s*\(/);
  assert.doesNotMatch(renderer, /XMLHttpRequest|WebSocket|sendBeacon/);
});
