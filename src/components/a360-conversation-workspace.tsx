"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { A360ConversationRecord, A360ConversationReportCopy, Project } from "@/lib/projects/types";
import { buildA360TailoredReportPrompt, defaultA360ConversationReport, parseA360TailoredReport } from "@/lib/prospects/a360-conversation";
import { printA360ConversationReport } from "@/lib/prospects/a360-report-export";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function hasLegacyDefaultA360Copy(project: Project): boolean {
  const report = project.a360Conversation?.report;
  if (!report) return false;
  const combined = `${report.executiveSummary}\n${report.conversationSummary}\n${report.nextStepSummary}`;
  const signatures = [
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
  return signatures.filter(Boolean).length >= 2;
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
    const report = defaultA360ConversationReport(activeRecord.discovery, activeRecord.appointment);
    const refreshedRecord: A360ConversationRecord = { ...activeRecord, report };
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
        printA360ConversationReport(latest.record);
        setMessage("Saved A360 wording was refreshed automatically before export.");
        window.setTimeout(() => setMessage(""), 3000);
        return;
      }
      printA360ConversationReport(activeRecord);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The report could not be opened.");
    }
  }

  return <main className="workspace-page a360-record-workspace">
    <style>{`.a360-record-workspace{max-width:1320px;margin:0 auto;padding-bottom:72px}.a360-record-workspace .record-hero{display:flex;justify-content:space-between;gap:28px;align-items:flex-end;padding:30px 0 22px}.a360-record-workspace .record-hero h1{margin:5px 0 8px;font-size:36px}.a360-record-workspace .record-hero p{max-width:760px;color:var(--muted);margin:0}.a360-record-workspace .record-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.a360-record-workspace .record-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(320px,.6fr);gap:18px}.a360-record-workspace .record-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px}.a360-record-workspace .record-card h2{margin:0 0 6px;font-size:18px}.a360-record-workspace .record-card>p{margin:0 0 16px;color:var(--muted)}.a360-record-workspace .record-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.a360-record-workspace .record-fact{padding:13px;border-radius:12px;background:var(--panel-strong);border:1px solid var(--line)}.a360-record-workspace .record-fact small{display:block;color:var(--muted);margin-bottom:4px}.a360-record-workspace .record-fact strong{font-size:14px}.a360-record-workspace .priority-chips{display:flex;gap:7px;flex-wrap:wrap}.a360-record-workspace .priority-chips span{padding:7px 10px;border-radius:999px;background:rgba(44,210,193,.1);border:1px solid rgba(44,210,193,.22);font-size:12px}.a360-record-workspace .report-editor{display:grid;gap:12px}.a360-record-workspace .report-editor label span,.a360-record-workspace .tailored-box label span{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.a360-record-workspace .report-editor input,.a360-record-workspace .report-editor textarea,.a360-record-workspace .tailored-box textarea{width:100%;border:1px solid var(--line);background:var(--panel-strong);color:var(--text);border-radius:11px;padding:11px 12px;font:inherit}.a360-record-workspace .report-editor textarea{min-height:112px;resize:vertical}.a360-record-workspace .tailored-box{margin-top:18px}.a360-record-workspace .tailored-box textarea{min-height:165px;resize:vertical}.a360-record-workspace .tailored-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:9px}.a360-record-workspace .record-note{font-size:12px;color:var(--muted);margin-top:12px}.a360-record-workspace .saved-message{color:#65d8ca;font-size:12px;font-weight:700}.a360-record-workspace .legacy-note{margin:0 0 14px;padding:10px 12px;border:1px solid rgba(44,210,193,.25);border-radius:11px;background:rgba(44,210,193,.08);color:var(--text);font-size:12px}@media(max-width:900px){.a360-record-workspace .record-hero{align-items:flex-start;flex-direction:column}.a360-record-workspace .record-grid{grid-template-columns:1fr}.a360-record-workspace .record-actions{justify-content:flex-start}}`}</style>
    <div className="record-hero">
      <div><span className="eyebrow">A360 conversation record</span><h1>{d.organizationName || d.contactName}</h1><p>This workspace preserves what was discussed before the onsite assessment and turns it into a polished, client-facing recap without treating reported information as verified.</p></div>
      <div className="record-actions"><Link className="button secondary" href="/">← Workspaces</Link><button className="button secondary" type="button" onClick={useLatestA360Copy}>Use latest A360 recap</button><button className="button primary" type="button" onClick={printReport}>Open PDF report</button></div>
    </div>

    <div className="record-grid">
      <section className="record-card"><h2>Client-facing report copy</h2><p>Edit anything below before opening the PDF. Changes save with this workspace.</p>{legacyDefaultCopy ? <p className="legacy-note">This workspace has older A360 wording saved in it. Opening the PDF will refresh that copy automatically, or you can use <strong>Use latest A360 recap</strong> now.</p> : null}<div className="report-editor">
        <label><span>Report title</span><input value={activeRecord.report.title} onChange={(event) => updateReport("title", event.target.value)} /></label>
        <label><span>Executive summary</span><textarea value={activeRecord.report.executiveSummary} onChange={(event) => updateReport("executiveSummary", event.target.value)} /></label>
        <label><span>Conversation summary</span><textarea value={activeRecord.report.conversationSummary} onChange={(event) => updateReport("conversationSummary", event.target.value)} /></label>
        <label><span>Next step</span><textarea value={activeRecord.report.nextStepSummary} onChange={(event) => updateReport("nextStepSummary", event.target.value)} /></label>
      </div>
      <div className="tailored-box"><h2>Tailored report prompt</h2><p>Copy the purpose-built prompt, run it through ChatGPT, then paste the four labeled sections back here to polish this specific recap.</p><div className="tailored-actions"><button className="button secondary compact" type="button" onClick={copyPrompt}>{copied ? "Copied" : "Copy tailored prompt"}</button></div><label><span>Paste tailored response</span><textarea value={tailoredOutput} onChange={(event) => setTailoredOutput(event.target.value)} placeholder="REPORT TITLE: …\nEXECUTIVE SUMMARY: …\nCONVERSATION SUMMARY: …\nNEXT STEP: …" /></label><div className="tailored-actions"><span className="saved-message">{message}</span><button className="button primary compact" type="button" disabled={!tailoredOutput.trim()} onClick={applyTailoredOutput}>Apply to report</button></div></div>
      </section>

      <aside><section className="record-card"><h2>Conversation snapshot</h2><p>Reported by the potential client; onsite validation is still pending.</p><div className="priority-chips">{d.priorities.map((priority) => <span key={priority}>{priority}</span>)}</div><div className="record-facts" style={{marginTop:12}}><div className="record-fact"><small>Workstations</small><strong>{d.workstations || "Not provided"}</strong></div><div className="record-fact"><small>Locations</small><strong>{d.locations}</strong></div><div className="record-fact"><small>Server</small><strong>{d.server === "not-sure" ? "Not sure" : d.server === "yes" ? "Reported yes" : "Reported no"}</strong></div><div className="record-fact"><small>Planning range</small><strong>{range}/mo</strong></div><div className="record-fact"><small>Management software</small><strong>{d.managementSoftware || "Not provided"}</strong></div><div className="record-fact"><small>Imaging</small><strong>{[d.imagingSoftware,d.imagingEnvironment].filter(Boolean).join(" · ") || "Not provided"}</strong></div></div></section>
      <section className="record-card" style={{marginTop:18}}><h2>Next step</h2><p>{formatPlanningAppointment(activeRecord.appointment)}</p><div className="record-fact"><small>Technology Consultant</small><strong>{activeRecord.appointment.consultantName}</strong></div><p className="record-note">The exported report deliberately avoids internal sales workflow language and does not state that the environment, security posture, risks, or recommendations have already been verified.</p></section></aside>
    </div>
  </main>;
}
