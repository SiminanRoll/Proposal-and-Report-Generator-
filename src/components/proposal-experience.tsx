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

function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function categoryLabel(line: CatalogLineItem): string {
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
      <div className="proposal-line-copy"><input value={line.name} onChange={(event) => updateLine(line.id, { name: event.target.value })} aria-label="Proposal item name" /><textarea rows={2} value={line.description ?? ""} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-label={`${line.name} description`} /><small>{categoryLabel(line)} · {line.sku}</small></div>
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

export function AdvantageStoryPresentation() {
  return <div className="presentation-section-layout proposal-advantage-slide">
    <div className="presentation-section-heading"><span className="presentation-kicker">Why Advantage Technologies</span><h2>One accountable technology partner for the entire practice.</h2><p>Advantage 360 brings support, security, backup, recovery, and technology planning together so the practice has one team responsible for keeping the environment protected, productive, and prepared.</p></div>
    <div className="proposal-capability-grid">
      <article><b>01</b><div><h3>Dental-focused support</h3><p>Support built around practice-management, imaging, clinical workflows, and the technology staff depend on every day.</p></div></article>
      <article><b>02</b><div><h3>Managed security</h3><p>Layered endpoint protection, monitoring, maintenance, and an experienced team ready to respond when activity needs attention.</p></div></article>
      <article><b>03</b><div><h3>Backup and recovery</h3><p>Protection designed around the systems and data the practice cannot afford to lose, with recovery expectations clearly understood.</p></div></article>
      <article><b>04</b><div><h3>Proactive planning</h3><p>Lifecycle visibility, budgeting guidance, and a practical roadmap that helps avoid rushed technology decisions.</p></div></article>
    </div>
    <div className="proposal-partner-statement"><CheckIcon /><div><strong>The goal is not simply to fix tickets.</strong><span>It is to give the practice a dependable technology foundation and a team that remains accountable after the project is complete.</span></div></div>
  </div>;
}

export function ProposalPlanPresentation({ project }: { project: Project }) {
  const scope = includedProposalItems(project, "one-time");
  return <div className="presentation-section-layout proposal-plan-slide">
    <div className="presentation-section-heading"><span className="presentation-kicker">Your Advantage 360 plan</span><h2>Move from today&apos;s findings to a supported, protected environment.</h2><p>The project scope addresses the immediate technology needs first, then transitions the practice into an ongoing managed-services relationship.</p></div>
    <div className="proposal-transition-path">
      <article><b>01</b><div><h3>Confirm the final scope</h3><p>Validate equipment, users, applications, imaging dependencies, vendor requirements, and timing before ordering or scheduling.</p></div></article>
      <article><b>02</b><div><h3>Prepare and implement</h3><p>Replace approved equipment, install required applications, migrate data and settings, and validate the clinical workflow.</p></div></article>
      <article><b>03</b><div><h3>Onboard and secure</h3><p>Document the environment, deploy Advantage management and security tools, confirm backups, and establish support ownership.</p></div></article>
      <article><b>04</b><div><h3>Manage and plan</h3><p>Provide ongoing support, monitoring, security response, maintenance, and a clear technology roadmap through Advantage 360.</p></div></article>
    </div>
    <div className="proposal-plan-bottom">
      <div className="proposal-plan-recommendations"><span className="presentation-kicker">Plan outcomes</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div>
      <aside><span className="presentation-kicker">Included project scope</span><strong>{scope.length || "No"}</strong><p>{scope.length === 1 ? "one-time project item is" : "one-time project items are"} included in the investment shown next.</p></aside>
    </div>
  </div>;
}

function ProposalLineList({ lines }: { lines: CatalogLineItem[] }) {
  return <div className="proposal-investment-lines">{lines.length ? lines.map((line) => <div key={line.id}><span><strong>{line.name}</strong><small>{line.quantity} × {money(line.unitPrice)}{line.description ? ` · ${line.description}` : ""}</small></span><b>{line.requiresPrice && line.unitPrice === 0 ? "To be confirmed" : money(proposalLineTotal(line))}</b></div>) : <div className="proposal-investment-empty">No items are currently included in this part of the proposal.</div>}</div>;
}

export function ProposalInvestmentPresentation({ project }: { project: Project }) {
  const monthly = includedProposalItems(project, "monthly");
  const oneTime = includedProposalItems(project, "one-time");
  const warnings = proposalPricingWarnings(project);
  return <div className="presentation-section-layout proposal-investment-slide">
    <div className="presentation-section-heading"><span className="presentation-kicker">Investment</span><h2>A clear view of the project and the ongoing A360 relationship.</h2><p>The one-time investment covers the approved implementation scope. The monthly investment covers the included managed services after onboarding.</p></div>
    <div className="proposal-investment-columns">
      <section><div className="proposal-investment-heading"><span><small>One-time project investment</small><strong>{money(project.pricing.oneTime)}</strong></span><em>Equipment · labor · applications · onboarding</em></div><ProposalLineList lines={oneTime} /></section>
      <section><div className="proposal-investment-heading"><span><small>Monthly A360 investment</small><strong>{money(project.pricing.monthly)}</strong></span><em>Managed support · security · backup · planning</em></div><ProposalLineList lines={monthly} /></section>
    </div>
    <div className={`proposal-investment-note ${warnings.length ? "attention" : ""}`}><strong>{warnings.length ? "Final pricing confirmation is still required." : "The proposal is ready for authorization."}</strong><span>{warnings.length ? `${warnings.length} included project item${warnings.length === 1 ? " has" : "s have"} not yet been assigned a price. Confirm those amounts before asking the client to authorize the final quote.` : "Equipment availability, third-party licensing, taxes, freight, and vendor charges are included only when specifically listed above."}</span></div>
  </div>;
}

export function ProposalAuthorizationPresentation({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const signed = project.signature.status === "signed";
  const signedDate = project.signature.signedAt ? new Date(project.signature.signedAt) : null;
  const formattedDate = signedDate && !Number.isNaN(signedDate.getTime()) ? signedDate.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : "";

  function updateSignature(patch: Partial<Project["signature"]>) {
    onUpdate({ ...project, signature: { ...project.signature, ...patch }, updatedAt: new Date().toISOString() });
  }

  function authorize() {
    if (!project.signature.signerName.trim() || !project.signature.acceptedTerms) return;
    updateSignature({ status: "signed", signedAt: new Date().toISOString() });
  }

  return <div className="presentation-section-layout proposal-authorization-slide">
    <div className="proposal-authorization-copy"><span className="presentation-kicker">Authorization</span><h2>{signed ? "The proposal is authorized." : "Ready to move forward?"}</h2><p>{signed ? `Thank you, ${project.signature.signerName}. Advantage Technologies can now confirm the final implementation details and coordinate the next steps with the practice.` : "Authorize the proposed scope so Advantage can confirm final equipment availability, complete the service documentation, and coordinate onboarding and implementation."}</p>
      <div className="proposal-authorization-totals"><span><small>One-time investment</small><strong>{money(project.pricing.oneTime)}</strong></span><span><small>Monthly A360 investment</small><strong>{money(project.pricing.monthly)}</strong></span></div>
      <div className="proposal-authorization-next"><CheckIcon /><span><strong>What happens after approval</strong><small>Advantage confirms scope and availability, completes the final service and project documents, and works with the practice to schedule the transition.</small></span></div>
    </div>
    <section className={`proposal-signature-card ${signed ? "signed" : ""}`}>
      {signed ? <><div className="proposal-signed-mark"><CheckIcon /></div><span className="presentation-kicker">Authorized by</span><h3>{project.signature.signerName}</h3><p>{project.signature.signerTitle || "Authorized representative"}</p><small>{formattedDate}</small><div className="proposal-signature-status">Proposal accepted</div></> : <><span className="presentation-kicker">Approve the proposal</span><label><span>Authorized name</span><input value={project.signature.signerName} onChange={(event) => updateSignature({ signerName: event.target.value, status: "draft", signedAt: "" })} placeholder="Full name" /></label><label><span>Title</span><input value={project.signature.signerTitle ?? ""} onChange={(event) => updateSignature({ signerTitle: event.target.value, status: "draft", signedAt: "" })} placeholder="Owner, doctor, office manager, etc." /></label><label className="proposal-authorization-check"><input type="checkbox" checked={Boolean(project.signature.acceptedTerms)} onChange={(event) => updateSignature({ acceptedTerms: event.target.checked, status: "draft", signedAt: "" })} /><span>I am authorized to approve this proposal for {project.client.name}. I approve the included scope and pricing and authorize Advantage Technologies to prepare the final implementation and service documents.</span></label><button type="button" disabled={!project.signature.signerName.trim() || !project.signature.acceptedTerms} onClick={authorize}>Authorize proposal</button><small className="proposal-terms">Final scheduling, hardware availability, third-party licensing, and any items not specifically listed remain subject to confirmation. This authorization is recorded in the local proposal workspace.</small></>}
    </section>
  </div>;
}

export function ProposalInvestmentPreview({ project }: { project: Project }) {
  return <div className="proposal-preview-investment"><span><small>One-time project</small><strong>{money(project.pricing.oneTime)}</strong></span><span><small>Monthly A360</small><strong>{money(project.pricing.monthly)}</strong></span><em>{project.signature.status === "signed" ? "Authorized" : "Ready for client review"}</em></div>;
}
