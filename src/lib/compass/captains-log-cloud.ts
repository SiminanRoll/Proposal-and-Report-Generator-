export interface CaptainsLogCloudConfig {
  url: string;
  anonKey: string;
  email: string;
}

interface CaptainsLogCloudSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

export interface CaptainsLogCloudAuthSnapshot {
  configured: boolean;
  signedIn: boolean;
  email: string;
  userId: string;
  expiresAt: number;
}

interface AuthRefreshBackoff {
  until: number;
  attempts: number;
  error: string;
}

const CONFIG_KEY = "client_compass_captains_log_cloud_config";
const SESSION_KEY = "client_compass_captains_log_cloud_session";
const AUTH_REFRESH_BACKOFF_KEY = "client_compass_captains_log_auth_backoff_v1";
const COMPANY_IDENTITY_CACHE_KEY = "client_compass.company_identity.v2";
const COMPANY_IDENTITY_SCHEMA_READY_KEY = "client_compass.company_identity.schema.v1";

type JsonMap = Record<string, unknown>;
type IdentityCacheItem = {
  companyId?: string;
  canonicalName?: string;
  normalizedName?: string;
  aliases?: string[];
  clientCompassClientIds?: string[];
};

let activeRefresh: Promise<CaptainsLogCloudSession> | null = null;

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function stripPasteNoise(value: string): string {
  return String(value || "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function unwrapPastedValue(value: string): string {
  const cleaned = stripPasteNoise(value);
  return cleaned.replace(/^[\"'“”‘’`]+|[\"'“”‘’`]+$/g, "").trim();
}

function cleanUrl(value: string): string {
  return unwrapPastedValue(value).replace(/\s+/g, "").replace(/\/+$/, "");
}

function cleanHeaderCredential(value: string): string {
  return unwrapPastedValue(value).replace(/\s+/g, "");
}

function headerSafeValue(value: string, label: string): string {
  const cleaned = cleanHeaderCredential(value);
  if (!cleaned) throw new Error(`${label} is empty.`);
  if (!/^[\x21-\x7E]+$/.test(cleaned)) {
    throw new Error(`${label} contains unsupported pasted characters. Re-copy it directly from Supabase and paste it again.`);
  }
  return cleaned;
}

function readJson<T>(key: string): T | null {
  if (!canStore()) return null;
  try { return JSON.parse(window.localStorage.getItem(key) || "null") as T | null; }
  catch { return null; }
}

function writeJson(key: string, value: unknown): void {
  if (!canStore()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStored(key: string): void {
  if (!canStore()) return;
  window.localStorage.removeItem(key);
}

function record(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function universalCompanySchemaReady(): boolean {
  return canStore() && window.localStorage.getItem(COMPANY_IDENTITY_SCHEMA_READY_KEY) === "1";
}

function normalizeIdentityCompany(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function identityCache(): IdentityCacheItem[] {
  const raw = readJson<unknown>(COMPANY_IDENTITY_CACHE_KEY);
  return Array.isArray(raw)
    ? raw.filter((item): item is IdentityCacheItem => Boolean(item && typeof item === "object" && isUuid((item as IdentityCacheItem).companyId)))
    : [];
}

function cachedCompanyId(clientCompassId = "", company = ""): string {
  const cache = identityCache();
  if (clientCompassId) {
    const direct = cache.find((item) => Array.isArray(item.clientCompassClientIds) && item.clientCompassClientIds.includes(clientCompassId));
    if (direct?.companyId && isUuid(direct.companyId)) return text(direct.companyId);
  }
  const normalized = normalizeIdentityCompany(company);
  if (!normalized) return "";
  const matches = cache.filter((item) => {
    if (normalizeIdentityCompany(item.normalizedName || item.canonicalName) === normalized) return true;
    return Array.isArray(item.aliases) && item.aliases.some((alias) => normalizeIdentityCompany(alias) === normalized);
  });
  return matches.length === 1 && isUuid(matches[0].companyId) ? text(matches[0].companyId) : "";
}

function enrichTaskEventRow(rowValue: unknown): unknown {
  if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) return rowValue;
  const row = { ...(rowValue as JsonMap) };
  const meta = { ...record(row.metadata) };
  const patch = { ...record(meta.patch) };
  const mobile = { ...record(meta.mobile_context) };
  const explicitId = text(row.company_id || patch.company_id || meta.company_id || mobile.company_id);
  const clientCompassId = text(meta.client_compass_client_id);
  const company = text(patch.company || meta.company || mobile.company || meta.transcript_company);
  const isCompassWrite = text(row.event_id).startsWith("client_compass") || text(meta.source) === "client_compass" || Boolean(clientCompassId);
  const companyId = isUuid(explicitId) ? explicitId : cachedCompanyId(clientCompassId, company);
  const universalMode = universalCompanySchemaReady();

  if (universalMode && isCompassWrite && company && !companyId) {
    throw new Error(`Client Compass stopped a Captain's Log write because Supabase has not established a universal company UUID for ${company}. Refresh Compass and try again.`);
  }
  if (!companyId) return row;

  if (universalMode) row.company_id = companyId;
  meta.company_id = companyId;
  if (Object.keys(patch).length || isCompassWrite) meta.patch = { ...patch, company_id: companyId };
  if (Object.keys(mobile).length || isCompassWrite) meta.mobile_context = { ...mobile, company_id: companyId };
  row.metadata = meta;
  return row;
}

function enrichCallModeRow(rowValue: unknown): unknown {
  if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) return rowValue;
  const row = { ...(rowValue as JsonMap) };
  if (text(row.event_type) !== "call_mode_event") return row;

  const payload = { ...record(row.payload) };
  const prospect = { ...record(payload.prospect) };
  const salesTask = { ...record(payload.sales_task) };
  const activity = { ...record(payload.activity) };
  const extra = { ...record(payload.extra) };
  const explicitId = text(row.company_id || payload.company_id || salesTask.company_id || prospect.company_id || activity.company_id || extra.company_id);
  const clientCompassId = text(extra.client_compass_client_id || salesTask.client_compass_client_id || prospect.client_compass_client_id);
  const company = text(salesTask.company || prospect.company || activity.company || extra.company);
  const isCompassWrite = text(row.event_id).startsWith("client_compass") || text(payload.source_app) === "client_compass" || Boolean(clientCompassId);
  const companyId = isUuid(explicitId) ? explicitId : cachedCompanyId(clientCompassId, company);
  const universalMode = universalCompanySchemaReady();

  if (universalMode && isCompassWrite && company && !companyId) {
    throw new Error(`Client Compass stopped a Captain's Log write because Supabase has not established a universal company UUID for ${company}. Refresh Compass and try again.`);
  }
  if (!companyId) return row;

  if (universalMode) row.company_id = companyId;
  payload.company_id = companyId;
  if (Object.keys(prospect).length) payload.prospect = { ...prospect, company_id: companyId };
  if (Object.keys(salesTask).length) payload.sales_task = { ...salesTask, company_id: companyId };
  if (Object.keys(activity).length) payload.activity = { ...activity, company_id: companyId };
  payload.extra = { ...extra, company_id: companyId };
  row.payload = payload;
  return row;
}

function enrichUniversalCompanyIds(method: string, path: string, payload: unknown): unknown {
  if (String(method || "").toUpperCase() !== "POST" || payload === undefined || payload === null) return payload;
  const items = Array.isArray(payload) ? payload : [payload];
  if (path === "task_events") {
    const enriched = items.map(enrichTaskEventRow);
    return Array.isArray(payload) ? enriched : enriched[0];
  }
  if (path === "app_events") {
    const enriched = items.map(enrichCallModeRow);
    return Array.isArray(payload) ? enriched : enriched[0];
  }
  return payload;
}

export function getCaptainsLogCloudConfig(): CaptainsLogCloudConfig {
  const saved = readJson<Partial<CaptainsLogCloudConfig>>(CONFIG_KEY) || {};
  return {
    url: cleanUrl(saved.url || ""),
    anonKey: cleanHeaderCredential(String(saved.anonKey || "")),
    email: unwrapPastedValue(String(saved.email || "")),
  };
}

export function normalizeCaptainsLogCloudConfig(config: CaptainsLogCloudConfig): CaptainsLogCloudConfig {
  return { url: cleanUrl(config.url), anonKey: cleanHeaderCredential(config.anonKey), email: unwrapPastedValue(config.email) };
}

export function saveCaptainsLogCloudConfig(config: CaptainsLogCloudConfig): CaptainsLogCloudConfig {
  const normalized = normalizeCaptainsLogCloudConfig(config);
  const previous = getCaptainsLogCloudConfig();
  writeJson(CONFIG_KEY, normalized);
  if (previous.url !== normalized.url || previous.anonKey !== normalized.anonKey || previous.email !== normalized.email) {
    removeStored(SESSION_KEY);
    removeStored(AUTH_REFRESH_BACKOFF_KEY);
  }
  return normalized;
}

function getSession(): CaptainsLogCloudSession | null {
  return readJson<CaptainsLogCloudSession>(SESSION_KEY);
}

function clearRefreshBackoff(): void {
  removeStored(AUTH_REFRESH_BACKOFF_KEY);
}

function saveSession(raw: Record<string, unknown>, fallbackEmail = ""): CaptainsLogCloudSession {
  const user = raw.user && typeof raw.user === "object" ? raw.user as Record<string, unknown> : {};
  const expiresAt = Number(raw.expires_at || 0) || Math.floor(Date.now() / 1000) + Number(raw.expires_in || 3600);
  const session: CaptainsLogCloudSession = {
    accessToken: String(raw.access_token || ""),
    refreshToken: String(raw.refresh_token || ""),
    expiresAt,
    userId: String(user.id || ""),
    email: String(user.email || fallbackEmail || ""),
  };
  if (!session.accessToken || !session.refreshToken || !session.userId) throw new Error("Supabase did not return a reusable Captain's Log session.");
  writeJson(SESSION_KEY, session);
  clearRefreshBackoff();
  return session;
}

async function authRequest(config: CaptainsLogCloudConfig, grantType: "password" | "refresh_token", body: Record<string, string>): Promise<CaptainsLogCloudSession> {
  if (!config.url || !config.anonKey) throw new Error("Captain's Log Supabase URL and publishable key are required.");
  const apikey = headerSafeValue(config.anonKey, "Supabase publishable / anon key");
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=${grantType}`, {
    method: "POST",
    headers: { apikey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const detail = String(data.msg || data.message || data.error_description || data.error || "request failed");
    throw new Error(`Supabase Auth ${response.status}: ${detail}`);
  }
  return saveSession(data, config.email);
}

export async function signInCaptainsLogCloud(config: CaptainsLogCloudConfig, password: string): Promise<CaptainsLogCloudAuthSnapshot> {
  const normalized = saveCaptainsLogCloudConfig(config);
  if (!normalized.email || !password) throw new Error("Captain's Log Supabase email and password are required.");
  await authRequest(normalized, "password", { email: normalized.email, password });
  return getCaptainsLogCloudAuthSnapshot();
}

export async function signOutCaptainsLogCloud(): Promise<void> {
  const config = getCaptainsLogCloudConfig();
  const session = getSession();
  if (session?.accessToken && config.url && config.anonKey) {
    try {
      const apikey = headerSafeValue(config.anonKey, "Supabase publishable / anon key");
      const token = headerSafeValue(session.accessToken, "Supabase access token");
      await fetch(`${config.url}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey, Authorization: `Bearer ${token}` } });
    } catch { /* local sign-out still wins */ }
  }
  removeStored(SESSION_KEY);
  removeStored(AUTH_REFRESH_BACKOFF_KEY);
}

export function getCaptainsLogCloudAuthSnapshot(): CaptainsLogCloudAuthSnapshot {
  const config = getCaptainsLogCloudConfig();
  const session = getSession();
  return {
    configured: Boolean(config.url && config.anonKey && config.email),
    signedIn: Boolean(session?.refreshToken && session?.userId),
    email: session?.email || config.email,
    userId: session?.userId || "",
    expiresAt: session?.expiresAt || 0,
  };
}

function refreshBackoffError(backoff: AuthRefreshBackoff): Error {
  const seconds = Math.max(1, Math.ceil((backoff.until - Date.now()) / 1000));
  return new Error(`Supabase session refresh is paused for ${seconds}s after a failed Auth request${backoff.error ? `: ${backoff.error}` : "."}`);
}

async function accessToken(): Promise<string> {
  const config = getCaptainsLogCloudConfig();
  const session = getSession();
  if (!session?.refreshToken) throw new Error("Connect Client Compass to the same Supabase account used by Captain's Log in Settings.");
  if (session.expiresAt > Math.floor(Date.now() / 1000) + 90 && session.accessToken) return session.accessToken;

  const storedBackoff = readJson<AuthRefreshBackoff>(AUTH_REFRESH_BACKOFF_KEY);
  if (storedBackoff?.until && storedBackoff.until > Date.now()) throw refreshBackoffError(storedBackoff);
  if (activeRefresh) return (await activeRefresh).accessToken;

  activeRefresh = authRequest(config, "refresh_token", { refresh_token: session.refreshToken })
    .catch((cause) => {
      const previous = readJson<AuthRefreshBackoff>(AUTH_REFRESH_BACKOFF_KEY);
      const attempts = Math.max(1, Number(previous?.attempts || 0) + 1);
      const delayMs = Math.min(5 * 60 * 1000, 15 * 1000 * Math.pow(2, Math.min(5, attempts - 1)));
      const message = cause instanceof Error ? cause.message : String(cause || "Supabase Auth refresh failed");
      const backoff: AuthRefreshBackoff = { until: Date.now() + delayMs, attempts, error: message.slice(0, 180) };
      writeJson(AUTH_REFRESH_BACKOFF_KEY, backoff);
      throw refreshBackoffError(backoff);
    })
    .finally(() => {
      activeRefresh = null;
    });

  return (await activeRefresh).accessToken;
}

export async function captainsLogCloudRest<T>(method: string, path: string, payload?: unknown, params?: Record<string, string>, prefer?: string): Promise<T> {
  const config = getCaptainsLogCloudConfig();
  if (!config.url || !config.anonKey) throw new Error("Captain's Log cloud connection is not configured.");
  const token = headerSafeValue(await accessToken(), "Supabase access token");
  const apikey = headerSafeValue(config.anonKey, "Supabase publishable / anon key");
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const headers: Record<string, string> = { apikey, Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
  if (prefer) headers.Prefer = headerSafeValue(prefer, "Supabase Prefer header");
  const outgoingPayload = enrichUniversalCompanyIds(method, path, payload);
  const response = await fetch(`${config.url}/rest/v1/${path}${query}`, { method, headers, body: outgoingPayload === undefined ? undefined : JSON.stringify(outgoingPayload), cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Captain's Log cloud sync failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const responseText = await response.text();
  return (responseText ? JSON.parse(responseText) : null) as T;
}
