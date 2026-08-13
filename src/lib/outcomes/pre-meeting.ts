import type { ClientContact, HipaaQuestionDefinition, Project } from "@/lib/projects/types";
import { HIPAA_QUESTIONS } from "@/lib/hipaa/questions";
import { downloadFillableClientPdf } from "./fillable-pdf";
import { ADVANTAGE_LOGO_DATA_URI } from "./pdf-assets";
import { adaptOrganizationLanguage, organizationAudienceExamples, organizationPossessive, organizationTerm, organizationTermTitle } from "@/lib/projects/client-language";
import { isNoActionNeeded, isRemoteConsultation } from "./planning-mode";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function primaryContact(project: Project): ClientContact | undefined {
  return project.client.contacts.find((contact) => contact.primary && contact.email.trim())
    ?? project.client.contacts.find((contact) => contact.email.trim())
    ?? project.client.contacts.find((contact) => contact.primary)
    ?? project.client.contacts[0];
}

function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] || "";
}


export function preMeetingHipaaQuestions(project: Project): HipaaQuestionDefinition[] {
  if (!project.hipaa.enabled) return [];
  return HIPAA_QUESTIONS.filter((question) => question.ownership !== "advantage-prefill").filter((question) => {
    const answer = project.hipaa.answers.find((item) => item.questionId === question.id);
    return !answer || answer.response === "not-yet-assessed" || answer.deferred;
  });
}

export function preMeetingHipaaQuestionCount(project: Project): number {
  return preMeetingHipaaQuestions(project).length;
}

function preMeetingLabel(project: Project): string {
  return preMeetingHipaaQuestionCount(project) ? "Pre-meeting packet" : "Pre-meeting overview";
}

export function preMeetingDocumentTitle(project: Project): string {
  const clientName = project.client.name.trim();
  const documentName = preMeetingHipaaQuestionCount(project) ? "Technology Review Pre-Meeting Packet" : "Technology Review Overview";
  return clientName ? `${clientName} — ${documentName}` : documentName;
}

function preMeetingTopics(project: Project): string {
  const topics = [
    ["Equipment health", "The age and condition of your computers, server, and backup systems."],
    ["Security and backups", `How the ${organizationTerm(project)} is protected and whether recovery coverage is ready when needed.`],
    ["Technology planning", "Items that may need attention now and equipment that should be planned for next."],
    ...(project.hipaa.enabled ? [["HIPAA technology practices", "A guided review of technology-related safeguards, policies, and responsibilities."]] : []),
    ["Recommended next steps", isNoActionNeeded(project) ? "No immediate follow-up is recommended; we will continue monitoring and revisit the environment at the next review checkpoint." : isRemoteConsultation(project) ? "We will finish with a clear plan for a consultation call with your Technology Consultant, including the scope, estimate, and timing decisions." : "We will finish with a clear plan for an onsite project-planning review, including the scope, estimate, and timing decisions."],
  ];
  return topics.map(([title, detail], index) => `<article class="topic${index === topics.length - 1 ? " wide" : ""}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></article>`).join("");
}

function preparationPanel(project: Project): string {
  if (project.hipaa.enabled) {
    return `<section class="panel"><h2>Helpful information to have available</h2><ul><li>Who is responsible for HIPAA policies and employee training</li><li>Whether the practice works with a qualified HIPAA consultant or compliance professional</li><li>Whether risk assessments are performed and documented</li><li>How access is added or removed when team members change</li><li>How the ${organizationTerm(project)} would continue working during a technology outage</li><li>How security incidents are documented and handled</li></ul></section><section class="panel"><h2>Who should attend?</h2><p>Ideally, someone familiar with the ${organizationPossessive(project)} operations, technology, or HIPAA procedures should join the conversation. This may be ${organizationAudienceExamples(project)}.</p><div class="confirmed-mini"><strong>Already confirmed by Advantage</strong><span>Endpoint protection and security monitoring</span><span>Managed backup and recovery coverage for the primary server</span></div></section>`;
  }
  return `<section class="panel"><h2>Helpful information to have available</h2><ul><li>Known computer, software, or workflow concerns</li><li>Upcoming changes to applications or connected systems</li><li>Plans to add staff, locations, or equipment</li><li>Any recurring support or downtime concerns</li><li>Questions about future technology budgeting</li></ul></section><section class="panel"><h2>Who should attend?</h2><p>Ideally, someone familiar with the ${organizationPossessive(project)} daily operations and technology should join the conversation. This may be ${organizationAudienceExamples(project)} or another decision-maker.</p></section>`;
}

function hipaaQuestionPages(project: Project, clientName: string): string {
  const missingQuestions = preMeetingHipaaQuestions(project);
  if (!missingQuestions.length) return "";
  const chunks: HipaaQuestionDefinition[][] = [];
  for (let index = 0; index < missingQuestions.length; index += 2) chunks.push(missingQuestions.slice(index, index + 2));
  return chunks.map((questions, pageIndex) => `<section class="premeeting-page question-page" data-pdf-page="true"><header class="brandline"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"></div><span class="document-label">HIPAA questions needing input · ${pageIndex + 1} of ${chunks.length}</span></header><div class="question-intro"><span class="eyebrow">Optional before the meeting</span><h1>Technology-related HIPAA questions</h1><p>These are the items that still need your input. Complete them now, or leave them blank and we will work through them together during the meeting. This is a readiness conversation—not a legal audit or certification.</p></div><div class="question-list">${questions.map((question) => `<article class="question-card"><div class="question-meta"><span>${escapeHtml(question.id)}</span><em>${escapeHtml(question.category.replace(" Safeguards", ""))}</em></div><h2>${escapeHtml(question.title)}</h2><p>${escapeHtml(adaptOrganizationLanguage(question.question, project))}</p><small>${escapeHtml(adaptOrganizationLanguage(question.plainLanguageExplanation, project))}</small><div class="question-fields"><label><span>Response</span><div class="pdf-form-marker choice" data-pdf-field="premeeting.hipaa.${escapeHtml(question.id)}.response" data-pdf-field-type="choice" data-pdf-options="Yes|Somewhat|No|Not sure|Not applicable" data-pdf-font-size="9"><i>Select an answer, or leave blank</i></div></label><label><span>Notes or helpful details</span><div class="pdf-form-marker notes" data-pdf-field="premeeting.hipaa.${escapeHtml(question.id)}.notes" data-pdf-field-type="text" data-pdf-multiline="true" data-pdf-font-size="8"><i>Optional</i></div></label></div></article>`).join("")}</div>${pageIndex === chunks.length - 1 ? `<div class="question-return"><strong>Complete now or wait until the meeting—either is fine.</strong><span>If you answer the questions in advance, save the PDF and reply to your Technology Review email with the completed copy.</span></div>` : ""}<footer class="premeeting-footer"><span>Advantage Technologies</span><span>${escapeHtml(clientName)}</span></footer></section>`).join("");
}


export function preMeetingOverviewHtml(project: Project): string {
  const clientName = project.client.name.trim() || `Your ${organizationTermTitle(project)}`;
  const hipaaEnabled = project.hipaa.enabled;
  const missingHipaaQuestions = preMeetingHipaaQuestionCount(project);
  const reassurance = hipaaEnabled && missingHipaaQuestions
    ? `<div><strong>You can complete the ${missingHipaaQuestions} remaining question${missingHipaaQuestions === 1 ? "" : "s"} now—or wait.</strong><span>No advance research is required. Leave anything blank that you would rather discuss together during the meeting.</span></div>`
    : hipaaEnabled
      ? `<div><strong>No advance HIPAA questions remain.</strong><span>Advantage has already captured the available responses. We will review them together during the meeting.</span></div>`
      : `<div><strong>No advance research is required.</strong><span>We will review what is known during the meeting and identify any information or decisions that may require follow-up.</span></div>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="adv-pdf-layout" content="portrait">
  <title>${escapeHtml(preMeetingDocumentTitle(project))}</title>
  <style>
    :root{--navy:#071a34;--blue:#1766de;--ink:#0b1830;--muted:#5f7085;--line:#dbe5ef;--pale:#f4f8fc;--teal:#179b86}
    *{box-sizing:border-box}
    html,body{margin:0;background:#edf2f7;color:var(--ink);font-family:Arial,"Segoe UI",sans-serif}
    .premeeting-page{position:relative;width:816px;height:1056px;margin:0 auto;padding:46px 52px 42px;background:#fff;overflow:hidden}.premeeting-page[data-pdf-capture-page],.pdf-capture-document .premeeting-page[data-pdf-capture-page]{display:block!important}
    .brandline{display:flex;align-items:center;justify-content:space-between;padding-bottom:18px;border-bottom:1px solid var(--line)}
    .brand{display:flex;align-items:center}.brand img{width:190px;height:46px;object-fit:contain;object-position:left center;display:block}
    .document-label{color:#667b94;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    .hero{padding:38px 0 28px}.eyebrow{display:block;color:var(--blue);font-size:11px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.hero h1{max-width:650px;margin:10px 0 14px;font-size:43px;line-height:.98;letter-spacing:-.045em}.hero p{max-width:675px;margin:0;color:var(--muted);font-size:16px;line-height:1.55}
    .topic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:3px}.topic{min-height:100px;padding:16px 17px;border:1px solid var(--line);border-top:4px solid #4c8de2;border-radius:15px;background:#fff}.topic:nth-child(2){border-top-color:#22aa9a}.topic:nth-child(3){border-top-color:#e1b24d}.topic:nth-child(4){border-top-color:#8c79d7}.topic.wide{grid-column:1/-1;min-height:83px}.topic strong{display:block;font-size:15px}.topic span{display:block;margin-top:7px;color:var(--muted);font-size:12px;line-height:1.42}
    .preparation{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;margin-top:16px}.panel{padding:19px 20px;border:1px solid var(--line);border-radius:16px;background:var(--pale)}.panel h2{margin:0 0 10px;font-size:18px}.panel p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.panel ul{display:grid;gap:7px;margin:0;padding:0;list-style:none}.panel li{position:relative;padding-left:17px;color:#314862;font-size:11.5px;line-height:1.35}.panel li:before{content:"";position:absolute;left:0;top:5px;width:7px;height:7px;border-radius:50%;background:var(--teal)}
    .confirmed-mini{margin-top:12px;padding-top:10px;border-top:1px solid #cfdeef}.confirmed-mini strong,.confirmed-mini span{display:block}.confirmed-mini strong{color:#175cae;font-size:9px;text-transform:uppercase;letter-spacing:.06em}.confirmed-mini span{margin-top:4px;color:#4e647d;font-size:9.5px;line-height:1.3}
    .reassurance{display:grid;grid-template-columns:44px 1fr;gap:13px;align-items:center;margin-top:10px;padding:16px 18px;border:1px solid #a9d9cf;border-radius:16px;background:#effaf7}.check{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#d8f4ec;color:#08735f;font-size:23px;font-weight:900}.reassurance strong{display:block;font-size:14px}.reassurance span{display:block;margin-top:4px;color:#4e6a65;font-size:11.5px;line-height:1.4}
    .question-page{padding-bottom:52px}.question-intro{padding:24px 0 18px}.question-intro h1{margin:7px 0 8px;font-size:31px;line-height:1;letter-spacing:-.035em}.question-intro p{max-width:690px;margin:0;color:var(--muted);font-size:13px;line-height:1.5}.question-list{display:grid;grid-template-columns:1fr;gap:13px}.question-card{padding:17px 18px;border:1px solid var(--line);border-top:4px solid var(--blue);border-radius:16px;background:#fff}.question-meta{display:flex;justify-content:space-between;gap:10px;color:#4c6685;font-size:8.5px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.question-meta em{font-style:normal;color:#8190a2}.question-card h2{margin:7px 0 5px;font-size:17px}.question-card>p{margin:0;color:#2f4864;font-size:11.5px;line-height:1.42}.question-card>small{display:block;margin-top:6px;color:#75869a;font-size:9.5px;line-height:1.35}.question-fields{display:grid;grid-template-columns:.75fr 1.25fr;gap:10px;margin-top:11px}.question-fields label>span{display:block;margin-bottom:5px;color:#5f7085;font-size:7.5px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.pdf-form-marker{position:relative;width:100%;height:31px;border:1.3px solid #3978bf;border-radius:8px;background:#fff}.pdf-form-marker.notes{height:48px}.pdf-form-marker i{position:absolute;left:9px;top:8px;color:#9aa8b8;font-size:8px;font-style:normal}.choice i{top:50%;transform:translateY(-50%)}.question-return{margin-top:12px;padding:13px 15px;border:1px solid #a9d9cf;border-radius:13px;background:#effaf7}.question-return strong,.question-return span{display:block}.question-return strong{font-size:12px}.question-return span{margin-top:4px;color:#4e6a65;font-size:9.5px;line-height:1.4}
    .premeeting-footer{position:absolute;left:52px;right:52px;bottom:32px;display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid var(--line);color:#718197;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  </style>
</head>
<body>
  <main>
  <section class="premeeting-page" data-pdf-page="true">
    <header class="brandline">
      <div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"></div>
      <span class="document-label">${preMeetingLabel(project)}</span>
    </header>

    <div class="hero">
      <span class="eyebrow">Prepared for ${escapeHtml(clientName)}</span>
      <h1>Technology Review — What to Expect</h1>
      <p>Our upcoming review is a practical conversation about the technology supporting your ${organizationTerm(project)}, what is working well, and what may need attention or future planning.</p>
    </div>

    <div class="topic-grid">${preMeetingTopics(project)}</div>

    <div class="preparation">${preparationPanel(project)}</div>

    <div class="reassurance">
      <div class="check">✓</div>
      ${reassurance}
    </div>

    <footer class="premeeting-footer"><span>Advantage Technologies</span><span>${escapeHtml(clientName)}</span></footer>
  </section>
  ${hipaaQuestionPages(project, clientName)}
  </main>
</body>
</html>`;
}

export async function downloadPreMeetingOverviewPdf(project: Project): Promise<void> {
  await downloadFillableClientPdf(preMeetingOverviewHtml(project), preMeetingDocumentTitle(project));
}

export function preMeetingEmailDraft(project: Project): { recipient: string; subject: string; body: string; mailto: string } {
  const contact = primaryContact(project);
  const recipient = contact?.email.trim() ?? "";
  const greeting = firstName(contact?.name ?? "");
  const subject = "Preparing for your Technology Review";
  const reviewTopics = project.hipaa.enabled
    ? "the health of your computers and server, security and backup protection, upcoming technology needs, and several technology-related HIPAA safeguards"
    : "the health of your computers and server, security and backup protection, and upcoming technology needs";
  const missingHipaaQuestions = preMeetingHipaaQuestionCount(project);
  const preparationCopy = project.hipaa.enabled && missingHipaaQuestions
    ? `The attached packet includes only the ${missingHipaaQuestions} HIPAA technology question${missingHipaaQuestions === 1 ? "" : "s"} that still need your input. You’re welcome to complete them in advance, or leave them blank and we’ll work through them together during the meeting. There is no need to research every answer beforehand.`
    : project.hipaa.enabled
      ? "The HIPAA technology section is included in our meeting, but no advance questions currently need your input. There is no need to research anything beforehand."
      : "There is no need to research anything beforehand. We’ll review the available information together and identify any items that may require follow-up.";
  const attachmentName = missingHipaaQuestions ? "pre-meeting packet" : "short overview";
  const body = `Hi${greeting ? ` ${greeting}` : ""},\n\nFor our upcoming Technology Review, we’ll look at ${reviewTopics}.\n\n${preparationCopy}\n\nI’ve attached a ${attachmentName} of what we’ll cover.\n\nThanks,\nPatric`;
  const mailto = `mailto:${encodeURI(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { recipient, subject, body, mailto };
}

export function openPreMeetingEmailDraft(project: Project): void {
  window.location.href = preMeetingEmailDraft(project).mailto;
}
