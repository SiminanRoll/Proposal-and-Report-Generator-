"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ADVANTAGE_360_PILLARS } from "@/lib/advantage-360-pillars";
import type { PlanningAppointment } from "@/lib/projects/types";
import {
  A360_PRIORITY_OPTIONS,
  RELIABILITY_DOWNTIME_PREVENTION_PRIORITY,
  a360PriorityLabel,
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
import { AnimatedNumber } from "./animated-number";
import ownershipStyles from "./new-ownership-experience.module.css";
import { ProspectA360Scheduler } from "./prospect-a360-scheduler";
import { ProspectA360Finish } from "./prospect-a360-finish";

const SECTIONS = ["Welcome", "Priorities", "Environment", "Software", "Your A360", "Summary", "Estimate", "Next step"] as const;

function A360Icon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v4m0 8v4M4 12h4m8 0h4"/><circle cx="12" cy="12" r="2.5"/></svg>;
}

function money(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (value: number) => void }) {
  return <div className="prospect-stepper"><button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">−</button><strong>{value}</strong><button type="button" onClick={() => onChange(value + 1)} aria-label="Increase">+</button></div>;
}

type PriorityA360Value = {
  kicker: string;
  title: string;
  points: string[];
};

function priorityA360Value(priority: string, term: OrganizationLanguage): PriorityA360Value {
  const values: Record<string, PriorityA360Value> = {
    [RELIABILITY_DOWNTIME_PREVENTION_PRIORITY]: {
      kicker: "How Advantage keeps work moving",
      title: `Keep the ${term} operating.`,
      points: [
        "Proactive monitoring and managed support help surface routine issues before they become larger interruptions.",
        "Documented environment history gives the team context before troubleshooting starts.",
        "Remote help, onsite support, vendor coordination, backup, and recovery planning stay connected under one accountable team.",
      ],
    },
    Cybersecurity: {
      kicker: "How Advantage protects the environment",
      title: "Layered protection with people behind it.",
      points: [
        "Endpoint protection, security monitoring, patching, and threat follow-up work together as one managed security program.",
        "When suspicious activity needs attention, Advantage has a clear path to investigate, respond, and keep your staff informed.",
        "Security stays connected to backups, recovery, Microsoft 365, and the rest of the environment instead of living in a silo.",
      ],
    },
    "Faster computers": {
      kicker: "How Advantage improves the daily experience",
      title: "Technology that keeps up with the team.",
      points: [
        "Lifecycle planning identifies slow, aging, or underpowered systems before they become a daily productivity problem.",
        "Recommendations are sized around the applications, imaging, multitasking, and workflows your team actually uses.",
        "Advantage coordinates setup, migration, support, and follow-through so the change is handled end to end.",
      ],
    },
    "Better support": {
      kicker: "What Advantage support feels like",
      title: "Help is one click away.",
      points: [
        "Advantage Connect gives your team a direct path to support from the desktop.",
        "Remote help, local onsite support, and documented history stay with the same service team.",
        "When another vendor is involved, Advantage can coordinate the technology side instead of leaving your staff in the middle.",
      ],
    },
    "Predictable costs": {
      kicker: "How Advantage makes IT easier to plan",
      title: "Plan technology instead of reacting to it.",
      points: [
        "Advantage 360 brings routine support, management, security, and monitoring into a predictable monthly service.",
        "Lifecycle planning shows upcoming replacements early enough to budget and sequence them deliberately.",
        "Larger projects stay visible and can be planned and priced separately around your priorities.",
      ],
    },
    "HIPAA & compliance": {
      kicker: "How Advantage supports readiness",
      title: "Build technology safeguards into the routine.",
      points: [
        "Security controls, documentation, and technology follow-up become part of the ongoing relationship instead of a periodic scramble.",
        "Advantage helps surface technology risks and remediation items while keeping owners and next steps clear.",
        `Ongoing guidance helps the ${term} keep safeguards aligned as systems, staff, vendors, and requirements change.`,
      ],
    },
    "Growth & expansion": {
      kicker: "How Advantage supports growth",
      title: "IT that can grow with the business.",
      points: [
        "Documented standards make it easier to add people, workstations, cloud services, or another location consistently.",
        "Networking, security, Microsoft 365, phones, and vendor dependencies can be planned together before opening-day pressure arrives.",
        "Support continues after the expansion so the new environment becomes part of the same managed relationship.",
      ],
    },
    "Aging technology": {
      kicker: "How Advantage manages lifecycle risk",
      title: "Replace risk before it becomes downtime.",
      points: [
        "Lifecycle visibility highlights aging computers, servers, operating systems, and warranty gaps before failure forces the decision.",
        "Replacement timing can be planned around budget, software dependencies, security, and business impact.",
        `The goal is fewer emergency purchases and a clearer multiyear technology plan for the ${term}.`,
      ],
    },
    "Backup & recovery": {
      kicker: "How Advantage plans for recovery",
      title: "Recovery is part of the plan.",
      points: [
        `Backup protection is managed around the systems and data the ${term} would actually need to recover.`,
        "Onsite and cloud protection, monitoring, and recovery planning work together as one continuity strategy.",
        "If recovery is needed, Advantage stays involved through restoration and vendor coordination.",
      ],
    },
    "Current IT frustration": {
      kicker: "How Advantage replaces friction with ownership",
      title: "One accountable technology partner.",
      points: [
        "Advantage Connect gives staff one clear place to ask for help, backed by documented environment and service history.",
        "Support, security, vendors, infrastructure, and planning stay connected instead of becoming separate conversations.",
        "One accountable relationship creates clearer ownership and follow-through when a problem crosses systems or vendors.",
      ],
    },
  };
  return values[a360PriorityLabel(priority)] ?? {
    kicker: "How Advantage supports it",
    title: "Technology built around what matters.",
    points: [
      "Your team gets one clear path to support and one accountable technology relationship.",
      "The environment stays documented so each conversation starts with context instead of from scratch.",
      "Planning, support, security, and vendor coordination stay connected as priorities change.",
    ],
  };
}

function EstimateReveal({ low, high }: { low: number; high: number }) {
  if (low === high) return <AnimatedNumber value={low} duration={950} format={money} className="prospect-estimate-count" />;
  return <span className="prospect-estimate-range"><AnimatedNumber value={low} duration={950} format={money} className="prospect-estimate-count" /><span aria-hidden="true">–</span><AnimatedNumber value={high} duration={1050} delay={90} format={money} className="prospect-estimate-count" /></span>;
}

function StoryFlipCard({
  id,
  flipped,
  onFlip,
  kicker,
  title,
  copy,
  backKicker,
  backTitle,
  points,
  primary = false,
}: {
  id: string;
  flipped: boolean;
  onFlip: (id: string) => void;
  kicker: string;
  title: string;
  copy: string;
  backKicker: string;
  backTitle: string;
  points: string[];
  primary?: boolean;
}) {
  return <button type="button" className={`prospect-story-card${primary ? " primary" : ""}${flipped ? " is-flipped" : ""}`} onClick={() => onFlip(id)} aria-pressed={flipped}>
    <span className="prospect-story-card-inner">
      <span className="prospect-story-face prospect-story-front"><b>{kicker}</b><strong>{title}</strong><span className="prospect-story-copy">{copy}</span><small>More to discuss →</small></span>
      <span className="prospect-story-face prospect-story-back"><b>{backKicker}</b><strong>{backTitle}</strong><span className="prospect-story-points">{points.map((point) => <span key={point}>{point}</span>)}</span><small>← Back to overview</small></span>
    </span>
  </button>;
}

function ProspectPresentation({ initial, onClose }: { initial: A360ProspectDiscovery; onClose: () => void }) {
  const [data, setData] = useState(initial);
  const [index, setIndex] = useState(0);
  const [flippedPillar, setFlippedPillar] = useState("");
  const [flippedStoryCard, setFlippedStoryCard] = useState("");
  const [planningAppointment, setPlanningAppointment] = useState<PlanningAppointment | null>(null);
  const [handoffId] = useState(() => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `a360-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const estimate = useMemo(() => preliminaryA360Estimate(data), [data]);
  const primary = data.priorities[0] || "Better support";
  const story = priorityStory(primary, data.organizationLanguage);
  const primaryValue = priorityA360Value(primary, data.organizationLanguage);
  const displayName = prospectDisplayName(data);
  const patch = <K extends keyof A360ProspectDiscovery>(key: K, value: A360ProspectDiscovery[K]) => setData((current) => ({ ...current, [key]: value }));
  const togglePriority = (priority: string) => patch("priorities", data.priorities.includes(priority) ? data.priorities.filter((item) => item !== priority) : [...data.priorities, priority]);
  const flipStoryCard = (cardId: string) => setFlippedStoryCard((current) => current === cardId ? "" : cardId);

  useEffect(() => {
    if (index !== 4) setFlippedStoryCard("");
  }, [index]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector("[data-planning-scheduler-open='true']")) return;
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((current) => Math.min(SECTIONS.length - 1, current + 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);

  return <div className="presentation-overlay prospect-presentation" role="dialog" aria-modal="true" aria-label="First-time prospect Advantage 360 presentation"><div className="presentation-shell">
    <header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav className="presentation-progress-nav" data-section-count={SECTIONS.length} style={{ "--presentation-progress": `${index / (SECTIONS.length - 1) * 100}%` } as CSSProperties}>{SECTIONS.map((section, sectionIndex) => <button key={section} type="button" className={index === sectionIndex ? "active" : sectionIndex < index ? "complete" : "upcoming"} onClick={() => setIndex(sectionIndex)}>{section}</button>)}</nav><div className="presentation-topbar-actions">{index >= 6 && <button className="presentation-estimate prospect-estimate-revealed" type="button" onClick={() => setIndex(6)} aria-label="Preliminary monthly estimate"><EstimateReveal low={estimate.low} high={estimate.high} /></button>}<button className="presentation-close" type="button" onClick={onClose}>Close</button></div></header>
    <main className="presentation-stage" aria-live="polite"><div className={`prospect-slide${index === 0 ? " prospect-slide-welcome" : ""}`}>
      {index === 0 && <section className={`${ownershipStyles.advantageSlide} prospect-ownership-welcome`}><div className={ownershipStyles.advantageHero}><div className={ownershipStyles.advantageHeroCopy}><span className={ownershipStyles.preparedKicker}>Prepared for {displayName}</span><h1>Advantage 360</h1></div><aside className={ownershipStyles.heroStatement}><span>One IT relationship</span><p>One simple program for the technology the {data.organizationLanguage} depends on — secure, reliable, and handled by one team.</p></aside></div><div className={ownershipStyles.pillars}>{ADVANTAGE_360_PILLARS.map((pillar) => <button key={pillar.key} type="button" className={`${ownershipStyles.pillarCard} ${ownershipStyles[pillar.tone]} ${flippedPillar === pillar.key ? ownershipStyles.isFlipped : ""}`} onClick={() => setFlippedPillar((current) => current === pillar.key ? "" : pillar.key)} aria-pressed={flippedPillar === pillar.key}><span className={ownershipStyles.pillarInner}><span className={ownershipStyles.pillarFront}><strong>{pillar.title}</strong><small>{pillar.short}</small></span><span className={ownershipStyles.pillarBack}><strong>{pillar.backTitle}</strong><small>{pillar.key === "supported" ? pillar.detail.replace("your practice", `your ${data.organizationLanguage}`) : pillar.detail}</small></span></span></button>)}</div><div className={ownershipStyles.advantageFooter}><strong>One partner. One plan. All handled.</strong><span>Advantage 360 brings support, security, backups, network management, cloud systems, vendor coordination, and ongoing technology guidance together under one relationship.</span></div></section>}
      {index === 1 && <section><span className="prospect-kicker">Your priorities</span><h2>What matters most to you?</h2><p className="prospect-intro">Choose in order. The first selection becomes the primary story; everything after it supports the conversation.</p><div className="prospect-choice-grid">{A360_PRIORITY_OPTIONS.map((priority) => { const rank = data.priorities.indexOf(priority); return <button key={priority} type="button" className={rank >= 0 ? "selected" : ""} onClick={() => togglePriority(priority)}>{rank >= 0 && <b>{rank + 1}</b>}<span>{priority}</span></button>; })}</div></section>}
      {index === 2 && <section><span className="prospect-kicker">Your environment</span><h2>A quick starting picture.</h2><p className="prospect-intro">Best estimates are welcome. We’ll confirm the details together during the onsite visit.</p><div className="prospect-input-cards"><article><span>About how many workstations?</span><Stepper value={data.workstations} min={0} onChange={(value) => patch("workstations", value)} /></article><article><span>Do you have a server?</span><div className="prospect-segmented">{(["yes", "no", "not-sure"] as ServerAnswer[]).map((answer) => <button key={answer} className={data.server === answer ? "active" : ""} type="button" onClick={() => patch("server", answer)}>{answer === "not-sure" ? "Not sure" : answer[0].toUpperCase() + answer.slice(1)}</button>)}</div></article><article><span>How many locations?</span><Stepper value={data.locations} min={1} onChange={(value) => patch("locations", value)} /></article></div></section>}
      {index === 3 && <section><span className="prospect-kicker">What runs your {data.organizationLanguage}?</span><h2>The software behind the work.</h2><div className="prospect-software-grid"><label><span>{softwareQuestionLabel(data.industry)}</span><input value={data.managementSoftware} onChange={(event) => patch("managementSoftware", event.target.value)} placeholder={data.industry === "Dental" ? "Dentrix, Open Dental, Eaglesoft, Curve…" : "Enter software or not sure"} /></label>{data.industry === "Dental" && <><label><span>Imaging software</span><input value={data.imagingSoftware} onChange={(event) => patch("imagingSoftware", event.target.value)} placeholder="DEXIS, Vatech, Carestream, Planmeca…" /></label><label><span>Imaging environment</span><div className="prospect-segmented">{["2D", "2D + 3D", "Not sure"].map((answer) => <button key={answer} className={data.imagingEnvironment === answer ? "active" : ""} type="button" onClick={() => patch("imagingEnvironment", answer as A360ProspectDiscovery["imagingEnvironment"])}>{answer}</button>)}</div></label></>}<label><span>Other important software</span><input value={data.otherSoftware} onChange={(event) => patch("otherSoftware", event.target.value)} placeholder="Accounting, phones, cloud apps, specialty systems…" /></label></div></section>}
      {index === 4 && <section className="prospect-your-a360-slide"><span className="prospect-kicker">Built around your priorities</span><h2>{story.title}</h2><p className="prospect-story-lead">{story.body}</p><div className="prospect-story-grid"><StoryFlipCard id="primary" primary flipped={flippedStoryCard === "primary"} onFlip={flipStoryCard} kicker="Your top priority" title={primary} copy="This gets the strongest attention in the conversation and helps guide the onsite visit." backKicker={primaryValue.kicker} backTitle={primaryValue.title} points={primaryValue.points} /><StoryFlipCard id="foundation" flipped={flippedStoryCard === "foundation"} onFlip={flipStoryCard} kicker="Connected foundation" title="Simple · Stable · Secure · Supported" copy="Support, security, monitoring, vendor coordination, backups, and planning operate as one relationship." backKicker="One team behind the environment" backTitle="We stay with the problem." points={["The support team keeps the context and documentation instead of making your staff start over every time.", "Monitoring, security, backups, and proactive support continue in the background while your team works.", "When another vendor is involved, Advantage can help coordinate the technology side instead of leaving you in the middle."]} />{data.priorities.slice(1, 4).map((priority) => { const priorityDetails = priorityStory(priority, data.organizationLanguage); const priorityValue = priorityA360Value(priority, data.organizationLanguage); return <StoryFlipCard key={priority} id={`supporting-${priority}`} flipped={flippedStoryCard === `supporting-${priority}`} onFlip={flipStoryCard} kicker="Supporting priority" title={priority} copy={priorityDetails.title} backKicker={priorityValue.kicker} backTitle={priorityValue.title} points={priorityValue.points} />; })}</div></section>}
      {index === 5 && <section><span className="prospect-kicker">What you shared with us</span><h2>Here’s the starting picture.</h2><div className="prospect-summary"><article><b>Environment</b><strong>{data.workstations} workstations · {data.locations} {data.locations === 1 ? "location" : "locations"}</strong><span>Server: {data.server === "not-sure" ? "Not sure" : data.server === "yes" ? "Yes" : "No"}</span></article><article><b>Business systems</b><strong>{data.managementSoftware || "Management software not yet identified"}</strong><span>{[data.imagingSoftware, data.imagingEnvironment, data.otherSoftware].filter(Boolean).join(" · ") || "Additional software we can talk through onsite"}</span></article><article><b>Conversation priority</b><strong>{primary}</strong><span>{data.priorities.slice(1).join(" · ") || "No secondary priorities selected"}</span></article></div><aside className="prospect-disclaimer">This gives us a helpful starting point. We’ll confirm the details together during the onsite visit.</aside></section>}
      {index === 6 && <section className="prospect-estimate-slide"><span className="prospect-kicker">Preliminary monthly estimate</span><h2>{estimate.low === estimate.high ? money(estimate.low) : `${money(estimate.low)}–${money(estimate.high)}`}<small> / month</small></h2><p>Based on the location, workstation, and server information we discussed.</p><aside><strong>Why this is preliminary</strong><p>The onsite visit lets us confirm the starting details together and see whether anything changes the monthly service. If it does, we’ll walk you through it before anything moves forward.</p></aside></section>}
      {index === 7 && <section className="prospect-next-step-slide"><span className="prospect-kicker">What comes next</span><h2>The next step toward the right plan.</h2><p className="prospect-story-lead">The onsite technology assessment gives your Technology Consultant a chance to see the environment firsthand, keep your priorities front and center, and make sure the plan fits the way you actually work.</p><div className="prospect-ota-grid">{["See your environment firsthand", "Confirm the starting picture", "Understand your software and workflow", "Shape the right plan"].map((item) => <article key={item}><span>✓</span><strong>{item}</strong></article>)}</div><ProspectA360Scheduler appointment={planningAppointment} onConfirm={setPlanningAppointment} /><ProspectA360Finish discovery={data} appointment={planningAppointment} handoffId={handoffId} /></section>}
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
  const start = () => { if (!draft.contactName.trim() || !draft.organizationName.trim()) return; setOpen(false); setPresenting(true); };
  return <>
    <button className="global-quick-present-button prospect-a360-button" type="button" onClick={() => setOpen(true)} title="Start a first-time prospect Advantage 360 presentation"><A360Icon /><span>A360 Presentation</span></button>
    {mounted && open && createPortal(<div className="quick-present-backdrop prospect-launcher-backdrop" role="presentation" onMouseDown={() => setOpen(false)}><section className="quick-present-dialog prospect-launcher" role="dialog" aria-modal="true" aria-labelledby="prospect-launcher-title" onMouseDown={(event) => event.stopPropagation()}><header><span className="quick-present-mark"><A360Icon /></span><div><span className="compass-kicker">First-time prospect</span><h2 id="prospect-launcher-title">Start A360 Presentation</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></header><div className="prospect-launcher-body"><label><span>Contact name</span><input autoFocus value={draft.contactName} onChange={(event) => setDraft({ ...draft, contactName: event.target.value })} placeholder="Dr. Sarah Smith" /></label><label><span>Business / practice / firm name</span><input value={draft.organizationName} onChange={(event) => setDraft({ ...draft, organizationName: event.target.value })} placeholder="Smith Family Dental" /></label><fieldset><legend>Organization language</legend><div className="prospect-segmented">{(["practice", "firm", "business", "organization"] as OrganizationLanguage[]).map((term) => <button type="button" key={term} className={draft.organizationLanguage === term ? "active" : ""} onClick={() => setDraft({ ...draft, organizationLanguage: term })}>{term[0].toUpperCase() + term.slice(1)}</button>)}</div></fieldset><fieldset><legend>Industry</legend><div className="prospect-segmented">{(["Dental", "Medical", "Legal", "Accounting", "Other"] as ProspectIndustry[]).map((industry) => <button type="button" key={industry} className={draft.industry === industry ? "active" : ""} onClick={() => setDraft({ ...draft, industry })}>{industry}</button>)}</div></fieldset><button className="button primary full" type="button" disabled={!draft.contactName.trim() || !draft.organizationName.trim()} onClick={start}>Start Presentation →</button><small className="prospect-launcher-note">The conversation workspace is created after an onsite assessment is scheduled and you save the presentation.</small></div></section></div>, document.body)}
    {mounted && presenting && createPortal(<ProspectPresentation initial={draft} onClose={() => setPresenting(false)} />, document.body)}
  </>;
}
