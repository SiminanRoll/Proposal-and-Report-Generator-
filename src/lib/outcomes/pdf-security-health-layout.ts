const PAGE_MARKER = 'class="pdf-page pdf-overview-page"';
const STYLE_MARKER = 'data-client-compass-page2-layout="v1.2.89"';

export const SECURITY_HEALTH_PAGE_LAYOUT_CSS = `
/* v1.2.89 - wider, stacked Security and Technology Health PDF page */
.pdf-overview-page .pdf-section-header{margin-bottom:10px!important}
.pdf-overview-page .pdf-overview-columns{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:10px!important;align-items:start!important}
.pdf-overview-page .pdf-overview-panel{height:auto!important;min-height:0!important;padding:14px 16px!important;border-radius:15px!important;break-inside:avoid!important}

.pdf-overview-page .pdf-overview-panel:first-child{display:grid!important;grid-template-columns:minmax(0,2.55in) minmax(0,1fr)!important;grid-template-areas:"security-label security-metrics" "security-title security-metrics" "security-incident security-incident" "security-statement security-statement"!important;column-gap:14px!important;row-gap:4px!important;align-items:start!important;border-color:#c8ddf2!important;background:linear-gradient(135deg,#eaf3ff 0%,#f3f8ff 55%,#eef9f7 100%)!important}
.pdf-overview-page .pdf-overview-panel:first-child>span{grid-area:security-label!important;color:#1766de!important}
.pdf-overview-page .pdf-overview-panel:first-child>h3{grid-area:security-title!important;margin:4px 0 0!important;font-size:15.6pt!important;line-height:1.12!important}
.pdf-overview-page .pdf-overview-panel:first-child>.pdf-compact-metrics{grid-area:security-metrics!important;margin:0!important;gap:8px!important;align-self:start!important}
.pdf-overview-page .pdf-overview-panel:first-child>.pdf-compact-metrics article{min-height:69px!important;padding:9px 11px!important;background:rgba(255,255,255,.94)!important}
.pdf-overview-page .pdf-overview-panel:first-child>.pdf-compact-metrics strong{font-size:19pt!important}
.pdf-overview-page .pdf-overview-panel:first-child>.pdf-incident-response{grid-area:security-incident!important;margin-top:5px!important}
.pdf-overview-page .pdf-overview-panel:first-child>.pdf-security-statement{grid-area:security-statement!important;display:grid!important;grid-template-columns:1.28in minmax(0,1fr)!important;gap:12px!important;align-items:start!important;margin-top:6px!important;padding:11px 13px!important;border:1px solid #d0e1f2!important;border-radius:11px!important;background:rgba(255,255,255,.86)!important}
.pdf-overview-page .pdf-security-statement>span{margin:1px 0 0!important;color:#1766de!important;font-size:6.4pt!important;font-weight:900!important;letter-spacing:.085em!important;line-height:1.3!important;text-transform:uppercase!important}
.pdf-overview-page .pdf-security-statement>p{margin:0!important;color:#4f647c!important;font-size:7.45pt!important;line-height:1.42!important}

.pdf-overview-page .pdf-overview-panel:last-child{display:grid!important;grid-template-columns:minmax(0,2.48in) minmax(0,1fr)!important;grid-template-areas:"health-label health-metrics" "health-title health-metrics" "health-title health-environment"!important;column-gap:14px!important;row-gap:4px!important;align-items:center!important;border-color:#d8e4ef!important;background:linear-gradient(135deg,#ffffff 0%,#fbfdff 58%,#f4f9fb 100%)!important}
.pdf-overview-page .pdf-overview-panel:last-child>span{grid-area:health-label!important;color:#18768b!important}
.pdf-overview-page .pdf-overview-panel:last-child>h3{grid-area:health-title!important;margin:4px 0 0!important;font-size:15.2pt!important;line-height:1.13!important}
.pdf-overview-page .pdf-overview-panel:last-child>.pdf-technology-recap{grid-area:health-metrics!important;margin:0!important;gap:7px!important}
.pdf-overview-page .pdf-overview-panel:last-child>.pdf-technology-recap article{min-height:66px!important;padding:8px 9px!important}
.pdf-overview-page .pdf-overview-panel:last-child>.pdf-technology-recap article strong{font-size:19pt!important}
.pdf-overview-page .pdf-overview-panel:last-child>.pdf-technology-recap article small{font-size:6.5pt!important}
.pdf-overview-page .pdf-overview-panel:last-child>.pdf-environment-line{grid-area:health-environment!important;margin:3px 0 0!important;padding:7px 10px!important;font-size:6.9pt!important}

.pdf-overview-page .pdf-review-story{grid-template-columns:1fr 14px 1fr 14px 1fr!important;gap:4px!important;margin-top:9px!important;padding:7px 9px!important;border-radius:12px!important}
.pdf-overview-page .pdf-review-story>i{height:1px!important}
.pdf-overview-page .pdf-review-story article{gap:7px!important;padding:3px 5px!important}
.pdf-overview-page .pdf-review-story article .pdf-report-icon{width:24px!important;height:24px!important;border-radius:8px!important}
.pdf-overview-page .pdf-review-story article .pdf-report-icon svg{width:14px!important;height:14px!important}
.pdf-overview-page .pdf-review-story article strong{font-size:7.4pt!important;line-height:1.18!important}
.pdf-overview-page .pdf-review-story article small{display:none!important}
`;

export function prepareSecurityHealthPageHtml(html: string): string {
  if (!html.includes(PAGE_MARKER) || html.includes(STYLE_MARKER)) return html;
  const style = `<style ${STYLE_MARKER}>${SECURITY_HEALTH_PAGE_LAYOUT_CSS}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : `${style}${html}`;
}
