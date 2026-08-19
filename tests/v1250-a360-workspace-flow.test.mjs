import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../src/components/a360-conversation-workspace.tsx", import.meta.url), "utf8");
const details = fs.readFileSync(new URL("../src/components/a360-presentation-details-editor.tsx", import.meta.url), "utf8");

test("A360 record uses a simple conversation-to-PDF flow", () => {
  assert.match(workspace, /A360 conversation record/);
  assert.match(workspace, /<A360PresentationDetailsEditor/);
  assert.match(workspace, /Client PDF/);
  assert.match(workspace, /Report copy/);
  assert.match(workspace, /Optional: tailor copy with ChatGPT/);
  assert.match(workspace, /<details className="tailored-tool">/);
  assert.match(workspace, /Use latest A360 recap/);
  assert.doesNotMatch(workspace, /next-step-card/);
  assert.doesNotMatch(workspace, /appointment time zone is stored with the record/i);
  assert.doesNotMatch(workspace, /The exported recap stays prospect-safe/i);
});

test("conversation summary shows one clear scheduled onsite card without instructional footer", () => {
  assert.match(details, /Scheduled onsite/);
  assert.match(details, /Environment discussed/);
  assert.match(details, /Planning range ·/);
  assert.doesNotMatch(details, /Planning & next step/);
  assert.doesNotMatch(details, /summary-footer/);
  assert.doesNotMatch(details, /Use <strong>Edit details/);
  assert.doesNotMatch(details, /Every change saves back/);
});
