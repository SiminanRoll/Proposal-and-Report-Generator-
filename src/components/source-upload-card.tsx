"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { SourceRequirement } from "@/lib/projects/templates";
import { CheckIcon, CloseIcon, FileIcon, UploadIcon } from "./icons";

function fileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function MultiSiteScalePadUpload({ requirement, files, onChange }: { requirement: SourceRequirement; files: File[]; onChange: (files: File[]) => void }) {
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondSiteInputRef = useRef<HTMLInputElement>(null);
  const [secondSiteOpen, setSecondSiteOpen] = useState(files.length > 1);
  const primary = files[0];
  const second = files[1];

  function setFile(index: number, file: File) {
    const next = files.slice();
    if (index === 0) next[0] = file;
    else {
      if (!next[0]) return;
      next[1] = file;
    }
    onChange(next.slice(0, 2));
  }

  function removePrimary() {
    onChange(second ? [second] : []);
    setSecondSiteOpen(false);
  }

  function removeSecond() {
    onChange(primary ? [primary] : []);
    setSecondSiteOpen(false);
  }

  return (
    <div className={`source-upload-card multisite-scalepad-card ${primary || second ? "has-file" : ""}`}>
      <div className="source-upload-icon">{primary ? <CheckIcon /> : <UploadIcon />}</div>
      <div className="source-upload-copy multisite-scalepad-copy">
        <div className="source-title-line"><h3>{requirement.label}</h3><span className="required-tag">Required</span></div>
        <p>Attach the ScalePad report for the primary location. Add a second ScalePad PDF when the review covers another office. Both hardware sets will stay separated by location in the presentation and finished PDF.</p>
        <div className="multisite-upload-grid">
          <article className={`multisite-upload-slot ${primary ? "complete" : ""}`}>
            <div className="multisite-upload-slot-copy">
              <span>Site 1 · Primary location</span>
              <strong>{primary ? primary.name : "Primary ScalePad / lifecycle source"}</strong>
              <small>{primary ? fileSize(primary.size) : requirement.extensions.join(" · ").toUpperCase()}</small>
            </div>
            <input
              ref={primaryInputRef}
              hidden
              type="file"
              accept={requirement.extensions.join(",")}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) setFile(0, file);
                event.currentTarget.value = "";
              }}
            />
            <div className="upload-actions-inline">
              <button className="button secondary compact" type="button" onClick={() => primaryInputRef.current?.click()}><FileIcon /> {primary ? "Replace" : "Attach"}</button>
              {primary && <button className="icon-button compact" type="button" onClick={removePrimary} aria-label="Remove primary lifecycle source"><CloseIcon /></button>}
            </div>
          </article>

          {(secondSiteOpen || second) ? (
            <article className={`multisite-upload-slot second-site ${second ? "complete" : ""}`}>
              <div className="multisite-upload-slot-copy">
                <span>Site 2 · Second location</span>
                <strong>{second ? second.name : "Second location ScalePad PDF"}</strong>
                <small>{second ? fileSize(second.size) : "PDF"}</small>
              </div>
              <input
                ref={secondSiteInputRef}
                hidden
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0];
                  if (file) setFile(1, file);
                  event.currentTarget.value = "";
                }}
              />
              <div className="upload-actions-inline">
                <button className="button secondary compact" type="button" disabled={!primary} onClick={() => secondSiteInputRef.current?.click()}><FileIcon /> {second ? "Replace" : "Attach PDF"}</button>
                <button className="icon-button compact" type="button" onClick={removeSecond} aria-label="Remove second site"><CloseIcon /></button>
              </div>
            </article>
          ) : (
            <button className="multisite-add-site-button" type="button" disabled={!primary} onClick={() => setSecondSiteOpen(true)}>
              <span>＋</span><strong>Add second site</strong><small>{primary ? "Attach another ScalePad PDF for a second location" : "Attach Site 1 first"}</small>
            </button>
          )}
        </div>
        <small className="multisite-location-note">Location names are taken from the report when available; otherwise Client Compass uses the PDF filename as the site label.</small>
      </div>
      <style>{`
        .multisite-scalepad-card{align-items:flex-start}.multisite-scalepad-copy{min-width:0;flex:1}.multisite-scalepad-copy>p{max-width:850px;margin:6px 0 12px}.multisite-upload-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:4px}.multisite-upload-slot,.multisite-add-site-button{min-height:92px;border:1px solid rgba(91,132,166,.25);border-radius:14px;background:rgba(246,250,253,.72);padding:12px 13px}.multisite-upload-slot{display:flex;align-items:center;justify-content:space-between;gap:12px}.multisite-upload-slot.complete{border-color:rgba(31,168,132,.32);background:rgba(239,251,247,.74)}.multisite-upload-slot.second-site{border-style:solid}.multisite-upload-slot-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px;text-align:left}.multisite-upload-slot-copy>span{font-size:10px;font-weight:800;letter-spacing:.055em;text-transform:uppercase;color:#4f7798}.multisite-upload-slot-copy>strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#18334c}.multisite-upload-slot-copy>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#71849a}.multisite-add-site-button{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;text-align:left;color:#244c6d;cursor:pointer;transition:border-color .16s ease,background .16s ease,transform .16s ease}.multisite-add-site-button:hover:not(:disabled){border-color:rgba(45,127,245,.45);background:rgba(241,247,255,.95);transform:translateY(-1px)}.multisite-add-site-button:disabled{cursor:not-allowed;opacity:.52}.multisite-add-site-button>span{font-size:18px;line-height:1;color:#2d7ff5}.multisite-add-site-button>strong{font-size:13px}.multisite-add-site-button>small{font-size:10px;color:#71849a}.multisite-location-note{display:block;margin-top:9px;color:#71849a!important}.multisite-upload-slot .upload-actions-inline{flex:0 0 auto}@media(max-width:760px){.multisite-upload-grid{grid-template-columns:1fr}.multisite-upload-slot{align-items:flex-start;flex-direction:column}.multisite-upload-slot .upload-actions-inline{width:100%;justify-content:flex-end}}
      `}</style>
    </div>
  );
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

  if (requirement.kind === "scalepad-pdf") {
    return <MultiSiteScalePadUpload requirement={requirement} files={files} onChange={onChange} />;
  }

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
