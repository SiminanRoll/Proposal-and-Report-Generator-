"use client";

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

const TIME_ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Los_Angeles", "Pacific"],
] as const;

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

export function A360PresentationDetailsEditor({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const record = project.a360Conversation;
  if (!record) return null;
  const activeRecord: A360ConversationRecord = record;

  const discovery = activeRecord.discovery;
  const knownPriorities = discovery.priorities.map(a360PriorityLabel);
  const customPriorities = knownPriorities.filter((priority) => !A360_PRIORITY_OPTIONS.includes(priority as (typeof A360_PRIORITY_OPTIONS)[number]));

  function save(nextRecord: A360ConversationRecord) {
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

  return <section className="record-card a360-details-editor">
    <style>{`.a360-details-editor{margin-bottom:18px}.a360-details-editor .details-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}.a360-details-editor .details-intro h2{margin:0 0 5px}.a360-details-editor .details-intro p{margin:0;color:var(--muted);max-width:760px}.a360-details-editor .details-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.a360-details-editor .wide{grid-column:span 2}.a360-details-editor .full{grid-column:1/-1}.a360-details-editor label>span,.a360-details-editor .field-title{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.a360-details-editor input,.a360-details-editor select,.a360-details-editor textarea{width:100%;border:1px solid var(--line);background:var(--panel-strong);color:var(--text);border-radius:11px;padding:10px 11px;font:inherit}.a360-details-editor textarea{min-height:74px;resize:vertical}.a360-details-editor .priority-editor{margin:16px 0 14px}.a360-details-editor .priority-options{display:flex;flex-wrap:wrap;gap:8px}.a360-details-editor .priority-option{display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid var(--line);border-radius:999px;background:var(--panel-strong);font-size:12px;cursor:pointer}.a360-details-editor .priority-option input{width:auto;margin:0;accent-color:#2ccfc0}.a360-details-editor .details-note{margin:14px 0 0;color:var(--muted);font-size:12px}.a360-details-editor .details-note strong{color:var(--text)}@media(max-width:1050px){.a360-details-editor .details-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.a360-details-editor .details-grid{grid-template-columns:1fr}.a360-details-editor .wide,.a360-details-editor .full{grid-column:auto}}`}</style>
    <div className="details-intro"><div><h2>Edit presentation details</h2><p>Adjust what was captured during the Advantage 360 conversation before you create the client PDF. These changes save with this A360 workspace and flow straight into the recap.</p></div></div>

    <div className="details-grid">
      <label className="wide"><span>Organization</span><input value={discovery.organizationName} onChange={(event) => updateDiscovery({ organizationName: event.target.value })} /></label>
      <label><span>Contact</span><input value={discovery.contactName} onChange={(event) => updateDiscovery({ contactName: event.target.value })} /></label>
      <label><span>Organization type</span><select value={discovery.organizationLanguage} onChange={(event) => updateDiscovery({ organizationLanguage: event.target.value as OrganizationLanguage })}><option value="practice">Practice</option><option value="firm">Firm</option><option value="business">Business</option><option value="organization">Organization</option></select></label>
      <label><span>Email</span><input type="email" value={activeRecord.contactEmail} onChange={(event) => save({ ...activeRecord, contactEmail: event.target.value })} /></label>
      <label><span>Phone</span><input value={activeRecord.contactPhone} onChange={(event) => save({ ...activeRecord, contactPhone: event.target.value })} /></label>
      <label><span>Industry</span><select value={discovery.industry} onChange={(event) => updateDiscovery({ industry: event.target.value as ProspectIndustry })}><option>Dental</option><option>Medical</option><option>Legal</option><option>Accounting</option><option>Other</option></select></label>
      <label><span>Workstations</span><input type="number" min="0" value={discovery.workstations} onChange={(event) => updateDiscovery({ workstations: Math.round(safeNumber(event.target.value, discovery.workstations)) })} /></label>
      <label><span>Locations</span><input type="number" min="1" value={discovery.locations} onChange={(event) => updateDiscovery({ locations: Math.round(safeNumber(event.target.value, discovery.locations, 1)) })} /></label>
      <label><span>Onsite server</span><select value={discovery.server} onChange={(event) => updateDiscovery({ server: event.target.value as ServerAnswer })}><option value="yes">Yes</option><option value="no">No</option><option value="not-sure">Not sure</option></select></label>
    </div>

    <div className="priority-editor"><span className="field-title">Priorities discussed</span><div className="priority-options">{A360_PRIORITY_OPTIONS.map((priority) => <label className="priority-option" key={priority}><input type="checkbox" checked={knownPriorities.includes(priority)} onChange={() => togglePriority(priority)} /><span>{priority}</span></label>)}</div></div>

    <div className="details-grid">
      <label className="wide"><span>Additional priorities</span><input value={customPriorities.join(", ")} onChange={(event) => updateCustomPriorities(event.target.value)} placeholder="Anything else discussed" /></label>
      <label><span>Practice / management software</span><input value={discovery.managementSoftware} onChange={(event) => updateDiscovery({ managementSoftware: event.target.value })} /></label>
      <label><span>Imaging software</span><input value={discovery.imagingSoftware} onChange={(event) => updateDiscovery({ imagingSoftware: event.target.value })} /></label>
      <label><span>Imaging environment</span><select value={discovery.imagingEnvironment} onChange={(event) => updateDiscovery({ imagingEnvironment: event.target.value as ImagingEnvironment })}><option value="">Not provided</option><option value="2D">2D</option><option value="2D + 3D">2D + 3D</option><option value="Not sure">Not sure</option></select></label>
      <label className="wide"><span>Other software discussed</span><input value={discovery.otherSoftware} onChange={(event) => updateDiscovery({ otherSoftware: event.target.value })} /></label>
      <label><span>Estimate low / month</span><input type="number" min="0" value={activeRecord.estimate.low} onChange={(event) => updateEstimate("low", event.target.value)} /></label>
      <label><span>Estimate high / month</span><input type="number" min="0" value={activeRecord.estimate.high} onChange={(event) => updateEstimate("high", event.target.value)} /></label>
      <label><span>Onsite date</span><input type="date" value={activeRecord.appointment.date} onChange={(event) => updateAppointment("date", event.target.value)} /></label>
      <label><span>Onsite time</span><input type="time" value={activeRecord.appointment.time} onChange={(event) => updateAppointment("time", event.target.value)} /></label>
      <label><span>Time zone</span><select value={activeRecord.appointment.timeZone} onChange={(event) => updateAppointment("timeZone", event.target.value)}>{TIME_ZONES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span>Technology Consultant</span><input value={activeRecord.appointment.consultantName} onChange={(event) => updateAppointment("consultantName", event.target.value)} /></label>
    </div>

    <p className="details-note"><strong>PDF workflow:</strong> adjust the presentation details here first, then fine-tune the client-facing recap copy below if you want, then open the PDF. Changing these fields does not overwrite custom report wording.</p>
  </section>;
}
