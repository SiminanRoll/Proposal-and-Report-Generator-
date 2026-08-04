import type { ClientContact, Project } from "@/lib/projects/types";
import { downloadFillableClientPdf } from "./fillable-pdf";

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

export function preMeetingDocumentTitle(project: Project): string {
  const clientName = project.client.name.trim();
  return clientName ? `${clientName} — Technology Review Overview` : "Technology Review Overview";
}

export function preMeetingOverviewHtml(project: Project): string {
  const clientName = project.client.name.trim() || "Your Practice";
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
    .premeeting-page{position:relative;width:816px;height:1056px;margin:0 auto;padding:46px 52px 42px;background:#fff;overflow:hidden}.pdf-capture-document .premeeting-page[data-pdf-capture-page]{display:block!important}
    .brandline{display:flex;align-items:center;justify-content:space-between;padding-bottom:18px;border-bottom:1px solid var(--line)}
    .brand{display:flex;align-items:center;gap:12px}.brand img:first-child{width:38px;height:38px;object-fit:contain}.brand img:last-child{width:155px;height:auto;object-fit:contain;filter:brightness(0) saturate(100%) invert(10%) sepia(25%) saturate(2400%) hue-rotate(178deg) brightness(88%)}
    .document-label{color:#667b94;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    .hero{padding:38px 0 28px}.eyebrow{display:block;color:var(--blue);font-size:11px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.hero h1{max-width:650px;margin:10px 0 14px;font-size:43px;line-height:.98;letter-spacing:-.045em}.hero p{max-width:675px;margin:0;color:var(--muted);font-size:16px;line-height:1.55}
    .topic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:3px}.topic{min-height:100px;padding:16px 17px;border:1px solid var(--line);border-top:4px solid #4c8de2;border-radius:15px;background:#fff}.topic:nth-child(2){border-top-color:#22aa9a}.topic:nth-child(3){border-top-color:#e1b24d}.topic:nth-child(4){border-top-color:#8c79d7}.topic.wide{grid-column:1/-1;min-height:83px}.topic strong{display:block;font-size:15px}.topic span{display:block;margin-top:7px;color:var(--muted);font-size:12px;line-height:1.42}
    .preparation{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;margin-top:16px}.panel{padding:19px 20px;border:1px solid var(--line);border-radius:16px;background:var(--pale)}.panel h2{margin:0 0 10px;font-size:18px}.panel p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.panel ul{display:grid;gap:7px;margin:0;padding:0;list-style:none}.panel li{position:relative;padding-left:17px;color:#314862;font-size:11.5px;line-height:1.35}.panel li:before{content:"";position:absolute;left:0;top:5px;width:7px;height:7px;border-radius:50%;background:var(--teal)}
    .reassurance{display:grid;grid-template-columns:44px 1fr;gap:13px;align-items:center;margin-top:15px;padding:16px 18px;border:1px solid #a9d9cf;border-radius:16px;background:#effaf7}.check{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#d8f4ec;color:#08735f;font-size:23px;font-weight:900}.reassurance strong{display:block;font-size:14px}.reassurance span{display:block;margin-top:4px;color:#4e6a65;font-size:11.5px;line-height:1.4}
    .premeeting-footer{position:absolute;left:52px;right:52px;bottom:32px;display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid var(--line);color:#718197;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  </style>
</head>
<body>
  <main>
  <section class="premeeting-page" data-pdf-page="true">
    <header class="brandline">
      <div class="brand"><img src="/advantage-mark.png" alt=""><img src="/advantage-wordmark-no-a.png" alt="Advantage Technologies"></div>
      <span class="document-label">Pre-meeting overview</span>
    </header>

    <div class="hero">
      <span class="eyebrow">Prepared for ${escapeHtml(clientName)}</span>
      <h1>Technology Review — What to Expect</h1>
      <p>Our upcoming review is a practical conversation about the technology supporting your practice, what is working well, and what may need attention or future planning.</p>
    </div>

    <div class="topic-grid">
      <article class="topic"><strong>Equipment health</strong><span>The age and condition of your computers, server, and backup systems.</span></article>
      <article class="topic"><strong>Security and backups</strong><span>How the practice is protected and whether recovery coverage is ready when needed.</span></article>
      <article class="topic"><strong>Technology planning</strong><span>Items that may need attention now and equipment that should be planned for next.</span></article>
      <article class="topic"><strong>HIPAA technology practices</strong><span>A guided review of technology-related safeguards, policies, and responsibilities.</span></article>
      <article class="topic wide"><strong>Recommended next steps</strong><span>We will finish with a clear plan, including whether an estimate, remote review, or onsite project-planning visit is appropriate.</span></article>
    </div>

    <div class="preparation">
      <section class="panel">
        <h2>Helpful information to have available</h2>
        <ul>
          <li>Who is responsible for HIPAA policies and employee training</li>
          <li>Whether risk assessments are performed and documented</li>
          <li>How access is added or removed when team members change</li>
          <li>Whether backup recovery is periodically tested</li>
          <li>How security incidents are documented and handled</li>
        </ul>
      </section>
      <section class="panel">
        <h2>Who should attend?</h2>
        <p>Ideally, someone familiar with the practice’s operations, technology, or HIPAA procedures should join the conversation. This may be the doctor, practice manager, office manager, or HIPAA coordinator.</p>
      </section>
    </div>

    <div class="reassurance">
      <div class="check">✓</div>
      <div><strong>No advance research is required.</strong><span>We will complete what is known during the meeting, skip anything that is not available, and identify any information that can be provided afterward.</span></div>
    </div>

    <footer class="premeeting-footer"><span>Advantage Technologies</span><span>${escapeHtml(clientName)}</span></footer>
  </section>
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
  const body = `Hi${greeting ? ` ${greeting}` : ""},\n\nFor our upcoming Technology Review, we’ll look at the health of your computers and server, security and backup protection, upcoming technology needs, and several technology-related HIPAA practices.\n\nThere is no need to research every answer beforehand. We’ll complete what we can together and identify anything that may require follow-up. If possible, it would be helpful to have someone involved in the practice’s HIPAA policies, employee onboarding, or security procedures join us.\n\nI’ve attached a short overview of what we’ll cover.\n\nThanks,\nPatric`;
  const mailto = `mailto:${encodeURI(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { recipient, subject, body, mailto };
}

export function openPreMeetingEmailDraft(project: Project): void {
  window.location.href = preMeetingEmailDraft(project).mailto;
}
