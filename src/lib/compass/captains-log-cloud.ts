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

const CONFIG_KEY = "client_compass_captains_log_cloud_config";
const SESSION_KEY = "client_compass_captains_log_cloud_session";

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
    if (canStore()) window.localStorage.removeItem(SESSION_KEY);
  }
  return normalized;
}

function getSession(): CaptainsLogCloudSession | null {
  return readJson<CaptainsLogCloudSession>(SESSION_KEY);
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
  if (!response.ok) throw new Error(String(data.msg || data.message || data.error_description || data.error || `Supabase sign-in failed (${response.status})`));
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
  if (canStore()) window.localStorage.removeItem(SESSION_KEY);
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

async function accessToken(): Promise<string> {
  const config = getCaptainsLogCloudConfig();
  const session = getSession();
  if (!session?.refreshToken) throw new Error("Connect Client Compass to the same Supabase account used by Captain's Log in Settings.");
  if (session.expiresAt > Math.floor(Date.now() / 1000) + 90 && session.accessToken) return session.accessToken;
  const refreshed = await authRequest(config, "refresh_token", { refresh_token: session.refreshToken });
  return refreshed.accessToken;
}

export async function captainsLogCloudRest<T>(method: string, path: string, payload?: unknown, params?: Record<string, string>, prefer?: string): Promise<T> {
  const config = getCaptainsLogCloudConfig();
  if (!config.url || !config.anonKey) throw new Error("Captain's Log cloud connection is not configured.");
  const token = headerSafeValue(await accessToken(), "Supabase access token");
  const apikey = headerSafeValue(config.anonKey, "Supabase publishable / anon key");
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const headers: Record<string, string> = { apikey, Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
  if (prefer) headers.Prefer = headerSafeValue(prefer, "Supabase Prefer header");
  const response = await fetch(`${config.url}/rest/v1/${path}${query}`, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload), cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Captain's Log cloud sync failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
