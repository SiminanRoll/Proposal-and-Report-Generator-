"use client";

import { useEffect } from "react";

const TC_EMAIL_ALIASES: Record<string, string> = {
  "bryan": "bryan.currier@adv-tech.com",
  "bryan currier": "bryan.currier@adv-tech.com",
  "craig marten": "craig.marten@adv-tech.com",
  "eric": "eric.prywitowski@adv-tech.com",
  "eric prywitowski": "eric.prywitowski@adv-tech.com",
  "jason": "jason.keller@adv-tech.com",
  "jason keller": "jason.keller@adv-tech.com",
  "joshua bruckmoser": "joshua.bruckmoser@adv-tech.com",
  "matt minicozzi": "matthew.minicozzi@adv-tech.com",
  "matthew minicozzi": "matthew.minicozzi@adv-tech.com",
  "shawn": "shawn.lamb@adv-tech.com",
  "shawn lamb": "shawn.lamb@adv-tech.com",
};

const EMAIL_BUTTON_PREFIX = "Draft status email to ";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function firstName(value: string): string {
  return clean(value).split(/\s+/)[0] || "there";
}

function tcEmail(value: string): string {
  return TC_EMAIL_ALIASES[clean(value).toLowerCase()] || "";
}

function companyName(button: HTMLButtonElement): string {
  const row = button.closest("article");
  const company = row?.querySelector<HTMLElement>('div[class*="companyCell"] > strong')?.textContent;
  return clean(company) || "this OTA";
}

function warmAccountabilityBody(tcName: string, company: string): string {
  return [
    `Hey ${firstName(tcName)},`,
    "",
    `Just wanted to touch base on ${company}. I noticed we don't have a quote in the system yet, so I wanted to make sure nothing got hung up along the way.`,
    "",
    "If you're still working through it, no problem. If you got stuck, need more information, or need help from anyone on our side to get it moving, just let us know. We're happy to jump in.",
    "",
    "When you get a chance, just send us a quick update on where things stand so we can keep the tracker current.",
    "",
    "Thanks!",
  ].join("\n");
}

export function OtaEmailDraftEnhancer() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>(`button[aria-label^="${EMAIL_BUTTON_PREFIX}"]`);
      if (!button) return;

      const label = clean(button.getAttribute("aria-label"));
      const tcName = clean(label.slice(EMAIL_BUTTON_PREFIX.length));
      if (!tcName) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const company = companyName(button);
      const to = tcEmail(tcName);
      const subject = `OTA follow-up - ${company}`;
      const body = warmAccountabilityBody(tcName, company);
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
