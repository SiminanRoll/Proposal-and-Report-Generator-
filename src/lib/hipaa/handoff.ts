import type { HipaaAnswer, HipaaResponse, Project } from "@/lib/projects/types";
import { answerIsSessionResolved } from "./engine";
import { HIPAA_QUESTION_SET_VERSION, hipaaClientHandoffQuestions } from "./questions";

const HANDOFF_FORMAT = "advantage-hipaa-readiness-client-handoff";
const HANDOFF_VERSION = 1;

interface HandoffResponse {
  questionId: string;
  response: HipaaResponse;
  note: string;
}

interface HandoffPayload {
  format: typeof HANDOFF_FORMAT;
  version: number;
  questionSetVersion: string;
  projectId: string;
  clientName: string;
  responderName: string;
  responderTitle: string;
  completedAt: string;
  responses: HandoffResponse[];
}

export interface HandoffImportResult {
  project: Project;
  importedCount: number;
  unansweredCount: number;
  responder: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function safeFileName(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "client";
}

function normalizedClientName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

function handoffSeed(project: Project) {
  return {
    format: HANDOFF_FORMAT,
    version: HANDOFF_VERSION,
    questionSetVersion: HIPAA_QUESTION_SET_VERSION,
    projectId: project.id,
    clientName: project.client.name,
    questions: hipaaClientHandoffQuestions().map((question) => ({
      id: question.id,
      title: question.title,
      question: question.question,
      explanation: question.plainLanguageExplanation,
      category: question.category.replace(" Safeguards", ""),
      existingResponse: project.hipaa.answers.find((answer) => answer.questionId === question.id)?.response ?? "not-yet-assessed",
      existingNote: project.hipaa.answers.find((answer) => answer.questionId === question.id)?.internalNotes ?? "",
    })),
  };
}

export function hipaaClientHandoffEmailSubject(project: Project): string {
  return `${project.client.name} — HIPAA readiness quick check`;
}

export function hipaaClientHandoffEmailBody(project: Project): string {
  return `Hi,\n\nBefore our technology review, please open the attached HIPAA Security Readiness quick-check form and answer what you know. It contains ${hipaaClientHandoffQuestions().length} short questions, notes are optional, and no supporting documents are required.\n\nWhen finished, click “Download completed responses” in the form and reply with the small JSON response file attached. Please do not include patient information.\n\nThank you.`;
}

export function hipaaClientHandoffHtml(project: Project): string {
  const seed = JSON.stringify(handoffSeed(project)).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.client.name)} — HIPAA Readiness Quick Check</title><style>
  :root{--navy:#071a34;--blue:#1766de;--ink:#0b1830;--muted:#647388;--line:#dbe4ef;--bg:#eef3f8;--green:#15866f;--yellow:#a96d08;--red:#b84b34}*{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,#edf4fb,#f7f9fc);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(960px,calc(100% - 28px));margin:auto;padding:26px 0 90px}.brand{display:flex;justify-content:space-between;gap:20px;align-items:center;color:#6e7c90;font-size:12px;margin-bottom:14px}.hero{padding:34px;border-radius:26px;background:linear-gradient(135deg,#06172f,#0b356f 62%,#1766de);color:#fff;box-shadow:0 24px 65px rgba(7,26,52,.22)}.hero .kicker,.question .kicker{font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.12em}.hero h1{margin:10px 0 13px;font-size:clamp(34px,6vw,58px);line-height:1}.hero p{margin:0;max-width:760px;color:#d5e5f9;line-height:1.65}.notice{margin:16px 0;padding:15px 18px;border:1px solid #c7d9ee;border-radius:15px;background:#f8fbff;color:#52647a;line-height:1.55}.identity{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.identity label,.note-label{display:grid;gap:6px}.identity span,.note-label span{font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.08em;color:#66758a}input[type=text],textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px 13px;font:inherit;color:var(--ink)}.questions{display:grid;gap:12px}.question{padding:20px;border:1px solid var(--line);border-radius:19px;background:rgba(255,255,255,.94);box-shadow:0 10px 28px rgba(22,51,87,.06)}.question h2{margin:5px 0 8px;font-size:19px}.question p{margin:0;color:#52647a;line-height:1.55}.answers{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:15px 0}.answers label{position:relative}.answers input{position:absolute;opacity:0;pointer-events:none}.answers span{display:grid;place-items:center;min-height:42px;padding:8px;border:1px solid var(--line);border-radius:11px;background:#fff;font-size:11px;font-weight:800;cursor:pointer;text-align:center}.answers input:checked+span{border-color:#2e79dc;background:#eaf3ff;box-shadow:0 0 0 2px #cfe3ff;color:#0f5dbb}.question small{display:block;margin-top:9px;color:#7b899a;line-height:1.45}.save-note{margin:0 0 16px;color:#68798d;font-size:11px}.actions{position:sticky;bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:20px;padding:15px 18px;border:1px solid rgba(255,255,255,.65);border-radius:18px;background:rgba(7,26,52,.94);backdrop-filter:blur(16px);box-shadow:0 18px 45px rgba(7,26,52,.25);color:#dce8f7}.actions p{margin:0;font-size:12px;line-height:1.45}.actions button{border:0;border-radius:12px;padding:13px 18px;background:linear-gradient(135deg,#2a82ec,#1766de);color:#fff;font-weight:850;cursor:pointer;white-space:nowrap}.status{margin-top:12px;font-size:12px;color:#53667e}.footer{margin-top:24px;color:#758397;font-size:11px;line-height:1.55}@media(max-width:720px){.identity{grid-template-columns:1fr}.answers{grid-template-columns:1fr 1fr}.actions{align-items:stretch;flex-direction:column}.actions button{width:100%}}@media print{body{background:#fff}.actions{position:static;background:#fff;color:var(--ink);box-shadow:none}.actions button{display:none}.question{break-inside:avoid}}
  </style></head><body><main><div class="brand"><strong>Advantage Technologies</strong><span>Client pre-review form</span></div><section class="hero"><span class="kicker">HIPAA Security Readiness · Quick Check</span><h1>${escapeHtml(project.client.name)}</h1><p>Answer what you know before the technology review. Most questions take only a few seconds. Notes are optional, and no supporting documents need to be attached.</p></section><div class="notice"><strong>Please do not include patient information.</strong> This file stays on your computer until you email the completed response file back to your Advantage contact.</div><section class="identity"><label><span>Your name</span><input id="responderName" type="text" autocomplete="name" placeholder="Name"></label><label><span>Your title or role</span><input id="responderTitle" type="text" placeholder="Office manager, doctor, privacy officer, etc."></label></section><p class="save-note">Your answers are saved in this browser as you work. “Not sure” is acceptable; Advantage can finish those items with you during the review.</p><div id="questions" class="questions"></div><div id="status" class="status"></div><div class="actions"><p>When finished, download the small response file and attach it to your reply email. Advantage will import it into the review.</p><button id="download" type="button">Download completed responses</button></div><div class="footer">This is a readiness screening, not legal advice, a formal audit, certification, or guarantee of HIPAA compliance. The organization remains responsible for evaluating and maintaining compliance across its complete environment.</div></main><script>
  const seed=${seed};
  const storageKey='advantage-hipaa-handoff:'+seed.projectId+':'+seed.questionSetVersion;
  const responseOptions=[['yes','Yes'],['partially','Somewhat'],['no','No'],['not-yet-assessed','Not sure'],['not-applicable','Does not apply']];
  const root=document.getElementById('questions');
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}};
  const draft=readDraft();
  seed.questions.forEach((question,index)=>{
    const saved=draft?.responses?.find((item)=>item.questionId===question.id);
    const selected=saved?.response||question.existingResponse;
    const note=saved?.note??question.existingNote;
    const article=document.createElement('article');article.className='question';article.dataset.questionId=question.id;
    const answers=responseOptions.map(([value,label])=>'<label><input type="radio" name="'+esc(question.id)+'" value="'+value+'" '+(selected===value?'checked':'')+'><span>'+label+'</span></label>').join('');
    article.innerHTML='<span class="kicker">'+String(index+1).padStart(2,'0')+' · '+esc(question.category)+'</span><h2>'+esc(question.title)+'</h2><p>'+esc(question.question)+'</p><div class="answers">'+answers+'</div><label class="note-label"><span>Optional note</span><textarea rows="2" placeholder="Add context only when it would help Advantage prepare.">'+esc(note)+'</textarea></label><small>'+esc(question.explanation)+'</small>';
    root.appendChild(article);
  });
  if(draft){document.getElementById('responderName').value=draft.responderName||'';document.getElementById('responderTitle').value=draft.responderTitle||'';document.getElementById('status').textContent='Saved answers restored from this browser.'}
  const collect=()=>({responderName:document.getElementById('responderName').value.trim(),responderTitle:document.getElementById('responderTitle').value.trim(),responses:[...document.querySelectorAll('.question')].map((article)=>({questionId:article.dataset.questionId,response:article.querySelector('input:checked')?.value||'not-yet-assessed',note:article.querySelector('textarea').value.trim()}))});
  const saveDraft=()=>{try{localStorage.setItem(storageKey,JSON.stringify(collect()))}catch{}};
  document.addEventListener('input',saveDraft);document.addEventListener('change',saveDraft);
  document.getElementById('download').addEventListener('click',()=>{
    const current=collect();
    const payload={format:seed.format,version:seed.version,questionSetVersion:seed.questionSetVersion,projectId:seed.projectId,clientName:seed.clientName,responderName:current.responderName,responderTitle:current.responderTitle,completedAt:new Date().toISOString(),responses:current.responses};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='${safeFileName(project.client.name)}-hipaa-readiness-responses.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    const answered=current.responses.filter((item)=>item.response!=='not-yet-assessed').length;document.getElementById('status').textContent='Saved '+answered+' of '+current.responses.length+' answered questions. Attach the downloaded JSON file to your reply email.';
  });
  </script></body></html>`;
}

export function downloadHipaaClientHandoff(project: Project): void {
  const blob = new Blob([hipaaClientHandoffHtml(project)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(project.client.name)}-hipaa-readiness-quick-check.html`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function isHipaaResponse(value: unknown): value is HipaaResponse {
  return ["yes", "partially", "no", "not-applicable", "not-yet-assessed"].includes(String(value));
}

export async function importHipaaClientHandoff(project: Project, file: File): Promise<HandoffImportResult> {
  const payload = JSON.parse(await file.text()) as Partial<HandoffPayload>;
  if (payload.format !== HANDOFF_FORMAT || payload.version !== HANDOFF_VERSION) throw new Error("This is not a valid Advantage HIPAA client response file.");
  if (payload.questionSetVersion !== HIPAA_QUESTION_SET_VERSION) throw new Error("This response file uses an older question set. Download a new client form and complete that version instead.");
  const sourceClient = normalizedClientName(payload.clientName);
  const currentClient = normalizedClientName(project.client.name);
  if (sourceClient && currentClient && sourceClient !== currentClient) throw new Error(`This response file was created for ${String(payload.clientName)} rather than ${project.client.name}.`);
  if (!Array.isArray(payload.responses)) throw new Error("The response file does not contain any answers.");
  const allowed = new Set(hipaaClientHandoffQuestions().map((question) => question.id));
  const responses = payload.responses.filter((item): item is HandoffResponse => Boolean(item && allowed.has(String(item.questionId)) && isHipaaResponse(item.response)));
  if (!responses.length) throw new Error("No matching client questions were found in the response file.");
  const suppliedCompletedAt = typeof payload.completedAt === "string" ? new Date(payload.completedAt) : null;
  const completedAt = suppliedCompletedAt && !Number.isNaN(suppliedCompletedAt.getTime()) ? suppliedCompletedAt.toISOString() : new Date().toISOString();
  const responderName = typeof payload.responderName === "string" ? payload.responderName.trim() : "";
  const responderTitle = typeof payload.responderTitle === "string" ? payload.responderTitle.trim() : "";
  const responder = [responderName, responderTitle].filter(Boolean).join(", ") || "Client pre-review form";
  const responseMap = new Map(responses.map((item) => [item.questionId, item]));
  const answers = project.hipaa.answers.map((answer) => {
    const imported = responseMap.get(answer.questionId);
    if (!imported) return answer;
    const note = typeof imported.note === "string" ? imported.note.trim() : "";
    const next: HipaaAnswer = {
      ...answer,
      response: imported.response,
      confidence: "medium",
      verificationStatus: imported.response === "not-yet-assessed" ? "not-reviewed" : "client-confirmed",
      evidenceSource: "Client questionnaire",
      evidenceDate: completedAt,
      internalNotes: note || `Completed by ${responder} in the client pre-review form.`,
      riskSeverity: imported.response === "no" ? "high" : imported.response === "partially" ? "moderate" : "none",
      completionStatus: imported.response === "not-yet-assessed" ? "open" : "complete",
      deferred: false,
      deferredAt: "",
      deferredReason: "",
      clientConfirmationStatus: "pending",
      clientConfirmer: "",
      confirmationDate: "",
      lastReviewedDate: completedAt,
    };
    return next;
  });
  const importedCount = responses.filter((item) => item.response !== "not-yet-assessed").length;
  const unansweredCount = responses.length - importedCount;
  const sessionResolved = answers.every(answerIsSessionResolved);
  return {
    project: {
      ...project,
      hipaa: {
        ...project.hipaa,
        answers,
        status: sessionResolved ? "ready-for-confirmation" : "in-progress",
        clientConfirmation: { status: "pending", confirmer: "", confirmedAt: "", acceptedResponsibility: false },
        lastUpdatedAt: completedAt,
      },
    },
    importedCount,
    unansweredCount,
    responder,
  };
}
