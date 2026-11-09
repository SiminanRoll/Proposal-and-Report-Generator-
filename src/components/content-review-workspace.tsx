"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ContentAuthRequiredError,
  type ContentDashboard,
  type ContentDecision,
  type ContentItem,
  type ContentReview,
  hasContentReviewSession,
  loadContentDashboard,
  markContentBatchReadyToArm,
  saveContentReview,
  setContentReviewerEmail,
  signInContentReviewer,
  signOutContentReviewer,
  signUpContentReviewer,
  uploadContentAsset,
} from "@/lib/compass/content-review-live";
import styles from "./content-review-workspace.module.css";

type TabKey = "posts" | "videos";

const POST_DECISIONS: Array<{ key: ContentDecision; label: string }> = [
  { key: "approve", label: "✓ Approve" },
  { key: "revise", label: "↻ Revise" },
  { key: "hold", label: "⏸ Hold" },
];

const VIDEO_DECISIONS: Array<{ key: ContentDecision; label: string }> = [
  { key: "record", label: "● Record This" },
  { key: "direction", label: "↻ Adjust Direction" },
  { key: "pass", label: "× Not for Me" },
];

function formatPublishDate(value: string | null) {
  if (!value) return "Date open";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function decisionLabel(decision?: ContentDecision) {
  switch (decision) {
    case "approve": return "Approved — ready to schedule";
    case "revise": return "Revision requested";
    case "hold": return "Held for now";
    case "record": return "Record this idea";
    case "direction": return "Adjust direction";
    case "pass": return "Pass on this idea";
    default: return "Awaiting review";
  }
}

function newestReviewMap(reviews: ContentReview[]) {
  const map = new Map<string, ContentReview>();
  for (const review of reviews) {
    const current = map.get(review.itemId);
    if (!current || new Date(review.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
      map.set(review.itemId, review);
    }
  }
  return map;
}

function LoginPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      if (mode === "signin") {
        await signInContentReviewer(email, password);
        onSignedIn();
      } else {
        const result = await signUpContentReviewer(email, password);
        setMessage(result);
        if (hasContentReviewSession()) onSignedIn();
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Access could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.authCard}>
        <div className={styles.authBrand}><span>A</span><div><strong>Bryan Currier</strong><small>Content Review</small></div></div>
        <p className={styles.authEyebrow}>Private content workspace</p>
        <h1>{mode === "signin" ? "Open the review board." : "Create reviewer access."}</h1>
        <p className={styles.authIntro}>
          {mode === "signin"
            ? "Sign in to review posts, leave direction, and choose the short videos that feel right."
            : "Use the same email Patric assigned to the review batch. Your account only sees content explicitly shared with that email."}
        </p>
        <form onSubmit={submit} className={styles.authForm}>
          <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span>Password</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="submit" disabled={submitting}>{submitting ? "Working…" : mode === "signin" ? "Open Review" : "Create Access"}</button>
        </form>
        {message ? <div className={styles.authMessage}>{message}</div> : null}
        <button className={styles.modeSwitch} type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
          {mode === "signin" ? "First time here? Create reviewer access" : "Already have access? Sign in"}
        </button>
      </section>
    </main>
  );
}

export function ContentReviewWorkspace() {
  const [dashboard, setDashboard] = useState<ContentDashboard | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewerEmail, setReviewerEmail] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    try {
      const next = await loadContentDashboard();
      setSignedIn(true);
      setDashboard(next);
      setReviewerEmail(next.batch?.reviewerEmail ?? "");
      const map = newestReviewMap(next.reviews);
      setNotes((current) => {
        const merged = { ...current };
        next.items.forEach((item) => {
          if (!(item.id in merged) || document.activeElement?.id !== `content-note-${item.id}`) {
            merged[item.id] = map.get(item.id)?.note ?? merged[item.id] ?? "";
          }
        });
        return merged;
      });
      if (!quiet) setError("");
    } catch (cause) {
      if (cause instanceof ContentAuthRequiredError) {
        setSignedIn(false);
        setDashboard(null);
        setError("");
      } else if (!quiet) {
        setError(cause instanceof Error ? cause.message : "Content review could not be loaded.");
      }
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!signedIn || !dashboard?.batch?.id) return;
    const timer = window.setInterval(() => void refresh(true), 4000);
    return () => window.clearInterval(timer);
  }, [signedIn, dashboard?.batch?.id, refresh]);

  const reviewMap = useMemo(() => newestReviewMap(dashboard?.reviews ?? []), [dashboard?.reviews]);
  const posts = useMemo(() => dashboard?.items.filter((item) => item.itemKind === "post") ?? [], [dashboard?.items]);
  const videos = useMemo(() => dashboard?.items.filter((item) => item.itemKind === "video") ?? [], [dashboard?.items]);
  const isOwner = Boolean(dashboard?.batch && dashboard.userId === dashboard.batch.ownerUserId);

  const postCounts = useMemo(() => {
    const counts = { approve: 0, revise: 0, hold: 0, pending: 0 };
    posts.forEach((item) => {
      const decision = reviewMap.get(item.id)?.decision;
      if (decision === "approve" || decision === "revise" || decision === "hold") counts[decision] += 1;
      else counts.pending += 1;
    });
    return counts;
  }, [posts, reviewMap]);

  const videoCounts = useMemo(() => {
    const counts = { record: 0, direction: 0, pass: 0, pending: 0 };
    videos.forEach((item) => {
      const decision = reviewMap.get(item.id)?.decision;
      if (decision === "record" || decision === "direction" || decision === "pass") counts[decision] += 1;
      else counts.pending += 1;
    });
    return counts;
  }, [videos, reviewMap]);

  async function chooseDecision(item: ContentItem, decision: ContentDecision) {
    try {
      setSavingId(item.id);
      setMessage("");
      await saveContentReview(item.id, decision, notes[item.id] ?? "");
      await refresh();
      setMessage("Saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Decision could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  async function saveExistingNote(item: ContentItem) {
    const review = reviewMap.get(item.id);
    if (!review) return;
    try {
      setSavingId(item.id);
      await saveContentReview(item.id, review.decision, notes[item.id] ?? "");
      setMessage("Note saved.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Note could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  async function uploadGraphic(item: ContentItem, file: File | null) {
    if (!file || !dashboard?.batch || !isOwner) return;
    try {
      setSavingId(`asset-${item.id}`);
      setMessage("");
      await uploadContentAsset(dashboard.batch.id, item.id, file);
      setMessage("Exact graphic attached.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Graphic could not be uploaded.");
    } finally {
      setSavingId("");
    }
  }

  async function saveReviewerAccess() {
    if (!dashboard?.batch || !isOwner) return;
    try {
      setSavingId("reviewer-email");
      await setContentReviewerEmail(dashboard.batch.id, reviewerEmail);
      setMessage(reviewerEmail.trim() ? "Reviewer access updated." : "Reviewer access cleared.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reviewer access could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  async function readyToArm() {
    if (!dashboard?.batch || !isOwner) return;
    const unresolved = posts.some((item) => {
      const decision = reviewMap.get(item.id)?.decision;
      return decision !== "approve" && decision !== "hold";
    });
    if (unresolved) {
      setMessage("Resolve every post as Approved or Hold before arming the batch.");
      return;
    }
    const approvedIds = posts.filter((item) => reviewMap.get(item.id)?.decision === "approve").map((item) => item.id);
    try {
      setSavingId("ready-to-arm");
      await markContentBatchReadyToArm(dashboard.batch.id, approvedIds);
      setMessage("Approved posts are ready to arm.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Batch could not be queued.");
    } finally {
      setSavingId("");
    }
  }

  async function logout() {
    await signOutContentReviewer();
    setSignedIn(false);
    setDashboard(null);
    setMessage("");
    setError("");
  }

  if (checkingAuth) {
    return <main className={styles.authPage}><section className={styles.authCard}><p>Opening content review…</p></section></main>;
  }

  if (!signedIn) return <LoginPanel onSignedIn={() => void refresh()} />;

  if (!dashboard?.batch) {
    return (
      <main className={styles.authPage}>
        <section className={styles.authCard}>
          <div className={styles.authBrand}><span>A</span><div><strong>Content Review</strong><small>Advantage Technologies</small></div></div>
          <h1>No review batch is assigned to this login.</h1>
          <p className={styles.authIntro}>Ask Patric to share the current batch with the same email you used to sign in.</p>
          <button className={styles.logoutButton} onClick={() => void logout()}>Sign Out</button>
        </section>
      </main>
    );
  }

  const batch = dashboard.batch;
  const allPostsResolved = postCounts.pending === 0 && postCounts.revise === 0;
  const approvedPosts = postCounts.approve;
  const ready = batch.status === "ready_to_arm";

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.mark}>A</span><span><strong>{batch.subjectName}</strong><small>Content Review</small></span></div>
        <div className={styles.headerActions}><span className={styles.syncStatus}><i /> Auto-synced</span><button onClick={() => void logout()}>Sign Out</button></div>
      </header>

      <nav className={styles.tabs}>
        <button className={activeTab === "posts" ? styles.activeTab : ""} onClick={() => setActiveTab("posts")}>Post Review <span>{posts.length}</span></button>
        <button className={activeTab === "videos" ? styles.activeTab : ""} onClick={() => setActiveTab("videos")}>Video Ideas <span>{videos.length}</span></button>
      </nav>

      <section className={styles.workspace}>
        {error ? <div className={styles.errorBanner}>{error}</div> : null}
        {message ? <div className={styles.messageBanner}>{message}</div> : null}
        {ready ? <div className={styles.readyBanner}><strong>Ready to Arm</strong><span>Approved posts have cleared review and are queued for the publishing step.</span></div> : null}

        {isOwner ? (
          <section className={styles.ownerBar}>
            <div><strong>Reviewer access</strong><span>Enter Bryan’s email. He creates/signs into reviewer access using this exact address.</span></div>
            <div className={styles.ownerControls}>
              <input type="email" value={reviewerEmail} onChange={(event) => setReviewerEmail(event.target.value)} placeholder="bryan@adv-tech.com" />
              <button onClick={() => void saveReviewerAccess()} disabled={savingId === "reviewer-email"}>{savingId === "reviewer-email" ? "Saving…" : "Save Access"}</button>
            </div>
          </section>
        ) : null}

        {activeTab === "posts" ? (
          <>
            <section className={styles.hero}>
              <div><p className={styles.eyebrow}>{batch.title}</p><h1>{posts.length} posts ready for review.</h1><p>Review the creative direction and copy, then approve, request a revision, or hold it.</p></div>
              <div className={styles.stats}>
                <div><strong>{postCounts.approve}</strong><span>Approved</span></div>
                <div><strong>{postCounts.revise}</strong><span>Revise</span></div>
                <div><strong>{postCounts.pending}</strong><span>Remaining</span></div>
              </div>
            </section>

            <div className={styles.infoBar}>Nothing publishes from this screen. Approval only moves a post toward the final scheduling step.</div>

            <div className={styles.postList}>
              {posts.map((item) => {
                const review = reviewMap.get(item.id);
                return (
                  <article className={styles.postCard} key={item.id}>
                    <div className={styles.preview}>
                      {item.assetUrl ? <img src={item.assetUrl} alt={item.title} /> : (
                        <div className={styles.quotePreview}>
                          <div className={styles.quoteHeader}><span className={styles.avatar}>BC</span><span><strong>Bryan Currier</strong><small>@bryancurrier</small></span><b>▲</b></div>
                          <blockquote>{item.imageQuote}</blockquote>
                          <div className={styles.quoteFooter}><span>CEO & FOUNDER</span><span>HASSLE FREE IT</span></div>
                        </div>
                      )}
                    </div>
                    <div className={styles.postBody}>
                      <div className={styles.meta}><strong>{formatPublishDate(item.publishDate)}</strong><span>{item.contentPillar}</span></div>
                      <h2>{item.title}</h2>
                      <div className={styles.platforms}>{item.platforms.map((platform) => <span key={platform}>{platform}</span>)}</div>
                      {isOwner ? (
                        <label className={styles.assetUpload}>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={savingId === `asset-${item.id}`}
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              event.currentTarget.value = "";
                              void uploadGraphic(item, file);
                            }}
                          />
                          <span>{savingId === `asset-${item.id}` ? "Uploading…" : item.assetPath ? "Replace exact graphic" : "Upload exact graphic"}</span>
                          {item.assetPath ? <small>Exact asset attached</small> : <small>PNG, JPG, or WebP</small>}
                        </label>
                      ) : null}
                      <div className={styles.copy}>{item.postCopy}</div>
                      <div className={styles.actionRow}>
                        {POST_DECISIONS.map((option) => (
                          <button key={option.key} className={review?.decision === option.key ? styles.selectedAction : ""} onClick={() => void chooseDecision(item, option.key)} disabled={savingId === item.id}>{option.label}</button>
                        ))}
                      </div>
                      <textarea id={`content-note-${item.id}`} value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} onBlur={() => void saveExistingNote(item)} placeholder="Optional note for Patric…" />
                      <div className={styles.itemStatus}><span className={review ? styles.statusDotActive : styles.statusDot} />{decisionLabel(review?.decision)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <section className={styles.hero}>
              <div><p className={styles.eyebrow}>Content Creation</p><h1>Short video ideas for Bryan.</h1><p>These are starting points, not scripts to memorize. Pick what sounds like you and make it yours.</p></div>
              <div className={styles.stats}>
                <div><strong>{videoCounts.record}</strong><span>Record</span></div>
                <div><strong>{videoCounts.direction}</strong><span>Adjust</span></div>
                <div><strong>{videoCounts.pending}</strong><span>Remaining</span></div>
              </div>
            </section>

            <section className={styles.videoIntro}>
              <h2>How to use this section</h2>
              <p>For each idea you like, choose <strong>Record This</strong> and record a short vertical video in your own words. If it’s close but you’d take it another direction, choose <strong>Adjust Direction</strong> and leave Patric a note. If it simply isn’t you, choose <strong>Not for Me</strong>.</p>
              <div><span>1. Pick an idea</span><span>2. Don’t memorize it</span><span>3. Record 20–35 seconds vertically</span><span>4. A natural office setting is perfect</span></div>
            </section>

            <div className={styles.videoGrid}>
              {videos.map((item, index) => {
                const review = reviewMap.get(item.id);
                return (
                  <article className={styles.videoCard} key={item.id}>
                    <div className={styles.videoHeading}><h2>{item.title}</h2><span>{String(index + 1).padStart(2, "0")}</span></div>
                    <p className={styles.label}>Possible opening</p><blockquote>“{item.hook}”</blockquote>
                    <div className={styles.why}><strong>Why it works:</strong> {item.whyItWorks}</div>
                    <p className={styles.label}>Talking points</p><ul>{item.talkingPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                    <p className={styles.label}>Easy way to film it</p><p>{item.filmingDirection}</p>
                    <div className={styles.actionRow}>
                      {VIDEO_DECISIONS.map((option) => (
                        <button key={option.key} className={review?.decision === option.key ? styles.selectedAction : ""} onClick={() => void chooseDecision(item, option.key)} disabled={savingId === item.id}>{option.label}</button>
                      ))}
                    </div>
                    <textarea id={`content-note-${item.id}`} value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} onBlur={() => void saveExistingNote(item)} placeholder="Optional: tell Patric what you’d change, add, or say differently…" />
                    <div className={styles.itemStatus}><span className={review ? styles.statusDotActive : styles.statusDot} />{decisionLabel(review?.decision)}</div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {isOwner ? (
          <section className={styles.armBar}>
            <div><strong>{ready ? "Batch is ready to arm." : "Ready for the publishing handoff?"}</strong><span>{allPostsResolved ? `${approvedPosts} approved post${approvedPosts === 1 ? "" : "s"} can move forward.` : "Every post must be Approved or Hold. Revisions stay out of the publishing queue."}</span></div>
            <button onClick={() => void readyToArm()} disabled={!allPostsResolved || approvedPosts === 0 || ready || savingId === "ready-to-arm"}>{ready ? "Ready to Arm" : savingId === "ready-to-arm" ? "Queuing…" : "Mark Ready to Arm"}</button>
          </section>
        ) : null}
      </section>
    </main>
  );
}
