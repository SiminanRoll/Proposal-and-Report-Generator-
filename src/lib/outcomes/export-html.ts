import type { Project } from "@/lib/projects/types";
import { categoryLabel } from "./builder";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function safeFileName(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "client-experience";
}

function painPoints(project: Project): string {
  const items = project.painPoints.filter(Boolean);
  if (!items.length) return "";
  return `<section><span class="kicker">What matters most</span><div class="pain-grid">${items.slice(0, 6).map((item) => `<article>${escapeHtml(item)}</article>`).join("")}</div></section>`;
}

export function outcomeHtml(project: Project): string {
  const typeLabel = project.type === "client-report" ? "Client technology review" : project.type === "legacy-modernization" ? "Modern proposal" : "Advantage 360 proposal";
  const priorityCount = project.findings.filter((item) => item.severity === "priority").length;
  const attentionCount = project.findings.filter((item) => item.severity === "attention").length;
  const healthyCount = project.findings.filter((item) => item.severity === "healthy").length;
  const findings = project.findings.map((item) => `<article class="finding ${item.severity}"><div><span>${escapeHtml(categoryLabel(item.category))}</span><em>${escapeHtml(item.severity)}</em></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.clientSummary)}</p></article>`).join("");
  const recommendations = project.recommendations.map((item, index) => `<article class="recommendation"><b>${String(index + 1).padStart(2, "0")}</b><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.clientValue)}</p></div></article>`).join("");
  const investment = project.type !== "client-report" && (project.pricing.monthly || project.pricing.oneTime)
    ? `<section><span class="kicker">Investment</span><div class="investment"><article><small>Monthly</small><strong>$${project.pricing.monthly.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></article><article><small>One-time</small><strong>$${project.pricing.oneTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></article></div></section>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.presentation.title)}</title><style>
  :root{--navy:#071a34;--blue:#1766de;--ink:#0b1830;--muted:#66758a;--line:#dfe6ef;--bg:#eef2f6}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0%,#dce9ff,transparent 28rem),var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(1180px,calc(100% - 36px));margin:0 auto;padding:28px 0 80px}.top{display:flex;justify-content:space-between;align-items:center;padding:8px 2px 24px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#617087}.hero{min-height:420px;border-radius:32px;padding:58px;background:linear-gradient(130deg,#06172f,#0b336c 60%,#1766de);color:white;box-shadow:0 30px 80px #17345b3d;display:flex;flex-direction:column;justify-content:center}.kicker{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:850;color:#7f8ca0;margin-bottom:13px}.hero .kicker{color:#a8caff}.hero h1{max-width:850px;margin:0 0 20px;font-size:clamp(42px,7vw,82px);line-height:.98;letter-spacing:-.055em}.hero p{max-width:850px;margin:0;color:#dceaffc9;font-size:18px;line-height:1.65}.score-grid,.investment{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:18px 0 48px}.score-grid article,.investment article{background:white;border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 10px 30px #1d304c10}.score-grid strong,.investment strong{display:block;font-size:36px}.score-grid small,.investment small{display:block;margin-top:7px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:800}section{margin-top:48px}section>h2{font-size:34px;letter-spacing:-.035em;margin:0 0 18px}.finding-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.finding{padding:25px;border-radius:21px;background:white;border:1px solid var(--line);border-top:5px solid #7098dc}.finding.priority{border-top-color:#ef8062}.finding.attention{border-top-color:#d9aa48}.finding.healthy{border-top-color:#35aa91}.finding>div{display:flex;justify-content:space-between}.finding span,.finding em{font-style:normal;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#7c899b;font-weight:850}.finding h3{margin:18px 0 9px;font-size:21px}.finding p,.recommendation p{margin:0;color:var(--muted);line-height:1.65}.recommendation-list{display:grid;gap:12px}.recommendation{display:grid;grid-template-columns:55px 1fr;gap:18px;padding:22px;border-radius:19px;background:white;border:1px solid var(--line)}.recommendation b{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:#eaf1ff;color:var(--blue)}.recommendation h3{margin:0 0 7px;font-size:19px}.pain-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.pain-grid article{padding:20px;border-radius:18px;background:#071a34;color:white;line-height:1.5}.footer{margin-top:58px;padding:26px 0;border-top:1px solid #ccd7e4;color:#748197;font-size:12px;display:flex;justify-content:space-between}.toolbar{position:fixed;right:20px;bottom:20px;display:flex;gap:8px}.toolbar button{border:0;border-radius:14px;padding:13px 17px;background:#071a34;color:white;font-weight:800;box-shadow:0 12px 30px #071a3440;cursor:pointer}@media(max-width:760px){.hero{padding:34px;min-height:360px}.score-grid,.investment,.finding-grid,.pain-grid{grid-template-columns:1fr}.footer{flex-direction:column;gap:8px}.toolbar{position:static;margin-top:25px}.toolbar button{width:100%}}@media print{body{background:white}.toolbar{display:none}main{width:100%;padding:0}.hero{box-shadow:none;break-after:page}section{break-inside:avoid}}
  </style></head><body><main><header class="top"><span>Advantage Technologies</span><span>${escapeHtml(typeLabel)}</span></header><section class="hero"><span class="kicker">Prepared for ${escapeHtml(project.client.name)}</span><h1>${escapeHtml(project.presentation.title)}</h1><p>${escapeHtml(project.presentation.executiveSummary)}</p></section><div class="score-grid"><article><strong>${priorityCount}</strong><small>Priority items</small></article><article><strong>${attentionCount}</strong><small>Needs attention</small></article><article><strong>${healthyCount}</strong><small>Healthy findings</small></article></div>${painPoints(project)}<section><span class="kicker">The review</span><h2>What we found</h2><div class="finding-grid">${findings}</div></section><section><span class="kicker">The plan</span><h2>Recommended next steps</h2><div class="recommendation-list">${recommendations}</div></section>${investment}<footer class="footer"><span>Prepared by Advantage Technologies</span><span>Generated locally from approved project information</span></footer><div class="toolbar"><button onclick="window.print()">Print or save PDF</button></div></main></body></html>`;
}

export function downloadOutcomeHtml(project: Project): void {
  const blob = new Blob([outcomeHtml(project)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(project.presentation.title)}.html`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
