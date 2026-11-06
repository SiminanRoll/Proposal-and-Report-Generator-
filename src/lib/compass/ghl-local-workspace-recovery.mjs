/**
 * Pure guard for restoring only absent GHL settings from a previously
 * authorized Client Compass Work Folder snapshot. Never overwrite newer
 * browser settings or task retry markers.
 */
export const GHL_LOCAL_RECOVERY_KEYS = [
  "client-compass.ghl-local-credentials.v1",
  "client-compass.ghl-local-mappings.v1",
  "client-compass.ghl-submission-ledger.v1",
  "client-compass.ghl-task-timezone.v1",
];

export function missingGhlStateFromBackup(current, saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  const newState = {};
  for (const key of GHL_LOCAL_RECOVERY_KEYS) {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) continue;
    if (!Object.prototype.hasOwnProperty.call(saved, key)) continue;
    const raw = saved[key];
    if (typeof raw !== "string" || !raw) continue;
    try {
      if (key === GHL_LOCAL_RECOVERY_KEYS[0]) {
        const config = JSON.parse(raw);
        if (!config || typeof config !== "object" || Array.isArray(config) ||
            typeof config.token !== "string" || config.token.length < 20 ||
            typeof config.locationId !== "string" ||
            !/^[a-zA-Z0-9_-]{8,128}$/.test(config.locationId) ||
            typeof config.assigneeId !== "string" ||
            !/^[a-zA-Z0-9_-]{8,128}$/.test(config.assigneeId)) continue;
      } else if (key === GHL_LOCAL_RECOVERY_KEYS[3]) {
        new Intl.DateTimeFormat("en-US", { timeZone: raw });
      } else {
        const record = JSON.parse(raw);
        if (!record || typeof record !== "object" || Array.isArray(record)) continue;
      }
      newState[key] = raw;
    } catch { /* Skip invalid/partial backup settings. */ }
  }
  return newState;
}
