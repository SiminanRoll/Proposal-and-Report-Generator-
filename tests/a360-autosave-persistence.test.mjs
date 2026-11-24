import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const projectKey = "advantage.proposal-report-generator.projects.v2";
const pricingKey = "advantage.proposal-report-generator.a360-presentation-pricing.v1";

function browserHarness(t, values = new Map()) {
  const previous = globalThis.window;
  const events = [];
  const storage = { fail: false };
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (storage.fail && key === projectKey) throw new DOMException("Full", "QuotaExceededError");
        values.set(key, String(value));
      },
      removeItem: (key) => values.delete(key),
    },
    dispatchEvent: (event) => { events.push(event); return true; },
    addEventListener() {}, removeEventListener() {},
  };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const cache = new Map();
  function load(relative) {
    let file = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (!path.extname(file)) file = [file + ".ts", file + ".tsx", path.join(file, "index.ts")].find(fs.existsSync);
    if (!file) throw new Error(`Missing test module: ${relative}`);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = fs.readFileSync(file, "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const localRequire = (specifier) => specifier.startsWith("@/")
      ? load(path.join(root, "src", specifier.slice(2)))
      : specifier.startsWith(".") ? load(path.resolve(path.dirname(file), specifier)) : nativeRequire(specifier);
    new Function("module", "exports", "require", js)(module, module.exports, localRequire);
    return module.exports;
  }
  return {
    draft: load("src/lib/prospects/a360-draft-store.ts"),
    model: load("src/lib/prospects/a360-conversation.ts"),
    prospect: load("src/lib/prospects/a360.ts"),
    store: load("src/lib/projects/store.ts"),
    values, storage, events,
  };
}

const appointment = {
  status: "scheduled", date: "2026-12-09", time: "14:30", timeZone: "America/New_York",
  consultantName: "Test Consultant", scheduledAt: "2026-11-24T18:00:00.000Z",
};
function discovery(harness) {
  return { ...harness.prospect.emptyA360Prospect(), contactName: "Test Contact", organizationName: "A360 Persistence Test" };
}
function checkpoint(harness, project, update) {
  return harness.draft.saveA360Draft(harness.model.updateA360ConversationProject(project, update));
}

test("Start immediately creates a visible unscheduled A360 draft with no contact or Finish requirement", (t) => {
  const h = browserHarness(t);
  const project = h.draft.createA360Draft(discovery(h));
  const saved = h.store.listProjects();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, project.id);
  assert.equal(saved[0].status, "draft");
  assert.equal(saved[0].a360Conversation.appointment, null);
  assert.equal(saved[0].a360Conversation.contactEmail, "");
  assert.equal(saved[0].planningAppointment, undefined);
  assert.deepEqual(saved[0].sources, []);
  assert.match(saved[0].a360Conversation.report.nextStepSummary, /has not been scheduled/);
  assert.doesNotMatch(saved[0].a360Conversation.report.executiveSummary, /already scheduled/);
  assert.ok(h.events.some((event) => event.type === "advantage-projects-changed"), "Recent Reports listeners are notified immediately");
});

test("every discovery edit and slide position survive reload, then appointment saves without Finish", (t) => {
  const h = browserHarness(t);
  let project = h.draft.createA360Draft(discovery(h));
  const id = project.id;
  const handoffId = project.a360Conversation.handoffId;
  for (const [key, value] of Object.entries({ priorities: ["Cybersecurity", "Better support"], workstations: 17, server: "yes", locations: 2, managementSoftware: "Practice app", imagingSoftware: "Imaging app", imagingEnvironment: "2D + 3D", otherSoftware: "Cloud phones" })) {
    project = checkpoint(h, project, { discovery: { ...project.a360Conversation.discovery, [key]: value } });
    assert.deepEqual(h.draft.loadA360Draft(id).a360Conversation.discovery[key], value, `${key} persisted in its own event`);
  }
  project = checkpoint(h, project, { presentationIndex: 7 });
  const restarted = browserHarness(t, h.values);
  project = restarted.draft.loadA360Draft(id);
  assert.equal(project.a360Conversation.discovery.workstations, 17);
  assert.equal(project.a360Conversation.discovery.otherSoftware, "Cloud phones");
  assert.equal(project.a360Conversation.presentationIndex, 7);
  project = checkpoint(restarted, project, { appointment });
  const reopened = restarted.draft.loadA360Draft(id);
  assert.deepEqual(reopened.a360Conversation.appointment, appointment);
  assert.deepEqual(reopened.planningAppointment, appointment);
  assert.equal(reopened.a360Conversation.contactEmail, "");
  assert.equal(reopened.a360Conversation.completedAt, undefined);
  assert.equal(reopened.a360Conversation.handoffId, handoffId);
  assert.equal(restarted.store.listProjects().length, 1);
  assert.match(reopened.a360Conversation.report.nextStepSummary, /already scheduled/);
});

test("appointment edits, contact details, and finishing update one stable workspace", (t) => {
  const h = browserHarness(t);
  let project = h.draft.createA360Draft(discovery(h));
  const originalId = project.id;
  project = checkpoint(h, project, { appointment });
  const changed = { ...appointment, date: "2026-12-11", time: "10:00", consultantName: "Another Consultant" };
  project = checkpoint(h, project, { appointment: changed });
  project = checkpoint(h, project, { contactEmail: "contact@example.com", contactPhone: "555 555 0123" });
  project = checkpoint(h, project, { completedAt: "2026-11-24T18:30:00.000Z" });
  // A retry with a stale/new project ID must still recognize the same conversation.
  project = h.draft.saveA360Draft({ ...project, id: "retry-must-not-create-duplicate" });
  assert.equal(project.id, originalId);
  assert.equal(h.store.listProjects().length, 1);
  assert.equal(project.status, "published");
  assert.deepEqual(h.draft.loadA360Draft(originalId).planningAppointment, changed);
  assert.equal(project.client.contacts.find((contact) => contact.primary).email, "contact@example.com");
  assert.match(project.a360Conversation.report.nextStepSummary, /Another Consultant/);
  assert.doesNotMatch(project.a360Conversation.report.nextStepSummary, /Test Consultant/);
});

test("quota failure preserves the last saved draft and retry persists the complete latest input", (t) => {
  const h = browserHarness(t);
  const initial = h.draft.createA360Draft(discovery(h));
  const savedBytes = h.values.get(projectKey);
  const unsaved = h.model.updateA360ConversationProject(initial, { discovery: { ...initial.a360Conversation.discovery, managementSoftware: "Do not lose this input" }, appointment });
  h.storage.fail = true;
  assert.throws(() => h.draft.saveA360Draft(unsaved), /browser workspace is full/);
  assert.equal(h.values.get(projectKey), savedBytes);
  assert.equal(h.draft.loadA360Draft(initial.id).a360Conversation.discovery.managementSoftware, "");
  assert.equal(unsaved.a360Conversation.discovery.managementSoftware, "Do not lose this input");
  h.storage.fail = false;
  h.draft.saveA360Draft(unsaved);
  assert.equal(h.draft.loadA360Draft(initial.id).a360Conversation.discovery.managementSoftware, "Do not lose this input");
  assert.deepEqual(h.draft.loadA360Draft(initial.id).a360Conversation.appointment, appointment);
  assert.equal(h.store.listProjects().length, 1);
});

test("resume and nonpricing edits preserve captured estimates and individually tailored report fields", (t) => {
  const h = browserHarness(t);
  let project = h.draft.createA360Draft({ ...discovery(h), workstations: 10 });
  const captured = structuredClone(project.a360Conversation.estimate);
  project.a360Conversation.report.title = "Our custom recap title";
  project.a360Conversation.report.executiveSummary = "Manually tailored summary that must survive autosave.";
  project = h.draft.saveA360Draft(project);
  h.values.set(pricingKey, JSON.stringify({ site: 9999, workstation: 999, serverStandardBackup: 888 }));
  project = h.draft.loadA360Draft(project.id);
  project = checkpoint(h, project, { presentationIndex: 3, contactEmail: "updated@example.com" });
  project = checkpoint(h, project, { discovery: { ...project.a360Conversation.discovery, managementSoftware: "New software detail", priorities: ["Cybersecurity"] } });
  project = checkpoint(h, project, { appointment });
  assert.deepEqual(project.a360Conversation.estimate, captured);
  assert.equal(h.draft.loadA360Draft(project.id).pricing.monthly, captured.high);
  assert.equal(project.a360Conversation.report.title, "Our custom recap title");
  assert.equal(project.a360Conversation.report.executiveSummary, "Manually tailored summary that must survive autosave.");
  assert.match(project.a360Conversation.report.conversationSummary, /New software detail/);
  assert.match(project.a360Conversation.report.nextStepSummary, /already scheduled/);
});

test("legacy saved conversations migrate optional progress without losing identity, appointment, or report", (t) => {
  const h = browserHarness(t);
  const project = h.draft.createA360Draft(discovery(h));
  project.status = "published";
  project.a360Conversation.appointment = appointment;
  project.planningAppointment = appointment;
  delete project.a360Conversation.presentationIndex;
  delete project.a360Conversation.completedAt;
  project.a360Conversation.report.executiveSummary = "Previously saved client copy";
  h.store.saveProject(project);
  const reopened = h.draft.loadA360Draft(project.id);
  assert.equal(reopened.status, "published");
  assert.equal(reopened.a360Conversation.presentationIndex, 0);
  assert.deepEqual(reopened.a360Conversation.appointment, appointment);
  assert.equal(reopened.a360Conversation.report.executiveSummary, "Previously saved client copy");
  assert.equal(reopened.a360Conversation.handoffId, project.a360Conversation.handoffId);
  assert.equal(h.model.isA360AppointmentScheduled({ ...appointment, date: "2026-02-31" }), false);
  assert.equal(h.model.isA360AppointmentScheduled({ ...appointment, time: "25:00" }), false);
  assert.equal(h.model.isA360AppointmentScheduled(null), false);
  assert.equal(h.model.isA360AppointmentScheduled(appointment), true);
});

test("one incomplete legacy A360 record cannot hide healthy projects or manufacture a captured price", (t) => {
  const h = browserHarness(t);
  const healthy = h.draft.createA360Draft(discovery(h));
  const incomplete = structuredClone(healthy);
  incomplete.id = "incomplete-legacy";
  incomplete.a360Conversation.handoffId = "incomplete-handoff";
  delete incomplete.a360Conversation.estimate;
  incomplete.a360Conversation.discovery.managementSoftware = 42;
  incomplete.a360Conversation.discovery.priorities = ["Better support", null, 15];
  incomplete.a360Conversation.report = { title: "Preserved legacy recap", executiveSummary: "Existing saved copy", nextStepSummary: null };
  h.store.saveProject(incomplete);
  const projects = h.store.listProjects();
  assert.equal(projects.length, 2);
  assert.ok(projects.some((project) => project.id === healthy.id));
  const reopened = h.draft.loadA360Draft(incomplete.id);
  assert.equal(reopened.a360Conversation.estimateCaptured, false);
  assert.match(reopened.a360Conversation.estimate.assumptions[0], /Estimate not captured/);
  assert.equal(reopened.a360Conversation.report.title, "Preserved legacy recap");
  assert.equal(reopened.a360Conversation.report.executiveSummary, "Existing saved copy");
  assert.deepEqual(reopened.a360Conversation.discovery.priorities, ["Better support"]);
  assert.equal(reopened.a360Conversation.discovery.managementSoftware, "");
  assert.match(h.model.buildA360TailoredReportPrompt(reopened.a360Conversation), /Not captured\. Do not invent a price/);
});
