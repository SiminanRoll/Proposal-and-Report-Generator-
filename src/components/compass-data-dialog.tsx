"use client";

import { useEffect, useMemo, useState } from "react";
import { buildImportPreview, defaultOrganizationResolutions } from "@/lib/compass/engine";
import {
  companyIdentityForClient,
  ensureCompanyIdentitiesForClients,
  normalizeUniversalCompanyName,
  refreshCompanyIdentityRegistry,
  type CompanyIdentity,
} from "@/lib/compass/company-identity";
import { parseCompassSpreadsheet } from "@/lib/compass/import";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient, CompassConfig, CompassDataset, OrganizationResolutions, ParsedCompassImport } from "@/lib/compass/types";

interface Props {
  open: boolean;
  dataset: CompassDataset | null;
  config: CompassConfig;
  onClose: () => void;
  onCommitted: () => void | Promise<void>;
}

const SUMMARY_LABELS: Array<[keyof ReturnType<typeof buildImportPreview>["summary"], string]> = [
  ["totalRows", "Rows detected"],
  ["organizationsDetected", "Organizations"],
  ["matchedOrganizations", "Matched"],
  ["unmatchedOrganizations", "Needs review"],
  ["newOrganizations", "New clients"],
  ["devicesDetected", "Devices"],
  ["physicalServers", "Physical servers"],
  ["virtualMachines", "Virtual machines"],
  ["workstations", "Workstations"],
  ["rejectedRows", "Rejected rows"],
  ["osConcerns", "OS concerns"],
  ["storageConcerns", "Storage concerns"],
];

function clientChoiceLabel(client: CompassClient): string {
  const place = [client.city, client.state].filter(Boolean).join(", ");
  return place ? `${client.name} — ${place}` : `${client.name} — ${client.id}`;
}

function organizationMatchesIdentity(organization: string, identity: CompanyIdentity): boolean {
  const normalized = normalizeUniversalCompanyName(organization);
  if (!normalized) return false;
  return [identity.normalizedName, identity.canonicalName, ...identity.aliases]
    .map(normalizeUniversalCompanyName)
    .filter(Boolean)
    .includes(normalized);
}

function canonicalOrganizationResolutions(
  parsed: ParsedCompassImport,
  dataset: CompassDataset | null,
  base: OrganizationResolutions,
  identities: CompanyIdentity[],
): OrganizationResolutions {
  if (!dataset) return base;
  const next: OrganizationResolutions = { ...base };
  const organizations = [...new Set(parsed.rows.map((row) => row.organization.trim()).filter(Boolean))];

  for (const organization of organizations) {
    if (next[organization]?.mode !== "unresolved") continue;
    const normalized = normalizeUniversalCompanyName(organization);
    if (!normalized) continue;

    const directMatches = dataset.clients.filter((client) => [client.name, ...(client.aliases ?? [])]
      .map(normalizeUniversalCompanyName)
      .filter(Boolean)
      .includes(normalized));
    if (directMatches.length === 1) {
      next[organization] = { mode: "existing", clientId: directMatches[0].id };
      continue;
    }

    const identityMatches = identities.filter((identity) => organizationMatchesIdentity(organization, identity));
    if (identityMatches.length !== 1) continue;
    const identity = identityMatches[0];
    const clientMatches = dataset.clients.filter((client) => (
      client.companyId === identity.companyId
      || identity.clientCompassClientIds.includes(client.id)
      || Boolean(companyIdentityForClient(client, [identity]))
    ));
    const uniqueMatches = [...new Map(clientMatches.map((client) => [client.id, client])).values()];
    if (uniqueMatches.length === 1) next[organization] = { mode: "existing", clientId: uniqueMatches[0].id };
  }

  return next;
}

export function CompassDataDialog({ open, dataset, config, onClose, onCommitted }: Props) {
  const [parsed, setParsed] = useState<ParsedCompassImport | null>(null);
  const [resolutions, setResolutions] = useState<OrganizationResolutions>({});
  const [reviewOrganizations, setReviewOrganizations] = useState<string[]>([]);
  const [matchQueries, setMatchQueries] = useState<Record<string, string>>({});
  const [reading, setReading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [fileError, setFileError] = useState("");
  const [commitError, setCommitError] = useState("");
  const preview = useMemo(() => parsed ? buildImportPreview(parsed, dataset, resolutions, config) : null, [parsed, dataset, resolutions, config]);
  const clientChoices = useMemo(() => [...(dataset?.clients ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [dataset]);
  const clientByChoiceLabel = useMemo(() => new Map(clientChoices.map((client) => [clientChoiceLabel(client).toLowerCase(), client])), [clientChoices]);

  const resetDialog = () => {
    setParsed(null);
    setResolutions({});
    setReviewOrganizations([]);
    setMatchQueries({});
    setFileError("");
    setCommitError("");
  };

  const closeDialog = () => {
    if (committing) return;
    resetDialog();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !committing) { resetDialog(); onClose(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, committing]);

  if (!open) return null;

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setFileError("");
    setCommitError("");
    try {
      const next = await parseCompassSpreadsheet(file);
      const base = defaultOrganizationResolutions(next, dataset);
      let identities: CompanyIdentity[] = [];
      if (dataset) {
        try {
          identities = await refreshCompanyIdentityRegistry();
        } catch (cause) {
          if (typeof console !== "undefined") console.debug("Canonical company matching deferred to local names and aliases.", cause);
        }
      }
      const resolved = canonicalOrganizationResolutions(next, dataset, base, identities);
      setParsed(next);
      setResolutions(resolved);
      setReviewOrganizations(Object.entries(resolved).filter(([, resolution]) => resolution.mode === "unresolved").map(([organization]) => organization));
      setMatchQueries({});
    } catch (cause) {
      resetDialog();
      setFileError(cause instanceof Error ? cause.message : "The spreadsheet could not be read.");
    } finally { setReading(false); }
  };

  const chooseExistingClient = (organization: string, value: string) => {
    setMatchQueries((current) => ({ ...current, [organization]: value }));
    const match = clientByChoiceLabel.get(value.trim().toLowerCase());
    setResolutions((current) => ({ ...current, [organization]: match ? { mode: "existing", clientId: match.id } : { mode: "unresolved" } }));
  };

  const markAsNew = (organization: string) => {
    setMatchQueries((current) => ({ ...current, [organization]: "" }));
    setResolutions((current) => ({ ...current, [organization]: { mode: "new" } }));
  };

  const commit = async () => {
    if (!preview?.dataset || committing) return;
    setCommitting(true);
    setCommitError("");
    try {
      const existingById = new Map((dataset?.clients ?? []).map((client) => [client.id, client]));
      const nextDataset: CompassDataset = {
        ...preview.dataset,
        clients: preview.dataset.clients.map((client) => {
          const existing = existingById.get(client.id);
          if (!existing) return client;
          return {
            ...client,
            companyId: existing.companyId ?? client.companyId,
            recordReviewNeeded: existing.recordReviewNeeded ?? false,
            recordReviewReason: existing.recordReviewReason ?? "",
          };
        }),
      };

      const reviewedExistingIds = new Set(reviewOrganizations.flatMap((organization) => {
        const resolution = resolutions[organization];
        return resolution?.mode === "existing" ? [resolution.clientId] : [];
      }));
      const canonicalClients = nextDataset.clients.filter((client) => reviewedExistingIds.has(client.id));
      if (canonicalClients.length) {
        try {
          await ensureCompanyIdentitiesForClients(canonicalClients);
        } catch (cause) {
          if (typeof console !== "undefined") console.debug("Canonical company aliases will retry later.", cause);
        }
      }

      await saveCompassDataset(nextDataset);
      await onCommitted();
      resetDialog();
      onClose();
    } catch (cause) {
      setCommitError(cause instanceof Error ? cause.message : "The current snapshot could not be saved.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="compass-modal-backdrop" role="presentation" onMouseDown={closeDialog}>
      <section className="compass-modal compass-import-modal" role="dialog" aria-modal="true" aria-labelledby="compass-import-title" aria-busy={committing} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-modal-header">
          <div><span className="compass-kicker">Current-state data</span><h2 id="compass-import-title">Update Client Compass Data</h2><p>Preview a Ninja master spreadsheet, resolve organizations, and replace the current technical snapshot.</p></div>
          <button className="compass-drawer-close" type="button" disabled={committing} onClick={closeDialog} aria-label="Close data import">×</button>
        </header>

        <label className="compass-file-drop">
          <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.tsv" onChange={(event) => void selectFile(event.target.files?.[0])} />
          <strong>{reading ? "Reading spreadsheet and matching companies…" : parsed ? parsed.sourceName : "Choose Ninja master spreadsheet"}</strong>
          <span>Supported: XLSX, XLS, XLSM, XLSB, CSV, and TSV. Processing stays in this browser.</span>
        </label>
        {fileError && <div className="compass-import-error" role="alert">{fileError}</div>}

        {preview && (
          <>
            <div className="compass-import-summary">
              {SUMMARY_LABELS.map(([key, label]) => <div key={key}><strong>{preview.summary[key]}</strong><span>{label}</span></div>)}
            </div>

            <div className="compass-resolution-header compass-resolution-header-v1224">
              <div>
                <h3>Organization matching</h3>
                <p><strong>{preview.summary.matchedOrganizations.toLocaleString()} matched automatically.</strong> Only organizations that need a decision are shown below. Tie them to the right existing company; create a new client only when it truly is new.</p>
              </div>
            </div>

            {reviewOrganizations.length === 0 ? (
              <div className="compass-resolution-all-matched-v1224"><strong>All organizations matched automatically.</strong><span>No company decisions are required for this inventory refresh.</span></div>
            ) : (
              <div className="compass-resolution-list compass-resolution-review-list-v1224">
                {reviewOrganizations.map((organization) => {
                  const resolution = resolutions[organization] ?? { mode: "unresolved" as const };
                  const selectedClient = resolution.mode === "existing" ? dataset?.clients.find((client) => client.id === resolution.clientId) ?? null : null;
                  const inputValue = matchQueries[organization] ?? (selectedClient ? clientChoiceLabel(selectedClient) : "");
                  const status = resolution.mode === "existing"
                    ? `Tied to ${selectedClient?.name || "existing company"}`
                    : resolution.mode === "new"
                      ? "Will create a new client record"
                      : "Needs review";
                  return (
                    <label key={organization} className={resolution.mode === "unresolved" ? "is-unresolved" : "is-resolved"}>
                      <span><strong>{organization}</strong><small>{status}</small></span>
                      <div className="compass-resolution-picker-v1224">
                        <input
                          type="search"
                          list="compass-existing-company-options-v1224"
                          placeholder="Search existing company…"
                          value={inputValue}
                          onChange={(event) => chooseExistingClient(organization, event.target.value)}
                          aria-label={`Tie ${organization} to an existing company`}
                        />
                        <button className={resolution.mode === "new" ? "is-active" : ""} type="button" onClick={(event) => { event.preventDefault(); markAsNew(organization); }}>Create new client</button>
                      </div>
                    </label>
                  );
                })}
                <datalist id="compass-existing-company-options-v1224">
                  {clientChoices.map((client) => <option key={client.id} value={clientChoiceLabel(client)} />)}
                </datalist>
              </div>
            )}
            <div className="compass-import-note">Committing replaces the prior technical device snapshot. Existing company identity, contact, owner, review, sales-interaction, quote, follow-up, status, note, and record-review fields are preserved. Confirmed Ninja names are retained as company aliases for future refreshes.</div>
          </>
        )}

        <div className={`compass-commit-feedback${committing || commitError ? " is-visible" : ""}`} aria-live="polite">
          {committing && preview?.dataset && <span>Saving {preview.dataset.devices.length.toLocaleString()} devices in this browser…</span>}
          {commitError && <span className="is-error" role="alert">{commitError}</span>}
        </div>
        <footer className="compass-modal-actions" aria-busy={committing}>
          <button className="button secondary" type="button" disabled={committing} onClick={closeDialog}>Cancel</button>
          <button className="button primary" type="button" disabled={!preview?.dataset || reading || committing} onClick={() => void commit()}>{committing ? "Saving current snapshot…" : preview?.unresolvedOrganizations.length ? `Resolve ${preview.unresolvedOrganizations.length} organization${preview.unresolvedOrganizations.length === 1 ? "" : "s"}` : "Commit current snapshot"}</button>
        </footer>
      </section>
    </div>
  );
}
