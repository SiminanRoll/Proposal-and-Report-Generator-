"use client";

import { useEffect } from "react";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"]);
const AGE_CONTEXT = /(?:^|[\s_-])(age|aging|lifecycle|inventory|device|hardware|health-row|replacement-device|next-device)(?:$|[\s_-])/i;
const EXPLICIT_AGE = /(-?\d+(?:\.\d+)?)\s*(years?\s*old|yrs?\s*old|yr\s*old|yrs?|yr)\b/gi;
const CONTEXTUAL_YEARS = /(-?\d+(?:\.\d+)?)\s*years?\b/gi;
const BARE_LONG_DECIMAL = /^\s*(-?\d+\.\d{2,})\s*$/;

function roundedAge(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatAgeShorthand(value: unknown, fallback = "—"): string {
  const parsed = typeof value === "number"
    ? value
    : Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return `${roundedAge(parsed)} yr`;
}

function ageContext(element: Element | null): boolean {
  let current: Element | null = element;
  for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
    const classValue = typeof current.className === "string" ? current.className : "";
    const context = [
      classValue,
      current.id,
      current.getAttribute("aria-label") ?? "",
      current.getAttribute("data-section") ?? "",
      current.getAttribute("data-field") ?? "",
    ].join(" ");
    if (AGE_CONTEXT.test(context)) return true;
  }
  return false;
}

function normalizedText(value: string, parent: Element | null): string {
  let next = value.replace(EXPLICIT_AGE, (_match, raw: string) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? `${roundedAge(parsed)} yr` : _match;
  });

  const contextual = ageContext(parent);
  if (contextual) {
    next = next.replace(CONTEXTUAL_YEARS, (_match, raw: string) => {
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? `${roundedAge(parsed)} yr` : _match;
    });

    const bare = next.match(BARE_LONG_DECIMAL);
    if (bare) {
      const parsed = Number(bare[1]);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
        const leading = next.match(/^\s*/)?.[0] ?? "";
        const trailing = next.match(/\s*$/)?.[0] ?? "";
        next = `${leading}${roundedAge(parsed)} yr${trailing}`;
      }
    }
  }

  return next;
}

function normalizeTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName)) return;
  const current = node.nodeValue ?? "";
  if (!current.trim()) return;
  const next = normalizedText(current, parent);
  if (next !== current) node.nodeValue = next;
}

function normalizeSubtree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    normalizeTextNode(root as Text);
    return;
  }
  if (!(root instanceof Element) && !(root instanceof Document) && !(root instanceof DocumentFragment)) return;
  const documentRef = root instanceof Document ? root : root.ownerDocument;
  if (!documentRef) return;
  const walker = documentRef.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    normalizeTextNode(current as Text);
    current = walker.nextNode();
  }
}

function installDocumentNormalizer(documentRef: Document, installed: WeakSet<Document>, observers: Set<MutationObserver>): void {
  if (installed.has(documentRef)) return;
  installed.add(documentRef);
  const root = documentRef.documentElement;
  if (!root) return;
  normalizeSubtree(root);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") normalizeTextNode(mutation.target as Text);
      for (const node of mutation.addedNodes) {
        normalizeSubtree(node);
        if (node instanceof HTMLIFrameElement) installFrameNormalizer(node, installed, observers);
        if (node instanceof Element) node.querySelectorAll("iframe").forEach((frame) => installFrameNormalizer(frame, installed, observers));
      }
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true });
  observers.add(observer);

  documentRef.querySelectorAll("iframe").forEach((frame) => installFrameNormalizer(frame, installed, observers));
}

function installFrameNormalizer(frame: HTMLIFrameElement, installed: WeakSet<Document>, observers: Set<MutationObserver>): void {
  const attach = () => {
    try {
      if (frame.contentDocument) installDocumentNormalizer(frame.contentDocument, installed, observers);
    } catch {
      // Cross-origin frames are intentionally ignored. Client Compass PDF capture uses same-origin srcdoc frames.
    }
  };
  attach();
  frame.addEventListener("load", attach, { once: true });
}

export function AgeDisplayRuntime() {
  useEffect(() => {
    const installed = new WeakSet<Document>();
    const observers = new Set<MutationObserver>();
    installDocumentNormalizer(document, installed, observers);
    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  return null;
}
