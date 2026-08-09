"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STYLE_ID = "client-compass-map-ui-runtime-style";

const MAP_UI_CSS = `
/* Final map-control geometry and polish that must win over historical layers. */
@media(min-width:1081px){
  .territory-donut-wrap{right:422px!important}
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
`;

function normalizeMapUi(): void {
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

    normalizeMapUi();
    let frame = 0;
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(normalizeMapUi);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [pathname]);

  return null;
}
