"use client";

import { useState } from "react";
import { GhlTaskPreflightDialog } from "./ghl-task-preflight-dialog";

/**
 * The former "+" button wrote directly to Captain's Log / Supabase.
 * During the preview phase it can ONLY open the shared GHL preflight.
 * Existing task presence is deliberately not inferred from legacy data.
 */
export function ClientTrackedAction({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
  tracked?: boolean; // Optional legacy caller prop; ignored until verified GHL task readback.
  nextFollowUp?: string;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button
      className="client-tracked-action is-add"
      type="button"
      onClick={() => setOpen(true)}
      aria-label={"Preview GHL coordination task for " + clientName}
      title="Preview GHL coordination task (no submission)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
    {open && (
      <GhlTaskPreflightDialog
        clients={[{ clientId, companyName: clientName }]}
        onClose={() => setOpen(false)}
      />
    )}
  </>;
}
