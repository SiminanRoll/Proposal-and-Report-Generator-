#!/usr/bin/env python3
"""Captain's Log cloud operations dashboard.

Small stdlib-only web service intended for DigitalOcean App Platform.
It serves the dashboard UI and proxies signed dashboard reads to the
server-runner-dashboard-data Supabase Edge Function. No Supabase service-role
credential is ever exposed to the browser or required by this service.
"""

import base64
import hashlib
import hmac
import html
import json
import os
import socket
import time
import urllib.request
from datetime import datetime, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
DEFAULT_SUPABASE_URL = "https://cqhqbucjzgijhskupnlw.supabase.co"
ALLOWED_WINDOWS = {1, 7, 30, 90, 365}
STATIC_FILES = {
    "/premium.css": ("premium.css", "text/css; charset=utf-8"),
    "/premium.js": ("premium.js", "application/javascript; charset=utf-8"),
    "/premium_core.js": ("premium_core.js", "application/javascript; charset=utf-8"),
    "/premium_social.js": ("premium_social.js", "application/javascript; charset=utf-8"),
    "/premium_app.js": ("premium_app.js", "application/javascript; charset=utf-8"),
}
SESSION_COOKIE = "cldash_session"
SESSION_TTL_SECONDS = 12 * 60 * 60


def env(name, *fallbacks):
    for key in (name, *fallbacks):
        value = os.environ.get(key)
        if value and value.strip():
            return value.strip()
    return None


def truthy(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def dashboard_secret():
    return env("SERVER_RUNNER_DASHBOARD_SECRET", "NPI_RADAR_SECRET", "OSS_WEBHOOK_SECRET")


def dashboard_user_id():
    return env("CAPTAINS_LOG_USER_ID", "NPI_RADAR_USER_ID")


def dashboard_data_url():
    explicit = env("SERVER_RUNNER_DASHBOARD_DATA_URL")
    if explicit:
        return explicit
    base = (env("SUPABASE_URL") or DEFAULT_SUPABASE_URL).rstrip("/")
    return base + "/functions/v1/server-runner-dashboard-data"


def auth_username():
    return env("DASHBOARD_USERNAME")


def auth_password():
    return env("DASHBOARD_PASSWORD")


def session_secret():
    return env("DASHBOARD_SESSION_SECRET") or dashboard_secret()


def auth_configured():
    return bool(auth_username() and auth_password() and session_secret())


def b64encode(value):
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def b64decode(value):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def make_session(username):
    expiry = int(time.time()) + SESSION_TTL_SECONDS
    payload = f"{username}|{expiry}".encode("utf-8")
    signature = hmac.new(session_secret().encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return b64encode(payload + b"|" + signature.encode("ascii"))


def valid_session(token):
    if not token or not auth_configured():
        return False
    try:
        decoded = b64decode(token).decode("utf-8")
        username, expiry_text, supplied = decoded.rsplit("|", 2)
        expiry = int(expiry_text)
        if expiry < int(time.time()):
            return False
        if not hmac.compare_digest(username, auth_username()):
            return False
        payload = f"{username}|{expiry}".encode("utf-8")
        expected = hmac.new(session_secret().encode("utf-8"), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, supplied)
    except Exception:
        return False


def snapshot(window_days=7):
    secret = dashboard_secret()
    user_id = dashboard_user_id()
    if not secret:
        raise RuntimeError("SERVER_RUNNER_DASHBOARD_SECRET is not configured")
    if not user_id:
        raise RuntimeError("CAPTAINS_LOG_USER_ID is not configured")

    try:
        window_days = int(window_days)
    except (TypeError, ValueError):
        window_days = 7
    if window_days not in ALLOWED_WINDOWS:
        window_days = 7

    payload = {
        "user_id": user_id,
        "window_days": window_days,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "host_name": socket.gethostname(),
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    request = urllib.request.Request(
        dashboard_data_url(),
        data=raw,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Server-Dashboard-Signature": signature,
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.loads(response.read().decode("utf-8"))
    if not data.get("ok"):
        raise RuntimeError(data.get("error", "dashboard read failed"))
    return data


LOGIN_PAGE = """<!doctype html>
<html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Captain's Log Operations</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 80% 0,#12334b 0,transparent 30%),#061019;color:#eef7fc;font:14px Segoe UI,Arial,sans-serif}.box{width:min(420px,calc(100vw - 32px));padding:28px;border:1px solid #254158;border-radius:18px;background:linear-gradient(160deg,#122737,#0c1b27);box-shadow:0 24px 60px rgba(0,0,0,.32)}.ey{font-size:10px;letter-spacing:.14em;color:#7ea9c8;font-weight:800}h1{font-size:25px;margin:7px 0 6px}.sub{color:#8fa6b9;margin-bottom:22px}label{display:block;color:#8fa6b9;font-size:10px;letter-spacing:.08em;margin:12px 0 5px}input{width:100%;border:1px solid #27445b;background:#071620;color:#eef7fc;border-radius:11px;padding:11px 12px;outline:none}input:focus{border-color:#65bbff;box-shadow:0 0 0 3px rgba(101,187,255,.10)}button{width:100%;margin-top:18px;border:1px solid #4d87b1;background:linear-gradient(180deg,#19405d,#12314a);color:#f4fbff;border-radius:11px;padding:11px;font-weight:800;cursor:pointer}.err{color:#ff9ca0;margin-top:12px;min-height:18px}.foot{color:#658198;font-size:10px;margin-top:18px}</style></head>
<body><form class='box' method='post' action='/login'><div class='ey'>CAPTAIN'S LOG · SERVER INTELLIGENCE</div><h1>Operations Dashboard</h1><div class='sub'>Sign in to view live runner health and opportunity intelligence.</div><label>USERNAME</label><input name='username' autocomplete='username' required autofocus><label>PASSWORD</label><input name='password' type='password' autocomplete='current-password' required><button type='submit'>SIGN IN</button><div class='err'>{{ERROR}}</div><div class='foot'>Protected server-side. Supabase credentials are never sent to this browser.</div></form></body></html>"""


class Handler(BaseHTTPRequestHandler):
    server_version = "CaptainsLogDashboard/1.0"

    def security_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        )

    def send_bytes(self, code, body, content_type):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location, cookie_header=None):
        self.send_response(303)
        self.send_header("Location", location)
        if cookie_header:
            self.send_header("Set-Cookie", cookie_header)
        self.security_headers()
        self.end_headers()

    def file(self, name, content_type):
        path = HERE / name
        if not path.exists():
            return self.send_bytes(404, b"Not found", "text/plain; charset=utf-8")
        return self.send_bytes(200, path.read_bytes(), content_type)

    def cookie_value(self, name):
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        jar = cookies.SimpleCookie()
        try:
            jar.load(raw)
            morsel = jar.get(name)
            return morsel.value if morsel else None
        except cookies.CookieError:
            return None

    def authenticated(self):
        if not auth_configured():
            return True
        return valid_session(self.cookie_value(SESSION_COOKIE))

    def login_page(self, error=""):
        page = LOGIN_PAGE.replace("{{ERROR}}", html.escape(error))
        return self.send_bytes(200 if not error else 401, page.encode("utf-8"), "text/html; charset=utf-8")

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/login":
            return self.send_bytes(405, b"Method not allowed", "text/plain; charset=utf-8")
        length = min(int(self.headers.get("Content-Length", "0") or 0), 16_384)
        form = parse_qs(self.rfile.read(length).decode("utf-8", "replace"))
        username = (form.get("username") or [""])[0]
        password = (form.get("password") or [""])[0]
        if not auth_configured():
            return self.login_page("Dashboard authentication is not configured.")
        good_user = hmac.compare_digest(username, auth_username())
        good_password = hmac.compare_digest(password, auth_password())
        if not (good_user and good_password):
            return self.login_page("Invalid username or password.")
        secure = truthy("DASHBOARD_COOKIE_SECURE", default=bool(os.environ.get("PORT")))
        cookie = f"{SESSION_COOKIE}={make_session(username)}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL_SECONDS}"
        if secure:
            cookie += "; Secure"
        return self.redirect("/", cookie)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/healthz":
            return self.send_bytes(200, b'{"ok":true}', "application/json; charset=utf-8")
        if parsed.path == "/login":
            if self.authenticated():
                return self.redirect("/")
            return self.login_page()
        if parsed.path == "/logout":
            return self.redirect("/login", f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0")
        if not self.authenticated():
            return self.redirect("/login")
        if parsed.path in ("/", "/premium.html"):
            return self.file("premium.html", "text/html; charset=utf-8")
        if parsed.path in STATIC_FILES:
            name, content_type = STATIC_FILES[parsed.path]
            return self.file(name, content_type)
        if parsed.path == "/api/status":
            try:
                raw_days = (parse_qs(parsed.query).get("days") or ["7"])[0]
                days = int(raw_days) if str(raw_days).isdigit() else 7
                if days not in ALLOWED_WINDOWS:
                    days = 7
                body = json.dumps(snapshot(days), separators=(",", ":")).encode("utf-8")
                return self.send_bytes(200, body, "application/json; charset=utf-8")
            except Exception as exc:
                body = json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"}).encode("utf-8")
                return self.send_bytes(502, body, "application/json; charset=utf-8")
        return self.send_bytes(404, b"Not found", "text/plain; charset=utf-8")

    def log_message(self, fmt, *args):
        print(datetime.now(timezone.utc).isoformat(timespec="seconds"), fmt % args)


def main():
    port = int(env("PORT", "CAPTAINS_LOG_DASHBOARD_PORT") or "8787")
    bind = env("CAPTAINS_LOG_DASHBOARD_BIND") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")

    if not dashboard_secret():
        raise RuntimeError("SERVER_RUNNER_DASHBOARD_SECRET must be configured")
    if not dashboard_user_id():
        raise RuntimeError("CAPTAINS_LOG_USER_ID must be configured")
    if bind not in {"127.0.0.1", "localhost", "::1"} and not auth_configured():
        raise RuntimeError("DASHBOARD_USERNAME and DASHBOARD_PASSWORD are required for a non-local bind")

    print(f"Captain's Log Operations Dashboard: http://{bind}:{port}")
    ThreadingHTTPServer((bind, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
