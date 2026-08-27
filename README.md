# GOPHER

Landing page and waitlist mock for **GOPHER**, a paid phone virtual assistant.

Named after the 1991 Gopher protocol: menus, selectors, fetch. No fluff.

GOPHER is built to sit in front of Grok Bot over **webhooks and plugins you run**. It is not an official Grok Bot product, and there is no official Grok Bot public API.

## Run

```bash
cd /workspace/gopher
python3 server.py
```

Then open **http://127.0.0.1:7070/**

Override bind with `GOPHER_HOST` / `GOPHER_PORT` if you need to.

Requires Python 3.10+ (stdlib only).

## Waitlist

`POST /api/waitlist` with JSON `{"email":"you@domain"}` or a normal form field `email`.

- Validates the address
- Treats duplicates as already-listed (idempotent)
- Persists signups in [`waitlist.json`](waitlist.json) so they survive refresh

The waitlist file is not served over HTTP.

## Layout

```
/workspace/gopher/
  index.html      landing page
  style.css       phosphor / 70-column menu
  app.js          waitlist UI
  server.py       static + waitlist API
  waitlist.json   signups
  README.md       this file
```
