"use client";

import type { Project } from "@/lib/projects/types";
import {
  AGREEMENT_PERIOD_LABELS, agreementCategoryLabel, agreementLineAmount,
  agreementMoney, agreementPeriodTotals, includedAgreement,
} from "@/lib/outcomes/agreement-breakdown";

export function AgreementBreakdownPresentation({ project }: { project: Project }) {
  const agreement = includedAgreement(project);
  if (!agreement) return null;
  const totals = agreement.showPricing ? agreementPeriodTotals(agreement) : [];
  return <div className="presentation-section-layout agreement-presentation">
    <div className="presentation-section-heading">
      <span className="presentation-kicker">Your Advantage 360 services · {project.client.name}</span>
      <h2>What your agreement includes.</h2>
      <p>A clear view of the services currently listed for your practice, including covered quantities and the billing details chosen for this review.</p>
    </div>
    <div className="agreement-presentation-body">
      <div className="agreement-presentation-services">
        {agreement.items.map((item) => {
          const subtotal = agreement.showPricing ? agreementLineAmount(item) : null;
          return <article className="agreement-presentation-service" key={item.id}>
            <div className="agreement-presentation-service-heading"><span>{agreementCategoryLabel(item.category)}{item.productId ? " · " + item.productId : ""}</span>
              <strong>{item.name}</strong></div>
            <p>{item.description}</p>
            <div className="agreement-presentation-service-meta"><span>Quantity <b>{item.quantity.toLocaleString("en-US")}</b></span>
              {agreement.showPricing && <span>{AGREEMENT_PERIOD_LABELS[item.billingPeriod]} <b>{subtotal === null ? "Rate not supplied" : agreementMoney(subtotal)}</b></span>}</div>
          </article>;
        })}
      </div>
      <aside className="agreement-presentation-sidebar">
        <div className="agreement-presentation-summary">
          <span className="presentation-kicker">Your services</span>
          <strong>{agreement.items.length}</strong>
          <p>Agreement line items included in this review.</p>
        </div>
        {totals.length > 0 && <div className="agreement-presentation-totals"><span className="presentation-kicker">Recurring and other charges</span>
          {totals.map((total) => <div key={total.period}><small>{AGREEMENT_PERIOD_LABELS[total.period]}</small>
            <strong>{total.amount === null ? "Incomplete pricing" : agreementMoney(total.amount)}</strong></div>)}
        </div>}
        <div className="agreement-presentation-note">
          <b>About this summary</b>
          {agreement.asOfDate && <p>Agreement information as of {agreement.asOfDate}.</p>}
          {agreement.notes && <p>{agreement.notes}</p>}
          <p>This is an informational breakdown. Your signed agreement and current invoice govern the services provided and actual charges.</p>
        </div>
      </aside>
    </div>
  </div>;
}
