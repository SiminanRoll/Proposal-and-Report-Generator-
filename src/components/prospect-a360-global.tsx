"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  A360_PRIORITY_OPTIONS,
  emptyA360Prospect,
  preliminaryA360Estimate,
  priorityStory,
  prospectDisplayName,
  softwareQuestionLabel,
  type A360ProspectDiscovery,
  type OrganizationLanguage,
  type ProspectIndustry,
  type ServerAnswer,
} from "@/lib/prospects/a360";

const SECTIONS = ["Welcome", "Priorities", "Environment", "Software", "Your A360", "Summary", "Estimate", "Next step"] as const;

function A360Icon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v4m0 8v4M4 12h4m8 0h4"/><circle cx="12" cy="12" r="2.5"/></svg>;
}

function money(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (value: number) => void }) {
  return <div className="prospect-stepper"><button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">−</button><strong>{value}</strong><button type="button" onClick={() => onChange(value + 1)} aria-label="Increase">+</button></div>;
}

function ProspectPresentation({ initial, onClose }: { initial: A360ProspectDiscovery; onClose: () => void }) {
  const [data, setData] = useState(initial);
  const [index, setIndex] = useState(0);
  const estimate = useMemo(() => preliminaryA360Estimate(data), [data]);
  const primary = data.priorities[0] || "Better support";
  const story = priorityStory(primary, data.organizationLanguage);
  const displayName = prospectDisplayName(data);
  const patch = <K extends keyof A360ProspectDiscovery>(key: K, value: A360ProspectDiscovery[K]) => setData((current) => ({ ...current, [key]: value }));
  const togglePriority = (priority: string) => patch("priorities", data.priorities.includes(priority) ? data.priorities.filter((item) => item !== priority) : [...data.priorities, priority]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((current) => Math.min(SECTIONS.length - 1, current + 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);

  return <div className="presentation-overlay prospect-presentation" role="dialog" aria-modal="true" aria-label="First-time prospect Advantage 360 presentation"><div className="presentation-shell">
    <header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav className="presentation-progress-nav" data-section-count={SECTIONS.length} style={{ "--presentation-progress": `${index / (SECTIONS.length - 1) * 100}%` } as CSSProperties}>{SECTIONS.map((section, sectionIndex) => <button key={section} type="button" className={index === sectionIndex ? "active" : sectionIndex < index ? "complete" : "upcoming"} onClick={() => setIndex(sectionIndex)}>{section}</button>)}</nav><div className="presentation-topbar-actions"><button className="presentation-estimate" type="button" onClick={() => setIndex(6)}>{estimate.low === estimate.high ? money(estimate.low) : `${money(estimate.low)}–${money(estimate.high)}`}</button><button className="presentation-close" type="button" onClick={onClose}>Close</button></div></header>
    <main className="presentation-stage" aria-live="polite"><div className="prospect-slide">
      {index === 0 && <section className="prospect-welcome"><span className="prospect-kicker">Prepared for {displayName}</span><h1>Advantage 360</h1><p>One technology relationship built to keep your {data.organizationLanguage} simple, stable, secure, and supported.</p><div className="prospect-pillars"><article><b>Simple</b><span>One accountable technology partner</span></article><article><b>Stable</b><span>Proactive care and lifecycle planning</span></article><article><b>Secure</b><span>Layered protection and monitoring</span></article><article><b>Supported</b><span>Remote, onsite, and vendor coordination</span></article></div></section>}
      {index === 1 && <section><span className="prospect-kicker">Conversational discovery</span><h2>What matters most to you?</h2><p className="prospect-intro">Choose in order. The first selection becomes the primary story; everything after it supports the conversation.</p><div className="prospect-choice-grid">{A360_PRIORITY_OPTIONS.map((priority) => { const rank = data.priorities.indexOf(priority); return <button key={priority} type="button" className={rank >= 0 ? "selected" : ""} onClick={() => togglePriority(priority)}>{rank >= 0 && <b>{rank + 1}</b>}<span>{priority}</span></button>; })}</div></section>}
      {index === 2 && <section><span className="prospect-kicker">Your environment</span><h2>A quick starting picture.</h2><p className="prospect-intro">Best estimates are welcome. The onsite assessment will verify the details.</p><div className="prospect-input-cards"><article><span>About how many workstations?</span><Stepper value={data.workstations} min={0} onChange={(value) => patch("workstations", value)} /></article><article><span>Do you have a server?</span><div className="prospect-segmented">{(["yes", "no", "not-sure"] as ServerAnswer[]).map((answer) => <button key={answer} className={data.server === answer ? "active" : ""} type="button" onClick={() => patch("server", answer)}>{answer === "not-sure" ? "Not sure" : answer[0].toUpperCase() + answer.slice(1)}</button>)}</div></article><article><span>How many locations?</span><Stepper value={data.locations} min={1} onChange={(value) => patch("locations", value)} /></article></div></section>}
      {index === 3 && <section><span className="prospect-kicker">What runs your {data.organizationLanguage}?</span><h2>The software behind the work.</h2><div className="prospect-software-grid"><label><span>{softwareQuestionLabel(data.industry)}</span><input value={data.managementSoftware} onChange={(event) => patch("managementSoftware", event.target.value)} placeholder={data.industry === "Dental" ? "Dentrix, Open Dental, Eaglesoft, Curve…" : "Enter software or not sure"} /></label>{data.industry === "Dental" && <><label><span>Imaging software</span><input value={data.imagingSoftware} onChange={(event) => patch("imagingSoftware", event.target.value)} placeholder="DEXIS, Vatech, Carestream, Planmeca…" /></label><label><span>Imaging environment</span><div className="prospect-segmented">{["2D", "2D + 3D", "Not sure"].map((answer) => <button key={answer} className={data.imagingEnvironment === answer ? "active" : ""} type="button" onClick={() => patch("imagingEnvironment", answer as A360ProspectDiscovery["imagingEnvironment"])}>{answer}</button>)}</div></label></>}<label><span>Other important software</span><input value={data.otherSoftware} onChange={(event) => patch("otherSoftware", event.target.value)} placeholder="Accounting, phones, cloud apps, specialty systems…" /></label></div></section>}
      {index === 4 && <section><span className="prospect-kicker">Built around your priorities</span><h2>{story.title}</h2><p className="prospect-story-lead">{story.body}</p><div className="prospect-story-grid"><article className="primary"><b>Primary focus</b><strong>{primary}</strong><p>This receives the strongest attention in the plan and onsite assessment.</p></article><article><b>Connected foundation</b><strong>Simple · Stable · Secure · Supported</strong><p>Support, security, monitoring, vendor coordination, backups, and planning operate as one relationship.</p></article>{data.priorities.slice(1, 4).map((priority) => <article key={priority}><b>Supporting priority</b><strong>{priority}</strong><p>{priorityStory(priority, data.organizationLanguage).title}</p></article>)}</div></section>}
      {index === 5 && <section><span className="prospect-kicker">Client-provided preliminary information</span><h2>Here is what we understand so far.</h2><div className="prospect-summary"><article><b>Environment</b><strong>{data.workstations} workstations · {data.locations} {data.locations === 1 ? "location" : "locations"}</strong><span>Server: {data.server === "not-sure" ? "Not sure" : data.server === "yes" ? "Yes" : "No"}</span></article><article><b>Business systems</b><strong>{data.managementSoftware || "Management software not yet identified"}</strong><span>{[data.imagingSoftware, data.imagingEnvironment, data.otherSoftware].filter(Boolean).join(" · ") || "Additional software to verify onsite"}</span></article><article><b>Conversation priority</b><strong>{primary}</strong><span>{data.priorities.slice(1).join(" · ") || "No secondary priorities selected"}</span></article></div><aside className="prospect-disclaimer">These are conversation inputs, not verified technical findings. Nothing here asserts actual performance, downtime, security condition, or infrastructure health.</aside></section>}
      {index === 6 && <section className="prospect-estimate-slide"><span className="prospect-kicker">Preliminary planning estimate</span><h2>{estimate.low === estimate.high ? money(estimate.low) : `${money(estimate.low)}–${money(estimate.high)}`}<small> / month</small></h2><p>Calculated live from the current Advantage 360 site, workstation, and standard-server pricing rules.</p><div className="prospect-assumptions">{estimate.assumptions.map((assumption) => <span key={assumption}>{assumption}</span>)}</div><aside><strong>Why this is preliminary</strong><p>The onsite technology assessment confirms device counts, server and backup requirements, network scope, software dependencies, and any services that are not represented by these initial answers. Imaging and 3D details inform discovery but do not change this estimate unless the verified pricing model says they should.</p></aside></section>}
      {index === 7 && <section><span className="prospect-kicker">The next step</span><h2>Onsite Technology Assessment</h2><p className="prospect-story-lead">This conversation gives us a starting point. The onsite assessment verifies the environment so Advantage can produce an accurate scope and number.</p><div className="prospect-ota-grid">{["Computers & lifecycle", "Server & recovery", "Network & connectivity", "Software & imaging", "Security & backups", "Scope, timing & pricing"].map((item) => <article key={item}><span>✓</span><strong>{item}</strong></article>)}</div><div className="prospect-cta"><div><strong>Discovery is ready for handoff.</strong><span>Prospect saving and OTA scheduling are not connected to a CRM endpoint in this version; your inputs remain available until you close this presentation.</span></div><button type="button" disabled title="CRM prospect and OTA scheduling integration required">Save Prospect & Request OTA</button></div></section>}
    </div></main>
    <footer className="presentation-footer"><span>{index + 1} / {SECTIONS.length}</span><div><button type="button" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>Previous</button><button className="next" type="button" disabled={index === SECTIONS.length - 1} onClick={() => setIndex((current) => Math.min(SECTIONS.length - 1, current + 1))}>Next →</button></div></footer>
  </div></div>;
}

export function ProspectA360Global() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [draft, setDraft] = useState(emptyA360Prospect);
  useEffect(() => { setMounted(true); }, []);
  const start = () => { if (!draft.contactName.trim()) return; setOpen(false); setPresenting(true); };
  return <>
    <button className="global-quick-present-button prospect-a360-button" type="button" onClick={() => setOpen(true)} title="Start a first-time prospect Advantage 360 presentation"><A360Icon /><span>A360 Presentation</span></button>
    {mounted && open && createPortal(<div className="quick-present-backdrop prospect-launcher-backdrop" role="presentation" onMouseDown={() => setOpen(false)}><section className="quick-present-dialog prospect-launcher" role="dialog" aria-modal="true" aria-labelledby="prospect-launcher-title" onMouseDown={(event) => event.stopPropagation()}><header><span className="quick-present-mark"><A360Icon /></span><div><span className="compass-kicker">First-time prospect</span><h2 id="prospect-launcher-title">Start A360 Presentation</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></header><div className="prospect-launcher-body"><label><span>Contact name</span><input autoFocus value={draft.contactName} onChange={(event) => setDraft({ ...draft, contactName: event.target.value })} placeholder="Dr. Sarah Smith" /></label><label><span>Business / practice / firm name <small>Optional</small></span><input value={draft.organizationName} onChange={(event) => setDraft({ ...draft, organizationName: event.target.value })} placeholder="Smith Family Dental" /></label><fieldset><legend>Organization language</legend><div className="prospect-segmented">{(["practice", "firm", "business", "organization"] as OrganizationLanguage[]).map((term) => <button type="button" key={term} className={draft.organizationLanguage === term ? "active" : ""} onClick={() => setDraft({ ...draft, organizationLanguage: term })}>{term[0].toUpperCase() + term.slice(1)}</button>)}</div></fieldset><fieldset><legend>Industry</legend><div className="prospect-segmented">{(["Dental", "Medical", "Legal", "Accounting", "Other"] as ProspectIndustry[]).map((industry) => <button type="button" key={industry} className={draft.industry === industry ? "active" : ""} onClick={() => setDraft({ ...draft, industry })}>{industry}</button>)}</div></fieldset><button className="button primary full" type="button" disabled={!draft.contactName.trim()} onClick={start}>Start Presentation →</button><small className="prospect-launcher-note">No prospect record is required. Discovery happens inside the presentation.</small></div></section></div>, document.body)}
    {mounted && presenting && createPortal(<ProspectPresentation initial={draft} onClose={() => setPresenting(false)} />, document.body)}
  </>;
}
