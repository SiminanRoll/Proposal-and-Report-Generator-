"use client";

import type { CompassConfig, CompassDataset } from "@/lib/compass/types";
import { CompassClientReviewDateControl } from "./compass-client-review-date-control";
import { CompassClientReviewWorkspaceV10941 } from "./compass-client-review-workspace-v10941";

interface CompassClientWorkspaceProps {
  clientId: string;
  dataset: CompassDataset;
  config: CompassConfig;
  onBack: () => void;
  onCloseAll: () => void;
  onDatasetSaved: () => void | Promise<void>;
}

export function CompassClientWorkspace(props: CompassClientWorkspaceProps) {
  const reviewDate = props.dataset.clients.find((client) => client.id === props.clientId)?.lastAccountReview ?? "";
  return <>
    <CompassClientReviewWorkspaceV10941 key={`${props.clientId}:${reviewDate}`} {...props} />
    <CompassClientReviewDateControl clientId={props.clientId} dataset={props.dataset} config={props.config} onDatasetSaved={props.onDatasetSaved} />
  </>;
}
