(function () {
  "use strict";

  var EMAIL_RE = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i;
  var form = document.getElementById("form");
  var emailEl = document.getElementById("email");
  var submit = document.getElementById("submit");
  var statusEl = document.getElementById("form-status");
  var clock = document.getElementById("clock");

  function setStatus(kind, text) {
    statusEl.className = "status-line" + (kind ? " " + kind : "");
    statusEl.textContent = text;
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

  if (!form) return;

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = (emailEl.value || "").trim();
    if (!EMAIL_RE.test(email)) {
      setStatus("err", "! that doesn’t look like an email. try again.");
      emailEl.focus();
      return;
    }

    submit.disabled = true;
    setStatus("", "… posting selector");

    fetch("/api/waitlist", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { okHttp: res.ok, body: body };
        });
      })
      .then(function (out) {
        var body = out.body || {};
        if (body.status === "joined") {
          setStatus("ok", "ok. you’re on the list.\nwe’ll ping this address when the hole opens.");
          form.classList.add("done");
          emailEl.readOnly = true;
        } else if (body.status === "duplicate") {
          setStatus("dup", "already listed. we’ll still ping you.");
          emailEl.readOnly = true;
        } else {
          setStatus("err", "! " + (body.error || "couldn’t file that selector."));
          submit.disabled = false;
        }
      })
      .catch(function () {
        setStatus("err", "! line dropped. try again.");
        submit.disabled = false;
      });
  });
})();
