export interface HardwareForwardFillRecord {
  id?: string;
  sourceDeviceId?: string;
  name?: string;
  processor?: string;
  cpu?: string;
  videoCard?: string;
  graphics?: string;
  sourceDeviceType?: string;
  purchaseDate?: string;
  purchased?: string;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function recordIds(record: HardwareForwardFillRecord): string[] {
  return [record.id, record.sourceDeviceId].map(clean).filter(Boolean);
}

function normalizedName(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchingFreshRecord(saved: HardwareForwardFillRecord, fresh: HardwareForwardFillRecord[]): HardwareForwardFillRecord | null {
  const ids = new Set(recordIds(saved));
  if (ids.size) {
    const idMatches = fresh.filter((candidate) => recordIds(candidate).some((id) => ids.has(id)));
    if (idMatches.length === 1) return idMatches[0];
  }

  // Stable IDs should normally match. The unique-name fallback supports older
  // report inventory records that predate sourceDeviceId without guessing when
  // more than one device shares a display name.
  const name = normalizedName(saved.name);
  if (!name) return null;
  const nameMatches = fresh.filter((candidate) => normalizedName(candidate.name) === name);
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

/**
 * Saved inventory corrections remain authoritative for values the user already
 * has, but older snapshots must not permanently erase hardware fields that were
 * added to Client Compass later. Fill only blank hardware facts from a freshly
 * refreshed record for the same device.
 */
export function forwardFillMissingHardware<T extends HardwareForwardFillRecord>(
  savedRecords: T[],
  freshRecords: HardwareForwardFillRecord[],
): T[] {
  return savedRecords.map((saved) => {
    const fresh = matchingFreshRecord(saved, freshRecords);
    if (!fresh) return { ...saved };

    const next = { ...saved } as T & HardwareForwardFillRecord;
    next.processor = clean(saved.processor) || clean(fresh.processor) || clean(fresh.cpu);
    next.cpu = clean(saved.cpu) || clean(fresh.cpu) || clean(fresh.processor);
    next.videoCard = clean(saved.videoCard) || clean(fresh.videoCard) || clean(fresh.graphics);
    next.graphics = clean(saved.graphics) || clean(fresh.graphics) || clean(fresh.videoCard);
    next.sourceDeviceType = clean(saved.sourceDeviceType) || clean(fresh.sourceDeviceType);
    next.purchaseDate = clean(saved.purchaseDate) || clean(fresh.purchaseDate) || clean(fresh.purchased);
    next.purchased = clean(saved.purchased) || clean(fresh.purchased) || clean(fresh.purchaseDate);
    return next;
  });
}
