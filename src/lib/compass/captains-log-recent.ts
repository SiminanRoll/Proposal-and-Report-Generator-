export type CaptainsLogRecentLike = {
  completedAt?: string;
  completed_at?: string;
  scheduledAt?: string;
  scheduled_at?: string;
  createdAt?: string;
  created_at?: string;
};

export function captainsLogRecentStamp(item: CaptainsLogRecentLike): string {
  return String(
    item.completedAt
    || item.completed_at
    || item.scheduledAt
    || item.scheduled_at
    || item.createdAt
    || item.created_at
    || "",
  );
}

export function newestCaptainsLogActivity<T extends CaptainsLogRecentLike>(items: readonly T[]): T | null {
  return [...items].sort((left, right) => captainsLogRecentStamp(right).localeCompare(captainsLogRecentStamp(left)))[0] ?? null;
}
