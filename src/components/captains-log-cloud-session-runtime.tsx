"use client";

import { useEffect } from "react";
import {
  getCaptainsLogCloudAuthSnapshot,
  getCaptainsLogCloudConfig,
  signInCaptainsLogCloud,
} from "@/lib/compass/captains-log-cloud";
import { restoreCaptainsLogCloudLocalCache, saveCaptainsLogCloudLocalCacheNow } from "@/lib/compass/captains-log-cloud-local-cache";
import {
  getCaptainsLogRememberDevice,
  loadCaptainsLogRememberedPassword,
} from "@/lib/compass/captains-log-device-signin";
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

function looksLikeAuthFailure(cause: unknown): boolean {
  const message = errorDetail(cause).toLowerCase();
  return ["auth", "jwt", "token", "refresh", "401", "403", "not signed in", "sign-in", "sign in"].some((token) => message.includes(token));
}

function publishStatus(detail: SessionStatusDetail): void {
  window.dispatchEvent(new CustomEvent<SessionStatusDetail>(CAPTAINS_LOG_CLOUD_SESSION_STATUS_EVENT, { detail }));
}

async function autoSignInRememberedDevice(): Promise<boolean> {
  if (!getCaptainsLogRememberDevice()) return false;
  const config = getCaptainsLogCloudConfig();
  if (!config.url || !config.anonKey || !config.email) return false;
  const password = await loadCaptainsLogRememberedPassword(config);
  if (!password) return false;
  await signInCaptainsLogCloud(config, password);
  await saveCaptainsLogCloudLocalCacheNow().catch(() => undefined);
  return true;
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
      inFlight = true;
      let snapshot = getCaptainsLogCloudAuthSnapshot();

      try {
        if (!snapshot.signedIn) {
          await restoreCaptainsLogCloudLocalCache().catch(() => false);
          snapshot = getCaptainsLogCloudAuthSnapshot();
        }
        if (!snapshot.signedIn) {
          const signedIn = await autoSignInRememberedDevice().catch(() => false);
          snapshot = getCaptainsLogCloudAuthSnapshot();
          if (!signedIn && !snapshot.signedIn) return;
        }

        try {
          await verifyCaptainsLogTaskConnection();
        } catch (cause) {
          const current = getCaptainsLogCloudAuthSnapshot();
          if (!getCaptainsLogRememberDevice() || (!looksLikeAuthFailure(cause) && current.signedIn)) throw cause;
          const signedIn = await autoSignInRememberedDevice();
          if (!signedIn) throw cause;
          snapshot = getCaptainsLogCloudAuthSnapshot();
          await verifyCaptainsLogTaskConnection();
        }

        await saveCaptainsLogCloudLocalCacheNow().catch(() => undefined);
        if (!disposed) {
          publishStatus({
            connected: true,
            remembered: true,
            email: getCaptainsLogCloudAuthSnapshot().email || snapshot.email,
            message: getCaptainsLogRememberDevice()
              ? "Supabase auto-connect is active on this device."
              : "Saved Supabase sign-in restored.",
          });
        }
      } catch (cause) {
        if (!disposed) {
          const current = getCaptainsLogCloudAuthSnapshot();
          publishStatus({
            connected: false,
            remembered: current.signedIn || getCaptainsLogRememberDevice(),
            email: current.email || snapshot.email,
            message: getCaptainsLogRememberDevice()
              ? `Auto-connect is saved; Compass will retry automatically. ${errorDetail(cause)}`
              : current.signedIn
                ? `Saved sign-in retained; Compass will retry automatically. ${errorDetail(cause)}`
                : "Supabase sign-in is required.",
          });
          if (current.signedIn || getCaptainsLogRememberDevice()) scheduleRetry();
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
