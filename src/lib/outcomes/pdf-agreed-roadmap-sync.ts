import { getProjectsSnapshot } from "@/lib/projects/store";
import { hasAgreedReviewPlan } from "@/lib/review-outcomes/model";
import type { ReviewOutcomeItem } from "@/lib/review-outcomes/types";
import { consultantContactFor, PATRIC_CONTACT, type ConsultantContact } from "./consultant-contacts";
import { formatPlanningAppointment, planningConsultantSentence, scheduledPlanningAppointment } from "./planning-appointment";
import { planningScheduledLabel } from "./planning-mode";

function liveClientReportProject(documentTitle: string) {
  if (typeof window === "undefined" || !documentTitle.startsWith("Technology Health Review")) return null;
  return getProjectsSnapshot()
    .filter((project) => {
      if (project.type !== "client-report") return false;
      const clientName = project.client.name.trim();
      const projectTitle = clientName ? `Technology Health Review - ${clientName}` : "Technology Health Review";
      return projectTitle === documentTitle;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

function normalizedCopy(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clientDecisionDetail(item: ReviewOutcomeItem): string {
  const title = item.title.trim();
  const note = item.clientFacingNote.trim();
  if (!note || normalizedCopy(note) === normalizedCopy(title)) return "";
  if (/^supporting condition discussed during the review/i.test(note)) return "";
  return note;
}

function decisionCard(documentRef: Document, item: ReviewOutcomeItem, index: number): HTMLElement {
  const card = documentRef.createElement("article");
  card.className = "recommendation pdf-client-agreed-decision";

  const number = documentRef.createElement("b");
  number.textContent = String(index + 1).padStart(2, "0");

  const body = documentRef.createElement("div");
  const meta = documentRef.createElement("div");
  meta.className = "action-meta";
  const agreed = documentRef.createElement("span");
  agreed.textContent = "Agreed decision";
  meta.appendChild(agreed);

  const title = documentRef.createElement("h3");
  title.textContent = item.title.trim() || "Agreed next step";

  body.append(meta, title);
  const detail = clientDecisionDetail(item);
  if (detail) {
    const copy = documentRef.createElement("p");
    copy.textContent = detail;
    body.appendChild(copy);
  }
  card.append(number, body);
  return card;
}

function contactCard(documentRef: Document, kicker: string, contact: ConsultantContact, className: string): HTMLElement {
  const card = documentRef.createElement("article");
  card.className = `pdf-contact-card ${className}`;

  const label = documentRef.createElement("span");
  label.className = "pdf-contact-kicker";
  label.textContent = kicker;

  const name = documentRef.createElement("h3");
  name.textContent = contact.name;

  const role = documentRef.createElement("p");
  role.className = "pdf-contact-role";
  role.textContent = `${contact.role} · Advantage Technologies`;

  const details = documentRef.createElement("div");
  details.className = "pdf-contact-details";
  const addDetail = (detailLabel: string, value?: string) => {
    if (!value) return;
    const item = documentRef.createElement("span");
    const itemLabel = documentRef.createElement("b");
    itemLabel.textContent = detailLabel;
    const itemValue = documentRef.createElement("strong");
    itemValue.textContent = value;
    item.append(itemLabel, itemValue);
    details.appendChild(item);
  };
  addDetail("Mobile", contact.mobile);
  addDetail("Phone", contact.phone);
  addDetail("Email", contact.email);
  addDetail("Web", contact.web);

  card.append(label, name, role, details);
  return card;
}

function inferredScheduledNextStep(project: ReturnType<typeof liveClientReportProject>): { copy: string; consultant: ConsultantContact } | null {
  if (!project) return null;
  const copy = project.reviewOutcome.agreedNextStep.trim();
  if (!copy) return null;
  const consultant = consultantContactFor(copy);
  if (!consultant) return null;
  const hasClockTime = /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/i.test(copy);
  const hasScheduledLanguage = /\bis scheduled\b|\bscheduled for\b|\bappointment\b|\bwill\s+(?:meet|complete|conduct|perform|join|be onsite)\b[\s\S]*\b(?:on|at)\b/i.test(copy);
  return hasClockTime && hasScheduledLanguage ? { copy, consultant } : null;
}

function syncScheduledFinalPage(documentRef: Document, documentTitle: string): void {
  const project = liveClientReportProject(documentTitle);
  if (!project) return;
  const appointment = scheduledPlanningAppointment(project);
  const inferred = appointment ? null : inferredScheduledNextStep(project);
  if (!appointment && !inferred) return;

  const finalPage = documentRef.querySelector<HTMLElement>(".print-report .pdf-client-success-page");
  if (!finalPage) return;

  const header = finalPage.querySelector<HTMLElement>(".pdf-section-header");
  const headerTitle = header?.querySelector<HTMLElement>("h2");
  const headerCopy = header?.querySelector<HTMLElement>("p");
  if (headerTitle) headerTitle.textContent = "Your next step is scheduled.";
  if (headerCopy) headerCopy.textContent = "Your appointment is confirmed, so there is nothing else you need to schedule after this review.";

  const closing = finalPage.querySelector<HTMLElement>(".pdf-focus-closing.final");
  if (closing) {
    closing.classList.add("scheduled");
    const label = closing.querySelector<HTMLElement>("strong");
    const paragraphs = closing.querySelectorAll<HTMLParagraphElement>("p");
    if (label) label.textContent = planningScheduledLabel(project);
    if (paragraphs[0]) paragraphs[0].textContent = appointment
      ? `${formatPlanningAppointment(appointment)} · ${planningConsultantSentence(project, appointment)}`
      : inferred!.copy;
    if (paragraphs[1]) paragraphs[1].textContent = "Your Technology Consultant will use this appointment to review the priorities, confirm scope, and move the agreed plan forward. Your Client Success Manager remains your ongoing point of contact.";
  }

  const contactBlock = finalPage.querySelector<HTMLElement>(".pdf-csm-contact");
  if (!contactBlock) return;
  const consultant = appointment ? consultantContactFor(appointment.consultantName) : inferred?.consultant ?? null;
  if (!consultant) return;
  contactBlock.classList.add("pdf-contact-team");
  contactBlock.replaceChildren(
    contactCard(documentRef, "Your Client Success Manager", PATRIC_CONTACT, "csm"),
    contactCard(documentRef, "Technology Consultant meeting with you", consultant, "consultant"),
  );
}

function addCleanRoadmapStyles(documentRef: Document): void {
  if (documentRef.getElementById("pdf-agreed-roadmap-clean-styles")) return;
  const style = documentRef.createElement("style");
  style.id = "pdf-agreed-roadmap-clean-styles";
  style.textContent = `
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-section-header{margin-bottom:14px!important}
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-consultation-banner{margin-top:10px!important}
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-recommendation-list{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:10px!important;
      margin-top:12px!important;
      align-content:start!important;
    }
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-client-agreed-decision{
      display:grid!important;
      grid-template-columns:32px minmax(0,1fr)!important;
      gap:10px!important;
      min-height:0!important;
      padding:13px 14px!important;
      border:1px solid #d6e4ef!important;
      border-left:4px solid #15977f!important;
      border-radius:13px!important;
      background:linear-gradient(145deg,#ffffff,#f7fbfa)!important;
      color:#0b1830!important;
      box-shadow:none!important;
    }
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-client-agreed-decision>b{
      display:grid!important;
      place-items:center!important;
      width:30px!important;
      height:30px!important;
      border-radius:9px!important;
      background:#1766de!important;
      color:#fff!important;
      font-size:6.5pt!important;
      font-weight:900!important;
    }
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-client-agreed-decision .action-meta{
      display:flex!important;
      margin:0 0 5px!important;
    }
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-client-agreed-decision .action-meta span{
      padding:4px 7px!important;
      border-radius:999px!important;
      background:#e7f6f1!important;
      color:#12876f!important;
      font-size:5.5pt!important;
      font-weight:900!important;
      letter-spacing:.06em!important;
      text-transform:uppercase!important;
    }
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-client-agreed-decision h3{
      margin:0!important;
      color:#10243d!important;
      font-size:10pt!important;
      line-height:1.22!important;
    }
    .pdf-action-page.pdf-agreed-roadmap-clean .pdf-client-agreed-decision p{
      margin:6px 0 0!important;
      color:#607187!important;
      font-size:6.8pt!important;
      line-height:1.4!important;
    }
  `;
  documentRef.head.appendChild(style);
}

/**
 * The internal project-packaging model is useful for estimating and technical
 * planning, but it must never replace the client-facing decisions captured in
 * Tailor Report. Rebuild only the agreed-roadmap page from the saved review
 * outcome immediately before PDF capture.
 */
export function syncAgreedRoadmapPdf(documentRef: Document, documentTitle: string): void {
  const project = liveClientReportProject(documentTitle);
  if (!project || !hasAgreedReviewPlan(project.reviewOutcome)) return;

  const actionPage = documentRef.querySelector<HTMLElement>(".print-report .pdf-action-page:not(.pdf-action-continuation)");
  if (!actionPage) return;
  actionPage.classList.add("pdf-agreed-roadmap-clean");
  addCleanRoadmapStyles(documentRef);

  const header = actionPage.querySelector<HTMLElement>(".pdf-section-header");
  const headerKicker = header?.querySelector<HTMLElement>(".kicker");
  const headerTitle = header?.querySelector<HTMLElement>("h2");
  const headerCopy = header?.querySelector<HTMLElement>("p");
  if (headerKicker) headerKicker.textContent = "Agreed plan";
  if (headerTitle) headerTitle.textContent = "Agreed technology roadmap";
  if (headerCopy) headerCopy.textContent = "These are the decisions agreed during the review and the next step we committed to together.";

  const appointment = scheduledPlanningAppointment(project);
  const inferred = appointment ? null : inferredScheduledNextStep(project);
  const banner = actionPage.querySelector<HTMLElement>(".pdf-consultation-banner");
  if (banner) {
    banner.classList.add("agreed", "single");
    const kicker = banner.querySelector<HTMLElement>(".kicker");
    const title = banner.querySelector<HTMLElement>("h3");
    const copy = banner.querySelector<HTMLElement>("p");
    if (appointment) {
      if (kicker) kicker.textContent = planningScheduledLabel(project);
      if (title) title.textContent = formatPlanningAppointment(appointment);
      if (copy) copy.textContent = planningConsultantSentence(project, appointment);
    } else if (inferred) {
      if (kicker) kicker.textContent = planningScheduledLabel(project);
      if (title) title.textContent = "Appointment confirmed";
      if (copy) copy.textContent = inferred.copy;
    } else {
      if (kicker) kicker.textContent = project.reviewOutcome.status === "confirmed" ? "Confirmed client plan" : "Agreed client plan";
      if (title) title.textContent = "Agreed next step";
      if (copy) copy.textContent = project.reviewOutcome.agreedNextStep.trim() || "Complete the agreed decisions and confirm progress at the next review checkpoint.";
    }
    const outcomes = banner.querySelector<HTMLElement>(".pdf-session-outcomes");
    outcomes?.remove();
  }

  const list = actionPage.querySelector<HTMLElement>(".pdf-recommendation-list");
  if (!list) return;
  const decisions = project.reviewOutcome.items.filter((item) => item.includeInReport && (item.title.trim() || item.clientFacingNote.trim()));
  list.replaceChildren(...decisions.slice(0, 6).map((item, index) => decisionCard(documentRef, item, index)));

  // Old package-based continuation pages can contain inferred device findings
  // rather than client decisions. The tailored roadmap is intentionally capped
  // at six decisions on the primary page, so remove those stale continuations.
  documentRef.querySelectorAll(".print-report .pdf-action-continuation").forEach((page) => page.remove());
}

export function prepareAgreedRoadmapHtml(html: string, documentTitle: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined" || !documentTitle.startsWith("Technology Health Review")) return html;
  const documentRef = new DOMParser().parseFromString(html, "text/html");
  syncAgreedRoadmapPdf(documentRef, documentTitle);
  syncScheduledFinalPage(documentRef, documentTitle);
  return `<!doctype html>${documentRef.documentElement.outerHTML}`;
}
