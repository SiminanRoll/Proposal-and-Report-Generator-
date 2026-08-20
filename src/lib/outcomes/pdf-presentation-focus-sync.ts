import { getProjectsSnapshot } from "@/lib/projects/store";
import { buildPresentationFocusStory, type PresentationFocusNarrative } from "./presentation-focus";

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

function roleLabel(narrative: PresentationFocusNarrative): string {
  if (narrative.role === "primary") return "Primary focus";
  if (narrative.role === "secondary") return "Secondary focus";
  return "Supporting focus";
}

function focusCard(documentRef: Document, narrative: PresentationFocusNarrative): HTMLElement {
  const card = documentRef.createElement("article");
  card.className = `pdf-tailored-focus-card ${narrative.role}`;

  const heading = documentRef.createElement("div");
  heading.className = "pdf-tailored-focus-card-heading";
  const role = documentRef.createElement("span");
  role.textContent = roleLabel(narrative);
  const label = documentRef.createElement("strong");
  label.textContent = narrative.label;
  heading.append(role, label);

  const title = documentRef.createElement("h3");
  title.textContent = narrative.headline;
  const intro = documentRef.createElement("p");
  intro.textContent = narrative.introduction;
  card.append(heading, title, intro);

  if (narrative.role === "primary") {
    const education = documentRef.createElement("div");
    education.className = "pdf-tailored-focus-education";
    for (const item of narrative.education.slice(0, 3)) {
      const point = documentRef.createElement("div");
      const pointTitle = documentRef.createElement("strong");
      pointTitle.textContent = item.title;
      const detail = documentRef.createElement("small");
      detail.textContent = item.detail;
      point.append(pointTitle, detail);
      education.appendChild(point);
    }
    card.appendChild(education);
  }

  const evidence = documentRef.createElement("aside");
  evidence.className = "pdf-tailored-focus-evidence";
  const evidenceLabel = documentRef.createElement("span");
  evidenceLabel.textContent = "Why this is in the plan";
  const evidenceTitle = documentRef.createElement("strong");
  evidenceTitle.textContent = narrative.evidenceTitle;
  const evidenceDetail = documentRef.createElement("p");
  evidenceDetail.textContent = narrative.evidenceDetail;
  evidence.append(evidenceLabel, evidenceTitle, evidenceDetail);
  card.appendChild(evidence);
  return card;
}

function focusFooter(documentRef: Document, sourcePage: Element, clientName: string): HTMLElement {
  const source = sourcePage.querySelector<HTMLElement>(".pdf-page-footer");
  const footer = source?.cloneNode(true) as HTMLElement | null;
  if (!footer) {
    const fallback = documentRef.createElement("footer");
    fallback.className = "pdf-page-footer";
    const brand = documentRef.createElement("span");
    brand.textContent = "Advantage Technologies";
    const label = documentRef.createElement("span");
    label.textContent = `${clientName} · Review Focus`;
    fallback.append(brand, label);
    return fallback;
  }
  const spans = footer.querySelectorAll("span");
  const finalSpan = spans.item(spans.length - 1);
  if (finalSpan) finalSpan.textContent = `${clientName} · Review Focus`;
  return footer;
}

function addFocusStyles(documentRef: Document): void {
  if (documentRef.getElementById("pdf-tailored-presentation-focus-styles")) return;
  const style = documentRef.createElement("style");
  style.id = "pdf-tailored-presentation-focus-styles";
  style.textContent = `
    .pdf-tailored-focus-page{justify-content:flex-start!important;background:linear-gradient(145deg,#f7faff,#fff 62%)!important}
    .pdf-tailored-focus-page .pdf-section-header{margin-bottom:14px!important}
    .pdf-tailored-focus-page .pdf-section-header p{max-width:6.7in!important}
    .pdf-tailored-focus-stack{display:grid;gap:11px;align-content:start}
    .pdf-tailored-focus-card{padding:14px 16px;border:1px solid #d7e2ee;border-left:5px solid #8da0b7;border-radius:16px;background:#fff;color:#0b1830}
    .pdf-tailored-focus-card.primary{padding:17px 18px;border-left-color:#1766de;background:linear-gradient(145deg,#f7fbff,#fff)}
    .pdf-tailored-focus-card.secondary{border-left-color:#15977f}.pdf-tailored-focus-card.supporting{border-left-color:#7865bb}
    .pdf-tailored-focus-card-heading{display:flex;align-items:center;gap:9px;margin-bottom:7px}
    .pdf-tailored-focus-card-heading span{display:inline-flex;padding:4px 7px;border-radius:999px;background:#e8f1ff;color:#1766de;font-size:5.7pt;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
    .pdf-tailored-focus-card.secondary .pdf-tailored-focus-card-heading span{background:#e7f6f1;color:#12876f}
    .pdf-tailored-focus-card.supporting .pdf-tailored-focus-card-heading span{background:#f0edfb;color:#6755a7}
    .pdf-tailored-focus-card-heading strong{font-size:7pt;color:#4f6681;text-transform:uppercase;letter-spacing:.04em}
    .pdf-tailored-focus-card h3{margin:0;color:#10243d;font-size:14pt;line-height:1.18}
    .pdf-tailored-focus-card>p{margin:6px 0 0;color:#5e7086;font-size:7.2pt;line-height:1.45}
    .pdf-tailored-focus-education{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}
    .pdf-tailored-focus-education>div{padding:10px;border:1px solid #dce7f2;border-radius:11px;background:#f7faff}
    .pdf-tailored-focus-education strong,.pdf-tailored-focus-education small{display:block}.pdf-tailored-focus-education strong{color:#183b68;font-size:6.4pt}.pdf-tailored-focus-education small{margin-top:4px;color:#687a90;font-size:5.8pt;line-height:1.35}
    .pdf-tailored-focus-evidence{display:grid;grid-template-columns:1fr;gap:2px;margin-top:9px;padding:9px 11px;border-radius:11px;background:#f0f5fa}
    .pdf-tailored-focus-evidence span{color:#6f8196;font-size:5.3pt;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
    .pdf-tailored-focus-evidence strong{color:#183b68;font-size:6.5pt}.pdf-tailored-focus-evidence p{margin:1px 0 0;color:#687a90;font-size:5.8pt;line-height:1.35}
    .pdf-tailored-client-context{margin-top:11px;padding:11px 13px;border:1px solid #cdd9e8;border-radius:13px;background:#f8fbff;color:#415a74}
    .pdf-tailored-client-context span{display:block;color:#1766de;font-size:5.5pt;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.pdf-tailored-client-context p{margin:4px 0 0;font-size:6.5pt;line-height:1.4}
  `;
  documentRef.head.appendChild(style);
}

export function preparePresentationFocusHtml(html: string, documentTitle: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined" || !documentTitle.startsWith("Technology Health Review")) return html;
  const project = liveClientReportProject(documentTitle);
  if (!project?.reviewOutcome?.presentationConcerns?.length) return html;

  const story = buildPresentationFocusStory(project);
  if (!story.primary || !story.narratives.length) return html;

  const documentRef = new DOMParser().parseFromString(html, "text/html");
  documentRef.querySelectorAll(".print-report .pdf-tailored-focus-page").forEach((page) => page.remove());
  const overview = documentRef.querySelector<HTMLElement>(".print-report .pdf-overview-page");
  if (!overview) return html;

  addFocusStyles(documentRef);
  const page = documentRef.createElement("section");
  page.className = "pdf-page pdf-tailored-focus-page";
  page.setAttribute("data-pdf-page", "true");

  const header = documentRef.createElement("header");
  header.className = "pdf-section-header";
  const kicker = documentRef.createElement("span");
  kicker.className = "kicker";
  kicker.textContent = "Review focus";
  const title = documentRef.createElement("h2");
  title.textContent = "What this technology review is focused on";
  const copy = documentRef.createElement("p");
  copy.textContent = "These priorities shape the conversation, recommendations, and next-step planning in this report. The first item is the primary story; the others support it.";
  header.append(kicker, title, copy);

  const stack = documentRef.createElement("div");
  stack.className = "pdf-tailored-focus-stack";
  for (const narrative of story.narratives) stack.appendChild(focusCard(documentRef, narrative));

  page.append(header, stack);
  if (story.clientConcern) {
    const context = documentRef.createElement("aside");
    context.className = "pdf-tailored-client-context";
    const contextLabel = documentRef.createElement("span");
    contextLabel.textContent = "Client context";
    const contextCopy = documentRef.createElement("p");
    contextCopy.textContent = story.clientConcern;
    context.append(contextLabel, contextCopy);
    page.appendChild(context);
  }
  page.appendChild(focusFooter(documentRef, overview, project.client.name.trim()));
  overview.insertAdjacentElement("afterend", page);
  return `<!doctype html>${documentRef.documentElement.outerHTML}`;
}
