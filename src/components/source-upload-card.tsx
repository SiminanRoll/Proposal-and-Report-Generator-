"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import type { SourceRequirement } from "@/lib/projects/templates";
import { CheckIcon, CloseIcon, FileIcon, UploadIcon } from "./icons";

function fileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function SourceUploadCard({
  requirement,
  files,
  onChange,
  compact = false,
}: {
  requirement: SourceRequirement;
  files: File[];
  onChange: (files: File[]) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = requirement.extensions.join(",");
  const hasFiles = files.length > 0;
  return (
    <div className={`source-upload-card ${hasFiles ? "has-file" : ""}${compact ? " is-compact" : ""}`}>
      <div className="source-upload-icon">{hasFiles ? <CheckIcon /> : <UploadIcon />}</div>
      <div className="source-upload-copy">
        <div className="source-title-line"><h3>{requirement.label}</h3><span className={requirement.required ? "required-tag" : "optional-tag"}>{requirement.required ? "Required" : "Optional"}</span></div>
        {(!compact || hasFiles) && <p>{hasFiles ? files.map((file) => file.name).join(" · ") : requirement.description}</p>}
        <small>{hasFiles ? `${files.length} file${files.length === 1 ? "" : "s"} · ${fileSize(files.reduce((sum, file) => sum + file.size, 0))}` : requirement.extensions.join(" · ").toUpperCase()}</small>
      </div>
      <div className="source-upload-action">
        <input
          ref={inputRef}
          hidden
          type="file"
          multiple={Boolean(requirement.multiple)}
          accept={accept}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const selected = Array.from(event.target.files ?? []) as File[];
            if (selected.length) onChange(requirement.multiple ? [...files, ...selected] : selected.slice(0, 1));
            event.currentTarget.value = "";
          }}
        />
        {hasFiles ? (
          <div className="upload-actions-inline">
            <button className="button secondary compact" type="button" onClick={() => inputRef.current?.click()}><FileIcon /> {requirement.multiple ? "Add" : "Replace"}</button>
            <button className="icon-button compact" type="button" onClick={() => onChange([])} aria-label={`Remove ${requirement.label}`}><CloseIcon /></button>
          </div>
        ) : (
          <button className="button secondary compact" type="button" onClick={() => inputRef.current?.click()}><FileIcon /> Attach</button>
        )}
      </div>
    </div>
  );
}
