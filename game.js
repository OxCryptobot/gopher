/* FETCH — original 8-bit burrow game for GOPHER AI. */
(function (global) {
  "use strict";

  var COLS = 20, ROWS = 16, TILE = 8;
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function rnd(n) { return Math.floor(Math.random() * n); }

  function FetchGame(canvas, hooks) {
    this.c = canvas.getContext("2d");
    this.c.imageSmoothingEnabled = false;
    this.hooks = hooks || {};
    this.mute = true;
    this.running = false;
    this.raf = 0;
    this.acc = 0;
    this.last = 0;
    this.reset(1);
  }

  FetchGame.prototype.reset = function (lvl) {
    this.lvl = lvl || 1;
    this.score = this.score || 0;
    if (lvl === 1) { this.score = 0; this.lives = 3; }
    this.dir = [1, 0];
    this.next = [1, 0];
    this.px = 2; this.py = 8;
    this.need = 6 + this.lvl * 2;
    this.got = 0;
    this.dead = false;
    this.win = false;
    this.tickMs = Math.max(90, 180 - this.lvl * 12);
    this.packets = [];
    this.sludge = [];
    var i, p;
    for (i = 0; i < this.need; i++) {
      p = this.empty();
      this.packets.push(p);
    }
    for (i = 0; i < this.lvl; i++) {
      p = this.empty();
      this.sludge.push({ x: p.x, y: p.y, d: rnd(4) });
    }
  };

  FetchGame.prototype.empty = function () {
    var x, y, n = 0;
    do {
      x = 1 + rnd(COLS - 2);
      y = 1 + rnd(ROWS - 2);
      n++;
    } while (n < 80 && this.blocked(x, y, true));
    return { x: x, y: y };
  };

  FetchGame.prototype.blocked = function (x, y, includePlayer) {
    if (x <= 0 || y <= 0 || x >= COLS - 1 || y >= ROWS - 1) return true;
    if (includePlayer && x === this.px && y === this.py) return true;
    var i;
    for (i = 0; i < this.packets.length; i++) {
      if (this.packets[i].x === x && this.packets[i].y === y) return true;
    }
    for (i = 0; i < this.sludge.length; i++) {
      if (this.sludge[i].x === x && this.sludge[i].y === y) return true;
    }
    return false;
  };

  FetchGame.prototype.input = function (name) {
    var d = DIRS[name];
    if (!d) return;
    if (d[0] === -this.dir[0] && d[1] === -this.dir[1]) return;
    this.next = d;
  };

  FetchGame.prototype.beep = function (f) {
    if (this.mute || !global.AudioContext) return;
    try {
      var ctx = this.ac || new AudioContext();
      this.ac = ctx;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "square";
      o.frequency.value = f;
      g.gain.value = 0.03;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.06);
    } catch (e) {}
  };

  FetchGame.prototype.step = function () {
    if (this.dead || this.win) return;
    this.dir = this.next;
    var nx = this.px + this.dir[0];
    var ny = this.py + this.dir[1];
    if (nx <= 0 || ny <= 0 || nx >= COLS - 1 || ny >= ROWS - 1) {
      this.hit();
      return;
    }
    var i, s;
    for (i = 0; i < this.sludge.length; i++) {
      if (this.sludge[i].x === nx && this.sludge[i].y === ny) {
        this.hit();
        return;
      }
    }
    this.px = nx; this.py = ny;
    for (i = this.packets.length - 1; i >= 0; i--) {
      if (this.packets[i].x === this.px && this.packets[i].y === this.py) {
        this.packets.splice(i, 1);
        this.got++;
        this.score += 10 * this.lvl;
        this.beep(660);
        this.emit();
      }
    }
    if (this.got >= this.need) {
      this.win = true;
      this.beep(880);
      var self = this;
      setTimeout(function () { self.reset(self.lvl + 1); self.win = false; self.emit(); }, 700);
      this.emit();
      return;
    }
    var dirs = ["up", "down", "left", "right"];
    for (i = 0; i < this.sludge.length; i++) {
      s = this.sludge[i];
      if (rnd(3) === 0) s.d = rnd(4);
      var dd = DIRS[dirs[s.d]];
      var sx = s.x + dd[0], sy = s.y + dd[1];
      if (sx > 0 && sy > 0 && sx < COLS - 1 && sy < ROWS - 1) {
        s.x = sx; s.y = sy;
      } else {
        s.d = rnd(4);
      }
      if (s.x === this.px && s.y === this.py) this.hit();
    }
    this.emit();
  };

  FetchGame.prototype.hit = function () {
    this.lives -= 1;
    this.beep(110);
    if (this.lives <= 0) {
      this.dead = true;
      this.running = false;
    } else {
      this.px = 2; this.py = 8; this.dir = [1, 0]; this.next = [1, 0];
    }
    this.emit();
  };

  FetchGame.prototype.emit = function () {
    if (this.hooks.onHud) this.hooks.onHud(this);
  };

  FetchGame.prototype.draw = function () {
    var c = this.c, x, y, i;
    c.fillStyle = "#020302";
    c.fillRect(0, 0, 160, 144);
    /* burrow walls */
    c.fillStyle = "#0b330b";
    for (x = 0; x < COLS; x++) {
      c.fillRect(x * TILE, 0, TILE, TILE);
      c.fillRect(x * TILE, (ROWS - 1) * TILE, TILE, TILE);
    }
    for (y = 0; y < ROWS; y++) {
      c.fillRect(0, y * TILE, TILE, TILE);
      c.fillRect((COLS - 1) * TILE, y * TILE, TILE, TILE);
    }
    /* dirt specks */
    c.fillStyle = "#143f14";
    for (i = 0; i < 18; i++) {
      c.fillRect((1 + (i * 3) % 18) * TILE + 3, (1 + (i * 5) % 14) * TILE + 3, 2, 2);
    }
    c.fillStyle = "#b8ff9a";
    for (i = 0; i < this.packets.length; i++) {
      c.fillRect(this.packets[i].x * TILE + 2, this.packets[i].y * TILE + 2, 4, 4);
    }
    c.fillStyle = "#ff6a3d";
    for (i = 0; i < this.sludge.length; i++) {
      c.fillRect(this.sludge[i].x * TILE + 1, this.sludge[i].y * TILE + 1, 6, 6);
    }
    /* gopher */
    var gx = this.px * TILE, gy = this.py * TILE;
    c.fillStyle = "#39ff14";
    c.fillRect(gx + 1, gy + 2, 6, 5);
    c.fillRect(gx + 2, gy + 1, 4, 2);
    c.fillStyle = "#070908";
    c.fillRect(gx + 2, gy + 3, 1, 1);
    c.fillRect(gx + 5, gy + 3, 1, 1);
    if (this.dead) {
      c.fillStyle = "#ff6a3d";
      c.font = "8px monospace";
      c.fillText("404 HOLE", 52, 80);
    } else if (this.win) {
      c.fillStyle = "#b8ff9a";
      c.font = "8px monospace";
      c.fillText("FETCHED", 56, 80);
    }
  };

  FetchGame.prototype.loop = function (ts) {
    if (!this.running) return;
    if (!this.last) this.last = ts;
    this.acc += ts - this.last;
    this.last = ts;
    while (this.acc >= this.tickMs) {
      this.step();
      this.acc -= this.tickMs;
    }
    this.draw();
    var self = this;
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
  };

  FetchGame.prototype.start = function () {
    this.score = 0;
    this.reset(1);
    this.dead = false;
    this.running = true;
    this.last = 0; this.acc = 0;
    cancelAnimationFrame(this.raf);
    var self = this;
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
    this.emit();
  };

  FetchGame.prototype.stop = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
  };

  global.FetchGame = FetchGame;
})(window);
