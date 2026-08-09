"use client";

import { useEffect } from "react";

/**
 * Transitional polish for the legacy client-review workspace markup.
 * Review-outcome decisions are already shown in Account Review Outcome, so the
 * lower planning section should contain only technical packages that are not
 * repeated from the recorded review.
 */
export function ClientWorkspacePolishRuntime() {
  useEffect(() => {
    const sync = () => {
      document.querySelectorAll<HTMLElement>(".client-review-company-meta-v10941").forEach((meta) => {
        const pills = Array.from(meta.querySelectorAll<HTMLElement>(":scope > span"));
        const values = pills.map((pill) => pill.textContent?.trim().toUpperCase() || "");

        pills.forEach((pill, index) => {
          pill.style.removeProperty("display");
          const state = values[index];
          if (!/^[A-Z]{2}$/.test(state)) return;

          const duplicateExactEarlier = values.slice(0, index).includes(state);
          const territoryCarriesState = values.some((value, otherIndex) => {
            if (otherIndex === index || !value || value === state) return false;
            return new RegExp(`^${state}\\b`).test(value);
          });
          if (duplicateExactEarlier || territoryCarriesState) pill.style.display = "none";
        });
      });

      document.querySelectorAll<HTMLButtonElement>(".client-review-header-actions-v10941 .compass-drawer-close").forEach((button) => {
        button.style.setProperty("transform", "none", "important");
        button.style.setProperty("animation", "none", "important");
        button.style.setProperty("transition", "background .14s ease, color .14s ease, border-color .14s ease, box-shadow .14s ease", "important");
      });

      document.querySelectorAll<HTMLElement>(".client-review-needs-v10941").forEach((section) => {
        const heading = section.querySelector<HTMLElement>(".client-review-section-heading-v10941");
        const label = heading?.querySelector<HTMLElement>("div > span");
        if (label && label.textContent !== "Technical needs") label.textContent = "Technical needs";

        const articles = Array.from(section.querySelectorAll<HTMLElement>(".client-review-needs-list-v10941 > article"));
        let technicalCount = 0;
        for (const article of articles) {
          const badge = article.querySelector<HTMLElement>(":scope > span");
          const duplicateReviewItem = badge?.textContent?.trim() === "Agreed";
          article.style.display = duplicateReviewItem ? "none" : "";
          if (!duplicateReviewItem) technicalCount += 1;
        }

        const count = heading?.querySelector<HTMLElement>("div > strong");
        const countText = technicalCount
          ? `${technicalCount} planning item${technicalCount === 1 ? "" : "s"}`
          : "No technical needs";
        if (count && count.textContent !== countText) count.textContent = countText;

        const list = section.querySelector<HTMLElement>(".client-review-needs-list-v10941");
        let empty = section.querySelector<HTMLElement>("[data-client-workspace-technical-empty]");
        if (!technicalCount && list) {
          list.style.display = "none";
          if (!empty) {
            empty = document.createElement("p");
            empty.className = "client-review-empty-v10941";
            empty.dataset.clientWorkspaceTechnicalEmpty = "true";
            empty.textContent = "No additional technical need is recorded for this client.";
            list.insertAdjacentElement("afterend", empty);
          }
        } else {
          if (list) list.style.display = "";
          empty?.remove();
        }
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
