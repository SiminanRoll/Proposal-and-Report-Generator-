export const QUICK_PRESENT_EVENT = "client-compass-quick-present";

export interface QuickPresentEventDetail {
  clientId?: string;
}

export function requestQuickPresent(clientId = ""): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QuickPresentEventDetail>(QUICK_PRESENT_EVENT, { detail: { clientId } }));
}
