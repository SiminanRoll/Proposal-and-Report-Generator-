/**
 * FAR / Account Evidence briefs are INTERNAL planning sources. This extracts
 * review candidates, not publishable assertions. Human selection and editing
 * are mandatory before anything reaches a client presentation or PDF.
 */
export type FarCategory = "service-value" | "open-decision" | "potential-adjustment";
export interface FarCandidate {
  id: string;
  category: FarCategory;
  section: string;
  evidence: string;
  suggestion: string;
  reviewStatus: "documented" | "unconfirmed" | "conditional";
}

function sectionFor(line: string): { category: FarCategory; title: string } | null {
  const text = line.toLowerCase().trim();
  if (/^(five strongest facts|strongest documented support examples|a\. ticket evidence|support outcomes|service value highlights|recent service wins)/.test(text))
    return { category: "service-value", title: line };
  if (/^(most important unanswered questions|open questions|items needing validation|pending validation)/.test(text))
    return { category: "open-decision", title: line };
  if (/^(top potential savings opportunities|current cost vs\.? potential savings|potential adjustments|cost optimization opportunities|potential savings)/.test(text))
    return { category: "potential-adjustment", title: line };
  if (/^(team action list|verified active monthly agreement charges|agreement additions|support volume|recommended approach|what .* does not necessarily replace|appendix|projects, activities|financial opportunities|source:)/.test(text))
    return { category: "open-decision", title: "" }; // explicit end of prior evidence section
  return null;
}

function topic(line: string): string {
  const s = line.toLowerCase();
  if (/backup|disaster recovery|restore test|data recovery|backup verification/.test(s)) return "backup";
  if (/imaging|cbct|3d|scan shares?/.test(s)) return "imaging";
  if (/server|ups|outage|network|switch|wi-?fi|wireless|firewall/.test(s)) return "infrastructure";
  if (/security|malware|virus|threat|patch|monitor|disk|corrupt/.test(s)) return "security";
  if (/licenses?|microsoft 365|business basic|subscriptions?/.test(s)) return "licensing";
  if (/workstations?|computers?|devices?|inventory/.test(s)) return "workstations";
  if (/access|application|vendor|login|conversion|migration/.test(s)) return "applications";
  return "general";
}

function suggestedLine(category: FarCategory, line: string): string {
  const key = topic(line);
  if (category === "service-value") {
    const options: Record<string, string> = {
      infrastructure: "Restored essential systems and network connectivity",
      applications: "Restored access to essential business applications",
      security: "Investigated threats and resolved security concerns",
      backup: "Supported recovery and data protection",
      imaging: "Coordinated imaging and clinical system support",
      workstations: "Resolved employee workstation issues",
      licensing: "Helped coordinate software and account access",
      general: "Resolved a documented technology issue",
    };
    return options[key];
  }
  if (category === "open-decision") {
    const options: Record<string, string> = {
      infrastructure: "Confirm infrastructure dependencies before changes",
      applications: "Verify application access and migration needs",
      security: "Review current monitoring and security evidence",
      backup: "Confirm backup coverage and recovery testing",
      imaging: "Verify imaging data, storage and retention",
      workstations: "Reconcile managed computers with the current inventory",
      licensing: "Verify active software licenses and assignments",
      general: "Confirm outstanding technology requirements",
    };
    return options[key];
  }
  const options: Record<string, string> = {
    infrastructure: "Validate server and network scope before changes",
    applications: "Review unused applications and access",
    security: "Review protection scope before adjusting services",
    backup: "Confirm protected data before changing backup services",
    imaging: "Verify imaging dependencies before consolidation",
    workstations: "Review managed-device quantities",
    licensing: "Review unused software licenses",
    general: "Review potential service adjustments",
  };
  return options[key];
}

function isCandidate(category: FarCategory, line: string): boolean {
  if (line.length < 35 || line.length > 1000) return false;
  if (/^(source:|page \d|confidential|ticket \d|agreement \d|company \d|why it matters:|evidence basis:|responsibility\b)/i.test(line)) return false;
  if (category === "service-value") return /(restor|resolv|repaired|fixed|confirmed result:|action\/outcome:|responded|coordinated|detected|recovered|remediated|resolved)/i.test(line);
  if (category === "open-decision") return /\?|^(verify|confirm|validate|reconcile|which|does|is|are|what|where|who)\b/i.test(line);
  return /^(validate|confirm|reconcile|review|retire|reduce|check)\b/i.test(line);
}

/** Explicitly numbered executive priorities often arrive inside DOCX tables.
 * Mammoth extracts their cell paragraphs as newline-delimited text, not a
 * heading + question-form checklist. Prioritize these documented top-three
 * titles before falling back to section/keyword scanning.
 */
function topThreeCandidates(lines: string[]): FarCandidate[] {
  const heading = lines.findIndex((line) => /^top\s+(?:three|3)\s+(?:things|concerns|priorities|findings|issues)\s*:?$/i.test(line));
  if (heading < 0) return [];
  type TopItem = { number: number; title: string; details: string[] };
  const items: TopItem[] = [];
  let current: TopItem | null = null;
  const stop = /^(?:executive snapshot|executive summary|service value(?: and .*)?|technology and lifecycle priorities|prior proposal|verified (?:12\/24-month|active)|role-based action plan|verification gaps|evidence register|cost and scope review|suggested doctor meeting talk track)\b/i;
  for (const line of lines.slice(heading + 1, heading + 36)) {
    if (stop.test(line)) break;
    const numbered = /^([1-3])\s*[.)-]\s*(.*)$/.exec(line);
    if (numbered) {
      const number = Number(numbered[1]);
      if (items.some((item) => item.number === number)) continue;
      current = { number, title: numbered[2].trim(), details: [] };
      items.push(current);
      continue;
    }
    if (!current) continue;
    // Some Word table cells place the title and explanation on separate runs
    // inside one paragraph, while others emit one paragraph per line.
    if (!current.title) current.title = line;
    else if (current.details.join(" ").length < 1400) current.details.push(line);
  }
  return items
    .filter((item) => item.title.length >= 12 && item.title.length <= 165)
    .sort((a, b) => a.number - b.number)
    .slice(0, 3)
    .map((item) => ({
      id: "far_top_" + item.number,
      category: "open-decision" as const,
      section: lines[heading],
      evidence: [item.title, ...item.details].join(" ").slice(0, 600),
      suggestion: item.title,
      reviewStatus: "unconfirmed" as const,
    }));
}

export function extractFarCandidates(text: string): FarCandidate[] {
  const lines = text.replaceAll("\r", "\n").split("\n").map((line) =>
    line.replace(/^\s*(?:[•●◦]\s*)?/, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  let section: { category: FarCategory; title: string } | null = null;
  const found: FarCandidate[] = topThreeCandidates(lines);
  const seen = new Set<string>();
  const limits: Record<FarCategory, number> = { "service-value": 8, "open-decision": 8, "potential-adjustment": 8 };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const detected = sectionFor(line);
    if (detected) { section = detected.title ? detected : null; continue; }
    if (!section || !isCandidate(section.category, line)) continue;
    const category = section.category;
    const suggestion = suggestedLine(category, line);
    // Preserve distinct evidence while collapsing near-duplicate document excerpts.
    const key = section.category + ":" + line.slice(0, 110).toLowerCase();
    if (seen.has(key) || found.filter((item) => item.category === category).length >= limits[category]) continue;
    seen.add(key);
    found.push({
      id: "far_" + index,
      category: section.category,
      section: section.title,
      evidence: line.slice(0, 600),
      suggestion,
      reviewStatus: section.category === "service-value" ? "documented" : section.category === "open-decision" ? "unconfirmed" : "conditional",
    });
  }
  return found;
}
