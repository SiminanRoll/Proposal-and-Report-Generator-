"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreateProjectScreen } from "./create-project-screen";
import { buildCompassGeneratorPrefill } from "@/lib/compass/generator-bridge";
import { loadCompassDataset } from "@/lib/compass/store";
import { isProjectType, type ProjectType, type SourceFileRecord } from "@/lib/projects/types";
import { emptyReviewOutcome } from "@/lib/review-outcomes/model";
import type { ReviewOutcome } from "@/lib/review-outcomes/types";

interface InitialValues {
  clientName: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  context: string;
  compassClientId: string;
  sourceRecords: Record<string, SourceFileRecord[]>;
  reviewOutcome: ReviewOutcome;
}

const EMPTY_INITIAL_VALUES: InitialValues = {
  clientName: "",
  contactName: "",
  contactRole: "",
  contactEmail: "",
  contactPhone: "",
  context: "",
  compassClientId: "",
  sourceRecords: {},
  reviewOutcome: emptyReviewOutcome(),
};

export function CreatePageClient() {
  const [projectType, setProjectType] = useState<ProjectType | null | undefined>(undefined);
  const [initialValues, setInitialValues] = useState<InitialValues>(EMPTY_INITIAL_VALUES);
  const [prefillWarning, setPrefillWarning] = useState("");

  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      const params = new URLSearchParams(window.location.search);
      const value = params.get("type") ?? "";
      const resolvedType = isProjectType(value) ? value : null;
      const fallback: InitialValues = {
        ...EMPTY_INITIAL_VALUES,
        clientName: params.get("client")?.trim() ?? "",
        contactName: params.get("contact")?.trim() ?? "",
        context: params.get("context")?.trim() ?? "",
        compassClientId: params.get("compassClientId")?.trim() ?? "",
      };
      if (!resolvedType || !fallback.compassClientId) {
        if (!cancelled) {
          setProjectType(resolvedType);
          setInitialValues(fallback);
        }
        return;
      }
      try {
        const dataset = await loadCompassDataset();
        const prefill = dataset ? buildCompassGeneratorPrefill(dataset, fallback.compassClientId) : null;
        if (!cancelled) {
          setProjectType(resolvedType);
          setInitialValues(prefill ? {
            clientName: prefill.clientName,
            contactName: prefill.contactName,
            contactRole: prefill.contactRole,
            contactEmail: prefill.contactEmail,
            contactPhone: prefill.contactPhone,
            context: fallback.context || prefill.context,
            compassClientId: prefill.clientId,
            sourceRecords: resolvedType === "client-report" ? prefill.sourceRecords : {},
            reviewOutcome: resolvedType === "client-report" ? prefill.reviewOutcome : emptyReviewOutcome(),
          } : fallback);
          if (!prefill) setPrefillWarning("The selected Client Compass client could not be found in the current snapshot. Basic URL details were preserved.");
        }
      } catch {
        if (!cancelled) {
          setProjectType(resolvedType);
          setInitialValues(fallback);
          setPrefillWarning("Client Compass data could not be read. You can still create the workspace by attaching the source documents manually.");
        }
      }
    };
    void prepare();
    return () => { cancelled = true; };
  }, []);

  if (projectType === undefined) return <div className="loading-state">Preparing workspace…</div>;
  if (projectType === null) {
    return (
      <div className="empty-state large">
        <span className="eyebrow">Choose an outcome</span>
        <h1>This creation path is not available.</h1>
        <p>Return to the dashboard and choose one of the three workspace types.</p>
        <Link className="button primary" href="/generator/">Back to workspaces</Link>
      </div>
    );
  }

  return <CreateProjectScreen
    projectType={projectType}
    initialClientName={initialValues.clientName}
    initialContactName={initialValues.contactName}
    initialContactRole={initialValues.contactRole}
    initialContactEmail={initialValues.contactEmail}
    initialContactPhone={initialValues.contactPhone}
    initialContext={initialValues.context}
    initialCompassClientId={initialValues.compassClientId}
    initialSourceRecords={initialValues.sourceRecords}
    initialReviewOutcome={initialValues.reviewOutcome}
    prefillWarning={prefillWarning}
  />;
}
