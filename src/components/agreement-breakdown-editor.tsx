"use client";

import { useState } from "react";
import type { ProjectAgreementBreakdown, ProjectAgreementLineItem } from "@/lib/projects/types";
import {
  A360_SERVICE_DESCRIPTIONS, AGREEMENT_CATEGORIES, AGREEMENT_PERIOD_LABELS,
  agreementCategoryLabel, agreementLineAmount, agreementMoney, agreementPeriodTotals,
  agreementValidationErrors, newAgreementBreakdown,
} from "@/lib/outcomes/agreement-breakdown";

function createLine(): ProjectAgreementLineItem {
  return { id: "agreement-line-" + (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)),
    name: "", description: "", category: "support", quantity: 1, unitPrice: null, billingPeriod: "monthly" };
}

export function AgreementBreakdownEditor({
  value, onSave, onClose,
}: {
  value?: ProjectAgreementBreakdown;
  onSave: (next: ProjectAgreementBreakdown) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ProjectAgreementBreakdown>(() => structuredClone(value ?? newAgreementBreakdown()));
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const totals = agreementPeriodTotals(draft);
  const modify = (next: ProjectAgreementBreakdown) => { setDraft({ ...next, verifiedAt: "" }); setVerified(false); setError(""); };
  const patchLine = (id: string, patch: Partial<ProjectAgreementLineItem>) => {
    modify({ ...draft, items: draft.items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  const save = () => {
    const next = { ...draft, items: draft.items.map((item) => ({
      ...item, name: item.name.trim(), description: item.description.trim(),
    })), sourceLabel: draft.sourceLabel.trim(), notes: draft.notes.trim() };
    if (next.includeInReport) {
      const issues = agreementValidationErrors(next);
      if (issues.length) { setError(issues.join(" ")); return; }
      if (!verified) { setError("Confirm the line items and charges against the current agreement before including them."); return; }
      next.verifiedAt = new Date().toISOString();
    } else {
      next.verifiedAt = "";
    }
    onSave(next);
  };
  return <div className="agreement-editor-overlay" role="dialog" aria-modal="true" aria-label="Edit client agreement breakdown">
    <section className="agreement-editor-panel">
      <header className="agreement-editor-header">
        <div><span className="section-kicker">Optional client report section</span><h2>Your Technology Services Agreement</h2>
          <p>Enter the actual services and recurring charges from this practice's current agreement. The A360 examples help explain services but do not confirm what this client has purchased.</p></div>
        <button className="button secondary compact" type="button" onClick={onClose}>Close</button>
      </header>
      <div className="agreement-editor-body">
        <label className="agreement-opt-in">
          <input type="checkbox" checked={draft.includeInReport} onChange={(event) => modify({ ...draft, includeInReport: event.target.checked })}/>
          <span><strong>Include agreement breakdown in the Technology Health Review</strong>
            <small>When off, this section does not appear in the presentation or finished PDF.</small></span>
        </label>
        <div className="agreement-editor-meta">
          <label>Agreement / invoice reference<input value={draft.sourceLabel} onChange={(event) => modify({ ...draft, sourceLabel: event.target.value })} placeholder="e.g. Current recurring agreement in ConnectWise"/></label>
          <label>Pricing / agreement as of<input type="date" value={draft.asOfDate} onChange={(event) => modify({ ...draft, asOfDate: event.target.value })}/></label>
          <label className="agreement-price-choice"><input type="checkbox" checked={draft.showPricing} onChange={(event) => modify({ ...draft, showPricing: event.target.checked })}/>
            Show rates and totals to the client</label>
        </div>
        <div className="agreement-editor-lines-header"><h3>Services on this agreement</h3>
          <button type="button" className="button secondary compact" onClick={() => modify({ ...draft, items: [...draft.items, createLine()] })}>+ Add service line</button></div>
        {draft.items.length === 0 && <p className="agreement-empty">No services added yet. Start with the actual agreement or invoice. Nothing is included automatically.</p>}
        {draft.items.map((item, i) => <article className="agreement-editor-line" key={item.id}>
          <div className="agreement-line-heading"><strong>Line {i + 1}</strong><button type="button" onClick={() => modify({ ...draft, items: draft.items.filter((row) => row.id !== item.id) })}>Remove</button></div>
          <div className="agreement-line-grid">
            <label className="agreement-wide">Agreement line item / service name<input value={item.name} onChange={(e) => patchLine(item.id, { name: e.target.value })} placeholder="Exact service name shown on client's agreement"/></label>
            <label>Category<select value={item.category} onChange={(e) => patchLine(item.id, { category: e.target.value as ProjectAgreementLineItem["category"] })}>
              {AGREEMENT_CATEGORIES.map((c) => <option key={c} value={c}>{agreementCategoryLabel(c)}</option>)}</select></label>
            <label>Quantity<input type="number" min="0.01" step="any" value={Number.isFinite(item.quantity) ? item.quantity : ""} onChange={(e) => patchLine(item.id, { quantity: e.target.value ? Number(e.target.value) : 0 })}/></label>
            <label>Unit price ($)<input type="number" min="0" step="0.01" value={item.unitPrice ?? ""} placeholder="Not supplied" onChange={(e) => patchLine(item.id, { unitPrice: e.target.value === "" ? null : Number(e.target.value) })}/></label>
            <label>Billing cycle<select value={item.billingPeriod} onChange={(e) => patchLine(item.id, { billingPeriod: e.target.value as ProjectAgreementLineItem["billingPeriod"] })}>
              {Object.entries(AGREEMENT_PERIOD_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label className="agreement-wide">Client-facing service description
              <textarea value={item.description} onChange={(e) => patchLine(item.id, { description: e.target.value })} rows={2} placeholder="Explain what this exact service covers for the client"/>
            </label>
            <label className="agreement-wide">Optional Advantage 360 wording reference
              <select defaultValue="" onChange={(e) => {
                const template = A360_SERVICE_DESCRIPTIONS.find((t) => t.label === e.target.value);
                if (template) patchLine(item.id, { description: template.description, category: template.category });
                e.target.value = "";
              }}><option value="">Choose a suggested description; confirm it matches the signed agreement</option>
                {A360_SERVICE_DESCRIPTIONS.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </label>
          </div>
          {draft.showPricing && <div className="agreement-line-total">{item.unitPrice === null ? "Price not supplied" : "Line total " + (agreementLineAmount(item) === null ? "Needs review" : agreementMoney(agreementLineAmount(item)!))} · {AGREEMENT_PERIOD_LABELS[item.billingPeriod]}</div>}
        </article>)}
        {draft.showPricing && totals.length > 0 && <div className="agreement-editor-totals">{totals.map((t) =>
          <div key={t.period}><span>{AGREEMENT_PERIOD_LABELS[t.period]} services</span><strong>{t.amount === null ? "Incomplete pricing" : agreementMoney(t.amount)}</strong></div>)}</div>}
        <label className="agreement-notes">Optional client-facing note<textarea rows={2} value={draft.notes} onChange={(e) => modify({ ...draft, notes: e.target.value })} placeholder="Optional explanation of this specific agreement (not legal terms)"/></label>
        <div className="agreement-editor-review">
          <p><strong>Client preview:</strong> {draft.items.length} service line{draft.items.length === 1 ? "" : "s"}. {draft.showPricing ? "Prices and separate billing-cycle totals shown where complete." : "Descriptions and quantities only; pricing hidden."}</p>
          <label><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)}/>
            I verified the items, descriptions, quantities and any displayed prices against this practice's current agreement.</label>
          <small>This is an informational summary; the signed agreement and current invoice determine actual entitlements and billing. No services are added from the Advantage 360 website automatically.</small>
        </div>
        {error && <p role="alert" className="agreement-editor-error">{error}</p>}
      </div>
      <footer className="agreement-editor-footer"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button type="button" className="button primary" onClick={save}>Save agreement section</button></footer>
    </section>
  </div>;
}
