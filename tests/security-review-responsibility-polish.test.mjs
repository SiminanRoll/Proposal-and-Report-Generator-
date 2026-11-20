import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const recap = read("../src/components/hipaa-presentation.tsx");
const card = read("../src/components/security-follow-up-owner-editor.tsx");
const css = read("../src/components/security-review-premium.module.css");
const pdf = read("../src/lib/outcomes/export-html.ts");
const owner = read("../src/lib/hipaa/follow-up-owner.ts");

test("client-facing Next steps shows compact responsibility cards and a single confirmation title", () => {
  const actions = recap.slice(recap.indexOf('{phase === "actions" && <section'));
  assert.match(actions, /<h2>Next steps<\/h2>/);
  assert.match(actions, /<h3>Responsible party<\/h3>/);
  assert.match(actions, /CONFIRMATION/);
  assert.doesNotMatch(actions, /Who handles what\?|OPEN ANSWERS|Assign a follow-up|Confirm the conversation|FINAL REVIEW|demo mode/i);
  assert.match(actions, /\{advantageFollowUps\} Advantage/);
  assert.match(actions, /\{clientFollowUps\} Your team/);
  assert.match(actions, /The answers and responsibilities reflect our conversation\./);
  assert.doesNotMatch(actions, /<h3>Confirm the conversation<\/h3>/);
});

test("owner cards show one clear party, preserve choice changes and allow optional next steps", () => {
  assert.match(card, /const ownerStatus = owner === "client" \? "Your team to confirm" : "Advantage to verify"/);
  assert.match(card, /data-owner=\{owner\}/);
  assert.match(card, /<span className=\{styles\.followUpOwnerNumber\}>/);
  assert.match(card, /aria-pressed=\{owner === "advantage"\}/);
  assert.match(card, /aria-pressed=\{owner === "client"\}/);
  assert.match(card, /followUpOwner: "advantage"/);
  assert.match(card, /followUpOwner: "client"/);
  assert.match(card, /<details className=\{styles\.followUpOwnerPlan\} defaultOpen=\{Boolean\(draft\.trim\(\)\)\}>/);
  assert.match(card, /onBlur=\{commitAction\}/);
  assert.match(card, /const pendingText = dirty && draft !== answer\.recommendedAction/);
  assert.doesNotMatch(card, /Client PDF|Our follow-up|question\.clientConfirms\[0\]|question\.advantageConfirms\[0\]/);
});

test("Back is in the top recap navigation, and the dark sticky footer gradient is overridden", () => {
  const top = recap.indexOf("recapTopbar");
  const stage = recap.indexOf("recapStage}");
  assert.ok(top >= 0 && top < stage, "Back belongs to top navigation");
  assert.match(recap, /aria-label="Previous review step"/);
  assert.match(css, /\.recapTopbar\{/);
  assert.match(css, /\.recapFlowActions\{position:static;bottom:auto;z-index:auto;background:none/);
  assert.match(css, /\.recapActionsStage \.followUpRouting\{background:#0b2b4c/);
  assert.match(css, /\.recapActionsStage \.recapConfirmation\{background:#0d2c4a/);
  assert.match(css, /\.followUpOwnerCard\[data-owner="client"\]/);
});

test("PDF gets exact saved owner and next-step information without exposing private questionnaire notes", () => {
  assert.match(owner, /answer\?\.followUpOwner === "advantage"/);
  assert.match(owner, /answer\.followUpOwner/);
  assert.match(pdf, /securityFollowUpOwner\(question, answer\)/);
  assert.match(pdf, /isClientSecurityFollowUp\(question, answer\)/);
  assert.match(pdf, /data-security-owner=/);
  assert.match(pdf, /"Your team to confirm" : owner === "advantage" \? "Advantage to verify"/);
  assert.match(pdf, /Agreed next step:/);
  assert.match(pdf, /answer\.recommendedAction\.trim\(\)/);
  assert.match(pdf, /printResponsibilitySummary/);
  assert.match(pdf, /withoutAutoImportedSecurityNotes\(raw\)/);
  assert.doesNotMatch(pdf, /\$\{answer\?\.internalNotes\}|\$\{answer\.internalNotes\}/);
  assert.match(pdf, /pdf-hipaa-responsibility-summary/);
});
