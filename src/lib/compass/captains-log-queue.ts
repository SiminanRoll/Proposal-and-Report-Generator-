export interface CaptainsLogQueueEntry {
  clientId: string;
  company: string;
  dueDate: string;
  addedAt: string;
  taskId?: string;
  linkedCompany?: string;
}

const STORAGE_KEY = "client_compass_captains_log_queue";
export const CAPTAINS_LOG_QUEUE_EVENT = "client-compass-captains-log-queue-updated";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readCaptainsLogQueue(): Record<string, CaptainsLogQueueEntry> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).flatMap(([clientId, value]) => {
      if (!value || typeof value !== "object") return [];
      const entry = value as Partial<CaptainsLogQueueEntry>;
      if (typeof entry.clientId !== "string" || !entry.clientId.trim()) return [];
      return [[clientId, {
        clientId: entry.clientId,
        company: typeof entry.company === "string" ? entry.company : "",
        dueDate: typeof entry.dueDate === "string" ? entry.dueDate : "",
        addedAt: typeof entry.addedAt === "string" ? entry.addedAt : "",
        taskId: typeof entry.taskId === "string" ? entry.taskId : "",
        linkedCompany: typeof entry.linkedCompany === "string" ? entry.linkedCompany : "",
      } satisfies CaptainsLogQueueEntry]];
    }));
  } catch {
    return {};
  }
}

function writeCaptainsLogQueue(queue: Record<string, CaptainsLogQueueEntry>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(CAPTAINS_LOG_QUEUE_EVENT, { detail: queue }));
}

export function getCaptainsLogQueueEntry(clientId: string): CaptainsLogQueueEntry | null {
  return readCaptainsLogQueue()[clientId] ?? null;
}

export function markCaptainsLogQueueEntry(entry: CaptainsLogQueueEntry): Record<string, CaptainsLogQueueEntry> {
  const queue = readCaptainsLogQueue();
  queue[entry.clientId] = entry;
  writeCaptainsLogQueue(queue);
  return queue;
}

export function clearCaptainsLogQueueEntry(clientId: string): Record<string, CaptainsLogQueueEntry> {
  const queue = readCaptainsLogQueue();
  delete queue[clientId];
  writeCaptainsLogQueue(queue);
  return queue;
}
