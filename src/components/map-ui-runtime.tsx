"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { loadMapLensState, MAP_LENS_CHANGE_EVENT, saveMapLensState } from "@/lib/segments/map-lens";

const STYLE_ID = "client-compass-map-ui-runtime-style";

const PIE_STATE_PREFIXES: Array<[RegExp, string]> = [
  [/^Wisconsin\b/i, "WI"],
  [/^Michigan\b/i, "MI"],
  [/^Illinois\b/i, "IL"],
  [/^Indiana\b/i, "IN"],
  [/^Ohio\b/i, "OH"],
  [/^Kentucky\b/i, "KY"],
  [/^Tennessee\b/i, "TN"],
  [/^Alabama\b/i, "AL"],
  [/^Georgia\b/i, "GA"],
  [/^Florida\b/i, "FL"],
];

const MAP_UI_CSS = `
/* Final map-control geometry and polish that must win over historical layers. */
@media(min-width:1081px){
  .territory-donut-wrap{right:397px!important}
}

/* The saved-segment chevron is a standalone glass control in both states. */
.map-segment-drawer-tab,
.map-segment-drawer-v10931:hover .map-segment-drawer-tab,
.map-segment-drawer-v10931.is-open .map-segment-drawer-tab{
  border-radius:10px!important;
  border-right:1px solid rgba(236,248,255,.09)!important;
  overflow:hidden!important;
}

/* Historical layers must never paint a second All label. */
.territory-map-toggle>button:first-child::before,
.territory-map-toggle>button:first-child::after{
  content:none!important;
  display:none!important;
}

/* Use one explicit selection hint instead of historical pseudo-copy. */
.map-lens-where::after,
.map-lens-where>div::after{
  content:none!important;
  display:none!important;
}
.map-lens-selection-hint{
  display:block!important;
  flex:0 0 100%!important;
  grid-column:1/-1!important;
  width:100%!important;
  margin-top:4px!important;
  color:rgba(225,241,251,.48)!important;
  font-size:8px!important;
  font-weight:700!important;
  line-height:1.15!important;
  letter-spacing:.015em!important;
  text-transform:none!important;
  white-space:normal!important;
}

/* Ctrl-selected pie sections stay visibly selected while the combined scope is built. */
.territory-donut-slice.is-lens-selected{
  opacity:1!important;
  stroke:rgba(245,253,255,.88)!important;
  stroke-width:1.15!important;
  filter:brightness(1.14) saturate(1.18) drop-shadow(0 0 8px rgba(185,232,255,.30))!important;
}
`;

function stateForPieSlice(slice: Element): string {
  const label = (slice.getAttribute("aria-label") || "").split(":")[0]?.trim() || "";
  return PIE_STATE_PREFIXES.find(([pattern]) => pattern.test(label))?.[1] ?? "";
}

function syncPieSelections(states?: Iterable<string>): void {
  const selected = new Set(states ?? loadMapLensState().states);
  document.querySelectorAll<SVGPathElement>(".territory-donut-slice").forEach((slice) => {
    const state = stateForPieSlice(slice);
    slice.classList.toggle("is-lens-selected", Boolean(state) && selected.has(state));
  });
}

function ensureSelectionHint(): void {
  const where = document.querySelector<HTMLElement>(".map-lens-where");
  if (!where) return;
  let hint = where.querySelector<HTMLElement>(".map-lens-selection-hint");
  if (!hint) {
    hint = document.createElement("small");
    hint.className = "map-lens-selection-hint";
    where.appendChild(hint);
  }
  const copy = "ctrl + click to add another selection";
  if (hint.textContent !== copy) hint.textContent = copy;
}

function ensureDefaultClientListSort(): void {
  const dialog = document.querySelector<HTMLElement>(".territory-client-review");
  if (!dialog || dialog.dataset.valueSortInitialized === "true") return;
  const valueButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>(".compass-column-sort"))
    .find((button) => (button.textContent || "").trim().toLowerCase().startsWith("value"));
  if (!valueButton) return;
  const indicator = valueButton.querySelector("span")?.textContent?.trim() || "";
  if (!valueButton.classList.contains("is-active")) {
    valueButton.click();
    return;
  }
  if (indicator !== "↓") {
    valueButton.click();
    return;
  }
  dialog.dataset.valueSortInitialized = "true";
}

function normalizeMapUi(pendingPieStates?: Iterable<string>): void {
  const toggle = document.querySelector<HTMLElement>(".territory-map-toggle");
  const firstButton = toggle?.querySelector<HTMLButtonElement>(":scope > button:first-child");
  if (firstButton) {
    const normalized = (firstButton.textContent ?? "").replace(/\s+/g, "").toLowerCase();
    if (normalized !== "all" || firstButton.childNodes.length !== 1 || firstButton.firstChild?.nodeType !== Node.TEXT_NODE) {
      firstButton.replaceChildren(document.createTextNode("All"));
    }
    firstButton.setAttribute("aria-label", "Show all clients");
  }

  document.querySelectorAll<HTMLElement>(".territory-active-title").forEach((title) => {
    const heading = title.querySelector<HTMLElement>("strong");
    const subtitle = title.querySelector<HTMLElement>("small");
    if (!subtitle) return;
    subtitle.style.display = heading?.textContent?.trim() === "All Territories" ? "none" : "";
  });

  ensureSelectionHint();
  ensureDefaultClientListSort();
  syncPieSelections(pendingPieStates);
}

export function MapUiRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/map")) return;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = MAP_UI_CSS;
      document.head.appendChild(style);
    }

    let pendingPieStates: Set<string> | null = null;
    let returnToClientList = false;
    let clientWorkspaceSeen = false;
    let reopeningClientList = false;
    let frame = 0;

    const restoreClientListIfNeeded = () => {
      if (!returnToClientList || reopeningClientList) return;
      if (document.querySelector(".compass-client-workspace-backdrop")) {
        clientWorkspaceSeen = true;
        return;
      }
      if (!clientWorkspaceSeen || document.querySelector(".territory-client-review")) return;
      const viewClients = document.querySelector<HTMLButtonElement>(".territory-review-clients");
      if (!viewClients) return;
      reopeningClientList = true;
      returnToClientList = false;
      clientWorkspaceSeen = false;
      window.requestAnimationFrame(() => {
        viewClients.click();
        reopeningClientList = false;
      });
    };

    const syncUi = () => {
      normalizeMapUi(pendingPieStates ?? undefined);
      restoreClientListIfNeeded();
    };

    const queueSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncUi);
    };

    const commitPendingPieSelections = () => {
      if (!pendingPieStates) return;
      const current = loadMapLensState();
      const states = [...pendingPieStates];
      pendingPieStates = null;
      saveMapLensState({ ...current, states });
      queueSync();
    };

    const onPieClick = (event: MouseEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !(event.target instanceof Element)) return;
      const slice = event.target.closest<SVGPathElement>(".territory-donut-slice");
      if (!slice) return;
      const state = stateForPieSlice(slice);
      if (!state) return;
      if (!pendingPieStates) pendingPieStates = new Set(loadMapLensState().states);
      if (pendingPieStates.has(state)) pendingPieStates.delete(state);
      else pendingPieStates.add(state);
      syncPieSelections(pendingPieStates);
    };

    const onModifierUp = (event: KeyboardEvent) => {
      if (event.key === "Control" || event.key === "Meta") commitPendingPieSelections();
    };

    const rememberClientListOrigin = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const openControl = event.target.closest(".territory-client-review-name, .territory-client-review-actions button");
      if (!openControl) return;
      returnToClientList = true;
      clientWorkspaceSeen = false;
    };

    const clearSelectedStateOutsideMap = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      const canvas = document.querySelector<HTMLElement>(".territory-map-canvas");
      if (!target || !canvas) return;

      // The map rail and its client-list drilldown are part of the same
      // workspace. Preserve the selected geography while using either one.
      const workspace = canvas.closest<HTMLElement>(".territory-map-layout");
      const targetElement = target instanceof Element ? target : target.parentElement;
      if (workspace?.contains(target) || canvas.contains(target) || targetElement?.closest(".territory-editor-backdrop")) return;
      if (!canvas.querySelector(".territory-regional-map.has-active")) return;
      canvas.click();
    };

    syncUi();
    const observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    document.addEventListener("pointerdown", clearSelectedStateOutsideMap, true);
    document.addEventListener("click", onPieClick, true);
    document.addEventListener("click", rememberClientListOrigin, true);
    window.addEventListener("keyup", onModifierUp);
    window.addEventListener("blur", commitPendingPieSelections);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, queueSync);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", clearSelectedStateOutsideMap, true);
      document.removeEventListener("click", onPieClick, true);
      document.removeEventListener("click", rememberClientListOrigin, true);
      window.removeEventListener("keyup", onModifierUp);
      window.removeEventListener("blur", commitPendingPieSelections);
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [pathname]);

  return null;
}
