import { ADVANTAGE_WEBSITE_LINKS, type AdvantageWebsiteLinkKey } from "@/lib/advantage-website-links";

const WEBSITE_LINK_STYLE = `<style id="advantage-pdf-website-links">
.adv-pdf-inline-link{display:inline;color:#1766de!important;font-weight:800!important;text-decoration:none!important;white-space:nowrap}
.adv-pdf-inline-link:after{content:' ↗';font-size:.9em}
.adv-pdf-link-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin-top:10px;color:#61758d;font-size:6.2pt;font-weight:750}
.adv-pdf-link-row>span{color:#7b8da1;font-size:5.5pt;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.adv-pdf-link-row a{color:#1766de!important;text-decoration:none!important;font-weight:850!important}
.adv-pdf-link-row a:after{content:' ↗';font-size:.9em}
</style>`;

function link(key: AdvantageWebsiteLinkKey, label: string, className = "adv-pdf-inline-link"): string {
  const href = ADVANTAGE_WEBSITE_LINKS[key];
  return `<a class="${className}" href="${href}" data-pdf-link="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function pageEnd(html: string, start: number): number {
  const next = html.indexOf('<section class="pdf-page', start + 1);
  return next >= 0 ? next : html.length;
}

function appendToPageHeader(html: string, marker: string, addition: string): string {
  const start = html.indexOf(marker);
  if (start < 0) return html;
  const end = pageEnd(html, start);
  const headerStart = html.indexOf('<header class="pdf-section-header">', start);
  if (headerStart < 0 || headerStart >= end) return html;
  const paragraphEnd = html.indexOf("</p>", headerStart);
  if (paragraphEnd < 0 || paragraphEnd >= end) return html;
  return `${html.slice(0, paragraphEnd)} ${addition}${html.slice(paragraphEnd)}`;
}

function insertBeforePageFooter(html: string, marker: string, addition: string): string {
  const start = html.indexOf(marker);
  if (start < 0) return html;
  const end = pageEnd(html, start);
  const segment = html.slice(start, end);
  const footerOffset = segment.lastIndexOf('<footer class="pdf-page-footer">');
  if (footerOffset < 0) return html;
  const insertion = start + footerOffset;
  return `${html.slice(0, insertion)}${addition}${html.slice(insertion)}`;
}

function markFirstBrandAsHomepageLink(html: string): string {
  const brandline = '<header class="pdf-brandline"><span>';
  if (html.includes(brandline)) {
    return html.replace(
      brandline,
      `<header class="pdf-brandline"><span data-pdf-link="${ADVANTAGE_WEBSITE_LINKS.home}">`,
    );
  }

  const logoPattern = /<img\b([^>]*?(?:advantage-logo-full\.png|alt=["']Advantage Technologies["'])[^>]*)>/i;
  return html.replace(logoPattern, (match, attributes: string) => {
    if (/data-pdf-link=/i.test(match)) return match;
    return `<img${attributes} data-pdf-link="${ADVANTAGE_WEBSITE_LINKS.home}">`;
  });
}

function actionPageWebsiteKey(html: string): AdvantageWebsiteLinkKey {
  const marker = '<section class="pdf-page pdf-action-page"';
  const start = html.indexOf(marker);
  if (start < 0) return "stable";
  const segment = html.slice(start, pageEnd(html, start));
  return /\b(server|workstation|computer|replacement|replace|aging|refresh|project)\b/i.test(segment) ? "projects" : "stable";
}

function decorateClientReport(html: string): string {
  let result = markFirstBrandAsHomepageLink(html);
  result = appendToPageHeader(
    result,
    '<section class="pdf-page pdf-overview-page"',
    link("secure", "Learn about Advantage security"),
  );

  const planningKey = actionPageWebsiteKey(result);
  result = appendToPageHeader(
    result,
    '<section class="pdf-page pdf-action-page"',
    planningKey === "projects"
      ? link("projects", "Explore technology refresh planning")
      : link("stable", "See how Advantage keeps technology stable"),
  );

  const finalLinks = `<div class="adv-pdf-link-row"><span>Keep exploring</span>${link("techEducation", "Tech Education", "")}${link("contact", "Contact Advantage", "")}</div>`;
  result = insertBeforePageFooter(result, '<section class="pdf-page pdf-client-success-page"', finalLinks);
  return result;
}

/**
 * Add a small number of useful Advantage website destinations to client PDFs.
 * The data-pdf-link attribute is converted into a native PDF URI annotation by
 * the raster PDF core so links remain clickable after the HTML page is imaged.
 */
export function preparePdfWebsiteLinks(html: string, documentTitle: string): string {
  if (!html) return html;
  let result = markFirstBrandAsHomepageLink(html);
  if (documentTitle.startsWith("Technology Health Review") || result.includes('class="print-report"')) {
    result = decorateClientReport(result);
  }
  if (!result.includes('id="advantage-pdf-website-links"')) {
    result = result.includes("</head>") ? result.replace("</head>", `${WEBSITE_LINK_STYLE}</head>`) : `${WEBSITE_LINK_STYLE}${result}`;
  }
  return result;
}
