"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import {
  CAPTAINS_LOG_TASK_OUTBOX_EVENT,
  markCaptainsLogTaskAttempt,
  readCaptainsLogTaskOutbox,
  removeCaptainsLogTask,
} from "@/lib/compass/captains-log-task-outbox";
import { writeCoordinationTaskToCaptainsLog } from "@/lib/compass/captains-log-task-write";

const RETRY_INTERVAL_MS = 45_000;
const FOCUS_THROTTLE_MS = 5_000;

export function CaptainsLogTaskOutboxRuntime() {
  useEffect(() => {
    let disposed = false;
    let running = false;
    let lastRunAt = 0;

    const flush = async (urgent = false) => {
      const now = Date.now();
      if (disposed || running || now - lastRunAt < (urgent ? FOCUS_THROTTLE_MS : RETRY_INTERVAL_MS - 1_000)) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const auth = getCaptainsLogCloudAuthSnapshot();
      if (!auth.configured || !auth.signedIn) return;
      const pending = readCaptainsLogTaskOutbox();
      if (!pending.length) return;

      running = true;
      lastRunAt = now;
      try {
        for (const item of pending) {
          if (disposed) return;
          markCaptainsLogTaskAttempt(item.id);
          try {
            await writeCoordinationTaskToCaptainsLog(item.request);
            removeCaptainsLogTask(item.id);
          } catch (cause) {
            // Keep the request in the durable outbox. The stable request ID makes
            // future retries idempotent if a response was lost after commit.
            if (typeof console !== "undefined") console.debug("Captain's Log queued task still pending", cause);
          }
        }
      } finally {
        running = false;
      }
    };

    const onFocus = () => void flush(true);
    const onOnline = () => void flush(true);
    const onVisible = () => { if (document.visibilityState === "visible") void flush(true); };
    const onQueued = () => void flush(true);
    const startup = window.setTimeout(() => void flush(true), 1400);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void flush(false); }, RETRY_INTERVAL_MS);

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener(CAPTAINS_LOG_TASK_OUTBOX_EVENT, onQueued);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearTimeout(startup);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(CAPTAINS_LOG_TASK_OUTBOX_EVENT, onQueued);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
