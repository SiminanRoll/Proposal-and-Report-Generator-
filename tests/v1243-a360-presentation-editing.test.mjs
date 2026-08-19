import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("A360 workspace exposes editable presentation details before PDF export", () => {
  const workspace = read("src/components/a360-conversation-workspace.tsx");
  const editor = read("src/components/a360-presentation-details-editor.tsx");

  assert.ok(workspace.includes("A360PresentationDetailsEditor"));
  assert.ok(workspace.indexOf("A360PresentationDetailsEditor") < workspace.lastIndexOf("Client-facing report copy"));
  assert.ok(workspace.includes("printReadableA360ConversationReport"));

  for (const label of [
    "Edit presentation details",
    "Organization",
    "Contact",
    "Priorities discussed",
    "Workstations",
    "Locations",
    "Onsite server",
    "Practice / management software",
    "Imaging software",
    "Other software discussed",
    "Estimate low / month",
    "Estimate high / month",
    "Onsite date",
    "Onsite time",
    "Time zone",
    "Technology Consultant",
  ]) assert.ok(editor.includes(label), `missing editable A360 field: ${label}`);

  assert.ok(editor.includes("planningAppointment: nextRecord.appointment"));
  assert.ok(editor.includes("a360Conversation: nextRecord"));
  assert.ok(editor.includes("pricing: { ...project.pricing, monthly: nextRecord.estimate.low }"));
  assert.ok(editor.includes("Changing these fields does not overwrite custom report wording"));
});
