export const GHL_LOCAL_RECOVERY_KEYS: readonly string[];
export function missingGhlStateFromBackup(
  current: Record<string, string | null | undefined>,
  saved: Record<string, string> | undefined,
): Record<string, string>;
