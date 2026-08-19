"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { A360PresentationDetailsEditor } from "@/components/a360-presentation-details-editor";
import type { A360ConversationRecord, A360ConversationReportCopy, Project } from "@/lib/projects/types";
import { buildA360TailoredReportPrompt, defaultA360ConversationReport, parseA360TailoredReport } from "@/lib/prospects/a360-conversation";
import { printReadableA360ConversationReport } from "@/lib/prospects/a360-readable-report-export";
import { a360PriorityLabel, normalizeA360PriorityText } from "@/lib/prospects/a360";

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
    setMessage("Latest A360 recap copy applied.");
    window.setTimeout(() => setMessage(""), 2200);
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
    setMessage("Tailored copy applied.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  function printReport() {
    try {
      if (legacyDefaultCopy) {
        const latest = projectWithLatestA360Copy();
        onUpdate(latest.project);
        printReadableA360ConversationReport(latest.record);
        setMessage("Recap copy refreshed before export.");
        window.setTimeout(() => setMessage(""), 2200);
        return;
      }
      printReadableA360ConversationReport(activeRecord);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The report could not be opened.");
    }
  }

  return <main className="workspace-page a360-record-workspace">
    <style>{`.a360-record-workspace{max-width:1320px;margin:0 auto;padding-bottom:72px}.a360-record-workspace .record-hero{display:flex;justify-content:space-between;gap:28px;align-items:flex-end;padding:30px 0 20px}.a360-record-workspace .record-hero h1{margin:5px 0 0;font-size:36px}.a360-record-workspace .record-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.a360-record-workspace .record-feedback{margin:-6px 0 14px;padding:9px 12px;border:1px solid rgba(44,210,193,.24);border-radius:11px;background:rgba(44,210,193,.07);color:var(--text);font-size:12px;font-weight:700}.a360-record-workspace .record-card{background:#fff;border:1px solid rgba(24,63,110,.12);border-radius:18px;padding:20px;box-shadow:0 10px 28px rgba(36,73,115,.045)}.a360-record-workspace .pdf-card{margin-top:18px}.a360-record-workspace .pdf-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.a360-record-workspace .pdf-card-header h2{margin:2px 0 0;font-size:20px}.a360-record-workspace .tool-kicker{display:block;color:#1766de;font-size:10px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.a360-record-workspace .report-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.a360-record-workspace .report-editor .full{grid-column:1/-1}.a360-record-workspace .report-editor label span,.a360-record-workspace .tailored-body label span{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.a360-record-workspace .report-editor input,.a360-record-workspace .report-editor textarea,.a360-record-workspace .tailored-body textarea{width:100%;border:1px solid #d5e2ef;background:#f6faff;color:#0b1f3a;border-radius:11px;padding:11px 12px;font:inherit;outline:none}.a360-record-workspace .report-editor input:focus,.a360-record-workspace .report-editor textarea:focus,.a360-record-workspace .tailored-body textarea:focus{background:#fff;border-color:rgba(28,103,220,.42);box-shadow:0 0 0 3px rgba(28,103,220,.08)}.a360-record-workspace .report-editor textarea{min-height:138px;resize:vertical}.a360-record-workspace .report-editor .full textarea{min-height:112px}.a360-record-workspace .legacy-note{margin:0 0 14px;padding:10px 12px;border:1px solid rgba(44,210,193,.25);border-radius:11px;background:rgba(44,210,193,.08);color:var(--text);font-size:12px}.a360-record-workspace .tailored-tool{margin-top:14px;border-top:1px solid rgba(24,63,110,.1);padding-top:12px}.a360-record-workspace .tailored-tool summary{cursor:pointer;list-style:none;font-size:12px;font-weight:800;color:#24445f}.a360-record-workspace .tailored-tool summary::-webkit-details-marker{display:none}.a360-record-workspace .tailored-tool summary::before{content:"+";display:inline-grid;place-items:center;width:18px;height:18px;margin-right:7px;border:1px solid #c9d9e8;border-radius:6px;background:#f6faff;color:#1766de;font-weight:900}.a360-record-workspace .tailored-tool[open] summary::before{content:"–"}.a360-record-workspace .tailored-body{margin-top:12px;padding:14px;border:1px solid #dbe6f0;border-radius:13px;background:#f8fbfe}.a360-record-workspace .tailored-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.a360-record-workspace .tailored-body textarea{min-height:145px;resize:vertical}.a360-record-workspace .tailored-actions{display:flex;justify-content:flex-end;margin-top:9px}.a360-record-workspace .report-footer{display:flex;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid rgba(24,63,110,.1)}@media(max-width:900px){.a360-record-workspace .record-hero{align-items:flex-start;flex-direction:column}.a360-record-workspace .record-actions{justify-content:flex-start}.a360-record-workspace .report-editor{grid-template-columns:1fr}.a360-record-workspace .report-editor .full{grid-column:auto}.a360-record-workspace .pdf-card-header{align-items:flex-start;flex-direction:column}}`}</style>

    <div className="record-hero">
      <div><span className="eyebrow">A360 conversation record</span><h1>{d.organizationName || d.contactName}</h1></div>
      <div className="record-actions"><Link className="button secondary" href="/">← Workspaces</Link><button className="button primary" type="button" onClick={printReport}>Open PDF report</button></div>
    </div>
    {message ? <div className="record-feedback" role="status">{message}</div> : null}

    <A360PresentationDetailsEditor project={project} onUpdate={onUpdate} />

    <section className="record-card pdf-card">
      <div className="pdf-card-header"><div><span className="tool-kicker">Client PDF</span><h2>Report copy</h2></div><button className="button secondary compact" type="button" onClick={useLatestA360Copy}>Use latest A360 recap</button></div>
      {legacyDefaultCopy ? <p className="legacy-note">Older recap wording is saved in this record. Opening the PDF will refresh it automatically.</p> : null}
      <div className="report-editor">
        <label className="full"><span>Report title</span><input value={normalizeA360PriorityText(activeRecord.report.title)} onChange={(event) => updateReport("title", event.target.value)} /></label>
        <label><span>Executive summary</span><textarea value={normalizeA360PriorityText(activeRecord.report.executiveSummary)} onChange={(event) => updateReport("executiveSummary", event.target.value)} /></label>
        <label><span>Conversation summary</span><textarea value={normalizeA360PriorityText(activeRecord.report.conversationSummary)} onChange={(event) => updateReport("conversationSummary", event.target.value)} /></label>
        <label className="full"><span>Next step</span><textarea value={normalizeA360PriorityText(activeRecord.report.nextStepSummary)} onChange={(event) => updateReport("nextStepSummary", event.target.value)} /></label>
      </div>

      <details className="tailored-tool">
        <summary>Optional: tailor copy with ChatGPT</summary>
        <div className="tailored-body"><div className="tailored-row"><span className="tool-kicker">Tailored report prompt</span><button className="button secondary compact" type="button" onClick={copyPrompt}>{copied ? "Copied" : "Copy prompt"}</button></div><label><span>Paste tailored response</span><textarea value={tailoredOutput} onChange={(event) => setTailoredOutput(event.target.value)} placeholder="REPORT TITLE: …\nEXECUTIVE SUMMARY: …\nCONVERSATION SUMMARY: …\nNEXT STEP: …" /></label><div className="tailored-actions"><button className="button primary compact" type="button" disabled={!tailoredOutput.trim()} onClick={applyTailoredOutput}>Apply to report</button></div></div>
      </details>

      <div className="report-footer"><button className="button primary" type="button" onClick={printReport}>Open PDF report</button></div>
    </section>
  </main>;
}
