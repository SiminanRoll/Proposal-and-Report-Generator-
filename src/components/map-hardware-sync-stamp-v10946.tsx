"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCompassState } from "@/lib/compass/store";

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

function shortSyncDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  const day = date.getDate();
  return `${month} ${day}${ordinal(day)}`;
}

export function MapHardwareSyncStampV10946() {
  const pathname = usePathname();
  const { dataset } = useCompassState();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!pathname.startsWith("/map")) {
      setTarget(null);
      return;
    }
    const syncTarget = () => setTarget(document.querySelector<HTMLElement>(".territory-map-canvas"));
    syncTarget();
    const timer = window.setInterval(syncTarget, 500);
    return () => window.clearInterval(timer);
  }, [pathname]);

  if (!target || !dataset?.importedAt) return null;
  return createPortal(
    <div className="territory-hardware-sync-v10946">Hardware Data Sync: {shortSyncDate(dataset.importedAt)}</div>,
    target,
  );
}
