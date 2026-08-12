"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  loadMapLensDisplayMode,
  loadMapLensState,
  MAP_LENS_CHANGE_EVENT,
  MAP_MODE_RENDERED_EVENT,
  primaryMapSegmentDescriptor,
  saveMapLensDisplayMode,
  type MapLensDisplayMode,
} from "@/lib/segments/map-lens";

const CONTROL_ID = "client-compass-map-two-state-toggle";
const STYLE_ID = "client-compass-map-two-state-toggle-style";

const CONTROL_CSS = `
#${CONTROL_ID}{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  width:100%;
  min-width:0;
  height:42px;
  padding:3px;
  gap:3px;
  box-sizing:border-box;
  border:1px solid rgba(255,255,255,.20);
  border-radius:14px;
  background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.07));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 8px 20px rgba(24,55,84,.10);
  backdrop-filter:blur(13px) saturate(128%);
  -webkit-backdrop-filter:blur(13px) saturate(128%);
}
#${CONTROL_ID}>button{
  appearance:none;
  display:flex;
  align-items:center;
  justify-content:center;
  width:100%;
  min-width:0;
  height:100%;
  margin:0;
  padding:0 10px;
  border:0;
  border-radius:11px;
  background:transparent;
  color:rgba(239,248,254,.78);
  box-shadow:none;
  cursor:pointer;
  overflow:hidden;
  font:inherit;
  font-size:12px;
  font-weight:900;
  line-height:1;
  text-align:center;
  white-space:nowrap;
  text-overflow:ellipsis;
  transform:none;
}
#${CONTROL_ID}>button>span{
  display:block;
  width:100%;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  text-align:center;
}
#${CONTROL_ID}>button:hover{
  color:#fff;
  background:rgba(255,255,255,.08);
}
#${CONTROL_ID}>button.is-active{
  color:#2f5f91;
  background:rgba(250,253,255,.97);
  box-shadow:0 5px 14px rgba(27,58,87,.16),inset 0 1px 0 #fff;
}
#${CONTROL_ID}>button:active{transform:translateY(1px)}
@media(max-width:700px){
  #${CONTROL_ID}{height:40px}
  #${CONTROL_ID}>button{padding-inline:7px;font-size:11px}
}
`;

function normalizedMode(): MapLensDisplayMode {
  const lens = loadMapLensState();
  const hasSegments = lens.segmentIds.length > 0;
  const stored = loadMapLensDisplayMode();
  if (stored === "value") return hasSegments ? "segments" : "need";
  if (hasSegments && stored === "need") return "segments";
  if (!hasSegments && stored === "segments") return "need";
  return stored;
}

function syncVisibleControl(): void {
  const native = document.querySelector<HTMLElement>(".territory-map-toggle");
  if (!native) return;

  // Stop rendering the accumulated historical control entirely. The native
  // buttons remain in the DOM only as an internal bridge for the map metric.
  native.style.setProperty("display", "none", "important");
  native.setAttribute("aria-hidden", "true");

  const controls = native.closest<HTMLElement>(".territory-map-controls");
  if (!controls) return;

  let visible = controls.querySelector<HTMLElement>(`#${CONTROL_ID}`);
  if (!visible) {
    visible = document.createElement("div");
    visible.id = CONTROL_ID;
    visible.setAttribute("role", "group");
    visible.setAttribute("aria-label", "Map view");
    visible.innerHTML = `<button type="button" data-map-view="clients"><span>All</span></button><button type="button" data-map-view="qualified"><span>Need</span></button>`;
    native.insertAdjacentElement("afterend", visible);

    visible.addEventListener("click", (event) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button[data-map-view]")
        : null;
      if (!button) return;
      const lens = loadMapLensState();
      const hasSegments = lens.segmentIds.length > 0;
      const nextMode: MapLensDisplayMode = button.dataset.mapView === "clients"
        ? "clients"
        : hasSegments ? "segments" : "need";
      saveMapLensDisplayMode(nextMode);

      // Keep React's native map metric in lockstep while its legacy control is hidden.
      const nativeButtons = Array.from(native.querySelectorAll<HTMLButtonElement>(":scope > button"));
      nativeButtons[nextMode === "clients" ? 0 : 1]?.click();
      window.requestAnimationFrame(syncVisibleControl);
    });
  }

  const lens = loadMapLensState();
  const hasSegments = lens.segmentIds.length > 0;
  const descriptor = hasSegments ? primaryMapSegmentDescriptor(lens) || "Segment" : "Need";
  const mode = normalizedMode();
  const buttons = Array.from(visible.querySelectorAll<HTMLButtonElement>("button[data-map-view]"));
  const all = buttons[0];
  const qualified = buttons[1];
  if (!all || !qualified) return;

  const qualifiedLabel = descriptor.trim() || (hasSegments ? "Segment" : "Need");
  const qualifiedSpan = qualified.querySelector("span");
  if (qualifiedSpan && qualifiedSpan.textContent !== qualifiedLabel) qualifiedSpan.textContent = qualifiedLabel;
  qualified.title = qualifiedLabel;
  qualified.setAttribute("aria-label", hasSegments ? `Show ${qualifiedLabel} clients in qualified need` : "Show clients in qualified need");

  all.classList.toggle("is-active", mode === "clients");
  qualified.classList.toggle("is-active", mode !== "clients");
  all.setAttribute("aria-pressed", mode === "clients" ? "true" : "false");
  qualified.setAttribute("aria-pressed", mode !== "clients" ? "true" : "false");
}

export function MapTwoStateToggleRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/map")) return;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CONTROL_CSS;
      document.head.appendChild(style);
    }

    let frame = 0;
    const queueSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncVisibleControl);
    };

    queueSync();
    window.addEventListener(MAP_MODE_RENDERED_EVENT, queueSync);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
    window.addEventListener("client-compass-segments-changed", queueSync);

    const observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener(MAP_MODE_RENDERED_EVENT, queueSync);
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
      window.removeEventListener("client-compass-segments-changed", queueSync);
      document.getElementById(CONTROL_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
      const native = document.querySelector<HTMLElement>(".territory-map-toggle");
      native?.style.removeProperty("display");
      native?.removeAttribute("aria-hidden");
    };
  }, [pathname]);

  return null;
}
