"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/projects/types";
import { useProjects } from "@/lib/projects/store";
import {
  downloadInternalTcReportPdf,
  formatInternalTcMoney,
  internalTcReportModel,
} from "@/lib/outcomes/internal-tc-report";

function projectReadyLabel(project: Project): string {
  if (project.presentation.executiveSummary) return "Report ready";
  if (project.status === "sources-needed") return "Needs sources";
  if (project.status === "review-needed") return "Needs review";
  return "Source data available";
}

export function InternalTcReportGenerator() {
  const { projects } = useProjects();
  const candidates = useMemo(
    () => projects.filter((project) => project.type === "client-report").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects],
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("id")?.trim() || "";
    if (requested && candidates.some((project) => project.id === requested)) setSelectedId(requested);
    else if (!selectedId && candidates[0]) setSelectedId(candidates[0].id);
  }, [candidates, selectedId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((project) => `${project.client.name} ${project.name}`.toLowerCase().includes(needle));
  }, [candidates, query]);
  const project = candidates.find((item) => item.id === selectedId) ?? null;
  const model = project ? internalTcReportModel(project) : null;

  const download = async () => {
    if (!project || downloading) return;
    setDownloading(true);
    try { await downloadInternalTcReportPdf(project); }
    finally { setDownloading(false); }
  };

  return (
    <div className="internal-tc-generator">
      <style>{`
        .internal-tc-generator{padding:28px 34px 70px;max-width:1600px;margin:0 auto;color:#12314f}.itc-hero{display:flex;justify-content:space-between;gap:20px;align-items:end;padding:28px 30px;border-radius:24px;background:linear-gradient(135deg,#0c315f,#164e82);color:white;box-shadow:0 18px 50px rgba(18,49,79,.18)}.itc-hero h1{margin:6px 0 8px;font-size:38px;letter-spacing:-.04em}.itc-hero p{margin:0;color:#d8e9f8;max-width:760px;line-height:1.5}.itc-kicker{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#71d9ff}.itc-internal{padding:8px 11px;border-radius:999px;background:#ffebe6;color:#a63827;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.itc-layout{display:grid;grid-template-columns:310px minmax(0,1fr);gap:18px;margin-top:18px}.itc-sidebar,.itc-report{background:#fff;border:1px solid #dbe5ef;border-radius:22px;box-shadow:0 14px 34px rgba(21,53,84,.07)}.itc-sidebar{padding:18px;align-self:start;position:sticky;top:84px}.itc-sidebar h2{font-size:16px;margin:0 0 12px}.itc-search{width:100%;border:1px solid #d5e0eb;border-radius:12px;padding:11px 12px;margin-bottom:10px}.itc-project-list{display:grid;gap:7px;max-height:620px;overflow:auto}.itc-project{display:block;text-align:left;width:100%;border:1px solid transparent;background:#f7fafd;border-radius:12px;padding:11px 12px;color:#173b5f;cursor:pointer}.itc-project:hover{border-color:#b9d4ea}.itc-project.active{border-color:#55a7df;background:#eaf6ff}.itc-project strong,.itc-project span{display:block}.itc-project strong{font-size:12px}.itc-project span{font-size:9px;color:#6d8195;margin-top:3px}.itc-report{padding:24px}.itc-toolbar{display:flex;justify-content:space-between;gap:14px;align-items:center;padding-bottom:18px;border-bottom:1px solid #e1e8ef}.itc-toolbar h2{font-size:22px;margin:0}.itc-toolbar small{display:block;color:#70849a;margin-top:4px}.itc-toolbar-actions{display:flex;gap:8px}.itc-button{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:11px;border:1px solid #c9d8e6;background:#fff;color:#1c5a8f;font-weight:800;font-size:11px;text-decoration:none;cursor:pointer}.itc-button.primary{background:#147bc1;color:white;border-color:#147bc1}.itc-button:disabled{opacity:.55;cursor:wait}.itc-summary{margin:18px 0;padding:15px 17px;background:#eff7fd;border-left:5px solid #238bd2;border-radius:10px;font-size:12px;line-height:1.55;color:#436079}.itc-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.itc-metric{border:1px solid #dbe5ef;border-radius:13px;padding:13px;background:#fbfdff}.itc-metric strong{display:block;font-size:22px;color:#173f68}.itc-metric span{display:block;margin-top:5px;font-size:8px;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:#71849a}.itc-section{margin-top:22px}.itc-section-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:9px}.itc-section-head h3{margin:0;font-size:17px}.itc-section-head span{font-size:8px;color:#8090a0;text-transform:uppercase;letter-spacing:.08em}.itc-priority-list{display:grid;gap:8px}.itc-priority{display:grid;grid-template-columns:1fr auto;gap:12px;border:1px solid #dbe5ef;border-left:5px solid #5f94c7;border-radius:12px;padding:12px 13px}.itc-priority.critical{border-left-color:#e15b48}.itc-priority.planning{border-left-color:#d6a52e}.itc-priority h4{margin:0 0 4px;font-size:12px}.itc-priority p{margin:0;font-size:10px;line-height:1.4;color:#65798e}.itc-priority aside{text-align:right}.itc-priority aside strong{display:block;font-size:12px}.itc-priority aside small{font-size:8px;color:#72859a}.itc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.itc-panel{border:1px solid #dbe5ef;border-radius:13px;padding:13px}.itc-panel h4{margin:0 0 8px;font-size:12px}.itc-panel p,.itc-panel li{font-size:10px;line-height:1.45;color:#61768b}.itc-panel ul{margin:0;padding-left:16px}.itc-device-table-wrap{overflow:auto;border:1px solid #dbe5ef;border-radius:13px}.itc-device-table{border-collapse:collapse;width:100%;min-width:880px;font-size:9px}.itc-device-table th{text-align:left;background:#153e67;color:white;padding:9px 8px;font-size:8px;letter-spacing:.06em;text-transform:uppercase}.itc-device-table td{padding:9px 8px;border-bottom:1px solid #e4eaf0;vertical-align:top}.itc-device-table strong{display:block}.itc-device-table small{display:block;color:#71849a;margin-top:2px}.itc-badge{display:inline-block;padding:4px 7px;border-radius:999px;background:#edf2f7;font-size:7px;font-weight:900}.itc-badge.critical{background:#ffe5df;color:#a73c2c}.itc-badge.planning{background:#fff0c8;color:#805d10}.itc-badge.healthy{background:#def4eb;color:#17705c}.itc-empty{padding:60px 30px;text-align:center;border:1px dashed #cbd8e5;border-radius:20px;background:#fff}.itc-empty h2{margin:0 0 8px}.itc-empty p{color:#6d8094;margin:0 0 18px}@media(max-width:1000px){.itc-layout{grid-template-columns:1fr}.itc-sidebar{position:static}.itc-project-list{max-height:240px}.itc-metrics{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <header className="itc-hero">
        <div>
          <span className="itc-kicker">Report Generator · Internal</span>
          <h1>Technology Consultant Report</h1>
          <p>A dense internal briefing built from the same Technology Review workspace. No client presentation language—just technical status, project priorities, risks, open questions, and an onsite verification checklist.</p>
        </div>
        <span className="itc-internal">Internal use only</span>
      </header>

      {candidates.length === 0 ? (
        <div className="itc-empty" style={{ marginTop: 18 }}>
          <h2>No Technology Review workspaces yet</h2>
          <p>Create a Technology Review first so the internal report can use the same Compass, security, HIPAA, and Review Outcome data.</p>
          <Link className="itc-button primary" href="/create/?type=client-report">Create Technology Review</Link>
        </div>
      ) : (
        <div className="itc-layout">
          <aside className="itc-sidebar">
            <h2>Select client report</h2>
            <input className="itc-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients" aria-label="Search client reports" />
            <div className="itc-project-list">
              {filtered.map((item) => (
                <button key={item.id} type="button" className={`itc-project${item.id === selectedId ? " active" : ""}`} onClick={() => setSelectedId(item.id)}>
                  <strong>{item.client.name}</strong>
                  <span>{projectReadyLabel(item)} · {new Date(item.updatedAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </aside>

          {project && model ? (
            <main className="itc-report">
              <div className="itc-toolbar">
                <div><h2>{model.clientName}</h2><small>TC briefing · Prepared {model.prepared}</small></div>
                <div className="itc-toolbar-actions">
                  <Link className="itc-button" href={`/project/?id=${encodeURIComponent(project.id)}`}>Open source report</Link>
                  <button className="itc-button primary" type="button" disabled={downloading} onClick={() => void download()}>{downloading ? "Building PDF…" : "Download internal PDF"}</button>
                </div>
              </div>

              <div className="itc-summary">{model.summary}</div>
              <div className="itc-metrics">
                <article className="itc-metric"><strong>{model.metrics.inventory}</strong><span>Managed devices</span></article>
                <article className="itc-metric"><strong>{model.metrics.replaceNow}</strong><span>Replace now</span></article>
                <article className="itc-metric"><strong>{model.metrics.planSoon}</strong><span>Plan soon</span></article>
                <article className="itc-metric"><strong>{formatInternalTcMoney(model.metrics.projectNeed)}</strong><span>Packaged project need</span></article>
                <article className="itc-metric"><strong>{model.metrics.osAttention}</strong><span>OS concerns</span></article>
                <article className="itc-metric"><strong>{model.metrics.storageAttention}</strong><span>Storage concerns</span></article>
                <article className="itc-metric"><strong>{model.security.incidents}</strong><span>Security incidents</span></article>
                <article className="itc-metric"><strong>{model.hipaa.enabled ? `${model.hipaa.score}%` : "N/A"}</strong><span>HIPAA readiness</span></article>
              </div>

              <section className="itc-section">
                <div className="itc-section-head"><h3>Priority work</h3><span>Project packaging + technical flags</span></div>
                <div className="itc-priority-list">
                  {model.priorities.length ? model.priorities.slice(0, 10).map((item, index) => (
                    <article key={`${item.title}-${index}`} className={`itc-priority ${item.tone}`}>
                      <div><h4>{item.title}</h4><p>{item.detail || "Verify scope and current state."}</p></div>
                      <aside><strong>{item.value ? formatInternalTcMoney(item.value) : "Verify"}</strong><small>{item.timing}{item.quoted ? " · Quoted" : ""}</small></aside>
                    </article>
                  )) : <div className="itc-panel"><p>No packaged project priorities are currently recorded.</p></div>}
                </div>
              </section>

              <section className="itc-section">
                <div className="itc-section-head"><h3>Technical inventory</h3><span>Priority ordered</span></div>
                <div className="itc-device-table-wrap">
                  <table className="itc-device-table">
                    <thead><tr><th>Device</th><th>Type / Site</th><th>OS</th><th>Lifecycle</th><th>Warranty</th><th>Storage / concern</th></tr></thead>
                    <tbody>{model.devices.slice(0, 24).map((device, index) => <tr key={`${device.name}-${index}`}><td><strong>{device.name}</strong><small>{device.model}</small></td><td>{device.type}<small>{device.location}</small></td><td>{device.os}</td><td><span className={`itc-badge ${device.lifecycleTone}`}>{device.lifecycle}</span><small>{device.age}</small></td><td><span className={`itc-badge ${device.warrantyTone}`}>{device.warranty}</span></td><td><span className={`itc-badge ${device.storageTone}`}>{device.storageTone === "critical" ? "Critical" : device.storageTone === "planning" ? "Watch" : device.storageTone === "healthy" ? "Healthy" : "Unknown"}</span><small>{device.concern}</small></td></tr>)}</tbody>
                  </table>
                </div>
              </section>

              <section className="itc-section">
                <div className="itc-section-head"><h3>Security, readiness &amp; context</h3><span>Internal notes</span></div>
                <div className="itc-grid">
                  <article className="itc-panel"><h4>Security source</h4><ul><li>{model.security.events.toLocaleString()} events analyzed</li><li>{model.security.signals} signals detected</li><li>{model.security.incidents} reported incidents</li><li>{model.security.malwareBlocked} malware files blocked</li><li>{model.security.canaries} canary files monitored</li></ul></article>
                  <article className="itc-panel"><h4>HIPAA readiness</h4>{model.hipaa.enabled ? <ul><li>{model.hipaa.score}% · {model.hipaa.label}</li><li>{model.hipaa.unanswered} unanswered/deferred</li><li>{model.hipaa.highRisk} high/critical risk items</li></ul> : <p>HIPAA readiness is not enabled in this workspace.</p>}</article>
                  <article className="itc-panel"><h4>Company / meeting context</h4>{model.context.length ? <ul>{model.context.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul> : <p>No additional context entered.</p>}</article>
                  <article className="itc-panel"><h4>Open questions</h4>{model.openQuestions.length ? <ul>{model.openQuestions.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul> : <p>No open intelligence or HIPAA questions are currently flagged.</p>}</article>
                </div>
              </section>

              <section className="itc-section">
                <div className="itc-section-head"><h3>Before you leave</h3><span>Verification checklist</span></div>
                <article className="itc-panel"><ul>{model.beforeYouLeave.map((item) => <li key={item}>{item}</li>)}</ul></article>
              </section>
            </main>
          ) : <div className="itc-empty"><h2>Select a client</h2><p>Choose a Technology Review workspace to build the TC briefing.</p></div>}
        </div>
      )}
    </div>
  );
}
