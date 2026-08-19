import type { A360ConversationRecord } from "@/lib/projects/types";
import { a360ConversationReportHtml } from "@/lib/prospects/a360-report-export";

const A360_READABLE_TYPE_STYLE = `<style>
body{font-family:Arial,Helvetica,sans-serif!important}
h1,h2,h3,.eyebrow,.priority strong,.value strong,.fact b,.price-hero strong,.appointment-card strong,.step b,.closing strong,.scheduled-strip strong{font-family:"Segoe UI",Arial,sans-serif}
.cover p{font-size:12.5pt}
</style>`;

export function readableA360ConversationReportHtml(record: A360ConversationRecord): string {
  return a360ConversationReportHtml(record).replace("</head>", `${A360_READABLE_TYPE_STYLE}</head>`);
}

export function printReadableA360ConversationReport(record: A360ConversationRecord): void {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank");
  if (!win) throw new Error("Allow pop-ups to open the A360 PDF report.");
  try { win.opener = null; } catch { /* Keep export usable if opener is read-only. */ }
  win.document.open();
  win.document.write(readableA360ConversationReportHtml(record));
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 450);
}
