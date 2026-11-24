import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = new Map();
let downloaded;
let downloadFailure;

function load(relativePath) {
  const filename = path.resolve(root, relativePath);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const require = (specifier) => {
    if (specifier === "@/lib/prospects/a360-pricing-settings") return {
      DEFAULT_A360_PRESENTATION_PRICING: {}, loadA360PresentationPricing: () => ({}),
    };
    if (specifier === "@/lib/projects/factory") return {
      createId: () => "unused", createProject: () => { throw new Error("The export must not create a project."); },
    };
    if (specifier === "./planning-mode") return { isHourlyOnsiteService: () => false, isRemoteConsultation: () => false };
    if (specifier === "@/lib/outcomes/fillable-pdf-core") return {
      downloadFillableClientPdf: async (html, title) => {
        if (downloadFailure) throw downloadFailure;
        downloaded = { html, title };
      },
    };
    const target = specifier.startsWith("@/")
      ? path.join(root, "src", specifier.slice(2))
      : path.resolve(path.dirname(filename), specifier);
    return load(`${target}.ts`);
  };
  new Function("require", "module", "exports", output)(require, module, module.exports);
  return module.exports;
}

const { emptyA360Prospect } = load("src/lib/prospects/a360.ts");
const { defaultA360ConversationReport } = load("src/lib/prospects/a360-conversation.ts");
const { a360ConversationReportHtml } = load("src/lib/prospects/a360-report-export.ts");
const { downloadableA360ConversationReportHtml, downloadReadableA360ConversationReport } = load("src/lib/prospects/a360-readable-report-export.ts");

const appointment = {
  status: "scheduled", date: "2026-12-03", time: "13:30", timeZone: "America/Chicago",
  consultantName: "Example Consultant", scheduledAt: "2026-11-24T18:00:00.000Z",
};

function record(scheduled = null) {
  const discovery = {
    ...emptyA360Prospect(), organizationName: "Example & Co", contactName: "Example Contact",
    priorities: ["Better support", "Cybersecurity"], workstations: 12, locations: 1,
    server: "yes", managementSoftware: "Example Software",
  };
  return {
    kind: "a360-conversation", handoffId: "synthetic-a360-test", discovery,
    estimate: { low: 500, high: 600, assumptions: ["12 workstations", "1 location"] },
    appointment: scheduled, contactEmail: "", contactPhone: "", capturedAt: "2026-11-24T18:00:00.000Z",
    report: defaultA360ConversationReport(discovery, scheduled), presentationIndex: 2,
  };
}

test("an unscheduled A360 draft exports without inventing a confirmed appointment", () => {
  const html = a360ConversationReportHtml(record());
  assert.match(html, /Onsite assessment not scheduled/);
  assert.match(html, /Date and time to confirm/);
  assert.match(html, /A date, time, and Technology Consultant have not been confirmed/);
  assert.doesNotMatch(html, /already scheduled|already on the calendar|appointment confirmed/i);
  assert.doesNotMatch(html, /undefined|null|Invalid Date/);
  assert.equal((html.match(/<section class="sheet/g) || []).length, 5);
});

test("incomplete appointment data does not produce a confirmed next-step panel", () => {
  const draft = record();
  draft.appointment = { ...appointment, date: "2026-02-31" };
  const html = a360ConversationReportHtml(draft);
  assert.match(html, /Onsite assessment not scheduled/);
  assert.doesNotMatch(html, /2026-02-31|Example Consultant|already scheduled/);
});

test("an uncaptured estimate is disclosed without turning missing pricing into zero dollars", () => {
  const draft = record();
  draft.estimateCaptured = false;
  draft.estimate = { low: 0, high: 0, assumptions: ["Confirm pricing before sharing."] };
  const html = downloadableA360ConversationReportHtml(draft);
  assert.match(html, /Estimate not captured/);
  assert.match(html, /An estimate was not captured in this saved conversation/);
  assert.doesNotMatch(html, /\$0|\$0.*month/);
});

test("saved appointment details keep their actual time zone without duplicate suffixes", () => {
  const html = downloadableA360ConversationReportHtml(record(appointment));
  assert.match(html, /Onsite assessment details/);
  assert.match(html, /December 3, 2026/);
  assert.match(html, /1:30 PM CT/);
  assert.match(html, /Example Consultant/);
  assert.doesNotMatch(html, /CT CT|already on the calendar|invitation sent/i);
});

test("export preserves manually tailored wording even when it resembles legacy copy", () => {
  const tailored = record(appointment);
  tailored.report = {
    title: "My saved recap title",
    executiveSummary: "My exact saved executive summary & priorities.",
    conversationSummary: "We discussed project scope and final scope and recommendations; this wording was manually tailored.",
    nextStepSummary: "My saved next step is to review the appointment details together. Keep example.top and .footer wording unchanged.",
  };
  const before = structuredClone(tailored);
  const html = downloadableA360ConversationReportHtml(tailored);
  assert.match(html, /My saved recap title/);
  assert.match(html, /My exact saved executive summary &amp; priorities/);
  assert.match(html, /We discussed project scope and final scope and recommendations; this wording was manually tailored/);
  assert.match(html, /My saved next step is to review the appointment details together/);
  assert.match(html, /Keep example\.top and \.footer wording unchanged/);
  assert.deepEqual(tailored, before);
});

test("direct A360 PDF uses five portrait pages with embedded artwork and preserved page chrome", () => {
  const html = downloadableA360ConversationReportHtml(record());
  assert.match(html, /<meta name="adv-pdf-layout" content="portrait">/);
  assert.match(html, /<body><main class="a360-pdf-pages">/);
  assert.equal((html.match(/<header class="a360-pdf-top">/g) || []).length, 5);
  assert.equal((html.match(/<footer class="a360-pdf-footer">/g) || []).length, 5);
  assert.equal((html.match(/<section class="sheet/g) || []).length, 5);
  assert.match(html, /src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /<img[^>]+src="https?:/);
  assert.match(html, /data-pdf-link="https:\/\/www\.adv-tech\.com\/a360\/"/);
});

test("Download PDF invokes the local renderer directly and propagates a rendering failure", async () => {
  downloaded = undefined;
  await downloadReadableA360ConversationReport(record());
  assert.equal(downloaded.title, "Advantage 360 Conversation Recap - Example & Co");
  assert.match(downloaded.html, /adv-pdf-layout/);
  assert.match(downloaded.html, /Onsite assessment not scheduled/);
  downloadFailure = new Error("Synthetic browser render failure");
  try {
    await assert.rejects(downloadReadableA360ConversationReport(record()), /Synthetic browser render failure/);
  } finally {
    downloadFailure = undefined;
  }
});

test("A360 PDF describes practical outcomes and a concrete post-assessment deliverable", () => {
  const draft = record(appointment);
  draft.discovery.priorities = ["Reliability & downtime prevention", "Cybersecurity"];
  const html = downloadableA360ConversationReportHtml(draft);
  assert.match(html, /Confidence in your technology/);
  assert.match(html, /reduce avoidable technology interruptions and help protect sensitive information/);
  assert.match(html, /Discover the Advantage/);
  assert.match(html, /What you can expect after the assessment/);
  assert.match(html, /any separate onboarding or project costs/);
  assert.doesNotMatch(html, /A helpful head start for the visit|This recap keeps the conversation|Your next step, together/);
  const alternative = record();
  alternative.discovery.priorities = ["Predictable costs", "Better support"];
  assert.match(a360ConversationReportHtml(alternative), /make routine technology costs more predictable and give your team a dependable place to turn for help/);
});

test("A360 native link measurement and raster page inherit the same root typography", () => {
  const html = downloadableA360ConversationReportHtml(record());
  assert.match(html, /\.sheet\[data-pdf-capture-page\]\{[^}]*font-size:11pt;line-height:1\.5;font-weight:400;font-synthesis:none/);
  assert.match(html, /data-pdf-link="https:\/\/www\.adv-tech\.com\/a360\//);
  assert.match(html, /data-pdf-link="https:\/\/www\.adv-tech\.com\/contact-us\//);
});

test("PDF itemizes the monthly service with saved quantities, software and captured pricing", () => {
  const draft = record();
  draft.discovery.imagingSoftware = "Example Imaging";
  draft.discovery.otherSoftware = "Finance & Documents";
  const before = structuredClone(draft);
  const html = downloadableA360ConversationReportHtml(draft);
  const coverage = html.split('<section class="sheet coverage-sheet">')[1].split('</section>')[0];
  for (const expected of ["What’s included in your monthly service", "12 workstations", "1 location", "1 onsite server", "Managed workstations", "Network management", "Security monitoring &amp; response", "Unlimited remote diagnostics", "Server &amp; standard backup", "Ongoing technology guidance", "Example Software", "Example Imaging", "Finance &amp; Documents", "$500–$600 / month", "third-party subscriptions are quoted separately"]) {
    assert.ok(coverage.includes(expected), `Missing coverage: ${expected}`);
  }
  assert.doesNotMatch(html, /What we used for this estimate/);
  assert.deepEqual(draft, before);
});

test("PDF removes the untouched automatic environment recap while preserving tailored notes", () => {
  const draft = record();
  const html = downloadableA360ConversationReportHtml(draft);
  assert.doesNotMatch(html, /class="discussion"|a head start before the onsite visit/);
  draft.report.conversationSummary = "We discussed the new imaging workflow and the team's priorities.";
  const tailored = downloadableA360ConversationReportHtml(draft);
  assert.match(tailored, /class="discussion"/);
  assert.match(tailored, /new imaging workflow/);
});

test("long coverage keeps all software on numbered continuation pages", () => {
  const draft = record();
  draft.discovery.otherSoftware = Array.from({ length: 100 }, (_, i) => `Application${i}`).join("; ");
  const html = downloadableA360ConversationReportHtml(draft);
  const pages = (html.match(/<section class="sheet/g) || []).length;
  assert.ok(pages > 5);
  assert.match(html, /Your service coverage, continued/);
  assert.match(html, /Application99/);
  assert.ok(html.includes(`${pages} / ${pages} · Prepared`));
  assert.equal((html.match(/<footer class="a360-pdf-footer">/g) || []).length, pages);
});
