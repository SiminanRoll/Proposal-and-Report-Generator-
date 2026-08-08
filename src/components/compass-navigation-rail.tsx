"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, SVGProps } from "react";
import { compassShellActionHref, dispatchCompassShellAction } from "@/lib/compass/shell-actions";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentSnapshot } from "@/lib/segments/engine";
import { useSegments } from "@/lib/segments/store";
import { SegmentIcon } from "./segment-icon";

type RailIconName = "search" | "report" | "data" | "settings" | "segments" | "chevron";

function RailIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: RailIconName }) {
  if (name === "search") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
  if (name === "report") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h4"/><path d="m15.5 14.5 1.5 1.5 3-3"/></svg>;
  if (name === "data") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3 1.4 0 2.7-.1 3.8-.4"/><path d="M19 16v6M16 19h6"/></svg>;
  if (name === "settings") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
  if (name === "segments") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="m6 9 6 6 6-6"/></svg>;
}

function formatCompactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function CompassNavigationRail() {
  const pathname = usePathname();
  const { dataset, config } = useCompassState();
  const { segments } = useSegments();
  const systemRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState("");
  const expanded = hovered || focused || pinned;

  const segmentMetrics = useMemo(() => {
    const metrics = new Map<string, { clients: number; value: number }>();
    if (!dataset) return metrics;
    for (const segment of segments) {
      const snapshot = buildSegmentSnapshot(segment, dataset, config);
      metrics.set(segment.id, { clients: snapshot.aggregate.clientCount, value: snapshot.aggregate.estimatedValue });
    }
    return metrics;
  }, [config, dataset, segments]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const syncActiveSegment = () => {
      if (!window.location.pathname.startsWith("/segments/view")) { setActiveSegmentId(""); return; }
      setActiveSegmentId(new URLSearchParams(window.location.search).get("id") || "");
    };
    syncActiveSegment();
    window.addEventListener("popstate", syncActiveSegment);
    return () => window.removeEventListener("popstate", syncActiveSegment);
  }, [pathname]);

  const cancelHoverClose = () => {
    if (hoverCloseTimerRef.current === null) return;
    window.clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
  };

  const openFromHover = () => { cancelHoverClose(); setHovered(true); };
  const scheduleHoverClose = () => {
    if (pinned) return;
    cancelHoverClose();
    hoverCloseTimerRef.current = window.setTimeout(() => { setHovered(false); hoverCloseTimerRef.current = null; }, 120);
  };

  const reportActive = pathname.startsWith("/generator") || pathname.startsWith("/create");
  const dataActive = pathname.startsWith("/data");
  const settingsActive = pathname.startsWith("/settings");
  const segmentsActive = pathname.startsWith("/segments");
  const activeLabel = useMemo(() => reportActive ? "Report Generator" : dataActive ? "Data Tools" : settingsActive ? "Settings" : segmentsActive ? "Segment Manager" : "", [dataActive, reportActive, segmentsActive, settingsActive]);

  useEffect(() => { setPinned(false); }, [pathname]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (systemRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("#client-compass-navigation")) return;
      setPinned(false); setHovered(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !expanded) return;
      setPinned(false); setHovered(false); setFocused(false); toggleRef.current?.focus();
    };
    document.addEventListener("mousedown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutsidePointer); window.removeEventListener("keydown", closeOnEscape); cancelHoverClose(); };
  }, [expanded]);

  const closeRail = () => { setPinned(false); setHovered(false); };

  return (
    <>
      <div ref={systemRef} className={`compass-navigation-system${expanded ? " is-expanded" : ""}${pinned ? " is-pinned" : ""}`} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
        <div className="compass-header-branding">
          <button ref={toggleRef} className="compass-corner-trigger" type="button" aria-controls="client-compass-navigation" aria-expanded={expanded} aria-label={expanded ? "Collapse Client Compass navigation" : "Open Client Compass navigation"} onMouseEnter={openFromHover} onMouseLeave={scheduleHoverClose} onClick={() => setPinned((value) => !value)}>
            <span className="compass-corner-mark"><Image src="/advantage-mark.png" width={36} height={36} alt="" priority /></span>
            <span className="compass-corner-chevron"><RailIcon name="chevron" /></span>
          </button>
          <Link className="compass-header-wordmark" href="/" onClick={closeRail}>
            <Image className="brand-wordmark" src="/advantage-wordmark-no-a.png" width={220} height={46} alt="Advantage Technologies" priority />
            <span>Client Compass</span>
          </Link>
        </div>
      </div>
      {mounted && createPortal(<>
        <button className={`compass-rail-mobile-backdrop${pinned ? " is-visible" : ""}`} type="button" onClick={closeRail} aria-label="Close navigation" tabIndex={pinned ? 0 : -1} />
        <aside id="client-compass-navigation" className={`compass-navigation-rail${expanded ? " is-expanded" : ""}${pinned ? " is-pinned" : ""}`} aria-label="Client Compass navigation" onMouseEnter={openFromHover} onMouseLeave={scheduleHoverClose}>
          <nav className="compass-rail-nav" aria-label="Primary navigation">
            <Link href={compassShellActionHref("find-client")} onClick={(event) => {
              if (pathname === "/") {
                event.preventDefault();
                dispatchCompassShellAction("find-client");
              }
              closeRail();
            }} title="Find a client">
              <span className="compass-rail-item-icon"><RailIcon name="search" /></span><span className="compass-rail-item-copy"><strong>Find a client</strong><small>Search the current snapshot</small></span>
            </Link>
            <Link className={reportActive ? "is-active" : ""} href="/generator/" aria-current={activeLabel === "Report Generator" ? "page" : undefined} onClick={closeRail} title="Report Generator">
              <span className="compass-rail-item-icon"><RailIcon name="report" /></span><span className="compass-rail-item-copy"><strong>Report Generator</strong><small>Reports and proposals</small></span>
            </Link>
            <Link className={dataActive ? "is-active" : ""} href="/data/" aria-current={activeLabel === "Data Tools" ? "page" : undefined} onClick={closeRail} title="Data Tools">
              <span className="compass-rail-item-icon"><RailIcon name="data" /></span><span className="compass-rail-item-copy"><strong>Data Tools</strong><small>Import, update, recalculate</small></span>
            </Link>
            <Link className={settingsActive ? "is-active" : ""} href="/settings/" aria-current={activeLabel === "Settings" ? "page" : undefined} onClick={closeRail} title="Settings">
              <span className="compass-rail-item-icon"><RailIcon name="settings" /></span><span className="compass-rail-item-copy"><strong>Settings</strong><small>Current dashboard and planning rules</small></span>
            </Link>
            <Link className={segmentsActive && (pathname === "/segments" || pathname === "/segments/") ? "is-active" : ""} href="/segments/" aria-current={activeLabel === "Segment Manager" && (pathname === "/segments" || pathname === "/segments/") ? "page" : undefined} onClick={closeRail} title="Segment Manager">
              <span className="compass-rail-item-icon"><RailIcon name="segments" /></span><span className="compass-rail-item-copy"><strong>Segment Manager</strong><small>Build and manage client books</small></span>
            </Link>
            {segments.length > 0 && <div className="compass-segment-nav" aria-label="Managed segments">
              <span className="compass-segment-nav-label">Segments</span>
              {segments.map((segment) => {
                const href = `/segments/view/?id=${encodeURIComponent(segment.id)}`;
                const active = pathname.startsWith("/segments/view") && activeSegmentId === segment.id;
                const metrics = segmentMetrics.get(segment.id);
                return <Link key={segment.id} className={`compass-segment-hot-button${active ? " is-active" : ""}`} href={href} onClick={() => { setActiveSegmentId(segment.id); closeRail(); }} style={{ "--segment-color": segment.color } as CSSProperties} title={segment.title}>
                  <span className="compass-segment-hot-icon"><SegmentIcon name={segment.icon} /></span>
                  <span className="compass-segment-hot-copy"><strong>{segment.title}</strong><small>Open segment</small></span>
                  <span className="compass-segment-hot-stats"><strong>{metrics ? `${metrics.clients} client${metrics.clients === 1 ? "" : "s"}` : "—"}</strong><small>{metrics ? formatCompactMoney(metrics.value) : "—"}</small></span>
                </Link>;
              })}
            </div>}
          </nav>
        </aside>
      </>, document.body)}
    </>
  );
}
