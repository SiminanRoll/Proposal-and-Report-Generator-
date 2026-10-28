"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const frameRef = useRef<HTMLDivElement>(null);

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
    if (!presenting || !frameRef.current) return;
    const element = frameRef.current;
    const resize = () => setScale(Math.min(1, Math.max(0.25, element.clientWidth / 1280)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [presenting]);

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
            <button type="button" className="multi-button primary" disabled={Boolean(report.errors.length)} onClick={() => { setPageIndex(0); setPresenting(true); }}>Open presentation</button>
            <button type="button" className="multi-button" disabled={Boolean(report.errors.length) || busy} onClick={() => void download()}>{busy ? "Generating PDF..." : "Download one combined PDF"}</button>
            <span>Original practice workspaces remain unchanged.</span>
          </div>
        </>}
      </section>
      {presenting && report && !report.errors.length && <section className="multi-card multi-presentation">
        <div className="multi-slide-nav"><button className="multi-button" onClick={() => setPageIndex(Math.max(0, shownPage - 1))} disabled={shownPage === 0}>Previous</button>
          <span>Slide {shownPage + 1} of {pages.length}</span>
          <button className="multi-button" onClick={() => setPageIndex(Math.min(pages.length - 1, shownPage + 1))} disabled={shownPage === pages.length - 1}>Next</button>
          <button className="multi-button ghost" onClick={() => setPresenting(false)}>Close presentation</button>
        </div>
        <div className="multi-slide-frame" ref={frameRef} style={{ height: 720 * scale }}>
          <iframe title={"Combined Technology Review · slide " + (shownPage + 1)} srcDoc={srcDoc} sandbox="" style={{ width: 1280, height: 720, transform: "scale(" + scale + ")", transformOrigin: "top left", border: 0, display: "block" }}/>
        </div>
      </section>}
    </>}
  </div>;
}
