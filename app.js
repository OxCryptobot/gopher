(function () {
  "use strict";

  var EMAIL_RE = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i;
  var USERS_KEY = "gopher_users_v1";
  var SESS_KEY = "gopher_session_v1";
  var BEST_KEY = "gopher_fetch_best_v1";

  /* Scalable Gopher directory. Add an item here; the hole grows. */
  var HOLES = {
    "/": {
      title: "Directory of GOPHER AI",
      items: [
        { n: "1", type: "1", name: "About/", path: "/about", hint: "what this is" },
        { n: "2", type: "1", name: "How/", path: "/how", hint: "order in, fetch, reply" },
        { n: "3", type: "1", name: "Capabilities/", path: "/caps", hint: "what it does" },
        { n: "4", type: "0", name: "Privacy", path: "/privacy", hint: "one line" },
        { n: "5", type: "1", name: "FETCH/", path: "/fetch", hint: "8-bit burrow game" },
        { n: "6", type: "7", name: "Waitlist", path: "/waitlist", hint: "get in" },
        { n: "9", type: "1", name: "User/", path: "/user", hint: "enter your hole" }
      ]
    },
    "/about": {
      title: "1 About/",
      html:
        "<p class='info'>GOPHER AI is a standalone phone assistant you pay for. You talk to a number. It turns the talk into an order, fetches, and brings the answer back to the same thread.</p>" +
        "<p class='info'>The name is the point. Old Gopher was a menu, a selector, a fetch. No infinite scroll. No chat sludge. A modern prompt sits on that contract.</p>"
    },
    "/how": {
      title: "2 How it works/",
      html:
        "<ol class='steps'>" +
        "<li>You send an order — voice, SMS, or the prompt.</li>" +
        "<li>GOPHER AI files it as a selector: fetch, watch, draft, remind.</li>" +
        "<li>Plugins you connect do the work.</li>" +
        "<li>The result comes back to the same conversation.</li>" +
        "</ol>"
    },
    "/caps": {
      title: "3 Capabilities/",
      html:
        "<ul class='caps'>" +
        "<li><span class='itype'>0</span> Voice and SMS in. A reply out.</li>" +
        "<li><span class='itype'>0</span> Orders, not chat.</li>" +
        "<li><span class='itype'>0</span> Numbered menus + a modern ask box.</li>" +
        "<li><span class='itype'>0</span> FETCH, an original 8-bit hole.</li>" +
        "<li><span class='itype'>0</span> A log of what was asked and what came back.</li>" +
        "</ul>" +
        "<p class='info dim'>Not a general chatbot. Not a free public menu.</p>"
    },
    "/privacy": {
      title: "4 Privacy",
      html: "<p class='info'>We keep your waitlist email now; later, your number and order logs to do the job. Login on this page stays on this device. We don’t sell any of it.</p>"
    }
  };

  var ALIAS = {
    about: "/about", how: "/how", caps: "/caps", capabilities: "/caps",
    privacy: "/privacy", fetch: "/fetch", game: "/fetch", play: "/fetch",
    user: "/user", login: "/user", waitlist: "/waitlist", home: "/", menu: "/"
  };

  var $ = function (id) { return document.getElementById(id); };
  var dirEl = $("dir"), viewEl = $("view"), authEl = $("auth"), gameEl = $("game");
  var heroEl = $("hero"), askEl = $("ask");
  var game = null;

  function pathNow() {
    var h = (location.hash || "#/").replace(/^#/, "");
    if (!h.startsWith("/")) h = "/" + h;
    if (h.length > 1 && h.endsWith("/")) h = h.slice(0, -1);
    return h || "/";
  }

  function go(path) {
    if (!path.startsWith("/")) path = "/" + path;
    if (location.hash !== "#" + path) location.hash = path;
    else render();
  }

  function setStatus(el, kind, text) {
    if (!el) return;
    el.className = "status-line" + (kind ? " " + kind : "");
    el.textContent = text;
  }

  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESS_KEY) || "null"); }
    catch (e) { return null; }
  }
  function setSession(name) {
    if (!name) sessionStorage.removeItem(SESS_KEY);
    else sessionStorage.setItem(SESS_KEY, JSON.stringify({ name: name, at: Date.now() }));
    paintWho();
  }
  function paintWho() {
    var s = session();
    $("who").textContent = s && s.name ? s.name : "guest";
  }

  function users() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

  function bufToB64(buf) {
    var b = new Uint8Array(buf), s = "", i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function b64ToBuf(s) {
    var raw = atob(s), u = new Uint8Array(raw.length), i;
    for (i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i);
    return u;
  }

  async function hashPass(pass, saltB64) {
    var enc = new TextEncoder();
    var salt = saltB64 ? b64ToBuf(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    var key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
    var bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt, iterations: 120000, hash: "SHA-256" },
      key,
      256
    );
    return { hash: bufToB64(bits), salt: saltB64 || bufToB64(salt) };
  }

  function bestScore(name) {
    try {
      var all = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
      return all[name || "guest"] || 0;
    } catch (e) { return 0; }
  }
  function saveBest(name, n) {
    var all = {};
    try { all = JSON.parse(localStorage.getItem(BEST_KEY) || "{}"); } catch (e) {}
    var k = name || "guest";
    all[k] = Math.max(n, all[k] || 0);
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
    return all[k];
  }

  function renderDir(path) {
    var hole = HOLES["/"] || { items: [], title: "Directory" };
    var html = "<p class='info dim'>" + hole.title + "</p><div class='selectors'>";
    hole.items.forEach(function (it) {
      var active = path === it.path ? " active" : "";
      html += "<button type='button' class='sel" + active + "' data-path='" + it.path + "' data-n='" + it.n + "'>" +
        "<span class='itype'>" + it.n + "</span> " + it.name +
        " <span class='path'>" + it.hint + "</span></button>";
    });
    html += "</div>";
    dirEl.innerHTML = html;
    dirEl.querySelectorAll("button.sel").forEach(function (b) {
      b.addEventListener("click", function () { go(b.getAttribute("data-path")); });
    });
  }

  function hideSpecial() {
    authEl.hidden = true;
    gameEl.hidden = true;
    viewEl.hidden = true;
    if (game) game.stop();
  }

  function render() {
    var path = pathNow();
    $("host").textContent = "gopher://gopher.ai:70" + path;
    renderDir(path);
    paintWho();
    hideSpecial();

    if (path === "/" || path === "/waitlist") {
      heroEl.hidden = false;
      askEl.hidden = false;
      if (path === "/waitlist") $("email").focus();
      return;
    }
    heroEl.hidden = true;
    askEl.hidden = true;

    if (path === "/user") {
      authEl.hidden = false;
      var s = session();
      $("auth-out").hidden = !s;
      if (s) setStatus($("auth-status"), "ok", "you’re in as " + s.name + ".");
      return;
    }
    if (path === "/fetch") {
      gameEl.hidden = false;
      bootGame();
      return;
    }
    var doc = HOLES[path];
    if (!doc) {
      viewEl.hidden = false;
      viewEl.innerHTML = "<h2>3 Error</h2><p class='info'>selector not found. press esc or 0 for the directory.</p>";
      return;
    }
    viewEl.hidden = false;
    viewEl.innerHTML = "<h2>" + doc.title + "</h2>" + doc.html;
    viewEl.focus();
  }

  function bootGame() {
    var canvas = $("fetch");
    var s = session();
    var name = s && s.name ? s.name : "guest";
    $("g-best").textContent = "best " + bestScore(name);
    if (!game) {
      game = new FetchGame(canvas, {
        onHud: function (g) {
          $("g-score").textContent = "score " + g.score;
          $("g-lvl").textContent = "lvl " + g.lvl;
          $("g-lives").textContent = "lives " + g.lives;
          var b = saveBest(name, g.score);
          $("g-best").textContent = "best " + b;
          if (g.dead) setStatus($("g-status"), "err", "404 hole. START to dig again.");
          else if (g.win) setStatus($("g-status"), "ok", "fetched. next hole…");
        }
      });
    }
    game.draw();
  }

  function tickClock() {
    var clock = $("clock");
    if (!clock) return;
    clock.textContent = new Date().toLocaleString("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).replace(",", "") + " COT";
  }
  tickClock();
  setInterval(tickClock, 30000);

  window.addEventListener("hashchange", render);
  document.addEventListener("keydown", function (e) {
    var inField = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (!gameEl.hidden && game && game.running && !inField) {
      if (e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); game.input("up"); }
      if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); game.input("down"); }
      if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); game.input("left"); }
      if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); game.input("right"); }
    }
    if (inField) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    if (e.key === "/" || e.key === "?") {
      e.preventDefault();
      go("/");
      $("command").focus();
      if (e.key === "?") setStatus($("ask-status"), "", "1–4 docs · 5 FETCH · 6 waitlist · 9 user");
      return;
    }
    if (e.key === "Escape" || e.key === "0") { go("/"); return; }
    var items = (HOLES["/"] && HOLES["/"].items) || [];
    items.forEach(function (it) {
      if (e.key === it.n) { e.preventDefault(); go(it.path); }
    });
  });

  $("ask-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = ($("command").value || "").trim();
    if (!q) return;
    if (/^[0-9]$/.test(q)) {
      var hit = HOLES["/"].items.filter(function (it) { return it.n === q; })[0];
      if (hit) { go(hit.path); $("command").value = ""; return; }
    }
    var alias = ALIAS[q.toLowerCase()];
    if (alias) { go(alias); $("command").value = ""; return; }
    if (EMAIL_RE.test(q)) {
      $("email").value = q;
      $("command").value = "";
      $("form").requestSubmit();
      return;
    }
    try { localStorage.setItem("gopher_first_order", q); } catch (err) {}
    setStatus($("ask-status"), "ok", "queued: “" + q + "”. leave an email or enter your hole.");
    $("email").focus();
  });

  $("form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = ($("email").value || "").trim();
    var st = $("form-status");
    if (!EMAIL_RE.test(email)) {
      setStatus(st, "err", "! that doesn’t look like an email.");
      return;
    }
    $("submit").disabled = true;
    var order = "";
    try { order = localStorage.getItem("gopher_first_order") || ""; } catch (err) {}
    fetch("/api/waitlist", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, order: order })
    })
      .then(function (res) { return res.json().then(function (body) { return body; }).catch(function () { return {}; }); })
      .then(function (body) {
        if (body.status === "joined" || body.status === "duplicate") {
          setStatus(st, body.status === "joined" ? "ok" : "dup",
            body.status === "joined" ? "ok. you’re on the list." : "already listed.");
        } else {
          stashLocal(email, order);
          setStatus(st, "ok", "ok. listed on this device.");
        }
        $("form").classList.add("done");
        $("email").readOnly = true;
      })
      .catch(function () {
        stashLocal(email, order);
        setStatus(st, "ok", "ok. listed on this device.");
        $("form").classList.add("done");
        $("email").readOnly = true;
      });
  });

  function stashLocal(email, order) {
    var key = "gopher_waitlist", list = [];
    try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { list = []; }
    if (!list.some(function (e) { return (e.email || "").toLowerCase() === email.toLowerCase(); })) {
      list.push({ email: email, order: order || "", at: new Date().toISOString() });
    }
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
  }

  async function authSubmit(isNew) {
    var name = ($("uname").value || "").trim().toLowerCase();
    var pass = $("pass").value || "";
    var st = $("auth-status");
    if (!/^[a-z0-9._-]{3,24}$/.test(name)) {
      setStatus(st, "err", "! name: 3–24 letters, numbers, . _ -");
      return;
    }
    if (pass.length < 8) {
      setStatus(st, "err", "! passphrase at least 8.");
      return;
    }
    var db = users();
    if (isNew) {
      if (db[name]) { setStatus(st, "err", "! that hole already exists on this device."); return; }
      var h = await hashPass(pass);
      db[name] = { salt: h.salt, hash: h.hash, at: Date.now() };
      saveUsers(db);
      setSession(name);
      $("pass").value = "";
      setStatus(st, "ok", "hole dug. welcome, " + name + ".");
      $("auth-out").hidden = false;
      return;
    }
    if (!db[name]) { setStatus(st, "err", "! no hole by that name here."); return; }
    var check = await hashPass(pass, db[name].salt);
    if (check.hash !== db[name].hash) { setStatus(st, "err", "! passphrase doesn’t match."); return; }
    setSession(name);
    $("pass").value = "";
    setStatus(st, "ok", "entered. hi " + name + ".");
    $("auth-out").hidden = false;
  }

  $("auth-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    authSubmit(false);
  });
  $("auth-new").addEventListener("click", function () { authSubmit(true); });
  $("auth-out").addEventListener("click", function () {
    setSession(null);
    setStatus($("auth-status"), "", "left the hole. guest mode.");
    $("auth-out").hidden = true;
  });

  $("g-start").addEventListener("click", function () {
    if (!game) bootGame();
    game.start();
    setStatus($("g-status"), "", "fetch packets. avoid orange sludge.");
  });
  $("g-mute").addEventListener("click", function () {
    if (!game) bootGame();
    game.mute = !game.mute;
    $("g-mute").textContent = game.mute ? "MUTE" : "SOUND";
  });
  document.querySelectorAll(".dpad button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (game) game.input(b.getAttribute("data-dir"));
    });
  });

  render();
})();
