"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MAP_MODE_RENDERED_EVENT } from "@/lib/segments/map-lens";

function normalizeTwoStateToggle(): void {
  const toggle = document.querySelector<HTMLElement>(".territory-map-toggle");
  if (!toggle) return;

  const buttons = Array.from(toggle.querySelectorAll<HTMLButtonElement>(":scope > button"));
  if (buttons.length < 2) return;

  // The map accumulated several historical three-state CSS layers. Inline
  // !important geometry makes the current two-state model authoritative.
  toggle.style.setProperty("display", "flex", "important");
  toggle.style.setProperty("grid-template-columns", "none", "important");
  toggle.style.setProperty("width", "100%", "important");
  toggle.style.setProperty("align-items", "stretch", "important");

  buttons.slice(0, 2).forEach((button) => {
    button.style.setProperty("display", "flex", "important");
    button.style.setProperty("flex", "1 1 50%", "important");
    button.style.setProperty("width", "50%", "important");
    button.style.setProperty("min-width", "0", "important");
    button.style.setProperty("grid-column", "auto", "important");
    button.style.setProperty("position", "relative", "important");
    button.style.setProperty("inset", "auto", "important");
    button.style.setProperty("left", "auto", "important");
    button.style.setProperty("right", "auto", "important");
    button.style.setProperty("transform", "none", "important");
    button.style.setProperty("translate", "none", "important");
    button.style.setProperty("margin", "0", "important");
    button.style.setProperty("align-items", "center", "important");
    button.style.setProperty("justify-content", "center", "important");
    button.style.setProperty("text-align", "center", "important");
  });

  buttons.slice(2).forEach((button) => {
    button.hidden = true;
    button.disabled = true;
    button.tabIndex = -1;
    button.setAttribute("aria-hidden", "true");
    button.style.setProperty("display", "none", "important");
    button.style.setProperty("visibility", "hidden", "important");
    button.style.setProperty("pointer-events", "none", "important");
    button.style.setProperty("width", "0", "important");
    button.style.setProperty("flex", "0 0 0", "important");
  });
}

export function MapTwoStateToggleRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/map")) return;

    let frame = 0;
    const queueNormalize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(normalizeTwoStateToggle);
    };

    queueNormalize();
    window.addEventListener(MAP_MODE_RENDERED_EVENT, queueNormalize);

    const observer = new MutationObserver(queueNormalize);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener(MAP_MODE_RENDERED_EVENT, queueNormalize);
    };
  }, [pathname]);

  return null;
}
