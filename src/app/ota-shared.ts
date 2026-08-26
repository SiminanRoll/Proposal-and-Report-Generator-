export const OTA_TRACKER_TIME_ZONE = "America/Chicago";
export const OTA_SHARED_SUPABASE_URL = "https://cqhqbucjzgijhskupnlw.supabase.co";
export const OTA_SHARED_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxaHFidWNqemdpamhza3Vwbmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzc3MTMsImV4cCI6MjA5NjYxMzcxM30.u8cyo636zYcFmtKS1DUCK3Usb5hRvvePvGB0v-4AOws";

export function chicagoDateKey(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OTA_TRACKER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
