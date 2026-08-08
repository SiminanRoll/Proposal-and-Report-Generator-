"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function bindCollapsibleCard(card: HTMLElement | null, defaultCollapsed: boolean) {
  if (!card) return;
  const header = card.querySelector<HTMLElement>(":scope > header");
  if (!header) return;
  if (!card.dataset.v10939Initialized) {
    card.dataset.v10939Initialized = "true";
    card.classList.toggle("is-collapsed-v10939", defaultCollapsed);
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button,a,input,textarea,select,label")) return;
      card.classList.toggle("is-collapsed-v10939");
      header.setAttribute("aria-expanded", card.classList.contains("is-collapsed-v10939") ? "false" : "true");
    });
    header.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target !== header) return;
      event.preventDefault();
      card.classList.toggle("is-collapsed-v10939");
      header.setAttribute("aria-expanded", card.classList.contains("is-collapsed-v10939") ? "false" : "true");
    });
  }
  header.setAttribute("aria-expanded", card.classList.contains("is-collapsed-v10939") ? "false" : "true");
}

function syncClientWorkspace() {
  const workspace = document.querySelector<HTMLElement>(".compass-client-workspace-crm");
  if (!workspace) return;
  const cards = workspace.querySelectorAll<HTMLElement>(".compass-crm-main-grid > .compass-crm-card");
  bindCollapsibleCard(cards[0] ?? null, true);
  bindCollapsibleCard(workspace.querySelector<HTMLElement>(".compass-captains-log-sync-card"), true);
}

function syncPresentationCopy() {
  const kicker = document.querySelector<HTMLElement>(".presentation-health-cover .presentation-kicker");
  if (!kicker) return;
  const current = kicker.textContent?.trim() || "";
  const marker = "Prepared for ";
  const position = current.indexOf(marker);
  if (position < 0) return;
  const desired = current.slice(position);
  if (current !== desired) kicker.textContent = desired;
}

export function InterfacePolishRuntimeV10939() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => {
      syncClientWorkspace();
      if (pathname.startsWith("/project")) syncPresentationCopy();
    };
    sync();
    const timer = window.setInterval(sync, 350);
    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
