/**
 * Short client-facing hardware labels from already-imported inventory values.
 * Preserve original inventory values; these helpers only affect presentation.
 */
export function compactCpuModel(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const normalized = raw.replace(/\((?:R|TM)\)|[®™]/gi, "").replace(/\s+/g, " ").trim();
  const intelCore = normalized.match(/\b(i[3579]-\d{3,6}[A-Z0-9]*)\b/i);
  if (intelCore) return intelCore[1];

  const coreUltra = normalized.match(/\b(Core Ultra\s+[3579]\s+\d{2,4}[A-Z]*)\b/i);
  if (coreUltra) return coreUltra[1].replace(/\s+/g, " ");

  const ryzen = normalized.match(/\b(Ryzen\s+(?:[3579]\s+)?\d{3,5}[A-Z0-9]*)\b/i);
  if (ryzen) return ryzen[1].replace(/\s+/g, " ");

  const xeon = normalized.match(/\b(Xeon\s+(?:CPU\s+)?(?:(?:Gold|Silver|Bronze|Platinum)\s+\d{3,5}[A-Z]*|(?:E[357]-|E-)[0-9]{3,5}(?:\s+v\d+)?))\b/i);
  if (xeon) return xeon[1].replace(/\s+CPU\s+/i, " ").replace(/\s+/g, " ");

  const epyc = normalized.match(/\b(EPYC\s+\d{3,5}[A-Z]*)\b/i);
  if (epyc) return epyc[1];

  // Unfamiliar CPU families should remain identifiable, not guessed or omitted.
  return normalized
    .replace(/\s+CPU\s*@\s*\d+(?:\.\d+)?\s*(?:GHz|MHz)\b/i, "")
    .replace(/\s+@\s*\d+(?:\.\d+)?\s*(?:GHz|MHz)\b/i, "")
    .replace(/\s+(?:CPU|Processor)\s*$/i, "")
    .trim();
}

export function compactRam(value: string): string {
  const raw = String(value ?? "").trim().replace(/^RAM\s*:?\s*/i, "");
  if (!raw) return "";
  const cleaned = raw.replace(/,/g, "").replace(/\s+/g, " ").trim();
  const mb = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?:MB|MiB)$/i);
  if (mb) {
    const gb = Number(mb[1]) / 1024;
    if (gb > 0) return `${Number(gb.toFixed(1))} GB`;
  }
  const gb = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?:GB|GiB)(?:\s+RAM)?$/i);
  if (gb) return `${Number(gb[1])} GB`;
  return raw;
}
