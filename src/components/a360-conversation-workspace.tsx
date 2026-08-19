"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { A360PresentationDetailsEditor } from "@/components/a360-presentation-details-editor";
import type { A360ConversationRecord, A360ConversationReportCopy, Project } from "@/lib/projects/types";
import { buildA360TailoredReportPrompt, defaultA360ConversationReport, parseA360TailoredReport } from "@/lib/prospects/a360-conversation";
import { printReadableA360ConversationReport } from "@/lib/prospects/a360-readable-report-export";
import { a360PriorityLabel, normalizeA360PriorityText } from "@/lib/prospects/a360";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function hasLegacyDefaultA360Copy(project: Project): boolean {
  const record = project.a360Conversation;
  const report = record?.report;
  if (!record || !report) return false;
  const combined = `${report.executiveSummary}\n${report.conversationSummary}\n${report.nextStepSummary}`;
  const signatures = [
    record.discovery.priorities.some((priority) => a360PriorityLabel(priority) !== priority),
    report.title.startsWith("Technology Conversation Recap —"),
    report.executiveSummary.includes("before any recommendations are finalized"),
    report.conversationSummary.includes("starting point rather than a completed technical assessment"),
    /technically (?:assessed or )?verified/i.test(combined),
    /final scope and recommendations/i.test(combined),
    /verified onsite information/i.test(combined),
    /preliminary Advantage 360 planning estimate/i.test(combined),
    /believed to be aging/i.test(combined),
    /subject to the onsite assessment/i.test(combined),
  ];
  return signatures.some(Boolean);
}

export function A360ConversationWorkspace({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const record = project.a360Conversation;
  const [tailoredOutput, setTailoredOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const prompt = useMemo(() => record ? buildA360TailoredReportPrompt(record) : "", [record]);

  if (!record) return null;
  const activeRecord: A360ConversationRecord = record;
  const d = activeRecord.discovery;
  const range = activeRecord.estimate.low === activeRecord.estimate.high ? money(activeRecord.estimate.low) : `${money(activeRecord.estimate.low)}–${money(activeRecord.estimate.high)}`;
  const legacyDefaultCopy = hasLegacyDefaultA360Copy(project);

  function updateReport(key: keyof A360ConversationReportCopy, value: string) {
    const presentation = key === "executiveSummary"
      ? { ...project.presentation, executiveSummary: value }
      : key === "title"
        ? { ...project.presentation, title: value }
        : project.presentation;
    onUpdate({ ...project, a360Conversation: { ...activeRecord, report: { ...activeRecord.report, [key]: value } }, presentation });
  }

  function projectWithLatestA360Copy(): { project: Project; record: A360ConversationRecord } {
    const discovery = { ...activeRecord.discovery, priorities: activeRecord.discovery.priorities.map(a360PriorityLabel) };
    const report = defaultA360ConversationReport(discovery, activeRecord.appointment);
    const refreshedRecord: A360ConversationRecord = { ...activeRecord, discovery, report };
    return {
      project: { ...project, a360Conversation: refreshedRecord, presentation: { ...project.presentation, title: report.title, executiveSummary: report.executiveSummary } },
      record: refreshedRecord,
    };
  }

  function useLatestA360Copy() {
    const latest = projectWithLatestA360Copy();
    onUpdate(latest.project);
    setMessage("Latest A360 recap copy applied. Conversation details, pricing, and appointment were preserved.");
    window.setTimeout(() => setMessage(""), 3000);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function applyTailoredOutput() {
    if (!tailoredOutput.trim()) return;
    const report = parseA360TailoredReport(tailoredOutput, activeRecord.report);
    onUpdate({ ...project, a360Conversation: { ...activeRecord, report }, presentation: { ...project.presentation, title: report.title, executiveSummary: report.executiveSummary } });
    setMessage("Tailored copy applied to the PDF report.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  function printReport() {
    try {
      if (legacyDefaultCopy) {
        const latest = projectWithLatestA360Copy();
        onUpdate(latest.project);
        printReadableA360ConversationReport(latest.record);
        setMessage("Saved A360 wording was refreshed automatically before export.");
        window.setTimeout(() => setMessage(""), 3000);
        return;
      }
      printReadableA360ConversationReport(activeRecord);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The report could not be opened.");
    }
  }

  return <main className="workspace-page a360-record-workspace">
    <style>{`.a360-record-workspace{--a360-field-surface:#fff;--a360-field-border:rgba(24,63,110,.14);--a360-field-shadow:0 1px 2px rgba(20,52,92,.04),0 8px 24px rgba(20,52,92,.035);max-width:1320px;margin:0 auto;padding-bottom:72px}.a360-record-workspace .record-hero{display:flex;justify-content:space-between;gap:28px;align-items:flex-end;padding:30px 0 22px}.a360-record-workspace .record-hero h1{margin:5px 0 8px;font-size:36px}.a360-record-workspace .record-hero p{max-width:760px;color:var(--muted);margin:0}.a360-record-workspace .record-hero-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.a360-record-workspace .record-hero-meta span{padding:6px 9px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--muted);font-size:11px;font-weight:700}.a360-record-workspace .record-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.a360-record-workspace .record-feedback{margin:-8px 0 16px;padding:9px 12px;border:1px solid rgba(44,210,193,.24);border-radius:11px;background:rgba(44,210,193,.07);color:var(--text);font-size:12px;font-weight:700}.a360-record-workspace .record-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(330px,.65fr);gap:18px;align-items:start}.a360-record-workspace .record-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px}.a360-record-workspace .record-card h2{margin:0 0 6px;font-size:18px}.a360-record-workspace .record-card>p{margin:0 0 16px;color:var(--muted)}.a360-record-workspace .report-editor{display:grid;gap:12px}.a360-record-workspace .report-editor label span,.a360-record-workspace .tailored-card label span{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.a360-record-workspace .report-editor input,.a360-record-workspace .report-editor textarea,.a360-record-workspace .tailored-card textarea{width:100%;border:1px solid var(--a360-field-border);background:var(--a360-field-surface);color:#0b1f3a;border-radius:11px;padding:11px 12px;font:inherit;box-shadow:0 1px 2px rgba(20,52,92,.025);outline:none}.a360-record-workspace .report-editor input:focus,.a360-record-workspace .report-editor textarea:focus,.a360-record-workspace .tailored-card textarea:focus{border-color:rgba(28,103,220,.42);box-shadow:0 0 0 3px rgba(28,103,220,.08)}.a360-record-workspace .report-editor textarea{min-height:112px;resize:vertical}.a360-record-workspace .tailored-card{margin-top:18px}.a360-record-workspace .tailored-card textarea{min-height:185px;resize:vertical}.a360-record-workspace .tailored-actions{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:10px}.a360-record-workspace .tailored-actions.top{justify-content:flex-end;margin:-2px 0 12px}.a360-record-workspace .record-note{font-size:11px!important;line-height:1.5;color:var(--muted)!important;margin:12px 0 0!important}.a360-record-workspace .saved-message{color:#15977f;font-size:11px;font-weight:750}.a360-record-workspace .legacy-note{margin:0 0 14px!important;padding:10px 12px;border:1px solid rgba(44,210,193,.25);border-radius:11px;background:rgba(44,210,193,.08);color:var(--text)!important;font-size:12px}.a360-record-workspace .next-step-card{background:linear-gradient(145deg,var(--panel),rgba(28,103,220,.055));border-color:rgba(28,103,220,.18)}.a360-record-workspace .next-step-time{display:block;margin:4px 0 15px;font-size:17px;line-height:1.35;color:var(--text)}.a360-record-workspace .next-step-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.a360-record-workspace .next-step-fact{padding:12px;border:1px solid var(--a360-field-border);border-radius:12px;background:var(--a360-field-surface);box-shadow:var(--a360-field-shadow)}.a360-record-workspace .next-step-fact small{display:block;color:var(--muted);font-size:10px;margin-bottom:4px}.a360-record-workspace .next-step-fact strong{font-size:13px;color:#0b1f3a}.a360-record-workspace .tool-kicker{display:block;margin-bottom:5px;color:#1766de;font-size:10px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.a360-record-workspace .a360-details-editor .summary-card{background:var(--a360-field-surface)!important;border-color:var(--a360-field-border)!important;box-shadow:var(--a360-field-shadow)!important}.a360-record-workspace .a360-details-editor .summary-card.accent{background:var(--a360-field-surface)!important;border-color:rgba(28,103,220,.25)!important;box-shadow:inset 0 3px 0 rgba(28,103,220,.11),var(--a360-field-shadow)!important}.a360-record-workspace .a360-details-editor .priority-summary{background:var(--a360-field-surface)!important;border-color:var(--a360-field-border)!important;box-shadow:0 1px 2px rgba(20,52,92,.025)!important}.a360-record-workspace .a360-details-editor .edit-group{background:rgba(247,250,253,.82)!important;border-color:rgba(24,63,110,.11)!important}.a360-record-workspace .a360-details-editor input,.a360-record-workspace .a360-details-editor select,.a360-record-workspace .a360-details-editor textarea,.a360-record-workspace .a360-details-editor .priority-option,.a360-record-workspace .a360-details-editor .pdf-option{background:var(--a360-field-surface)!important;border-color:var(--a360-field-border)!important;color:#0b1f3a!important;box-shadow:0 1px 2px rgba(20,52,92,.025)}.a360-record-workspace .a360-details-editor .priority-option.selected{background:rgba(44,210,193,.09)!important;border-color:rgba(44,210,193,.35)!important;box-shadow:none}.a360-record-workspace .a360-details-editor input:focus,.a360-record-workspace .a360-details-editor select:focus,.a360-record-workspace .a360-details-editor textarea:focus{border-color:rgba(28,103,220,.42)!important;box-shadow:0 0 0 3px rgba(28,103,220,.08)!important}@media(max-width:900px){.a360-record-workspace .record-hero{align-items:flex-start;flex-direction:column}.a360-record-workspace .record-grid{grid-template-columns:1fr}.a360-record-workspace .record-actions{justify-content:flex-start}.a360-record-workspace .tailored-card{margin-top:18px}}`}</style>
    <div className="record-hero">
      <div><span className="eyebrow">A360 conversation record</span><h1>{d.organizationName || d.contactName}</h1><p>This workspace preserves what was discussed before the onsite assessment and turns it into a polished, client-facing recap without treating reported information as verified.</p><div className="record-hero-meta"><span>{d.contactName || "Contact not captured"}</span><span>{range}/mo planning range</span><span>{formatPlanningAppointment(activeRecord.appointment)}</span></div></div>
      <div className="record-actions"><Link className="button secondary" href="/">← Workspaces</Link><button className="button secondary" type="button" onClick={useLatestA360Copy}>Use latest A360 recap</button><button className="button primary" type="button" onClick={printReport}>Open PDF report</button></div>
    </div>
    {message ? <div className="record-feedback" role="status">{message}</div> : null}

    <A360PresentationDetailsEditor project={project} onUpdate={onUpdate} />

    <div className="record-grid">
      <section className="record-card"><span className="tool-kicker">Client PDF content</span><h2>Client-facing report copy</h2><p>Edit the narrative only when you want to refine how the conversation is presented. The captured details above remain the source record.</p>{legacyDefaultCopy ? <p className="legacy-note">This workspace has older A360 wording saved in it. Opening the PDF will refresh that copy automatically, or you can use <strong>Use latest A360 recap</strong> now.</p> : null}<div className="report-editor">
        <label><span>Report title</span><input value={normalizeA360PriorityText(activeRecord.report.title)} onChange={(event) => updateReport("title", event.target.value)} /></label>
        <label><span>Executive summary</span><textarea value={normalizeA360PriorityText(activeRecord.report.executiveSummary)} onChange={(event) => updateReport("executiveSummary", event.target.value)} /></label>
        <label><span>Conversation summary</span><textarea value={normalizeA360PriorityText(activeRecord.report.conversationSummary)} onChange={(event) => updateReport("conversationSummary", event.target.value)} /></label>
        <label><span>Next step</span><textarea value={normalizeA360PriorityText(activeRecord.report.nextStepSummary)} onChange={(event) => updateReport("nextStepSummary", event.target.value)} /></label>
      </div></section>

      <aside>
        <section className="record-card next-step-card"><span className="tool-kicker">Already scheduled</span><h2>Next step</h2><strong className="next-step-time">{formatPlanningAppointment(activeRecord.appointment)}</strong><div className="next-step-facts"><div className="next-step-fact"><small>Technology Consultant</small><strong>{activeRecord.appointment.consultantName || "Not assigned"}</strong></div><div className="next-step-fact"><small>Planning range</small><strong>{range}/mo</strong></div></div><p className="record-note">The appointment time zone is stored with the record and shown consistently in the presentation and exported report.</p></section>

        <section className="record-card tailored-card"><span className="tool-kicker">Optional writing assist</span><h2>Tailored report prompt</h2><p>Copy the purpose-built prompt, run it through ChatGPT, then paste the four labeled sections back here to polish this specific recap.</p><div className="tailored-actions top"><button className="button secondary compact" type="button" onClick={copyPrompt}>{copied ? "Copied" : "Copy tailored prompt"}</button></div><label><span>Paste tailored response</span><textarea value={tailoredOutput} onChange={(event) => setTailoredOutput(event.target.value)} placeholder="REPORT TITLE: …\nEXECUTIVE SUMMARY: …\nCONVERSATION SUMMARY: …\nNEXT STEP: …" /></label><div className="tailored-actions"><span className="saved-message">{tailoredOutput.trim() ? "Ready to apply" : ""}</span><button className="button primary compact" type="button" disabled={!tailoredOutput.trim()} onClick={applyTailoredOutput}>Apply to report</button></div><p className="record-note">The exported recap stays prospect-safe: it does not present the environment, risks, security posture, or recommendations as technically verified before the onsite assessment.</p></section>
      </aside>
    </div>
  </main>;
}
