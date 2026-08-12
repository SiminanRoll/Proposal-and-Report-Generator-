"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  loadMapLensDisplayMode,
  loadMapLensState,
  MAP_LENS_CHANGE_EVENT,
  MAP_MODE_RENDERED_EVENT,
} from "@/lib/segments/map-lens";

function numericText(value: string | null | undefined): number {
  const match = String(value || "").match(/[\d,.]+/);
  return match ? Number(match[0].replace(/,/g, "")) || 0 : 0;
}

function replaceTailLabel(container: Element | null, label: string): void {
  if (!container) return;
  const strong = container.querySelector("strong");
  if (!strong) return;
  const current = Array.from(container.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node !== strong)?.textContent?.trim() || "";
  if (current === label) return;
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) node.remove();
  });
  container.append(document.createTextNode(` ${label}`));
}

function syncQualifyingBar(): void {
  const mode = loadMapLensDisplayMode();
  const lens = loadMapLensState();
  const qualifying = mode !== "clients";
  const hasSegments = lens.segmentIds.length > 0;
  document.body.classList.toggle("is-map-qualifying-view", qualifying);
  document.body.classList.toggle("is-map-segment-view", qualifying && hasSegments);

  const detail = document.querySelector<HTMLElement>(".territory-active-detail");
  if (!detail) return;
  const metricCards = Array.from(detail.querySelectorAll<HTMLElement>(".territory-active-metrics > span"));
  const matched = numericText(metricCards[0]?.querySelector("strong")?.textContent);
  const need = numericText(metricCards[1]?.querySelector("strong")?.textContent);

  const firstSmall = metricCards[0]?.querySelector("small");
  const secondSmall = metricCards[1]?.querySelector("small");
  if (firstSmall) {
    const desired = qualifying && hasSegments ? "segment matches" : "clients";
    if (firstSmall.textContent !== desired) firstSmall.textContent = desired;
  }
  if (secondSmall) {
    const desired = qualifying ? "qualified need" : "in need";
    if (secondSmall.textContent !== desired) secondSmall.textContent = desired;
  }

  const summary = document.querySelector<HTMLElement>(".territory-map-summary");
  const summaryCards = summary ? Array.from(summary.querySelectorAll(":scope > span")) : [];
  if (qualifying && hasSegments) replaceTailLabel(summaryCards[0] ?? null, "segment matches");
  else replaceTailLabel(summaryCards[0] ?? null, "clients");
  replaceTailLabel(summaryCards[1] ?? null, qualifying ? "qualified need" : "in need");

  const bars = detail.querySelector<HTMLElement>(".territory-health-bars");
  if (!bars) return;
  let qualifiedRow = bars.querySelector<HTMLElement>(".territory-qualified-need-row");
  if (!qualifying) {
    qualifiedRow?.remove();
    return;
  }

  if (!qualifiedRow) {
    qualifiedRow = document.createElement("div");
    qualifiedRow.className = "territory-health-row territory-qualified-need-row";
    qualifiedRow.innerHTML = "<span>Qualified need</span><i><b class=\"tone-red\"></b></i><strong>0</strong>";
    bars.appendChild(qualifiedRow);
  }
  const count = qualifiedRow.querySelector("strong");
  const fill = qualifiedRow.querySelector<HTMLElement>("i > b");
  if (count && count.textContent !== String(need)) count.textContent = String(need);
  const width = matched > 0 ? Math.max(need > 0 ? 4 : 0, Math.min(100, (need / matched) * 100)) : 0;
  const widthText = `${width}%`;
  if (fill && fill.style.width !== widthText) fill.style.width = widthText;
}

export function MapStatsIntegrityRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/map")) return;
    let frame = 0;
    const queue = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncQualifyingBar();
      });
    };

    syncQualifyingBar();
    const page = document.querySelector(".territory-map-page");
    const observer = new MutationObserver(queue);
    if (page) observer.observe(page, { childList: true, subtree: true, characterData: true });
    window.addEventListener(MAP_LENS_CHANGE_EVENT, queue);
    window.addEventListener(MAP_MODE_RENDERED_EVENT, queue);
    document.addEventListener("click", queue, true);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, queue);
      window.removeEventListener(MAP_MODE_RENDERED_EVENT, queue);
      document.removeEventListener("click", queue, true);
      document.body.classList.remove("is-map-qualifying-view", "is-map-segment-view");
    };
  }, [pathname]);

  return null;
}
