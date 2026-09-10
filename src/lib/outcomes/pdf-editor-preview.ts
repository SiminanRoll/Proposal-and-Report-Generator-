import type { Project } from "@/lib/projects/types";
import { consultantContactFor, PATRIC_CONTACT, type ConsultantContact } from "./consultant-contacts";
import { formatPlanningAppointment, planningConsultantSentence, scheduledPlanningAppointment } from "./planning-appointment";
import { planningScheduledLabel } from "./planning-mode";

interface PreviewLayout {
  captureWidth: number;
  captureHeight: number;
}

const PORTRAIT_LAYOUT: PreviewLayout = { captureWidth: 816, captureHeight: 1056 };
const LANDSCAPE_LAYOUT: PreviewLayout = { captureWidth: 1280, captureHeight: 720 };

function requestedLayout(documentRef: Document): PreviewLayout {
  const requested = documentRef.querySelector<HTMLMetaElement>('meta[name="adv-pdf-layout"]')?.content.trim().toLowerCase();
  return requested === "portrait" ? PORTRAIT_LAYOUT : LANDSCAPE_LAYOUT;
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

function syncScheduledNextStepPage(documentRef: Document, project: Project): void {
  const appointment = scheduledPlanningAppointment(project);
  if (!appointment) return;
  const finalPage = documentRef.querySelector<HTMLElement>(".print-report .pdf-client-success-page");
  if (!finalPage) return;

  const sourceTitle = formatPlanningAppointment(appointment);
  const sourceCopy = planningConsultantSentence(project, appointment);
  const scheduledLabel = planningScheduledLabel(project);
  const heading = finalPage.querySelector<HTMLElement>(".pdf-section-header");
  const headingTitle = heading?.querySelector<HTMLElement>("h2");
  const headingCopy = heading?.querySelector<HTMLElement>("p");
  if (headingTitle) headingTitle.textContent = "Your next step is scheduled.";
  if (headingCopy) headingCopy.textContent = "The planning appointment below is confirmed and is the agreed next step from this review.";

  const closing = finalPage.querySelector<HTMLElement>(".pdf-focus-closing.final");
  if (closing) {
    closing.classList.add("scheduled");
    const label = closing.querySelector<HTMLElement>("strong");
    if (label) label.textContent = scheduledLabel;
    const paragraphs = closing.querySelectorAll<HTMLParagraphElement>("p");
    if (paragraphs[0]) paragraphs[0].textContent = [sourceTitle, sourceCopy].filter(Boolean).join(". ");
    if (paragraphs[1]) paragraphs[1].textContent = "No additional scheduling is needed. We will use this appointment to review the priorities, confirm scope, and move the agreed plan forward.";
  }

  const consultant = consultantContactFor(appointment.consultantName);
  const contactBlock = finalPage.querySelector<HTMLElement>(".pdf-csm-contact");
  if (consultant && contactBlock) {
    contactBlock.classList.add("pdf-contact-team");
    contactBlock.replaceChildren(
      contactCard(documentRef, "Your Client Success Manager", PATRIC_CONTACT, "csm"),
      contactCard(documentRef, "Technology Consultant meeting with you", consultant, "consultant"),
    );
  }
}

function captureCss(documentRef: Document, layout: PreviewLayout): string {
  const css = Array.from(documentRef.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n")
    .replace(/@media\s+print/gi, "@media all");

  return `${css}\n
    *{animation:none!important;transition:none!important;caret-color:auto!important;-webkit-font-smoothing:antialiased!important;text-rendering:geometricPrecision!important}
    img,svg{image-rendering:auto!important}
    .print-report,.pdf-capture-document,[data-pdf-capture-page]{font-family:Arial,"Segoe UI",sans-serif!important}
    .print-report{display:block!important;width:${layout.captureWidth}px!important;margin:0!important;padding:0!important}
    .screen-report,.toolbar,.top,.footer{display:none!important}
    [data-pdf-capture-page]{display:flex!important;box-sizing:border-box!important;width:${layout.captureWidth}px!important;height:${layout.captureHeight}px!important;min-height:${layout.captureHeight}px!important;max-height:${layout.captureHeight}px!important;border:0!important;border-radius:0!important;overflow:hidden!important;page-break-after:auto!important;break-after:auto!important}
    [data-pdf-capture-page].pdf-flow-page{display:block!important}
    [data-pdf-capture-page] .pdf-page-footer{position:absolute!important;left:18px!important;right:18px!important;bottom:12px!important}
    .pdf-focus-closing.final.scheduled{border-color:#78cdb8!important;background:#e7f8f2!important}
    .pdf-focus-closing.final.scheduled strong{color:#12876f!important}
    .pdf-csm-contact.pdf-contact-team{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;margin-top:18px!important;padding:0!important;border-radius:0!important;background:transparent!important;color:#0b1830!important}
    .pdf-contact-card{min-width:0;padding:16px 17px!important;border:1px solid #d7e4f1!important;border-radius:16px!important;box-shadow:none!important}
    .pdf-contact-card.csm{border-color:#173f70!important;background:linear-gradient(135deg,#071a34,#123f78)!important;color:#fff!important}
    .pdf-contact-card.consultant{border-color:#9fd9c9!important;background:linear-gradient(135deg,#eff9f5,#f7fbff)!important;color:#0b1830!important}
    .pdf-contact-kicker{display:block!important;margin:0!important;font-size:6.2pt!important;font-weight:900!important;letter-spacing:.1em!important;text-transform:uppercase!important}
    .pdf-contact-card.csm .pdf-contact-kicker{color:#9ec9ff!important}
    .pdf-contact-card.consultant .pdf-contact-kicker{color:#12876f!important}
    .pdf-contact-card h3{margin:5px 0 2px!important;font-size:14pt!important;line-height:1.05!important}
    .pdf-contact-card.csm h3{color:#fff!important}
    .pdf-contact-role{margin:0!important;font-size:6.8pt!important;font-weight:700!important;line-height:1.3!important}
    .pdf-contact-card.csm .pdf-contact-role{color:#cbd9ea!important}
    .pdf-contact-card.consultant .pdf-contact-role{color:#55766e!important}
    .pdf-contact-details{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px 10px!important;margin-top:11px!important}
    .pdf-contact-details span{display:block!important;min-width:0!important}
    .pdf-contact-details b,.pdf-contact-details strong{display:block!important}
    .pdf-contact-details b{margin-bottom:2px!important;font-size:5.2pt!important;font-weight:850!important;letter-spacing:.07em!important;text-transform:uppercase!important}
    .pdf-contact-card.csm .pdf-contact-details b{color:#8fb9ec!important}
    .pdf-contact-card.consultant .pdf-contact-details b{color:#4d8579!important}
    .pdf-contact-details strong{font-size:6.4pt!important;line-height:1.25!important;overflow-wrap:anywhere!important}
    .pdf-contact-card.csm .pdf-contact-details strong{color:#fff!important}
    .pdf-contact-card.consultant .pdf-contact-details strong{color:#17314f!important}
  `;
}

/**
 * Converts the final report HTML into a page-for-page editor preview using the
 * same 816x1056 portrait page box and the same promoted print/capture rules as
 * the raster PDF path. Editor chrome is kept outside those page boxes.
 */
export function preparePdfEditorPreviewHtml(html: string, project: Project): string {
  if (typeof DOMParser === "undefined") return html;
  const documentRef = new DOMParser().parseFromString(html.replace(
    "Most of the environment is in good shape. The items below deserve attention over time so they can be addressed thoughtfully and before they create unnecessary disruption.",
    "The items below deserve attention and should be addressed.",
  ), "text/html");

  syncScheduledNextStepPage(documentRef, project);
  const layout = requestedLayout(documentRef);
  const pages = Array.from(documentRef.querySelectorAll<HTMLElement>(".print-report > section"));
  pages.forEach((page) => { page.dataset.pdfCapturePage = "true"; });

  const exactCapture = documentRef.createElement("style");
  exactCapture.id = "client-compass-pdf-editor-capture-css";
  exactCapture.textContent = captureCss(documentRef, layout);
  documentRef.head.appendChild(exactCapture);

  const editorChrome = documentRef.createElement("style");
  editorChrome.id = "client-compass-pdf-editor-preview-css";
  editorChrome.textContent = `
    html,body{width:auto!important;height:auto!important;min-height:100%!important;overflow:auto!important;background:#d9dfe7!important}
    body{padding:28px 0 64px!important}
    main{width:${layout.captureWidth}px!important;max-width:none!important;height:auto!important;margin:0 auto!important;padding:0!important;overflow:visible!important}
    .print-report{width:${layout.captureWidth}px!important;height:auto!important;overflow:visible!important}
    [data-pdf-capture-page]{position:relative!important;margin:0 0 28px!important;box-shadow:0 18px 50px rgba(14,32,55,.18)!important;background:#fff!important}
    [data-pdf-inline-edit]{cursor:text!important;outline:1px dashed transparent!important;outline-offset:4px!important;border-radius:3px!important}
    [data-pdf-inline-edit]:hover{outline-color:rgba(45,127,245,.58)!important;background:rgba(45,127,245,.035)!important}
    [data-pdf-inline-edit]:focus{outline:2px solid #2d7ff5!important;background:rgba(45,127,245,.055)!important}
    [data-pdf-inline-edit][data-pdf-edit-dirty="true"]{outline-color:rgba(21,151,127,.55)!important}
  `;
  documentRef.head.appendChild(editorChrome);

  return `<!doctype html>${documentRef.documentElement.outerHTML}`;
}
