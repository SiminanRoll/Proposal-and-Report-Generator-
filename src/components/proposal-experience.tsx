"use client";

import type { ChangeEvent } from "react";
import type { CatalogLineItem, Project } from "@/lib/projects/types";
import {
  createCatalogItemId,
  includedProposalItems,
  projectWithCatalogItems,
  proposalLineTotal,
  proposalPricingWarnings,
  replaceA360MonthlyDefaults,
} from "@/lib/proposals/pricing";
import { CheckIcon, SparkIcon } from "./icons";
import { PROPOSAL_COVER_TITLE, proposalCoverSummary, proposalHardwareFinding, proposalLineClientCopy } from "@/lib/proposals/client-copy";
import { categoryLabel } from "@/lib/outcomes/builder";
import { AnimatedNumber } from "./animated-number";
import { applicationPlanningCopy, applicationSupportCopy, organizationReference, organizationTerm, supportHeading, workflowCopy } from "@/lib/projects/client-language";

function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function catalogCategoryLabel(line: CatalogLineItem): string {
  if (line.category === "managed-services") return "Managed service";
  if (line.category === "hardware") return "Equipment";
  if (line.category === "labor") return "Labor";
  if (line.category === "applications") return "Applications";
  if (line.category === "onboarding") return "Onboarding";
  if (line.category === "discount") return "Discount";
  return "Custom";
}

function numericValue(event: ChangeEvent<HTMLInputElement>): number {
  const value = Number(event.target.value);
  return Number.isFinite(value) ? value : 0;
}

function PricingRows({ project, billing, onUpdate }: { project: Project; billing: CatalogLineItem["billing"]; onUpdate: (project: Project) => void }) {
  const lines = project.catalogItems.filter((line) => line.billing === billing);

  function updateLine(lineId: string, patch: Partial<CatalogLineItem>) {
    onUpdate(projectWithCatalogItems(project, project.catalogItems.map((line) => line.id === lineId ? { ...line, ...patch } : line)));
  }

  function removeLine(lineId: string) {
    onUpdate(projectWithCatalogItems(project, project.catalogItems.filter((line) => line.id !== lineId)));
  }

  return <div className="proposal-pricing-rows">
    <div className="proposal-pricing-row proposal-pricing-header"><span>Include</span><span>Proposal item</span><span>Qty</span><span>Unit price</span><span>Line total</span><span /></div>
    {lines.map((line) => <div className={`proposal-pricing-row ${line.included ? "included" : "excluded"}`} key={line.id}>
      <label className="proposal-include-toggle"><input type="checkbox" checked={line.included} onChange={(event) => updateLine(line.id, { included: event.target.checked })} /><span aria-hidden="true" /></label>
      <div className="proposal-line-copy"><input value={line.name} onChange={(event) => updateLine(line.id, { name: event.target.value })} aria-label="Proposal item name" /><textarea rows={2} value={line.description ?? ""} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-label={`${line.name} description`} /><small>{catalogCategoryLabel(line)} · {line.sku}</small></div>
      <input className="proposal-number-input" type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Math.max(0, numericValue(event)) })} aria-label={`${line.name} quantity`} />
      <div className="proposal-currency-input"><span>$</span><input type="number" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: numericValue(event) })} aria-label={`${line.name} unit price`} /></div>
      <strong className={line.included && line.requiresPrice && line.unitPrice === 0 ? "needs-price" : ""}>{line.included && line.requiresPrice && line.unitPrice === 0 ? "Add price" : money(proposalLineTotal(line))}</strong>
      <button type="button" className="proposal-remove-line" onClick={() => removeLine(line.id)} aria-label={`Remove ${line.name}`}>×</button>
    </div>)}
  </div>;
}

export function ProposalPricingEditor({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const warnings = proposalPricingWarnings(project);

  function addLine(billing: CatalogLineItem["billing"]) {
    const line: CatalogLineItem = {
      id: createCatalogItemId(billing === "monthly" ? "monthly" : "project"),
      sku: billing === "monthly" ? "A360-CUSTOM" : "PROJECT-CUSTOM",
      name: billing === "monthly" ? "Custom monthly service" : "Custom project item",
      description: "",
      category: billing === "monthly" ? "managed-services" : "other",
      quantity: 1,
      unitPrice: 0,
      billing,
      included: true,
      requiresPrice: billing === "one-time",
    };
    onUpdate(projectWithCatalogItems(project, [...project.catalogItems, line]));
  }

  return <section className="workspace-card proposal-pricing-editor">
    <div className="workspace-card-heading proposal-pricing-heading"><div><span className="section-kicker"><SparkIcon /> Proposal pricing</span><h2>Build the complete A360 investment.</h2><p>Monthly defaults come from the current A360 pricing worksheet. Add the equipment, application installation, labor, and onboarding costs that apply to this client.</p></div><div className="proposal-pricing-summary"><span><small>Monthly</small><strong>{money(project.pricing.monthly)}</strong></span><span><small>One-time</small><strong>{money(project.pricing.oneTime)}</strong></span></div></div>

    {warnings.length > 0 && <div className="proposal-pricing-warning"><strong>{warnings.length} included project item{warnings.length === 1 ? " still needs" : "s still need"} pricing.</strong><span>Enter the equipment, labor, application, or onboarding amount—or remove the item from the included scope before presenting the final quote.</span></div>}

    <div className="proposal-pricing-section">
      <div className="proposal-pricing-section-heading"><div><span className="section-kicker">Monthly managed services</span><h3>A360 recurring services</h3></div><div><button className="button secondary compact" type="button" onClick={() => onUpdate(replaceA360MonthlyDefaults(project))}>Restore A360 defaults</button><button className="button secondary compact" type="button" onClick={() => addLine("monthly")}>Add monthly item</button></div></div>
      <PricingRows project={project} billing="monthly" onUpdate={onUpdate} />
    </div>

    <div className="proposal-pricing-section">
      <div className="proposal-pricing-section-heading"><div><span className="section-kicker">Project investment</span><h3>Equipment, installation, and onboarding</h3></div><button className="button secondary compact" type="button" onClick={() => addLine("one-time")}>Add project item</button></div>
      <PricingRows project={project} billing="one-time" onUpdate={onUpdate} />
    </div>

    <div className="proposal-pricing-footer"><div><CheckIcon /><span><strong>Pricing stays editable until authorization.</strong><small>Changing an included line after authorization returns the proposal to draft so it can be reviewed and approved again.</small></span></div><div><span>Estimated monthly</span><strong>{money(project.pricing.monthly)}</strong><span>Estimated one-time</span><strong>{money(project.pricing.oneTime)}</strong></div></div>
  </section>;
}

export function ProposalOverviewPresentation({ project }: { project: Project }) {
  const priority = project.findings.filter((item) => item.severity === "priority").length;
  const attention = project.findings.filter((item) => item.severity === "attention").length;
  const healthy = project.findings.filter((item) => item.severity === "healthy").length;
  return <div className="presentation-overview proposal-client-overview"><div className="presentation-overview-copy"><span className="presentation-kicker">Prepared for {project.client.name}</span><h1>{PROPOSAL_COVER_TITLE}</h1><p>{proposalCoverSummary(project)}</p></div><div className="presentation-score-stack"><div className="presentation-score priority"><strong><AnimatedNumber value={priority} delay={240} /></strong><span>Needs attention now</span></div><div className="presentation-score attention"><strong><AnimatedNumber value={attention} delay={320} /></strong><span>Plan for</span></div><div className="presentation-score healthy"><strong><AnimatedNumber value={healthy} delay={400} /></strong><span>In good shape</span></div></div></div>;
}

export function ProposalFindingsPresentation({ project }: { project: Project }) {
  const hardware = proposalHardwareFinding(project);
  const replacementPattern = /server lifecycle|past the planned lifecycle|replacement timing|should be replaced/i;
  const hardwareFindingIndex = hardware
    ? project.findings.findIndex((item) => item.category === "lifecycle" && item.severity === "priority" && replacementPattern.test(`${item.title} ${item.clientSummary}`))
    : -1;
  const findings = project.findings.map((item, index) => hardware && index === hardwareFindingIndex
    ? { ...item, title: hardware.title, clientSummary: hardware.summary, clientCategory: "Hardware" }
    : { ...item, clientCategory: categoryLabel(item.category) });
  if (hardware && hardwareFindingIndex < 0) findings.unshift({ id: "proposal-hardware-replacement", category: hardware.category, title: hardware.title, clientSummary: hardware.summary, severity: hardware.severity, evidenceIds: [], clientCategory: "Hardware" });
  return <div className="presentation-section-layout proposal-findings-slide"><div className="presentation-section-heading"><span className="presentation-kicker">The review</span><h2>What we found</h2><p>The most important items to address now and plan for next.</p></div><div className="presentation-findings">{findings.map((item) => <article className={`presentation-finding ${item.severity}`} key={item.id}><div><span>{item.clientCategory}</span><em>{item.severity === "priority" ? "Needs attention now" : item.severity === "attention" ? "Plan for" : "In good shape"}</em></div><h3>{item.title}</h3><p>{item.clientSummary}</p></article>)}</div></div>;
}

export function AdvantageStoryPresentation({ project }: { project: Project }) {
  return <div className="presentation-section-layout proposal-advantage-slide">
    <div className="presentation-section-heading"><span className="presentation-kicker">What you can expect</span><h2>Technology support built around your {organizationTerm(project)}.</h2><p>Your team should not have to coordinate multiple vendors every time something goes wrong. With Advantage Technologies, you have one team responsible for supporting your computers, network, security, backups, and long-term technology needs.</p></div>
    <div className="proposal-capability-grid">
      <article><b>01</b><div><h3>{supportHeading(project)}</h3><p>{applicationSupportCopy(project)}</p></div></article>
      <article><b>02</b><div><h3>Security that stays active</h3><p>Your computers are monitored and protected around the clock, with a team ready to investigate and respond when something needs attention.</p></div></article>
      <article><b>03</b><div><h3>Backups you can rely on</h3><p>Your server and critical data are protected with local and cloud backup, along with recovery planning designed to reduce downtime.</p></div></article>
      <article><b>04</b><div><h3>Planning before problems become urgent</h3><p>We help you understand what needs attention now, what can wait, and how to budget for technology changes before they become emergencies.</p></div></article>
    </div>
    <div className="proposal-partner-statement"><CheckIcon /><div><strong>You should always know who to call.</strong><span>Our goal is to keep your {organizationTerm(project)} secure, productive, and prepared—with one team accountable for supporting it.</span></div></div>
  </div>;
}

export function ProposalPlanPresentation({ project }: { project: Project }) {
  const scope = includedProposalItems(project, "one-time");
  return <div className="presentation-section-layout proposal-plan-slide">
    <div className="presentation-section-heading"><span className="presentation-kicker">Your recommended plan</span><h2>A clear path forward.</h2><p>We&apos;ll address the items that need attention now, make sure your {organizationTerm(project)} is properly supported and protected, and give your team one accountable technology partner going forward.</p></div>
    <div className="proposal-transition-path">
      <article><b>01</b><div><h3>Confirm the details</h3><p>Before anything is ordered or scheduled, we&apos;ll confirm the equipment, users, {applicationPlanningCopy(project)}, vendor requirements, and timing.</p></div></article>
      <article><b>02</b><div><h3>Replace and prepare</h3><p>We&apos;ll replace the approved equipment, install the required applications, move data and settings, and make sure your {workflowCopy(project)} is ready.</p></div></article>
      <article><b>03</b><div><h3>Onboard and protect</h3><p>We&apos;ll document the environment, deploy our management and security tools, confirm backup coverage, and make sure each supported device is ready for ongoing service.</p></div></article>
      <article><b>04</b><div><h3>Support and plan ahead</h3><p>Once the project is complete, our team will provide ongoing support, monitoring, security response, maintenance, and technology planning.</p></div></article>
    </div>
    <div className="proposal-plan-bottom">
      <div className="proposal-plan-recommendations"><span className="presentation-kicker">What this gives your {organizationTerm(project)}</span><div><CheckIcon /><span><strong>One team to call</strong><small>Your team has one place to go for technology support and one partner accountable for the environment.</small></span></div><div><CheckIcon /><span><strong>Consistent protection</strong><small>Supported computers are monitored, maintained, and protected using the same managed security standards.</small></span></div><div><CheckIcon /><span><strong>Confirmed backup and recovery</strong><small>Backup coverage and recovery expectations are reviewed, documented, and incorporated into the plan.</small></span></div><div><CheckIcon /><span><strong>Fewer technology surprises</strong><small>Future equipment needs are identified early so they can be budgeted and scheduled before they become urgent.</small></span></div></div>
      <aside><span className="presentation-kicker">Project scope</span><strong>{scope.length || "No"}</strong><p>{scope.length === 1 ? "One-time project item included" : "One-time project items included"} in this proposal.</p></aside>
    </div>
  </div>;
}

function ProposalLineList({ lines, project }: { lines: CatalogLineItem[]; project: Project }) {
  return <div className="proposal-investment-lines">{lines.length ? lines.map((line) => { const copy = proposalLineClientCopy(line, project); return <div key={line.id}><span><strong>{copy.name}</strong><small>{line.quantity} × {money(line.unitPrice)}{copy.description ? ` · ${copy.description}` : ""}</small></span><b>{line.requiresPrice && line.unitPrice === 0 ? "To be confirmed" : money(proposalLineTotal(line))}</b></div>; }) : <div className="proposal-investment-empty">No items are currently included in this part of the proposal.</div>}</div>;
}

export function ProposalInvestmentPresentation({ project }: { project: Project }) {
  const monthly = includedProposalItems(project, "monthly");
  const oneTime = includedProposalItems(project, "one-time");
  const warnings = proposalPricingWarnings(project);
  return <div className="presentation-section-layout proposal-investment-slide">
    <div className="presentation-section-heading"><span className="presentation-kicker">Your investment</span><h2>Your technology investment.</h2><p>Below is the estimated cost to complete the recommended work and provide ongoing support, security, backup, and technology planning for your {organizationTerm(project)}.</p></div>
    <div className="proposal-investment-columns">
      <section><div className="proposal-investment-heading"><span><small>{warnings.length ? "Estimated one-time investment" : "One-time investment"}</small><strong>{money(project.pricing.oneTime)}</strong></span><em>Equipment, installation, application setup, and onboarding</em></div><ProposalLineList lines={oneTime} project={project} /></section>
      <section><div className="proposal-investment-heading"><span><small>Ongoing monthly support</small><strong>{money(project.pricing.monthly)} per month</strong></span><em>Support, security, backup, monitoring, and planning</em></div><ProposalLineList lines={monthly} project={project} /></section>
    </div>
    <div className={`proposal-investment-note ${warnings.length ? "attention" : ""}`}><strong>{warnings.length ? "Final pricing will be confirmed." : "Your investment is ready for review."}</strong><span>{warnings.length ? "Final pricing will be confirmed after the project scope and application requirements are reviewed. Any changes will be discussed with you before equipment is ordered or work is authorized." : "Equipment availability, third-party licensing, taxes, freight, and vendor charges are included only when specifically listed above."}</span></div>
  </div>;
}

export function ProposalAuthorizationPresentation({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const signed = project.signature.status === "signed";
  const pricingWarnings = proposalPricingWarnings(project);
  const pricingComplete = pricingWarnings.length === 0;
  const signedDate = project.signature.signedAt ? new Date(project.signature.signedAt) : null;
  const formattedDate = signedDate && !Number.isNaN(signedDate.getTime()) ? signedDate.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : "";

  function updateSignature(patch: Partial<Project["signature"]>) {
    onUpdate({ ...project, signature: { ...project.signature, ...patch }, updatedAt: new Date().toISOString() });
  }

  function authorize() {
    if (!pricingComplete || !project.signature.signerName.trim() || !project.signature.acceptedTerms) return;
    updateSignature({ status: "signed", signedAt: new Date().toISOString() });
  }

  return <div className="presentation-section-layout proposal-authorization-slide">
    <div className="proposal-authorization-copy"><span className="presentation-kicker">Authorization</span><h2>{signed ? "The proposal is authorized." : "Ready to move forward?"}</h2><p>{signed ? `Thank you, ${project.signature.signerName}. Advantage Technologies can now confirm the final implementation details and coordinate the next steps with ${organizationReference(project)}.` : "Authorize the proposed scope so Advantage can confirm final equipment availability, complete the service documentation, and coordinate onboarding and implementation."}</p>
      <div className="proposal-authorization-totals"><span><small>One-time investment</small><strong>{money(project.pricing.oneTime)}</strong></span><span><small>Ongoing monthly support</small><strong>{money(project.pricing.monthly)}</strong></span></div>
      <div className="proposal-authorization-next"><CheckIcon /><span><strong>What happens after approval</strong><small>Advantage confirms scope and availability, completes the final service and project documents, and works with {organizationReference(project)} to schedule the transition.</small></span></div>
    </div>
    <section className={`proposal-signature-card ${signed ? "signed" : ""}`}>
      {signed ? <><div className="proposal-signed-mark"><CheckIcon /></div><span className="presentation-kicker">Authorized by</span><h3>{project.signature.signerName}</h3><p>{project.signature.signerTitle || "Authorized representative"}</p><small>{formattedDate}</small><div className="proposal-signature-status">Proposal accepted</div></> : <><span className="presentation-kicker">Approve the proposal</span><label><span>Authorized name</span><input value={project.signature.signerName} onChange={(event) => updateSignature({ signerName: event.target.value, status: "draft", signedAt: "" })} placeholder="Full name" /></label><label><span>Title</span><input value={project.signature.signerTitle ?? ""} onChange={(event) => updateSignature({ signerTitle: event.target.value, status: "draft", signedAt: "" })} placeholder="Owner, manager, or authorized representative" /></label><label className="proposal-authorization-check"><input type="checkbox" checked={Boolean(project.signature.acceptedTerms)} onChange={(event) => updateSignature({ acceptedTerms: event.target.checked, status: "draft", signedAt: "" })} /><span>I am authorized to approve this proposal for {project.client.name}. I approve the included scope and pricing and authorize Advantage Technologies to prepare the final implementation and service documents.</span></label>{!pricingComplete && <div className="proposal-authorization-pricing-warning">Complete the remaining project pricing before authorization.</div>}<button type="button" disabled={!pricingComplete || !project.signature.signerName.trim() || !project.signature.acceptedTerms} onClick={authorize}>Authorize proposal</button><small className="proposal-terms">Final scheduling, hardware availability, third-party licensing, and any items not specifically listed remain subject to confirmation. This authorization is recorded in the local proposal workspace.</small></>}
    </section>
  </div>;
}

export function ProposalInvestmentPreview({ project }: { project: Project }) {
  return <div className="proposal-preview-investment"><span><small>One-time project</small><strong>{money(project.pricing.oneTime)}</strong></span><span><small>Ongoing monthly support</small><strong>{money(project.pricing.monthly)}</strong></span><em>{project.signature.status === "signed" ? "Authorized" : "Ready for client review"}</em></div>;
}
