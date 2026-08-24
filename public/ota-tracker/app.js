(() => {
  "use strict";

  const CONFIG_KEY = "client_compass_captains_log_cloud_config";
  const SESSION_KEY = "client_compass_captains_log_cloud_session";
  const CHICAGO_TZ = "America/Chicago";
  const state = { companies: [], otas: [], filter: "all", search: "", sort: "urgency", parsed: [] };
  const $ = (id) => document.getElementById(id);
  const els = {
    connectionPill: $("connection-pill"), connectButton: $("connect-button"), refreshButton: $("refresh-button"), importButton: $("import-button"),
    connectionDialog: $("connection-dialog"), cloudUrl: $("cloud-url"), cloudKey: $("cloud-key"), cloudEmail: $("cloud-email"), cloudPassword: $("cloud-password"), signinButton: $("signin-button"), connectionMessage: $("connection-message"),
    kpiGrid: $("kpi-grid"), filterTabs: $("filter-tabs"), searchInput: $("search-input"), sortSelect: $("sort-select"), copyOverdueButton: $("copy-overdue-button"),
    queueSubtitle: $("queue-subtitle"), lastSync: $("last-sync"), otaList: $("ota-list"), toast: $("toast"),
    importDialog: $("import-dialog"), closeImportButton: $("close-import-button"), emailBatch: $("email-batch"), parseButton: $("parse-button"), importSelectedButton: $("import-selected-button"), importPreview: $("import-preview"), previewCount: $("preview-count"), importMessage: $("import-message")
  };

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
  }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function text(value) { return String(value ?? "").trim(); }
  function esc(value) { return text(value).replace(/[&<>'"]/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch])); }
  function normalizeCompany(value) {
    return text(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ").replace(/\s+/g, " ").trim();
  }
  function getConfig() {
    const saved = readJson(CONFIG_KEY) || {};
    return { url: text(saved.url).replace(/\/+$/, ""), anonKey: text(saved.anonKey).replace(/\s+/g, ""), email: text(saved.email) };
  }
  function getSession() { return readJson(SESSION_KEY); }
  function saveSession(raw, email) {
    const user = raw && raw.user && typeof raw.user === "object" ? raw.user : {};
    const session = {
      accessToken: text(raw.access_token), refreshToken: text(raw.refresh_token),
      expiresAt: Number(raw.expires_at || 0) || Math.floor(Date.now() / 1000) + Number(raw.expires_in || 3600),
      userId: text(user.id), email: text(user.email || email)
    };
    if (!session.accessToken || !session.refreshToken || !session.userId) throw new Error("Supabase did not return a reusable session.");
    writeJson(SESSION_KEY, session);
    return session;
  }
  async function authRequest(grantType, body) {
    const config = getConfig();
    if (!config.url || !config.anonKey) throw new Error("Supabase URL and publishable key are required.");
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=${grantType}`, {
      method: "POST", headers: { apikey: config.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(text(data.msg || data.message || data.error_description || data.error || `Auth ${response.status}`));
    return saveSession(data, config.email);
  }
  async function accessToken() {
    let session = getSession();
    if (!session?.refreshToken) throw new Error("Connect OTA Tracker to Captain's Log cloud.");
    if (session.accessToken && Number(session.expiresAt || 0) > Math.floor(Date.now() / 1000) + 90) return session.accessToken;
    session = await authRequest("refresh_token", { refresh_token: session.refreshToken });
    return session.accessToken;
  }
  async function rest(method, path, { params, body, prefer } = {}) {
    const config = getConfig();
    const token = await accessToken();
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const headers = { apikey: config.anonKey, Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
    if (prefer) headers.Prefer = prefer;
    const response = await fetch(`${config.url}/rest/v1/${path}${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    const payload = await response.text();
    if (!response.ok) throw new Error(`Captain's Log cloud ${response.status}${payload ? `: ${payload.slice(0, 220)}` : ""}`);
    return payload ? JSON.parse(payload) : null;
  }

  function chicagoYmd(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: CHICAGO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }
  function ymdDayNumber(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
    return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000) : NaN;
  }
  function ageState(ota) {
    const status = text(ota.status).toLowerCase();
    if (/cancel|no[-_ ]?show/.test(status)) return { key: "closed", label: "Closed", days: null, width: 0, message: "Cancelled / no-show" };
    if (ota.quoted) return { key: "quoted", label: "Quoted", days: null, width: 100, message: ota.quoted_date ? `Quoted ${formatDate(ota.quoted_date)}` : "Quote complete" };
    if (!ota.appointment_date) return { key: "unknown", label: "No date", days: null, width: 10, message: "OTA date missing" };
    const today = ymdDayNumber(chicagoYmd());
    const appointment = ymdDayNumber(ota.appointment_date);
    if (!Number.isFinite(today) || !Number.isFinite(appointment)) return { key: "unknown", label: "No date", days: null, width: 10, message: "OTA date invalid" };
    const days = today - appointment;
    if (days < 0) return { key: "upcoming", label: "Upcoming", days, width: 26, message: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} until OTA` };
    if (days <= 1) return { key: "green", label: "In window", days, width: 48, message: days === 0 ? "OTA is today" : "1 day after OTA" };
    if (days === 2) return { key: "yellow", label: "Watch", days, width: 73, message: "2 days after OTA • no quote" };
    return { key: "red", label: "Needs quote", days, width: 100, message: `${days} days after OTA • no quote` };
  }
  function formatDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
    if (!m) return text(value) || "—";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)));
  }
  function formatTime(value) {
    const m = /^(\d{1,2}):(\d{2})/.exec(text(value));
    if (!m) return text(value) || "Time not set";
    let h = Number(m[1]); const minute = m[2]; const suffix = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return `${h}:${minute} ${suffix}`;
  }
  function companyFor(ota) { return state.companies.find((c) => c.id === ota.company_id) || null; }
  function enrichedOtas() { return state.otas.map((ota) => ({ ...ota, company: companyFor(ota)?.display_name || "Unknown company", aging: ageState(ota) })); }

  function toast(message) {
    els.toast.textContent = message; els.toast.classList.add("is-visible");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
  }
  function updateConnectionState() {
    const config = getConfig(); const session = getSession(); const online = Boolean(config.url && config.anonKey && session?.refreshToken);
    els.connectionPill.classList.toggle("is-online", online); els.connectionPill.classList.toggle("is-offline", !online);
    els.connectionPill.querySelector("span:last-child").textContent = online ? (session.email || config.email || "Connected") : "Not connected";
  }
  function renderKpis() {
    const items = enrichedOtas();
    const count = (key) => items.filter((x) => x.aging.key === key).length;
    const due = count("red"), watch = count("yellow"), upcoming = count("upcoming"), quoted = count("quoted");
    const waiting = items.filter((x) => ["green","yellow","red"].includes(x.aging.key)).length;
    els.kpiGrid.innerHTML = [
      ["red", "Needs quote", due, due ? "3+ days after OTA" : "No overdue exceptions"],
      ["yellow", "Watch list", watch, "Exactly 2 days after OTA"],
      ["green", "Waiting on quote", waiting, "Completed OTA, not quoted"],
      ["cyan", "Upcoming", upcoming, "Future OTA appointments"],
      ["green", "Quoted", quoted, "Quote clock stopped"]
    ].map(([tone,label,value,sub]) => `<article class="kpi-card ${tone}"><small>${label}</small><strong>${value}</strong><span>${sub}</span></article>`).join("");
  }
  function filteredRows() {
    const q = state.search.toLowerCase();
    let rows = enrichedOtas().filter((x) => {
      if (state.filter !== "all" && x.aging.key !== state.filter) return false;
      if (!q) return true;
      return [x.company, x.contact_name, x.tc_name, x.source_subject, x.notes].some((v) => text(v).toLowerCase().includes(q));
    });
    const priority = { red:0, yellow:1, green:2, upcoming:3, unknown:4, quoted:5, closed:6 };
    rows.sort((a,b) => {
      if (state.sort === "company") return a.company.localeCompare(b.company);
      const ad = ymdDayNumber(a.appointment_date), bd = ymdDayNumber(b.appointment_date);
      if (state.sort === "date-asc") return (Number.isFinite(ad)?ad:99999999) - (Number.isFinite(bd)?bd:99999999);
      if (state.sort === "date-desc") return (Number.isFinite(bd)?bd:-1) - (Number.isFinite(ad)?ad:-1);
      const p = (priority[a.aging.key] ?? 9) - (priority[b.aging.key] ?? 9);
      if (p) return p;
      if (a.aging.key === "red") return (bd || 0) - (ad || 0);
      return (ad || 99999999) - (bd || 99999999);
    });
    return rows;
  }
  function renderList() {
    const rows = filteredRows();
    els.queueSubtitle.textContent = `${rows.length} visible OTA${rows.length === 1 ? "" : "s"} • status clock uses ${CHICAGO_TZ}`;
    if (!rows.length) {
      els.otaList.innerHTML = `<div class="empty-state"><strong>No OTAs match this view.</strong><span>Try another filter or import a batch of OTA emails.</span></div>`;
      return;
    }
    els.otaList.innerHTML = rows.map((ota) => {
      const a = ota.aging; const closed = a.key === "closed";
      return `<article class="ota-row ${esc(a.key)}" data-id="${esc(ota.id)}">
        <div class="decay-rail" aria-hidden="true"></div>
        <div class="cell company-cell"><span class="cell-label">Company</span><strong title="${esc(ota.company)}">${esc(ota.company)}</strong><small>${esc(ota.source_subject || ota.source || "Captain's Log OTA")}</small></div>
        <div class="cell date-cell"><span class="cell-label">OTA date</span><strong>${esc(formatDate(ota.appointment_date))}</strong><small>${esc(formatTime(ota.appointment_time))}${ota.time_zone ? ` • ${esc(ota.time_zone)}` : ""}</small></div>
        <div class="cell contact-cell"><span class="cell-label">Primary contact</span><strong>${esc(ota.contact_name || "Not set")}</strong><small>Primary contact</small></div>
        <div class="cell tc-cell"><span class="cell-label">Assigned TC</span><strong>${esc(ota.tc_name || "Unassigned")}</strong><small>Technology consultant</small></div>
        <div class="cell status-cell"><span class="cell-label">Quote clock</span><div class="status-line"><span class="status-badge ${esc(a.key)}">${esc(a.label)}</span><span class="age-text">${esc(a.message)}</span></div><div class="decay-track" style="--decay-width:${a.width}%"><span></span></div></div>
        <div class="cell action-cell"><button class="mini-button edit" type="button" data-action="edit">Edit</button>${closed ? "" : ota.quoted ? `<button class="mini-button undo" type="button" data-action="unquote">Undo quote</button>` : `<button class="mini-button quote" type="button" data-action="quote">Mark quoted</button>`}</div>
      </article>`;
    }).join("");
  }
  function renderAll() { renderKpis(); renderList(); }

  async function loadData({ silent = false } = {}) {
    try {
      if (!silent) els.refreshButton.disabled = true;
      const [companies, otas] = await Promise.all([
        rest("GET", "companies", { params: { select: "id,display_name,normalized_name,status", order: "display_name.asc" } }),
        rest("GET", "company_otas", { params: { select: "id,company_id,handoff_id,appointment_date,appointment_time,time_zone,tc_name,contact_name,status,source,created_at,updated_at,notes,set_date,source_message_hash,source_message_id,source_subject,source_file_name,source_imported_at,quoted,quoted_date", order: "appointment_date.asc.nullslast" } })
      ]);
      state.companies = Array.isArray(companies) ? companies : []; state.otas = Array.isArray(otas) ? otas : [];
      updateConnectionState(); renderAll(); els.lastSync.textContent = `Synced ${new Intl.DateTimeFormat("en-US", { hour:"numeric", minute:"2-digit" }).format(new Date())}`;
    } catch (error) {
      updateConnectionState(); if (!silent) toast(error.message || String(error));
      els.queueSubtitle.textContent = "Cloud connection required to load OTA records.";
    } finally { els.refreshButton.disabled = false; }
  }

  async function setQuoted(id, quoted) {
    try {
      const body = { quoted, quoted_date: quoted ? chicagoYmd() : null };
      const rows = await rest("PATCH", "company_otas", { params: { id: `eq.${id}`, select: "*" }, body, prefer: "return=representation" });
      if (Array.isArray(rows) && rows[0]) state.otas = state.otas.map((x) => x.id === id ? rows[0] : x);
      else await loadData({ silent: true });
      renderAll(); toast(quoted ? "OTA marked quoted. Quote clock cleared." : "Quote status reopened.");
    } catch (error) { toast(error.message || String(error)); }
  }
  async function editOta(id) {
    const ota = state.otas.find((x) => x.id === id); if (!ota) return;
    const date = prompt("OTA date (YYYY-MM-DD)", ota.appointment_date || ""); if (date === null) return;
    const time = prompt("OTA time (HH:MM or HH:MM:SS)", text(ota.appointment_time).slice(0,5)); if (time === null) return;
    const contact = prompt("Primary contact", ota.contact_name || ""); if (contact === null) return;
    const tc = prompt("Assigned TC", ota.tc_name || ""); if (tc === null) return;
    const notes = prompt("Notes", ota.notes || ""); if (notes === null) return;
    try {
      const body = { appointment_date: parseDateValue(date) || null, appointment_time: parseTimeValue(time) || null, contact_name: text(contact) || null, tc_name: text(tc) || null, notes: text(notes) };
      const rows = await rest("PATCH", "company_otas", { params: { id: `eq.${id}`, select: "*" }, body, prefer: "return=representation" });
      if (Array.isArray(rows) && rows[0]) state.otas = state.otas.map((x) => x.id === id ? rows[0] : x);
      renderAll(); toast("OTA updated.");
    } catch (error) { toast(error.message || String(error)); }
  }

  function splitEmailBatch(raw) {
    let value = text(raw).replace(/\r\n/g, "\n"); if (!value) return [];
    value = value.replace(/^\s*-{2,}\s*(?:Forwarded|Original) message\s*-{2,}\s*$/gim, "\n<<<OTA_SPLIT>>>\n");
    value = value.replace(/\n(?=From:\s*[^\n]+\n(?:(?:Sent|Date|To|Cc|Bcc):[^\n]*\n){1,5}Subject:)/gi, "\n<<<OTA_SPLIT>>>\n");
    let parts = value.split("<<<OTA_SPLIT>>>").map((x) => text(x)).filter(Boolean);
    if (parts.length === 1 && /\n[-=]{8,}\n/.test(value)) parts = value.split(/\n[-=]{8,}\n/).map((x) => text(x)).filter(Boolean);
    return parts;
  }
  function lineField(raw, labels) {
    const pattern = labels.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const m = new RegExp(`^(?:${pattern})\\s*[:\\-]\\s*(.+)$`, "im").exec(raw);
    return text(m?.[1]);
  }
  function parseDateValue(value) {
    const v = text(value).replace(/\b(?:Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat|Sun)(?:day)?\b,?\s*/i, "");
    let m = /\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/.exec(v);
    if (m) return `${m[1]}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[3])).padStart(2,"0")}`;
    m = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(v);
    if (m) return `${m[3]}-${String(Number(m[1])).padStart(2,"0")}-${String(Number(m[2])).padStart(2,"0")}`;
    const months = {jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
    m = /\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i.exec(v);
    if (m) return `${m[3]}-${String(months[m[1].toLowerCase()]).padStart(2,"0")}-${String(Number(m[2])).padStart(2,"0")}`;
    return "";
  }
  function parseTimeValue(value) {
    const v = text(value); if (!v) return "";
    let m = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\b/i.exec(v);
    if (!m) { m = /\b(\d{1,2})\s*(AM|PM)\b/i.exec(v); if (!m) return ""; m = [m[0], m[1], "00", "00", m[2]]; }
    let h = Number(m[1]); const min = Number(m[2] || 0); const sec = Number(m[3] || 0); const mer = text(m[4]).toUpperCase();
    if (mer === "PM" && h < 12) h += 12; if (mer === "AM" && h === 12) h = 0;
    if (h > 23 || min > 59 || sec > 59) return "";
    return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  }
  function subjectCompany(subject) {
    let s = text(subject).replace(/^(?:re|fw|fwd):\s*/i, "");
    s = s.replace(/\b(?:OTA|Onsite Technology Assessment|Onsite Assessment)\b\s*(?:scheduled|confirmation|set)?\s*[:\-|]?\s*/i, "");
    s = s.replace(/\s+[-|]\s+(?=(?:\d{1,2}\/\d{1,2}\/20\d{2}|20\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)))/i, "\n").split("\n")[0];
    return text(s);
  }
  async function sha256(value) {
    const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2,"0")).join("");
  }
  async function parseEmailPart(raw, index) {
    const subject = lineField(raw, ["Subject"]);
    let company = lineField(raw, ["Company","Practice","Office","Organization","Client","Prospect"]);
    if (!company && /\b(?:OTA|Onsite (?:Technology )?Assessment)\b/i.test(subject)) company = subjectCompany(subject);
    const contact = lineField(raw, ["Primary Contact","Contact Name","Contact"]);
    const tc = lineField(raw, ["TC","Technology Consultant","Technician","Consultant","Assigned To","Assigned TC"]);
    let dateText = lineField(raw, ["OTA Date","Appointment Date","Assessment Date"]);
    if (!dateText) dateText = text((/(?:OTA|onsite(?: technology)? assessment|appointment|scheduled for)[^\n]{0,90}((?:20\d{2}-\d{1,2}-\d{1,2})|(?:\d{1,2}\/\d{1,2}\/20\d{2})|(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}))/i.exec(raw))?.[1]);
    if (!dateText) dateText = subject;
    let timeText = lineField(raw, ["OTA Time","Appointment Time","Assessment Time","Time"]);
    if (!timeText) timeText = text((/(?:OTA|onsite(?: technology)? assessment|appointment|scheduled for)[^\n]{0,120}\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b/i.exec(raw))?.[1]);
    const messageId = lineField(raw, ["Message-ID","Message-Id","Message Id"]);
    const hash = await sha256(raw.replace(/\s+/g, " ").trim());
    return { id: `parsed-${Date.now()}-${index}`, selected: true, raw, company, contact, tc, date: parseDateValue(dateText), time: parseTimeValue(timeText), subject, messageId, hash };
  }
  function matchCompany(name) {
    const n = normalizeCompany(name); if (!n) return [];
    return state.companies.filter((c) => normalizeCompany(c.normalized_name || c.display_name) === n || normalizeCompany(c.display_name) === n);
  }
  function matchExistingOta(item) {
    if (item.messageId) { const byId = state.otas.find((o) => text(o.source_message_id) === item.messageId); if (byId) return byId; }
    const byHash = state.otas.find((o) => text(o.source_message_hash) === item.hash); if (byHash) return byHash;
    const companies = matchCompany(item.company); if (companies.length !== 1 || !item.date) return null;
    const candidates = state.otas.filter((o) => o.company_id === companies[0].id && o.appointment_date === item.date);
    if (candidates.length === 1) return candidates[0];
    if (item.contact) return candidates.find((o) => text(o.contact_name).toLowerCase() === item.contact.toLowerCase()) || null;
    return null;
  }
  function previewStatus(item) {
    const existing = matchExistingOta(item); if (existing) return { key:"duplicate", label:"Will update existing" };
    const matches = matchCompany(item.company); if (matches.length === 1) return { key:"match", label:"Company matched" };
    return { key:"new", label: item.company ? "New company" : "Needs company" };
  }
  function renderImportPreview() {
    els.previewCount.textContent = state.parsed.length ? `${state.parsed.length} parsed record${state.parsed.length === 1 ? "" : "s"}` : "No emails parsed";
    els.importSelectedButton.disabled = !state.parsed.some((x) => x.selected && x.company && x.date);
    if (!state.parsed.length) { els.importPreview.innerHTML = `<div class="empty-state compact"><strong>Parsed OTA records will appear here.</strong><span>You can correct company, contact, date, time, or TC before importing.</span></div>`; return; }
    els.importPreview.innerHTML = state.parsed.map((item, index) => {
      const s = previewStatus(item);
      return `<div class="preview-card" data-index="${index}"><div class="preview-card-top"><div class="preview-card-title"><input type="checkbox" data-field="selected" ${item.selected ? "checked" : ""} aria-label="Include record"><div><strong>${esc(item.subject || `Email ${index+1}`)}</strong><small>${esc(item.messageId || "Fingerprint captured")}</small></div></div><span class="parse-status ${s.key}">${esc(s.label)}</span></div><div class="preview-grid">
        <label>Company<input data-field="company" value="${esc(item.company)}" placeholder="Practice / company"></label>
        <label>Contact<input data-field="contact" value="${esc(item.contact)}" placeholder="Primary contact"></label>
        <label>OTA date<input data-field="date" value="${esc(item.date)}" placeholder="YYYY-MM-DD"></label>
        <label>OTA time<input data-field="time" value="${esc(item.time ? item.time.slice(0,5) : "")}" placeholder="10:00 AM"></label>
        <label>Assigned TC<input data-field="tc" value="${esc(item.tc)}" placeholder="TC name"></label>
      </div></div>`;
    }).join("");
  }
  async function parseBatch() {
    const parts = splitEmailBatch(els.emailBatch.value); els.importMessage.textContent = "";
    if (!parts.length) { els.importMessage.textContent = "Paste at least one OTA email first."; return; }
    els.parseButton.disabled = true; els.parseButton.textContent = "Parsing…";
    try {
      state.parsed = await Promise.all(parts.map((part,i) => parseEmailPart(part,i)));
      renderImportPreview();
    } catch (error) { els.importMessage.textContent = error.message || String(error); }
    finally { els.parseButton.disabled = false; els.parseButton.textContent = "Parse emails"; }
  }
  async function ensureCompany(name) {
    const matches = matchCompany(name); if (matches.length === 1) return matches[0];
    if (matches.length > 1) throw new Error(`More than one Captain's Log company matches “${name}”. Correct the company name before import.`);
    const body = { display_name: text(name), normalized_name: normalizeCompany(name), relationship_type: "prospect", relationship_source: "ota_tracker_email_import", metadata: { source: "ota_tracker" } };
    const rows = await rest("POST", "companies", { params: { select: "id,display_name,normalized_name,status" }, body, prefer: "return=representation" });
    if (!Array.isArray(rows) || !rows[0]) throw new Error(`Could not create company “${name}”.`);
    state.companies.push(rows[0]); return rows[0];
  }
  async function importOne(item) {
    if (!item.company || !item.date) throw new Error("Every selected row needs a company and OTA date.");
    const company = await ensureCompany(item.company); const existing = matchExistingOta(item);
    const body = {
      company_id: company.id, appointment_date: item.date, appointment_time: parseTimeValue(item.time) || null, time_zone: CHICAGO_TZ,
      tc_name: text(item.tc) || null, contact_name: text(item.contact) || null, source: "ota_tracker_email_import", status: existing?.status || "scheduled",
      source_message_hash: item.hash, source_message_id: text(item.messageId) || null, source_subject: text(item.subject) || null, source_imported_at: new Date().toISOString()
    };
    if (existing) {
      const rows = await rest("PATCH", "company_otas", { params: { id: `eq.${existing.id}`, select: "*" }, body, prefer: "return=representation" });
      return { mode:"updated", row: rows?.[0] || null };
    }
    const rows = await rest("POST", "company_otas", { params: { select: "*" }, body, prefer: "return=representation" });
    return { mode:"created", row: rows?.[0] || null };
  }
  async function importSelected() {
    const selected = state.parsed.filter((x) => x.selected); if (!selected.length) return;
    const invalid = selected.find((x) => !x.company || !x.date); if (invalid) { els.importMessage.textContent = "Selected rows need both company and OTA date before import."; return; }
    els.importSelectedButton.disabled = true; els.importSelectedButton.textContent = "Importing…"; els.importMessage.textContent = "";
    let created = 0, updated = 0;
    try {
      for (const item of selected) { const result = await importOne(item); if (result.mode === "updated") updated++; else created++; }
      await loadData({ silent:true }); state.parsed = []; renderImportPreview(); els.emailBatch.value = "";
      els.importMessage.textContent = `Import complete: ${created} created, ${updated} updated / deduplicated.`; toast("OTA email import complete.");
    } catch (error) { els.importMessage.textContent = error.message || String(error); }
    finally { els.importSelectedButton.disabled = false; els.importSelectedButton.textContent = "Import selected"; }
  }
  function syncPreviewInput(event) {
    const card = event.target.closest(".preview-card"); if (!card) return;
    const item = state.parsed[Number(card.dataset.index)]; if (!item) return;
    const field = event.target.dataset.field; if (!field) return;
    if (field === "selected") item.selected = event.target.checked;
    else if (field === "date") item.date = parseDateValue(event.target.value) || text(event.target.value);
    else if (field === "time") item.time = parseTimeValue(event.target.value) || text(event.target.value);
    else item[field] = text(event.target.value);
    if (event.type === "change") renderImportPreview(); else els.importSelectedButton.disabled = !state.parsed.some((x) => x.selected && x.company && x.date);
  }
  async function copyOverdue() {
    const rows = enrichedOtas().filter((x) => x.aging.key === "red").sort((a,b) => b.aging.days - a.aging.days);
    if (!rows.length) { toast("No 3+ day unquoted OTAs right now."); return; }
    const digest = ["OTA QUOTE FOLLOW-UP", `As of ${formatDate(chicagoYmd())}`, "", ...rows.map((x) => `${x.aging.days} days • ${x.company} • OTA ${formatDate(x.appointment_date)} • TC: ${x.tc_name || "Unassigned"} • Contact: ${x.contact_name || "Not set"}`)].join("\n");
    await navigator.clipboard.writeText(digest); toast(`Copied ${rows.length} overdue OTA${rows.length === 1 ? "" : "s"}.`);
  }

  els.connectButton.addEventListener("click", () => {
    const c = getConfig(); els.cloudUrl.value = c.url; els.cloudKey.value = c.anonKey; els.cloudEmail.value = c.email || getSession()?.email || ""; els.cloudPassword.value = ""; els.connectionMessage.textContent = ""; els.connectionDialog.showModal();
  });
  els.signinButton.addEventListener("click", async () => {
    els.signinButton.disabled = true; els.connectionMessage.textContent = "Connecting…";
    try {
      const config = { url:text(els.cloudUrl.value).replace(/\/+$/, ""), anonKey:text(els.cloudKey.value).replace(/\s+/g,""), email:text(els.cloudEmail.value) };
      writeJson(CONFIG_KEY, config); localStorage.removeItem(SESSION_KEY);
      await authRequest("password", { email:config.email, password:els.cloudPassword.value }); updateConnectionState(); els.connectionDialog.close(); await loadData(); toast("OTA Tracker connected to Captain's Log cloud.");
    } catch (error) { els.connectionMessage.textContent = error.message || String(error); }
    finally { els.signinButton.disabled = false; }
  });
  els.refreshButton.addEventListener("click", () => loadData());
  els.importButton.addEventListener("click", () => { els.importMessage.textContent = ""; els.importDialog.showModal(); });
  els.closeImportButton.addEventListener("click", () => els.importDialog.close());
  els.parseButton.addEventListener("click", parseBatch); els.importSelectedButton.addEventListener("click", importSelected);
  els.importPreview.addEventListener("input", syncPreviewInput); els.importPreview.addEventListener("change", syncPreviewInput);
  els.filterTabs.addEventListener("click", (event) => { const button = event.target.closest("button[data-filter]"); if (!button) return; state.filter = button.dataset.filter; [...els.filterTabs.querySelectorAll("button")].forEach((b) => b.classList.toggle("is-active", b === button)); renderList(); });
  els.searchInput.addEventListener("input", () => { state.search = els.searchInput.value; renderList(); });
  els.sortSelect.addEventListener("change", () => { state.sort = els.sortSelect.value; renderList(); });
  els.copyOverdueButton.addEventListener("click", () => copyOverdue().catch((error) => toast(error.message || String(error))));
  els.otaList.addEventListener("click", (event) => { const button = event.target.closest("button[data-action]"); const row = event.target.closest(".ota-row"); if (!button || !row) return; if (button.dataset.action === "quote") setQuoted(row.dataset.id, true); else if (button.dataset.action === "unquote") setQuoted(row.dataset.id, false); else if (button.dataset.action === "edit") editOta(row.dataset.id); });

  updateConnectionState(); renderKpis();
  if (getConfig().url && getConfig().anonKey && getSession()?.refreshToken) loadData({ silent:true });
})();
