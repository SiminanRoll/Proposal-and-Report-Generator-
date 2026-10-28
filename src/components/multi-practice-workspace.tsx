"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listProjects } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";
import { outcomeReady } from "@/lib/outcomes/builder";
import {
  buildMultiPracticeData, deleteMultiPracticeReview, listMultiPracticeReviews,
  newMultiPracticeReview, saveMultiPracticeReview, type MultiPracticeReview,
} from "@/lib/outcomes/multi-practice-review";
import { downloadMultiPracticePdf, multiPracticeHtml, multiPracticePages } from "@/lib/outcomes/multi-practice-html";

export function MultiPracticeWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saved, setSaved] = useState<MultiPracticeReview[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [ownerLabel, setOwnerLabel] = useState("");
  const [title, setTitle] = useState("Multi-Practice Technology Health Review");
  const [includeBudget, setIncludeBudget] = useState(true);
  const [active, setActive] = useState<MultiPracticeReview | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const presenterRef = useRef<HTMLDivElement>(null);
  const openPresentationRef = useRef<HTMLButtonElement>(null);
  const nativeFullscreenRef = useRef(false);

  useEffect(() => {
    const all = listProjects();
    setProjects(all);
    const reviews = listMultiPracticeReviews();
    setSaved(reviews);
    const id = new URLSearchParams(window.location.search).get("id");
    const existing = reviews.find((r) => r.id === id);
    if (existing) setActive(existing);
  }, []);

  useEffect(() => {
    if (!presenting || !stageRef.current) return;
    const stage = stageRef.current;
    const resize = () => setScale(Math.max(0.05, Math.min(stage.clientWidth / 1280, stage.clientHeight / 720)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [presenting]);

  useEffect(() => {
    if (!presenting) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    presenterRef.current?.focus();
    nativeFullscreenRef.current = document.fullscreenElement === document.documentElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closePresentation();
      } else if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setPageIndex((current) => Math.min(pages.length - 1, current + 1));
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setPageIndex((current) => Math.max(0, current - 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setPageIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setPageIndex(Math.max(0, pages.length - 1));
      }
    };
    const onFullscreenChange = () => {
      if (document.fullscreenElement === document.documentElement) {
        nativeFullscreenRef.current = true;
      } else if (nativeFullscreenRef.current) {
        nativeFullscreenRef.current = false;
        setPresenting(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      openPresentationRef.current?.focus();
    };
  }, [presenting, pages.length]);

  const eligible = useMemo(
    () => projects.filter((p) => p.type === "client-report" && outcomeReady(p))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects],
  );
  const report = useMemo(() => active ? buildMultiPracticeData(active, projects) : null, [active, projects]);
  const pages = useMemo(() => report && !report.errors.length ? multiPracticePages(report) : [], [report]);
  const shownPage = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const srcDoc = useMemo(
    () => report && !report.errors.length && presenting ? multiPracticeHtml(report, shownPage) : "",
    [report, presenting, shownPage],
  );

  function launchPresentation() {
    setPageIndex(0);
    setPresenting(true);
    // Enter native browser fullscreen while the user click is still active.
    // The fixed viewport presenter also works when fullscreen is blocked.
    if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }
  function closePresentation() {
    nativeFullscreenRef.current = false;
    setPresenting(false);
    if (document.fullscreenElement === document.documentElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }

  function choose(id: string) {
    setError("");
    setSelected((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : previous.length < 6 ? [...previous, id] : previous);
  }
  function create() {
    const picked = selected.map((id) => eligible.find((p) => p.id === id)).filter((p): p is Project => Boolean(p));
    if (picked.length < 2 || picked.length > 6) { setError("Choose between two and six completed practice reviews."); return; }
    if (!ownerLabel.trim()) { setError("Enter the shared owner or practice-group name."); return; }
    const review = newMultiPracticeReview(picked, ownerLabel, title, includeBudget);
    const preflight = buildMultiPracticeData(review, projects);
    if (preflight.errors.length) { setError(preflight.errors.join(" ")); return; }
    try {
      saveMultiPracticeReview(review);
      setSaved(listMultiPracticeReviews());
      setActive(review);
      setError("");
      window.history.replaceState(null, "", "/generator/combined/?id=" + encodeURIComponent(review.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The combined review could not be saved."); }
  }
  function open(review: MultiPracticeReview) {
    setActive(review);
    setPresenting(false);
    setPageIndex(0);
    setError("");
    window.history.replaceState(null, "", "/generator/combined/?id=" + encodeURIComponent(review.id));
  }
  function close() {
    setActive(null);
    setPresenting(false);
    setError("");
    window.history.replaceState(null, "", "/generator/combined/");
  }
  function reconfirm() {
    if (!active) return;
    const newRevision: Record<string, string> = {};
    for (const id of active.projectIds) {
      const source = projects.find((p) => p.id === id);
      if (!source) { setError("A linked source report is missing. Restore it before reconfirming."); return; }
      newRevision[id] = source.updatedAt;
    }
    const revised = { ...active, sourceUpdatedAt: newRevision, updatedAt: new Date().toISOString() };
    const check = buildMultiPracticeData(revised, projects);
    if (check.errors.length) { setError(check.errors.join(" ")); return; }
    try {
      saveMultiPracticeReview(revised);
      setSaved(listMultiPracticeReviews());
      setActive(revised);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update report source dates."); }
  }
  function remove(id: string) {
    if (!window.confirm("Delete this combined review? The original practice reports will remain unchanged.")) return;
    deleteMultiPracticeReview(id);
    setSaved(listMultiPracticeReviews());
    if (active?.id === id) close();
  }
  async function download() {
    if (!report || report.errors.length) return;
    setBusy(true); setError("");
    try { await downloadMultiPracticePdf(report); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to generate the combined PDF."); }
    finally { setBusy(false); }
  }

  return <div className="multi-workspace">
    <header className="multi-workspace-head">
      <div><span className="multi-kicker">Client Compass · Report Generator</span><h1>Multi-Practice Technology Review</h1><p>One ownership presentation and one PDF. Each managed practice keeps its own report, evidence and planning scope.</p></div>
      <Link className="multi-button ghost" href="/generator/">Back to Report Generator</Link>
    </header>
    {error && <p className="multi-error" role="alert">{error}</p>}
    {!active ? <>
      <section className="multi-card">
        <h2>Combine existing Technology Reviews</h2>
        <p>Select two or more completed reviews belonging to the same owner. No original report is changed or merged.</p>
        <div className="multi-report-options">
          {eligible.length ? eligible.map((project) => <label key={project.id} className="multi-report-option">
            <input type="checkbox" checked={selected.includes(project.id)} onChange={() => choose(project.id)}/>
            <span><b>{project.client.name}</b><small>Updated {new Date(project.updatedAt).toLocaleDateString()} · {project.client.companyId ? "Company identity linked" : "Report ID only"}</small></span>
          </label>) : <p>No ready Technology Reviews are available in this browser. Create or restore the individual reports first.</p>}
        </div>
        <div className="multi-fields">
          <label>Shared owner / practice group<input value={ownerLabel} onChange={(event) => setOwnerLabel(event.target.value)} placeholder="Doctor or practice group name"/></label>
          <label>Presentation title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="multi-inline"><input type="checkbox" checked={includeBudget} onChange={(event) => setIncludeBudget(event.target.checked)}/> Include separate practice budgets and consolidated planning estimate</label>
        </div>
        <button type="button" className="multi-button primary" disabled={selected.length < 2} onClick={create}>Create combined ownership review</button>
        <p className="multi-disclaimer">By creating this combined review, you confirm these distinct practice reports may be presented together to their shared, authorized owner.</p>
      </section>
      {saved.length > 0 && <section className="multi-card">
        <h2>Saved combined reviews</h2>
        <div className="multi-saved">{saved.map((item) => <div key={item.id} className="multi-saved-row"><div><b>{item.ownerLabel}</b><small>{item.projectIds.length} linked practices · {item.title}</small></div><div><button className="multi-button" onClick={() => open(item)}>Open</button><button className="multi-button ghost" onClick={() => remove(item.id)}>Delete</button></div></div>)}</div>
      </section>}
    </> : <>
      <section className="multi-card">
        <div className="multi-active-head"><div><span className="multi-kicker">Saved ownership review</span><h2>{active.ownerLabel}</h2><p>{active.title} · {active.projectIds.length} practices</p></div>
          <div className="multi-toolbar"><button className="multi-button ghost" onClick={close}>All combined reviews</button><button className="multi-button" onClick={reconfirm}>Reconfirm source versions</button></div>
        </div>
        {report && <>
          <div className="multi-practice-list">{report.practices.map((p) => <div className="multi-practice-summary" key={p.id}><strong>{p.name}</strong><span>{p.assetCount} asset entries · {p.lifecycle.overdue} replace now · {p.lifecycle.dueSoon} plan soon · {p.os.attention} OS concerns</span><small>Source updated {new Date(p.sourceUpdatedAt).toLocaleDateString()}</small></div>)}</div>
          {report.errors.length > 0 && <div className="multi-error"><strong>Review not ready:</strong> {report.errors.map((message, index) => <p key={index}>{message}</p>)}</div>}
          {report.warnings.length > 0 && <details className="multi-warnings"><summary>{report.warnings.length} source disclosure(s) to review</summary>{report.warnings.map((message, index) => <p key={index}>{message}</p>)}</details>}
          <div className="multi-toolbar bottom">
            <button type="button" className="multi-button primary" disabled={Boolean(report.errors.length)} ref={openPresentationRef} onClick={launchPresentation}>Open full-screen presentation</button>
            <button type="button" className="multi-button" disabled={Boolean(report.errors.length) || busy} onClick={() => void download()}>{busy ? "Generating PDF..." : "Download one combined PDF"}</button>
            <span>Original practice workspaces remain unchanged.</span>
          </div>
        </>}
      </section>
      {presenting && report && !report.errors.length && typeof document !== "undefined" && createPortal(
        <div className="multi-presenter-overlay" role="dialog" aria-modal="true" aria-label="Multi-practice client presentation" tabIndex={-1} ref={presenterRef}>
          <header className="multi-presenter-header">
            <div className="multi-presenter-brand">
              <span className="multi-presenter-brand-name">ADVANTAGE <small>TECHNOLOGIES</small></span>
              <span className="multi-presenter-owner">{active.ownerLabel} · Multi-Practice Technology Review</span>
            </div>
            <div className="multi-presenter-actions">
              <button className="multi-presenter-action" type="button" onClick={() => void download()} disabled={busy}>{busy ? "Generating PDF…" : "Download PDF"}</button>
              <button className="multi-presenter-action multi-presenter-close" type="button" onClick={closePresentation} aria-label="Exit full-screen presentation">Close presentation ×</button>
            </div>
          </header>
          <div className="multi-presenter-progress" aria-hidden="true"><div style={{ width: (pages.length > 1 ? (shownPage / (pages.length - 1)) * 100 : 100) + "%" }} /></div>
          <div className="multi-presenter-stage" ref={stageRef}>
            <div className="multi-presenter-canvas" style={{ width: 1280 * scale, height: 720 * scale }}>
              <iframe title={"Combined Technology Review · slide " + (shownPage + 1)} srcDoc={srcDoc} sandbox="" tabIndex={-1} style={{ width: 1280, height: 720, transform: "scale(" + scale + ")", transformOrigin: "top left", border: 0, display: "block", pointerEvents: "none" }}/>
            </div>
          </div>
          <footer className="multi-presenter-footer">
            <span className="multi-presenter-hint">Use ← → arrow keys to navigate · Esc to exit</span>
            <nav className="multi-presenter-navigation" aria-label="Presentation slide navigation">
              <button type="button" onClick={() => setPageIndex(Math.max(0, shownPage - 1))} disabled={shownPage === 0} aria-label="Previous slide">← Previous</button>
              <span aria-live="polite">Slide {shownPage + 1} of {pages.length}</span>
              <button type="button" onClick={() => setPageIndex(Math.min(pages.length - 1, shownPage + 1))} disabled={shownPage === pages.length - 1} aria-label="Next slide">Next →</button>
            </nav>
          </footer>
        </div>,
        document.body
      )}
    </>}
  </div>;
}
