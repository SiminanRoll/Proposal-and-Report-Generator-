import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileFunction } from "node:vm";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const presentation = read("../src/components/hipaa-presentation.tsx");
const preparation = read("../src/components/hipaa-readiness.tsx");
const engine = read("../src/lib/hipaa/engine.ts");
const styles = read("../src/components/security-review-premium.module.css");
const pdf = read("../src/lib/outcomes/export-html.ts");

test("security question stays on one card with a selected answer and optional note before confirmation", () => {
  assert.match(presentation, /const \[selectedResponse, setSelectedResponse\]/);
  assert.match(presentation, /function chooseResponse\(response: HipaaResponse\)/);
  assert.match(presentation, /data-selected=\{selectedResponse === "yes"\}/);
  assert.match(presentation, /data-selected=\{selectedResponse === "no"\}/);
  assert.match(presentation, /aria-pressed=\{selectedResponse === "partially"\}/);
  assert.match(presentation, /chooseResponse\("not-yet-assessed"\)/);
  assert.match(presentation, /hasChoice && <div className=\{premium\.inlineConfirmation\}/);
  assert.match(presentation, /value=\{draft\.internalNotes\}/);
  assert.match(presentation, /Additional notes/);
  assert.match(presentation, /Confirm &amp; next/);
  assert.doesNotMatch(presentation, /isFlipped|setIsFlipped|premium\.flipped|premium\.back\}/);
});

test("unknown answers are saved with optional note as deferred, not falsely counted as Yes/No", () => {
  assert.match(presentation, /draft\.response === "not-yet-assessed"\s*\?\s*deferHipaaAnswer\(updated,/);
  assert.match(presentation, /withUpdatedHipaaAnswer\(project, current\.question\.id, draft\)/);
  assert.match(engine, /response !== "not-yet-assessed"/);
  assert.match(presentation, /setSelectedResponse\(null\)/);
});

test("imported security-report evidence never seeds editable client-presented notes or observation text", () => {
  assert.doesNotMatch(engine, /answer\.internalNotes = evidence\.evidence/);
  assert.doesNotMatch(engine, /answer\.clientVisibleObservation =/);
  assert.match(engine, /withoutAutoImportedSecurityNotes/);
  assert.match(presentation, /draftFrom\(answer: HipaaAnswer\)[\s\S]*withoutAutoImportedSecurityNotes\(answer\)/);
  assert.match(preparation, /function answerFor[\s\S]*withoutAutoImportedSecurityNotes/);
  assert.doesNotMatch(pdf, /answer\??\.internalNotes/);
});

test("legacy automatically generated notes are scrubbed while human-authored notes are preserved", () => {
  const match = engine.match(/export function withoutAutoImportedSecurityNotes\(answer: HipaaAnswer\): HipaaAnswer \{([\s\S]*?)\n\}/);
  assert.ok(match, "pure sanitizer must remain independently testable");
  const sanitize = compileFunction(match[1], ["answer"]);
  const original = {
    questionId: "SEC-01", response: "not-yet-assessed",
    verificationStatus: "proposed", evidenceSource: "Imported technical report",
    internalNotes: "Managed devices: 15 (Huntress report)",
    clientVisibleObservation: "Imported monitoring activity is available for review. The protected device scope still needs confirmation.",
  };
  const cleaned = sanitize(original);
  assert.equal(cleaned.internalNotes, "");
  assert.equal(cleaned.clientVisibleObservation, "");
  assert.equal(original.internalNotes, "Managed devices: 15 (Huntress report)", "do not mutate original project");
  const confirmedOld = sanitize({ ...original, verificationStatus: "client-confirmed" });
  assert.equal(confirmedOld.internalNotes, "", "legacy generated evidence remains redacted after old answer confirmation");
  const backup = sanitize({
    ...original, questionId: "SEC-06",
    clientVisibleObservation: "2 backup-server records are available. Confirm local copies, encrypted cloud copies, protected workloads, and exclusions.",
  });
  assert.equal(backup.clientVisibleObservation, "");
  const manual = sanitize({
    ...original, verificationStatus: "client-confirmed", evidenceSource: "Joint review",
    internalNotes: "Office manager will verify coverage next week.",
    clientVisibleObservation: "We will review backup coverage together.",
  });
  assert.equal(manual.internalNotes, "Office manager will verify coverage next week.");
  assert.equal(manual.clientVisibleObservation, "We will review backup coverage together.");
  const unrelated = sanitize({ ...original, questionId: "SEC-09" });
  assert.deepEqual(unrelated, { ...original, questionId: "SEC-09" });
});

test("color cues and responsive notes are explicitly styled for all answer states", () => {
  for (const tone of ["yes", "no", "partially", "not-yet-assessed", "not-applicable"]) {
    assert.ok(styles.includes('data-selected="true"][data-response="' + tone + '"]'), "missing selected style for " + tone);
  }
  assert.match(styles, /\.inlineConfirmation/);
  assert.match(styles, /\.inlineNoteLabel textarea/);
  assert.match(styles, /prefers-reduced-motion:reduce\)\{\.inlineConfirmation/);
  assert.match(styles, /@media\(max-width:650px\)/);
});
