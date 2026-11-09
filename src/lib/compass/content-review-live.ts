export type ContentDecision = "approve" | "revise" | "hold" | "record" | "direction" | "pass";
export type ContentItemKind = "post" | "video";

const SUPABASE_URL = "https://cqhqbucjzgijhskupnlw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VVFtD-sgGWs0aK_pCnr9IA_-IOVslw8";
const SESSION_KEY = "client-compass-content-review-session-v1";

type AuthUser = { id: string; email?: string | null };
type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user?: AuthUser;
};

export type ContentBatch = {
  id: string;
  slug: string;
  subjectName: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "review" | "revision" | "ready_to_arm" | "armed" | "published" | "archived";
  ownerUserId: string;
  reviewerEmail: string;
};

export type ContentItem = {
  id: string;
  batchId: string;
  itemKey: string;
  itemKind: ContentItemKind;
  sortOrder: number;
  publishDate: string | null;
  title: string;
  contentPillar: string;
  postCopy: string;
  imageQuote: string;
  platforms: string[];
  assetUrl: string;
  assetPath: string;
  hook: string;
  whyItWorks: string;
  talkingPoints: string[];
  filmingDirection: string;
  publishingStatus: "draft" | "ready_to_arm" | "armed" | "published" | "failed";
};

export type ContentReview = {
  itemId: string;
  reviewerUserId: string;
  decision: ContentDecision;
  note: string;
  updatedAt: string;
};

export type ContentDashboard = {
  userId: string;
  userEmail: string;
  batch: ContentBatch | null;
  items: ContentItem[];
  reviews: ContentReview[];
};

type BatchRow = {
  id: string; slug: string; subject_name: string; title: string; period_start: string; period_end: string;
  status: ContentBatch["status"]; owner_user_id: string; reviewer_email: string | null;
};
type ItemRow = {
  id: string; batch_id: string; item_key: string; item_kind: ContentItemKind; sort_order: number;
  publish_date: string | null; title: string; content_pillar: string | null; post_copy: string | null;
  image_quote: string | null; platforms: string[] | null; asset_url: string | null; hook: string | null;
  why_it_works: string | null; talking_points: unknown; filming_direction: string | null;
  publishing_status: ContentItem["publishingStatus"];
};
type ReviewRow = {
  item_id: string; reviewer_user_id: string; decision: ContentDecision; note: string | null; updated_at: string;
};

export class ContentAuthRequiredError extends Error {
  constructor() {
    super("Sign in to review this content.");
    this.name = "ContentAuthRequiredError";
  }
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function readSession(): AuthSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession | null) {
  if (!canUseStorage()) return;
  if (!session) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function authHeaders(accessToken?: string, json = false): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function parseError(response: Response) {
  try {
    const payload = await response.json() as { msg?: string; message?: string; error_description?: string; error?: string };
    return payload.error_description || payload.message || payload.msg || payload.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function normalizeSession(payload: AuthSession): AuthSession {
  const expiresAt = payload.expires_at ?? Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600);
  return { ...payload, expires_at: expiresAt };
}

async function refreshSession(session: AuthSession): Promise<AuthSession> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(undefined, true),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) {
    writeSession(null);
    throw new ContentAuthRequiredError();
  }
  const next = normalizeSession(await response.json() as AuthSession);
  writeSession(next);
  return next;
}

async function requireSession(): Promise<AuthSession> {
  let session = readSession();
  if (!session?.access_token || !session.refresh_token) throw new ContentAuthRequiredError();
  if ((session.expires_at ?? 0) <= Math.floor(Date.now() / 1000) + 60) {
    session = await refreshSession(session);
  }
  return session;
}

async function authedFetch(path: string, init: RequestInit = {}) {
  const session = await requireSession();
  const headers = new Headers(init.headers);
  Object.entries(authHeaders(session.access_token)).forEach(([key, value]) => headers.set(key, String(value)));
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (response.status === 401) {
    const refreshed = await refreshSession(session);
    headers.set("Authorization", `Bearer ${refreshed.access_token}`);
    return fetch(`${SUPABASE_URL}${path}`, { ...init, headers, cache: "no-store" });
  }
  return response;
}

export function hasContentReviewSession() {
  return Boolean(readSession()?.access_token);
}

export async function signInContentReviewer(email: string, password: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(undefined, true),
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  writeSession(normalizeSession(await response.json() as AuthSession));
}

export async function signUpContentReviewer(email: string, password: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(undefined, true),
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const payload = await response.json() as AuthSession & { identities?: unknown[] };
  if (payload.access_token) {
    writeSession(normalizeSession(payload));
    return "Access created and signed in.";
  }
  return "Access created. Check your email if Supabase asks you to confirm the address, then sign in here.";
}

export async function signOutContentReviewer(): Promise<void> {
  const session = readSession();
  if (session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: authHeaders(session.access_token),
      });
    } catch {
      // Local sign-out is authoritative for this static client.
    }
  }
  writeSession(null);
}

async function currentUser(): Promise<AuthUser> {
  const response = await authedFetch("/auth/v1/user");
  if (!response.ok) {
    writeSession(null);
    throw new ContentAuthRequiredError();
  }
  return response.json() as Promise<AuthUser>;
}

function mapBatch(row: BatchRow): ContentBatch {
  return {
    id: row.id, slug: row.slug, subjectName: row.subject_name, title: row.title,
    periodStart: row.period_start, periodEnd: row.period_end, status: row.status,
    ownerUserId: row.owner_user_id, reviewerEmail: row.reviewer_email ?? "",
  };
}

function mapItem(row: ItemRow): ContentItem {
  return {
    id: row.id, batchId: row.batch_id, itemKey: row.item_key, itemKind: row.item_kind,
    sortOrder: row.sort_order, publishDate: row.publish_date, title: row.title,
    contentPillar: row.content_pillar ?? "", postCopy: row.post_copy ?? "", imageQuote: row.image_quote ?? "",
    platforms: row.platforms ?? [], assetUrl: "", assetPath: row.asset_url ?? "", hook: row.hook ?? "",
    whyItWorks: row.why_it_works ?? "",
    talkingPoints: Array.isArray(row.talking_points)
      ? row.talking_points.filter((value): value is string => typeof value === "string")
      : [],
    filmingDirection: row.filming_direction ?? "", publishingStatus: row.publishing_status,
  };
}

function mapReview(row: ReviewRow): ContentReview {
  return {
    itemId: row.item_id, reviewerUserId: row.reviewer_user_id, decision: row.decision,
    note: row.note ?? "", updatedAt: row.updated_at,
  };
}

function encodeStoragePath(path: string) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

async function signedAssetUrl(path: string): Promise<string> {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const response = await authedFetch(`/storage/v1/object/sign/content-assets/${encodeStoragePath(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!response.ok) return "";
  const payload = await response.json() as { signedURL?: string; signedUrl?: string };
  const signed = payload.signedURL ?? payload.signedUrl ?? "";
  if (!signed) return "";
  return signed.startsWith("http")
    ? signed
    : `${SUPABASE_URL}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
}

function safeAssetName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "asset";
}

export async function loadContentDashboard(): Promise<ContentDashboard> {
  const user = await currentUser();
  const batchResponse = await authedFetch(
    "/rest/v1/content_batches?select=id,slug,subject_name,title,period_start,period_end,status,owner_user_id,reviewer_email&status=neq.archived&order=period_start.desc&limit=1",
  );
  if (!batchResponse.ok) throw new Error(await parseError(batchResponse));
  const batches = await batchResponse.json() as BatchRow[];
  const batchRow = batches[0];
  if (!batchRow) return { userId: user.id, userEmail: user.email ?? "", batch: null, items: [], reviews: [] };

  const itemResponse = await authedFetch(
    `/rest/v1/content_items?select=id,batch_id,item_key,item_kind,sort_order,publish_date,title,content_pillar,post_copy,image_quote,platforms,asset_url,hook,why_it_works,talking_points,filming_direction,publishing_status&batch_id=eq.${encodeURIComponent(batchRow.id)}&order=sort_order.asc`,
  );
  if (!itemResponse.ok) throw new Error(await parseError(itemResponse));
  const itemRows = await itemResponse.json() as ItemRow[];
  const items = await Promise.all(itemRows.map(async (row) => {
    const item = mapItem(row);
    if (item.assetPath) item.assetUrl = await signedAssetUrl(item.assetPath);
    return item;
  }));

  let reviews: ContentReview[] = [];
  if (items.length) {
    const ids = items.map((item) => item.id).join(",");
    const reviewResponse = await authedFetch(
      `/rest/v1/content_reviews?select=item_id,reviewer_user_id,decision,note,updated_at&item_id=in.(${ids})&order=updated_at.desc`,
    );
    if (!reviewResponse.ok) throw new Error(await parseError(reviewResponse));
    reviews = (await reviewResponse.json() as ReviewRow[]).map(mapReview);
  }

  return { userId: user.id, userEmail: user.email ?? "", batch: mapBatch(batchRow), items, reviews };
}

export async function saveContentReview(itemId: string, decision: ContentDecision, note: string): Promise<void> {
  const user = await currentUser();
  const response = await authedFetch("/rest/v1/content_reviews?on_conflict=item_id,reviewer_user_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      item_id: itemId,
      reviewer_user_id: user.id,
      decision,
      note: note.trim(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(await parseError(response));
}

export async function uploadContentAsset(batchId: string, itemId: string, file: File): Promise<void> {
  const contentType = file.type || "application/octet-stream";
  if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    throw new Error("Use a PNG, JPG, or WebP graphic.");
  }
  const path = `${batchId}/${itemId}/${Date.now()}-${safeAssetName(file.name)}`;
  const uploadResponse = await authedFetch(`/storage/v1/object/content-assets/${encodeStoragePath(path)}`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error(`Graphic could not be uploaded: ${await parseError(uploadResponse)}`);

  const itemResponse = await authedFetch(`/rest/v1/content_items?id=eq.${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ asset_url: path, updated_at: new Date().toISOString() }),
  });
  if (!itemResponse.ok) throw new Error(`Graphic uploaded, but the post could not be linked: ${await parseError(itemResponse)}`);
}

export async function setContentReviewerEmail(batchId: string, reviewerEmail: string): Promise<void> {
  const response = await authedFetch(`/rest/v1/content_batches?id=eq.${encodeURIComponent(batchId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ reviewer_email: reviewerEmail.trim().toLowerCase() || null, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(await parseError(response));
}

export async function markContentBatchReadyToArm(batchId: string, approvedPostIds: string[]): Promise<void> {
  if (approvedPostIds.length) {
    const ids = approvedPostIds.join(",");
    const itemResponse = await authedFetch(`/rest/v1/content_items?id=in.(${ids})`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ publishing_status: "ready_to_arm", updated_at: new Date().toISOString() }),
    });
    if (!itemResponse.ok) throw new Error(await parseError(itemResponse));
  }
  const batchResponse = await authedFetch(`/rest/v1/content_batches?id=eq.${encodeURIComponent(batchId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "ready_to_arm", updated_at: new Date().toISOString() }),
  });
  if (!batchResponse.ok) throw new Error(await parseError(batchResponse));
}
