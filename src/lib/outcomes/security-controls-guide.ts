import type { Project } from "@/lib/projects/types";

const CONTROLS: Array<{ title: string; check: string; assistance: string }> = [
  { title: "Antivirus & firewalls", check: "Protection on office computers", assistance: "Managed threat monitoring and firewall review" },
  { title: "Data encryption", check: "Sensitive data stored and sent securely", assistance: "Encryption guidance for supported systems" },
  { title: "Mobile device security", check: "Protected laptops and mobile devices", assistance: "Managed endpoint controls, where covered" },
  { title: "Updates & vulnerabilities", check: "Security patches and risk remediation", assistance: "Managed updates and lifecycle planning" },
  { title: "Backups & recovery", check: "Protected copies and recovery testing", assistance: "Local/cloud backup and restore support, if included" },
  { title: "Incident response", check: "A documented response process", assistance: "Threat escalation and technical recovery coordination" },
  { title: "Email MFA", check: "Second-factor email sign-ins", assistance: "Microsoft 365 MFA configuration, where managed" },
  { title: "Network & remote MFA", check: "MFA for external and cloud access", assistance: "Review supported remote-access sign-ins" },
  { title: "Email security", check: "Filtering of malicious email", assistance: "Filtering and configuration review, if included" },
  { title: "Security awareness", check: "Staff phishing and security education", assistance: "Guidance and training-provider recommendations" },
];

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

/** A reference, not a completed insurance application or an assurance of service coverage. */
export function securityControlsGuideHtml(project: Project, footer: string): string {
  if (project.type !== "client-report" || !project.hipaa.enabled) return "";
  const cards = CONTROLS.map((control, index) =>
    '<article class="pdf-controls-guide-card">' +
      '<div class="pdf-controls-guide-title"><b>' + String(index + 1).padStart(2, "0") + '</b><h3>' + escapeHtml(control.title) + '</h3></div>' +
      '<p><span>WHAT IT CHECKS</span>' + escapeHtml(control.check) + '</p>' +
      '<p><span>ADVANTAGE CAN HELP</span>' + escapeHtml(control.assistance) + '</p>' +
    '</article>').join("");
  return '<section class="pdf-page pdf-controls-guide" data-pdf-page="true">' +
    '<header class="pdf-section-header">' +
      '<span class="kicker">Security reference · Questionnaire help</span>' +
      '<h2>Cyber insurance &amp; security controls</h2>' +
      '<p>Ten common questions, what they check, and where Advantage can help.</p>' +
    '</header>' +
    '<div class="pdf-controls-guide-intro"><strong>Using an insurance or security questionnaire?</strong>' +
      '<span>Review these topics with your team. Confirm each Yes, No, or Unknown against your actual systems and services.</span></div>' +
    '<div class="pdf-controls-guide-grid">' + cards + '</div>' +
    '<div class="pdf-controls-guide-note"><strong>Before you check Yes</strong>' +
      '<span>Coverage depends on your active agreement, software, devices and documented procedures. Your organization or qualified adviser should confirm the final questionnaire answers. Ask Advantage to verify technical items we support.</span></div>' +
    footer + '</section>';
}

export const SECURITY_CONTROLS_GUIDE_CSS = [
  ".pdf-controls-guide .pdf-section-header{margin-bottom:.15in!important}",
  ".pdf-controls-guide .pdf-section-header h2{font-size:23pt!important;line-height:1.1!important}",
  ".pdf-controls-guide .pdf-section-header p{max-width:6.5in!important;font-size:8.5pt!important}",
  ".pdf-controls-guide-intro{display:flex;align-items:center;gap:.13in;border:1px solid #c7dfee;border-radius:.12in;background:linear-gradient(100deg,#edf5ff,#f3fbfb);padding:.11in .14in;margin-bottom:.14in;color:#18456c;line-height:1.35}",
  ".pdf-controls-guide-intro strong{flex:0 0 1.62in;font-size:8.2pt;line-height:1.25}",
  ".pdf-controls-guide-intro span{font-size:7.6pt}",
  ".pdf-controls-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.10in;align-content:start}",
  ".pdf-controls-guide-card{min-width:0;min-height:1.20in;padding:.14in .14in!important;border:1px solid #d8e5f0;border-radius:.13in;background:#fff;break-inside:avoid;page-break-inside:avoid;box-shadow:none}",
  ".pdf-controls-guide-title{display:flex;align-items:center;gap:.09in;margin-bottom:.09in}",
  ".pdf-controls-guide-title b{width:.30in;height:.30in;flex:0 0 .30in;border-radius:.08in;display:grid;place-items:center;background:linear-gradient(145deg,#1a76c4,#15a3ad);color:#fff;font-size:7.6pt}",
  ".pdf-controls-guide-title h3{margin:0;font-size:10.7pt;line-height:1.2;color:#0b2545;letter-spacing:-.01em}",
  ".pdf-controls-guide-card p{display:flex;flex-direction:column;gap:2px;margin:0 0 .06in;padding-left:.39in;color:#48627a;font-size:8.3pt;line-height:1.26}",
  ".pdf-controls-guide-card p:last-child{margin-bottom:0}",
  ".pdf-controls-guide-card p span{color:#1c81a5;font-size:6.8pt;letter-spacing:.07em;font-weight:900}",
  ".pdf-controls-guide-note{display:flex;align-items:flex-start;gap:.12in;margin-top:.13in;padding:.11in .13in;border-left:3px solid #169d9e;border-radius:.08in;background:#f2f7f9;color:#4d6479}",
  ".pdf-controls-guide-note strong{flex:0 0 1.09in;color:#15577b;font-size:7.6pt}",
  ".pdf-controls-guide-note span{font-size:7.8pt;line-height:1.34}",
].join("\n");
