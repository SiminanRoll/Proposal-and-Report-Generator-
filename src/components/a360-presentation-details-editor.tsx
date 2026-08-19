"use client";

import { useState } from "react";
import type { A360ConversationRecord, Project } from "@/lib/projects/types";
import {
  A360_PRIORITY_OPTIONS,
  a360PriorityLabel,
  type A360ProspectDiscovery,
  type ImagingEnvironment,
  type OrganizationLanguage,
  type ProspectIndustry,
  type ServerAnswer,
} from "@/lib/prospects/a360";
import {
  formatPlanningAppointment,
  PLANNING_TIME_ZONES,
  planningTimeZoneOptionLabel,
} from "@/lib/outcomes/planning-appointment";

type A360ConversationRecordWithPdfOptions = A360ConversationRecord & {
  includeLifecyclePlanning?: boolean;
};

function estimateAssumptions(discovery: A360ProspectDiscovery): string[] {
  const locations = Math.max(1, Math.round(discovery.locations || 1));
  const workstations = Math.max(0, Math.round(discovery.workstations || 0));
  return [
    `${locations} ${locations === 1 ? "location" : "locations"}`,
    `${workstations} ${workstations === 1 ? "workstation" : "workstations"}`,
    discovery.server === "yes" ? "1 onsite server" : discovery.server === "no" ? "No onsite server" : "Server details to confirm onsite",
  ];
}

function safeNumber(value: string, fallback: number, minimum = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function A360PresentationDetailsEditor({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const record = project.a360Conversation;
  const [editing, setEditing] = useState(false);
  if (!record) return null;
  const activeRecord: A360ConversationRecordWithPdfOptions = record;

  const discovery = activeRecord.discovery;
  const knownPriorities = discovery.priorities.map(a360PriorityLabel);
  const customPriorities = knownPriorities.filter((priority) => !A360_PRIORITY_OPTIONS.includes(priority as (typeof A360_PRIORITY_OPTIONS)[number]));
  const estimateRange = activeRecord.estimate.low === activeRecord.estimate.high
    ? `${money(activeRecord.estimate.low)}/mo`
    : `${money(activeRecord.estimate.low)}–${money(activeRecord.estimate.high)}/mo`;
  const serverSummary = discovery.server === "yes" ? "Onsite server" : discovery.server === "no" ? "No onsite server" : "Server to confirm onsite";
  const imagingSummary = [discovery.imagingSoftware, discovery.imagingEnvironment].filter(Boolean).join(" · ") || "Not provided";
  const softwareSummary = [discovery.managementSoftware, discovery.otherSoftware].filter(Boolean).join(" · ") || "Not provided";
  const currentTimeZoneKnown = PLANNING_TIME_ZONES.some((item) => item.value === activeRecord.appointment.timeZone);

  function save(nextRecord: A360ConversationRecordWithPdfOptions) {
    const nextDiscovery = nextRecord.discovery;
    const organizationName = nextDiscovery.organizationName.trim() || nextDiscovery.contactName.trim() || project.client.name;
    const existingPrimary = project.client.contacts.findIndex((contact) => contact.primary);
    const contacts = [...project.client.contacts];
    const primaryContact = {
      id: existingPrimary >= 0 ? contacts[existingPrimary].id : `contact-a360-${nextRecord.handoffId}`,
      name: nextDiscovery.contactName,
      role: existingPrimary >= 0 ? contacts[existingPrimary].role : "",
      email: nextRecord.contactEmail,
      phone: nextRecord.contactPhone,
      primary: true,
    };
    if (existingPrimary >= 0) contacts[existingPrimary] = { ...contacts[existingPrimary], ...primaryContact };
    else contacts.unshift(primaryContact);

    onUpdate({
      ...project,
      name: organizationName ? `${organizationName} — A360 Conversation` : project.name,
      updatedAt: new Date().toISOString(),
      client: {
        ...project.client,
        name: organizationName,
        industry: nextDiscovery.industry,
        organizationTerm: nextDiscovery.organizationLanguage,
        contacts,
      },
      painPoints: nextDiscovery.priorities.map(a360PriorityLabel),
      pricing: { ...project.pricing, monthly: nextRecord.estimate.low },
      planningAppointment: nextRecord.appointment,
      a360Conversation: nextRecord,
    });
  }

  function updateDiscovery(patch: Partial<A360ProspectDiscovery>) {
    const nextDiscovery = { ...discovery, ...patch };
    save({
      ...activeRecord,
      discovery: nextDiscovery,
      estimate: { ...activeRecord.estimate, assumptions: estimateAssumptions(nextDiscovery) },
    });
  }

  function togglePriority(priority: string) {
    const normalized = discovery.priorities.map(a360PriorityLabel);
    const nextPriorities = normalized.includes(priority)
      ? normalized.filter((item) => item !== priority)
      : [...normalized, priority];
    updateDiscovery({ priorities: nextPriorities });
  }

  function updateCustomPriorities(value: string) {
    const selectedKnown = discovery.priorities
      .map(a360PriorityLabel)
      .filter((priority) => A360_PRIORITY_OPTIONS.includes(priority as (typeof A360_PRIORITY_OPTIONS)[number]));
    const custom = value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
    updateDiscovery({ priorities: [...selectedKnown, ...custom] });
  }

  function updateEstimate(key: "low" | "high", value: string) {
    const amount = safeNumber(value, activeRecord.estimate[key]);
    const low = key === "low" ? amount : Math.min(activeRecord.estimate.low, amount);
    const high = key === "high" ? amount : Math.max(activeRecord.estimate.high, amount);
    save({ ...activeRecord, estimate: { ...activeRecord.estimate, low, high } });
  }

  function updateAppointment(key: "date" | "time" | "timeZone" | "consultantName", value: string) {
    save({ ...activeRecord, appointment: { ...activeRecord.appointment, [key]: value } });
  }

  function updateLifecyclePlanning(value: boolean) {
    save({ ...activeRecord, includeLifecyclePlanning: value });
  }

  return <section className={`record-card a360-details-editor ${editing ? "editing" : "summary"}`}>
    <style>{`.a360-details-editor{margin-bottom:18px;padding:0!important;overflow:hidden;background:#edf4fb!important}.a360-details-editor .details-header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;border-bottom:1px solid rgba(24,63,110,.1);background:linear-gradient(135deg,#f6f9fd,#eef7f6)}.a360-details-editor .details-heading h2{margin:0;font-size:17px}.a360-details-editor .summary-body{padding:16px 18px 18px}.a360-details-editor .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.a360-details-editor .summary-card{min-height:122px;padding:14px;border:1px solid rgba(24,63,110,.12);border-radius:13px;background:#fff;box-shadow:0 5px 16px rgba(36,73,115,.035)}.a360-details-editor .summary-label,.a360-details-editor label>span,.a360-details-editor .field-title{display:block;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin-bottom:7px}.a360-details-editor .summary-card strong{display:block;font-size:15px;line-height:1.3;color:var(--text);margin-bottom:5px}.a360-details-editor .summary-card p{margin:0;color:var(--muted);font-size:12px;line-height:1.45}.a360-details-editor .summary-card.appointment strong{font-size:14px}.a360-details-editor .summary-price{display:inline-flex;margin-top:9px;padding:5px 8px;border-radius:999px;background:#f1f7fd;border:1px solid #d7e5f2;color:#163758;font-size:11px;font-weight:800}.a360-details-editor .priority-summary{display:flex;align-items:flex-start;gap:16px;margin-top:10px;padding:13px 14px;border:1px solid rgba(24,63,110,.12);border-radius:13px;background:#fff}.a360-details-editor .priority-summary>.summary-label{min-width:118px;margin:5px 0 0}.a360-details-editor .priority-chips{display:flex;flex-wrap:wrap;gap:7px}.a360-details-editor .priority-chip,.a360-details-editor .option-chip{padding:7px 10px;border-radius:999px;background:#eefbf8;border:1px solid rgba(44,210,193,.25);font-size:11px;font-weight:750;color:var(--text)}.a360-details-editor .option-row{margin-top:9px}.a360-details-editor .edit-body{padding:16px 18px 18px}.a360-details-editor .edit-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.a360-details-editor .edit-group{padding:15px;border:1px solid rgba(24,63,110,.11);border-radius:14px;background:#fff}.a360-details-editor .edit-group.full{grid-column:1/-1}.a360-details-editor .edit-group-header{margin-bottom:12px}.a360-details-editor .edit-group-header h3{margin:0;font-size:14px}.a360-details-editor .field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.a360-details-editor .wide{grid-column:span 2}.a360-details-editor input,.a360-details-editor select,.a360-details-editor textarea{width:100%;border:1px solid #d5e2ef;background:#f6faff;color:var(--text);border-radius:10px;padding:9px 10px;font:inherit;outline:none}.a360-details-editor input:focus,.a360-details-editor select:focus,.a360-details-editor textarea:focus{background:#fff;border-color:rgba(28,103,220,.45);box-shadow:0 0 0 3px rgba(28,103,220,.08)}.a360-details-editor .priority-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.a360-details-editor .priority-option{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid #d5e2ef;border-radius:11px;background:#f6faff;font-size:11px;font-weight:700;cursor:pointer}.a360-details-editor .priority-option.selected{border-color:rgba(44,210,193,.35);background:#eefbf8}.a360-details-editor .priority-option input{width:auto;margin:0;accent-color:#2ccfc0;box-shadow:none}.a360-details-editor .additional-priority{display:block;margin-top:10px}.a360-details-editor .pdf-option{display:flex;align-items:center;gap:9px;padding:10px 11px;border:1px solid #d5e2ef;border-radius:11px;background:#f6faff;cursor:pointer}.a360-details-editor .pdf-option input{width:auto;margin:0;accent-color:#2ccfc0;box-shadow:none}.a360-details-editor .pdf-option strong{font-size:12px}.a360-details-editor .pdf-option small{display:block;color:var(--muted);font-size:10px;margin-top:1px}.a360-details-editor .edit-actions{display:flex;justify-content:flex-end;margin-top:12px}@media(max-width:1100px){.a360-details-editor .summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.a360-details-editor .priority-options{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.a360-details-editor .details-header{align-items:flex-start;flex-direction:column}.a360-details-editor .summary-grid,.a360-details-editor .edit-layout,.a360-details-editor .field-grid,.a360-details-editor .priority-options{grid-template-columns:1fr}.a360-details-editor .wide,.a360-details-editor .edit-group.full{grid-column:auto}.a360-details-editor .priority-summary{flex-direction:column;gap:8px}.a360-details-editor .priority-summary>.summary-label{margin:0}.a360-details-editor .summary-card{min-height:0}}`}</style>

    <div className="details-header">
      <div className="details-heading"><h2>Conversation details</h2></div>
      <button className={`button ${editing ? "primary" : "secondary"} compact`} type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Done" : "Edit details"}</button>
    </div>

    {!editing ? <div className="summary-body">
      <div className="summary-grid">
        <article className="summary-card"><span className="summary-label">Contact</span><strong>{discovery.contactName || "Not provided"}</strong><p>{activeRecord.contactEmail || "No email captured"}<br />{activeRecord.contactPhone || "No phone captured"}</p></article>
        <article className="summary-card"><span className="summary-label">Environment discussed</span><strong>{discovery.workstations || 0} workstations · {discovery.locations || 1} {discovery.locations === 1 ? "location" : "locations"}</strong><p>{serverSummary}<br />{discovery.industry} · {discovery.organizationLanguage}</p></article>
        <article className="summary-card"><span className="summary-label">Software discussed</span><strong>{softwareSummary}</strong><p>Imaging: {imagingSummary}</p></article>
        <article className="summary-card appointment"><span className="summary-label">Scheduled onsite</span><strong>{formatPlanningAppointment(activeRecord.appointment)}</strong><p>{activeRecord.appointment.consultantName || "Consultant not assigned"}</p><span className="summary-price">Planning range · {estimateRange}</span></article>
      </div>
      <div className="priority-summary"><span className="summary-label">Priorities</span><div className="priority-chips">{knownPriorities.length ? knownPriorities.map((priority) => <span className="priority-chip" key={priority}>{priority}</span>) : <span className="priority-chip">No priorities captured</span>}</div></div>
      {activeRecord.includeLifecyclePlanning === true ? <div className="option-row"><span className="option-chip">Lifecycle planning included</span></div> : null}
    </div> : <div className="edit-body">
      <div className="edit-layout">
        <section className="edit-group"><div className="edit-group-header"><h3>Organization & contact</h3></div><div className="field-grid">
          <label className="wide"><span>Organization</span><input value={discovery.organizationName} onChange={(event) => updateDiscovery({ organizationName: event.target.value })} /></label>
          <label><span>Contact</span><input value={discovery.contactName} onChange={(event) => updateDiscovery({ contactName: event.target.value })} /></label>
          <label><span>Organization type</span><select value={discovery.organizationLanguage} onChange={(event) => updateDiscovery({ organizationLanguage: event.target.value as OrganizationLanguage })}><option value="practice">Practice</option><option value="firm">Firm</option><option value="business">Business</option><option value="organization">Organization</option></select></label>
          <label><span>Email</span><input type="email" value={activeRecord.contactEmail} onChange={(event) => save({ ...activeRecord, contactEmail: event.target.value })} /></label>
          <label><span>Phone</span><input value={activeRecord.contactPhone} onChange={(event) => save({ ...activeRecord, contactPhone: event.target.value })} /></label>
          <label><span>Industry</span><select value={discovery.industry} onChange={(event) => updateDiscovery({ industry: event.target.value as ProspectIndustry })}><option>Dental</option><option>Medical</option><option>Legal</option><option>Accounting</option><option>Other</option></select></label>
        </div></section>

        <section className="edit-group"><div className="edit-group-header"><h3>Environment & software</h3></div><div className="field-grid">
          <label><span>Workstations</span><input type="number" min="0" value={discovery.workstations} onChange={(event) => updateDiscovery({ workstations: Math.round(safeNumber(event.target.value, discovery.workstations)) })} /></label>
          <label><span>Locations</span><input type="number" min="1" value={discovery.locations} onChange={(event) => updateDiscovery({ locations: Math.round(safeNumber(event.target.value, discovery.locations, 1)) })} /></label>
          <label><span>Onsite server</span><select value={discovery.server} onChange={(event) => updateDiscovery({ server: event.target.value as ServerAnswer })}><option value="yes">Yes</option><option value="no">No</option><option value="not-sure">Not sure</option></select></label>
          <label><span>Management software</span><input value={discovery.managementSoftware} onChange={(event) => updateDiscovery({ managementSoftware: event.target.value })} /></label>
          <label><span>Imaging software</span><input value={discovery.imagingSoftware} onChange={(event) => updateDiscovery({ imagingSoftware: event.target.value })} /></label>
          <label><span>Imaging environment</span><select value={discovery.imagingEnvironment} onChange={(event) => updateDiscovery({ imagingEnvironment: event.target.value as ImagingEnvironment })}><option value="">Not provided</option><option value="2D">2D</option><option value="2D + 3D">2D + 3D</option><option value="Not sure">Not sure</option></select></label>
          <label className="wide"><span>Other software</span><input value={discovery.otherSoftware} onChange={(event) => updateDiscovery({ otherSoftware: event.target.value })} /></label>
        </div></section>

        <section className="edit-group full"><div className="edit-group-header"><h3>Priorities</h3></div><div className="priority-options">{A360_PRIORITY_OPTIONS.map((priority) => {
          const selected = knownPriorities.includes(priority);
          return <label className={`priority-option ${selected ? "selected" : ""}`} key={priority}><input type="checkbox" checked={selected} onChange={() => togglePriority(priority)} /><span>{priority}</span></label>;
        })}</div><label className="additional-priority"><span>Additional priorities</span><input value={customPriorities.join(", ")} onChange={(event) => updateCustomPriorities(event.target.value)} placeholder="Anything else discussed" /></label></section>

        <section className="edit-group"><div className="edit-group-header"><h3>Planning range</h3></div><div className="field-grid">
          <label><span>Low / month</span><input type="number" min="0" value={activeRecord.estimate.low} onChange={(event) => updateEstimate("low", event.target.value)} /></label>
          <label><span>High / month</span><input type="number" min="0" value={activeRecord.estimate.high} onChange={(event) => updateEstimate("high", event.target.value)} /></label>
        </div><div style={{marginTop:12}}><span className="field-title">Optional PDF section</span><label className="pdf-option"><input type="checkbox" checked={activeRecord.includeLifecyclePlanning === true} onChange={(event) => updateLifecyclePlanning(event.target.checked)} /><div><strong>Lifecycle planning</strong><small>Include in PDF</small></div></label></div></section>

        <section className="edit-group"><div className="edit-group-header"><h3>Scheduled onsite</h3></div><div className="field-grid">
          <label><span>Date</span><input type="date" value={activeRecord.appointment.date} onChange={(event) => updateAppointment("date", event.target.value)} /></label>
          <label><span>Time</span><input type="time" value={activeRecord.appointment.time} onChange={(event) => updateAppointment("time", event.target.value)} /></label>
          <label><span>Time zone</span><select value={activeRecord.appointment.timeZone} onChange={(event) => updateAppointment("timeZone", event.target.value)}>{!currentTimeZoneKnown ? <option value={activeRecord.appointment.timeZone}>{planningTimeZoneOptionLabel(activeRecord.appointment.timeZone)}</option> : null}{PLANNING_TIME_ZONES.map((item) => <option value={item.value} key={item.value}>{item.label} ({item.shortLabel})</option>)}</select></label>
          <label><span>Technology Consultant</span><input value={activeRecord.appointment.consultantName} onChange={(event) => updateAppointment("consultantName", event.target.value)} /></label>
        </div></section>
      </div>
      <div className="edit-actions"><button className="button primary compact" type="button" onClick={() => setEditing(false)}>Done</button></div>
    </div>}
  </section>;
}
