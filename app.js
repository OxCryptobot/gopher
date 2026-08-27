(function () {
  "use strict";

  var EMAIL_RE = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i;
  var MENU = { "1": "#about", "2": "#how", "3": "#caps", "4": "#privacy", "7": "#ask" };
  var form = document.getElementById("form");
  var emailEl = document.getElementById("email");
  var submit = document.getElementById("submit");
  var statusEl = document.getElementById("form-status");
  var clock = document.getElementById("clock");
  var askForm = document.getElementById("ask-form");
  var command = document.getElementById("command");
  var askStatus = document.getElementById("ask-status");

  function setStatus(el, kind, text) {
    if (!el) return;
    el.className = "status-line" + (kind ? " " + kind : "");
    el.textContent = text;
  }

  function tick() {
    if (!clock) return;
    var now = new Date();
    clock.textContent = now.toLocaleString("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(",", "") + " COT";
  }
  tick();
  setInterval(tick, 30000);

  function highlight() {
    var hash = (location.hash || "").replace("#", "");
    document.querySelectorAll(".selectors a").forEach(function (a) {
      var id = (a.getAttribute("href") || "").replace("#", "");
      a.classList.toggle("active", !!hash && id === hash);
    });
  }
  window.addEventListener("hashchange", highlight);
  highlight();

  function goSelector(sel) {
    var target = MENU[String(sel)];
    if (!target) return false;
    location.hash = target;
    var node = document.querySelector(target);
    if (node) {
      node.focus({ preventScroll: true });
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return true;
  }

  document.addEventListener("keydown", function (e) {
    var inField = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (inField) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    if (e.key === "/" || e.key === "?") {
      e.preventDefault();
      if (command) command.focus();
      if (e.key === "?" && askStatus) {
        setStatus(askStatus, "", "1 about · 2 how · 3 capabilities · 4 privacy · 7 waitlist");
      }
      return;
    }
    if (MENU[e.key]) {
      e.preventDefault();
      goSelector(e.key);
    }
  });

  if (askForm && command) {
    askForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var q = (command.value || "").trim();
      if (!q) {
        command.focus();
        return;
      }
      if (/^[1-47]$/.test(q)) {
        goSelector(q);
        setStatus(askStatus, "ok", "selector " + q + ".");
        command.value = "";
        return;
      }
      if (EMAIL_RE.test(q)) {
        emailEl.value = q;
        command.value = "";
        setStatus(askStatus, "", "filing as waitlist…");
        form.requestSubmit();
        return;
      }
      try { localStorage.setItem("gopher_first_order", q); } catch (err) {}
      setStatus(askStatus, "ok", "queued: “" + q + "”. leave an email and we’ll open the hole with it.");
      emailEl.focus();
    });
  }

  if (!form) return;

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = (emailEl.value || "").trim();
    if (!EMAIL_RE.test(email)) {
      setStatus(statusEl, "err", "! that doesn’t look like an email. try again.");
      emailEl.focus();
      return;
    }

    submit.disabled = true;
    setStatus(statusEl, "", "… posting selector");

    var order = "";
    try { order = localStorage.getItem("gopher_first_order") || ""; } catch (err) {}

    fetch("/api/waitlist", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, order: order })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { okHttp: res.ok, body: body };
        }).catch(function () {
          return { okHttp: res.ok, body: {} };
        });
      })
      .then(function (out) {
        var body = out.body || {};
        if (body.status === "joined") {
          setStatus(statusEl, "ok", "ok. you’re on the list.\nwe’ll ping this address when the hole opens.");
          form.classList.add("done");
          emailEl.readOnly = true;
        } else if (body.status === "duplicate") {
          setStatus(statusEl, "dup", "already listed. we’ll still ping you.");
          emailEl.readOnly = true;
        } else {
          // Static host (GitHub Pages): keep the signup locally and succeed honestly.
          stashLocal(email, order);
          setStatus(statusEl, "ok", "ok. listed on this device.\nwhen GOPHER AI is live we’ll still want this address — we’ll add a mail drop next.");
          form.classList.add("done");
          emailEl.readOnly = true;
        }
      })
      .catch(function () {
        stashLocal(email, order);
        setStatus(statusEl, "ok", "ok. listed on this device. mail drop comes with the live hole.");
        form.classList.add("done");
        emailEl.readOnly = true;
      });
  });

  function stashLocal(email, order) {
    var key = "gopher_waitlist";
    var list = [];
    try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (err) { list = []; }
    if (!Array.isArray(list)) list = [];
    var lower = email.toLowerCase();
    if (!list.some(function (e) { return (e.email || "").toLowerCase() === lower; })) {
      list.push({ email: email, order: order || "", at: new Date().toISOString() });
    }
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (err) {}
  }
})();
