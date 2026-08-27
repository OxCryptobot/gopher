#!/usr/bin/env python3
"""GOPHER landing + waitlist. Tiny static server. No extra deps."""
from __future__ import annotations

import json
import os
import re
import sys
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
WAITLIST_PATH = os.path.join(ROOT, "waitlist.json")
HOST = os.environ.get("GOPHER_HOST", "0.0.0.0")
PORT = int(os.environ.get("GOPHER_PORT", "7070"))
EMAIL_RE = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.I)
HIDDEN = {"waitlist.json", "waitlist.json.tmp", "server.py", "README.md"}
LOCK = threading.Lock()

os.chdir(ROOT)


def load_waitlist() -> list:
    if not os.path.exists(WAITLIST_PATH):
        return []
    try:
        with open(WAITLIST_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def save_waitlist(entries: list) -> None:
    tmp = WAITLIST_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)
        f.write("\n")
    os.replace(tmp, WAITLIST_PATH)


def wants_json(handler: SimpleHTTPRequestHandler) -> bool:
    accept = handler.headers.get("Accept", "")
    ctype = handler.headers.get("Content-Type", "")
    return "application/json" in accept or "application/json" in ctype


class Handler(SimpleHTTPRequestHandler):
    server_version = "GOPHER/0.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[gopher] {self.log_date_time_string()} {fmt % args}", file=sys.stderr)

    def list_directory(self, path: str):
        self.send_error(404, "Not found")
        return None

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def translate_path(self, path: str) -> str:
        mapped = super().translate_path(path)
        name = os.path.basename(mapped)
        if name in HIDDEN:
            return os.path.join(ROOT, "__no_such_file__")
        return mapped

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self.path = "/index.html"
            return super().do_GET()
        if parsed.path.rstrip("/") == "/api/waitlist":
            self._json(405, {"ok": False, "error": "POST an email to join."})
            return
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.rstrip("/") != "/api/waitlist":
            self.send_error(404, "Not found")
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length > 4096:
            self._fail(413, "payload too large")
            return
        raw = self.rfile.read(length) if length else b""
        email = self._extract_email(raw)
        if email is None:
            self._fail(400, "that doesn't look like an email. try again.")
            return
        email = email.strip()
        if not EMAIL_RE.match(email) or len(email) > 254:
            self._fail(400, "that doesn't look like an email. try again.")
            return

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with LOCK:
            entries = load_waitlist()
            existing = {e.get("email", "").lower() for e in entries if isinstance(e, dict)}
            if email.lower() in existing:
                status = "duplicate"
            else:
                entries.append({"email": email, "joined_at": now})
                save_waitlist(entries)
                status = "joined"

        body = {"ok": True, "status": status, "email": email}
        if wants_json(self):
            self._json(200, body)
        else:
            self._html_result(body)

    def _extract_email(self, raw: bytes) -> str | None:
        ctype = self.headers.get("Content-Type", "")
        text = raw.decode("utf-8", errors="replace")
        if "application/json" in ctype:
            try:
                data = json.loads(text or "{}")
            except json.JSONDecodeError:
                return None
            if isinstance(data, dict):
                value = data.get("email")
                return value if isinstance(value, str) else None
            return None
        parsed = parse_qs(text, keep_blank_values=True)
        values = parsed.get("email") or []
        return values[0] if values else None

    def _fail(self, code: int, message: str) -> None:
        payload = {"ok": False, "status": "invalid", "error": message}
        if wants_json(self):
            self._json(code, payload)
        else:
            self._html_result(payload, code)

    def _json(self, code: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _html_result(self, payload: dict, code: int = 200) -> None:
        if payload.get("status") == "joined":
            line = "ok. you're on the list."
        elif payload.get("status") == "duplicate":
            line = "already listed. we'll still ping you."
        else:
            line = payload.get("error") or "could not file that selector."
        html = (
            "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width, initial-scale=1'>"
            "<title>GOPHER waitlist</title>"
            "<link rel='stylesheet' href='/style.css'></head><body>"
            "<div class='shell'><p class='breath'>" + _esc(line) + "</p>"
            "<p><a href='/'>back to GOPHER</a></p></div></body></html>"
        ).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)


def _esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def main() -> None:
    if not os.path.exists(WAITLIST_PATH):
        save_waitlist([])
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"GOPHER listening on http://127.0.0.1:{PORT}/", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nGOPHER closed the hole.", flush=True)
        httpd.server_close()


if __name__ == "__main__":
    main()
