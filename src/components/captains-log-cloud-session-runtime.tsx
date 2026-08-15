"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { saveCaptainsLogCloudLocalCacheNow } from "@/lib/compass/captains-log-cloud-local-cache";
import { verifyCaptainsLogTaskConnection } from "@/lib/compass/captains-log-task-write";

export const CAPTAINS_LOG_CLOUD_SESSION_STATUS_EVENT = "client-compass-cloud-session-status";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_INTERVAL_MS = 30 * 1000;
const WAKE_DEBOUNCE_MS = 1200;

type SessionStatusDetail = {
  connected: boolean;
  remembered: boolean;
  email: string;
  message: string;
};

function errorDetail(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause || "Supabase could not be reached.");
}

function publishStatus(detail: SessionStatusDetail): void {
  window.dispatchEvent(new CustomEvent<SessionStatusDetail>(CAPTAINS_LOG_CLOUD_SESSION_STATUS_EVENT, { detail }));
}

export function CaptainsLogCloudSessionRuntime() {
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let retryTimer = 0;
    let wakeTimer = 0;

    const scheduleRetry = () => {
      if (disposed || retryTimer || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = 0;
        void maintainSession();
      }, RETRY_INTERVAL_MS);
    };

    const maintainSession = async () => {
      if (disposed || inFlight) return;
      const snapshot = getCaptainsLogCloudAuthSnapshot();
      if (!snapshot.signedIn) return;

      inFlight = true;
      try {
        await verifyCaptainsLogTaskConnection();
        await saveCaptainsLogCloudLocalCacheNow().catch(() => undefined);
        if (!disposed) {
          publishStatus({
            connected: true,
            remembered: true,
            email: getCaptainsLogCloudAuthSnapshot().email || snapshot.email,
            message: "Saved Supabase sign-in restored.",
          });
        }
      } catch (cause) {
        if (!disposed) {
          const current = getCaptainsLogCloudAuthSnapshot();
          publishStatus({
            connected: false,
            remembered: current.signedIn,
            email: current.email || snapshot.email,
            message: current.signedIn
              ? `Saved sign-in retained; Compass will retry automatically. ${errorDetail(cause)}`
              : "Supabase sign-in is required.",
          });
          if (current.signedIn) scheduleRetry();
        }
      } finally {
        inFlight = false;
      }
    };

    const wakeAndRetry = () => {
      if (disposed) return;
      window.clearTimeout(wakeTimer);
      wakeTimer = window.setTimeout(() => { void maintainSession(); }, WAKE_DEBOUNCE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") wakeAndRetry();
    };

    void maintainSession();
    const interval = window.setInterval(() => { void maintainSession(); }, CHECK_INTERVAL_MS);
    window.addEventListener("focus", wakeAndRetry);
    window.addEventListener("online", wakeAndRetry);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.clearTimeout(retryTimer);
      window.clearTimeout(wakeTimer);
      window.removeEventListener("focus", wakeAndRetry);
      window.removeEventListener("online", wakeAndRetry);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
