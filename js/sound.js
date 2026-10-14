/* ============================================================
   Reino de Colombia · Imperial Sound System  (v2)
   Runs on every page. Two layers:

   1) Forest ambience (Tayrona National Park field recordings,
      fran_marenco on Freesound, CC0): two dense-forest tracks
      cross-faded on a loop at very low volume. Playback state
      (muted or not + live position + elapsed time) is stored in
      localStorage so the soundscape RESUMES IN-PROGRESS across
      page changes — it never restarts from the beginning and
      never snaps in at full volume: on arrival it fades up from
      silence into wherever the forest already is. Autoplay
      policy is respected: audio only starts after the first
      user gesture.

   2) Wooden click (robo9418, CC0): a short, quiet organic tap
      played on virtually every interactive element site-wide —
      nav links, buttons, form controls, clickable cards / pills
      / chips / tabs / dots, back-to-top, and anything else with
      pointer semantics. Played through WebAudio (instant, no
      per-element Audio objects); the mini click (cabled_mess,
      CC0) is the fallback if the wooden file fails to load, and
      a pooled <audio> element is the last-resort fallback if
      WebAudio itself is unavailable.

   Attribution (Creative Commons 0):
     https://freesound.org/people/fran_marenco/sounds/796625/
     https://freesound.org/people/fran_marenco/sounds/796623/
     https://freesound.org/people/Robo9418/sounds/840321/
     https://freesound.org/people/cabled_mess/sounds/370962/
   ============================================================ */
(function () {
  'use strict';

  /* ---------- paths (root-relative: identical on every page) ---------- */
  var BASE = '/assets/audio/';
  var AMBIENCE_FILES = [
    BASE + '796625-fran-marenco-dense-forest.mp3',
    BASE + '796623-fran-marenco-dense-forest.mp3'
  ];
  var CLICK_FILE = BASE + '840321-robo9418-wooden-short-cli.mp3';
  var CLICK_FALLBACK = BASE + '370962-cabled-mess-click-01-mini.mp3';

  /* ---------- persisted state keys ---------- */
  var LS_MUTED = 'co_site_muted';   // '1' when the visitor muted the site
  var LS_POS = 'co_amb_pos';        // JSON: { t: seconds, f: deck index }
  var LS_TS = 'co_amb_ts';          // Date.now() when position was saved

  /* ---------- tuning: elegant, calm, barely-there ---------- */
  var MASTER = 0.10;                // ambience master ceiling (very quiet)
  var FADE_UP = 2.5;                // s: fade-in on (re)start — no snap
  var FADE = 4;                     // s: crossfade between the two takes
  var ROTATE = 45000;               // ms between gentle take rotations
  var SAVE_EVERY = 2000;            // ms between position persists
  var STALE = 15 * 60 * 1000;       // trust a stored position for 15 min
  var CLICK_VOL = 0.18;             // wooden click level (WebAudio gain)
  var CLICK_GAP = 40;               // ms guard against double-fire bursts

  /* ================= small helpers ================= */
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // Linear volume ramp between two decks. `toV === null` means "fade the
  // target deck up to the MASTER ceiling"; a number means "fade it to that
  // specific level" (used for fade-outs).
  function ramp(fromDeck, toDeck, toV, secs, done) {
    var fromV = fromDeck.el.volume;
    var target = (toV === null) ? MASTER : toV;
    var startV = toDeck.el.volume;
    var steps = Math.max(1, Math.round((secs * 1000) / 100));
    var i = 0;
    var id = setInterval(function () {
      if (!running) { clearInterval(id); return; }   // deck was reset while fading
      i++;
      var k = i / steps;
      fromDeck.el.volume = Math.max(0, Math.min(MASTER, fromV * (1 - k)));
      toDeck.el.volume = Math.max(0, Math.min(MASTER, startV + (target - startV) * k));
      if (i >= steps) { clearInterval(id); if (done) done(); }
    }, 100);
  }

  /* ================= layer 1: forest ambience ================= */
  var deckA = { el: new Audio(AMBIENCE_FILES[0]), fadeIn: false };
  var deckB = { el: new Audio(AMBIENCE_FILES[1]), fadeIn: false };
  [deckA, deckB].forEach(function (d) {
    d.el.loop = true;
    d.el.preload = 'auto';
    d.el.volume = 0;
    // Some browsers reject seeking before metadata; queue the seek instead.
    d.el.addEventListener('loadedmetadata', function () {
      if (typeof d.pendingSeek === 'number') {
        try { d.el.currentTime = d.pendingSeek; } catch (e) {}
        d.pendingSeek = null;
      }
    });
  });

  var running = false;
  var muted = load(LS_MUTED) === '1';
  var saveTimer = null;
  var rotateTimer = null;

  function liveDeck() {
    if (!running) return null;
    return deckA.fadeIn ? deckA : deckB;
  }

  function savePos() {
    var live = liveDeck();
    if (!live || muted) return;
    store(LS_POS, JSON.stringify({ t: live.el.currentTime, f: live === deckA ? 0 : 1 }));
    store(LS_TS, String(Date.now()));
  }

  function readPos() {
    try {
      var raw = load(LS_POS);
      var ts = parseInt(load(LS_TS), 10) || 0;
      if (!raw || !ts || Date.now() - ts > STALE) return null;
      var p = JSON.parse(raw);
      if (typeof p.t !== 'number' || p.t < 0) return null;
      return p;
    } catch (e) { return null; }
  }

  function placeDeck(deck, pos) {
    // Resume mid-forest, honouring the looping phase so the handoff
    // between pages stays continuous even after some minutes away.
    var dur = deck.el.duration;
    var t = pos && typeof pos.t === 'number' ? pos.t : 0;
    if (isFinite(dur) && dur > 0) t = t % dur;
    try {
      deck.el.currentTime = t;
    } catch (e) {
      deck.pendingSeek = t; // will be applied on loadedmetadata
    }
  }

  function startAmbience() {
    if (running || muted) return;
    var pos = readPos();
    var first = (pos && pos.f === 1) ? deckB : deckA;
    var other = first === deckA ? deckB : deckA;
    placeDeck(first, pos);
    first.el.play().then(function () {
      running = true;
      first.fadeIn = true;
      // Fade up from silence instead of snapping to full volume.
      first.el.volume = 0;
      ramp(other, first, null, FADE_UP);
      rotateTimer = setTimeout(crossfade, ROTATE);
      if (!saveTimer) saveTimer = setInterval(savePos, SAVE_EVERY);
    }).catch(function () {
      /* autoplay blocked: retried on the next user gesture */
    });
  }

  function stopAmbience(fadeSecs) {
    if (!running) return;
    savePos();
    clearTimeout(rotateTimer);
    rotateTimer = null;
    var busy = deckA.fadeIn ? deckA : deckB;
    var finish = function () {
      [deckA, deckB].forEach(function (d) {
        d.el.pause();
        d.el.volume = 0;
        d.fadeIn = false;
      });
      running = false;
    };
    if (fadeSecs > 0) {
      // Graceful fade-out: keep the live deck playing while it ramps to silence.
      var steps = Math.max(1, Math.round((fadeSecs * 1000) / 100));
      var fromV = busy.el.volume;
      var i = 0;
      var id = setInterval(function () {
        i++;
        busy.el.volume = Math.max(0, fromV * (1 - i / steps));
        if (i >= steps) { clearInterval(id); finish(); }
      }, 100);
    } else {
      finish();
    }
  }

  function crossfade() {
    if (!running || muted) return;
    var idle = deckA.fadeIn ? deckB : deckA;
    var busy = deckA.fadeIn ? deckA : deckB;
    placeDeck(idle, null);
    idle.el.play().catch(function () {});
    ramp(busy, idle, null, FADE, function () {
      busy.el.pause();
      busy.el.volume = 0;
      busy.fadeIn = false;
      idle.fadeIn = true;
      rotateTimer = setTimeout(crossfade, ROTATE);
    });
  }

  /* ================= layer 2: wooden click ================= */
  var AC = window.AudioContext || window.webkitAudioContext;
  var audioCtx = null;
  var clickBuffers = {};       // url -> decoded AudioBuffer | 'loading' | 'error'
  var clickEl = null;          // fallback <audio> pool
  var clickElBusy = false;
  var lastClickAt = 0;

  function ctx() {
    if (!AC) return null;
    if (!audioCtx) {
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended' && audioCtx.resume) {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function loadBuffer(url) {
    if (clickBuffers[url]) return;
    clickBuffers[url] = 'loading';
    var c = ctx();
    if (!c) return;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 400 && xhr.response) {
          c.decodeAudioData(xhr.response, function (buf) {
            clickBuffers[url] = buf;
          }, function () { clickBuffers[url] = 'error'; });
        } else {
          clickBuffers[url] = 'error';
        }
      };
      xhr.onerror = function () { clickBuffers[url] = 'error'; };
      xhr.send();
    } catch (e) { clickBuffers[url] = 'error'; }
  }

  function playViaElement() {
    if (!clickEl) {
      clickEl = new Audio(CLICK_FILE);
      clickEl.preload = 'auto';
      clickEl.volume = CLICK_VOL;
      clickEl.addEventListener('error', function () {
        if (clickEl.src.indexOf(CLICK_FALLBACK) === -1) clickEl.src = CLICK_FALLBACK;
      });
    }
    if (clickElBusy && !clickEl.ended) return; // tiny pool guard
    clickElBusy = true;
    try {
      clickEl.currentTime = 0;
      clickEl.play().catch(function () {});
    } catch (e) {}
    setTimeout(function () { clickElBusy = false; }, 300);
  }

  function playClick() {
    var now = Date.now();
    if (now - lastClickAt < CLICK_GAP) return;
    lastClickAt = now;
    if (muted) return;

    var c = ctx();
    if (c) {
      var buf = clickBuffers[CLICK_FILE];
      if (buf && buf !== 'loading' && buf !== 'error') {
        try {
          var src = c.createBufferSource();
          src.buffer = buf;
          var gain = c.createGain();
          gain.gain.value = CLICK_VOL;
          src.connect(gain).connect(c.destination);
          src.start(0);
          return;
        } catch (e) { /* fall through to element playback */ }
      }
      loadBuffer(CLICK_FILE);
      var fb = clickBuffers[CLICK_FALLBACK];
      if (fb && fb !== 'loading' && fb !== 'error') {
        try {
          var src2 = c.createBufferSource();
          src2.buffer = fb;
          var gain2 = c.createGain();
          gain2.gain.value = CLICK_VOL;
          src2.connect(gain2).connect(c.destination);
          src2.start(0);
        } catch (e) {}
      }
      return;
    }
    playViaElement();
  }

  /* Warm the caches as soon as we're allowed to touch audio. */
  function primeAudio() {
    ctx();
    loadBuffer(CLICK_FILE);
    loadBuffer(CLICK_FALLBACK);
  }

  /* ---------- which elements count as "interactive"? ---------- */
  var CLICK_SELECTOR = [
    'a[href]',
    'button:not(#sound-toggle)',
    'input[type="button"], input[type="submit"], input[type="reset"]',
    '[role="button"], [role="tab"], [role="menuitem"], [role="link"]',
    '.btn', '.chip', '.district-tab', '.brochure-dot', '.brochure-nav',
    '.casino-btn', '.copy-ip-btn', '.status-pill', '.back-to-top',
    '.nav-toggle', '.nav-pill', '.skip-link', '.town-link',
    '.gov-pill[data-jump]', '[data-jump-town]',
    '.citizen-card', '.town-roster-card', '.town-mayor-row',
    '.resident-chip', '.profile-close', '.grant-again',
    '.roster-clear', 'select'
  ].join(', ');

  function isDisabled(node) {
    if (node.disabled) return true;
    if (node.getAttribute && node.getAttribute('aria-disabled') === 'true') return true;
    return false;
  }

  function targetIsInteractive(t) {
    if (!t || !t.closest) return false;
    if (t.closest('#sound-toggle')) return false;   // its handler plays its own click
    var m = t.closest(CLICK_SELECTOR);
    if (m && !isDisabled(m)) return true;
    // Catch-all: any element the CSS explicitly invites clicking.
    try {
      if (getComputedStyle(t).cursor === 'pointer') return true;
    } catch (e) {}
    return false;
  }

  document.addEventListener('click', function (e) {
    if (targetIsInteractive(e.target)) playClick();
  }, true);

  // Keyboard activation feels identical to mouse activation.
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') &&
        e.target && e.target.matches &&
        e.target.matches('button:not(#sound-toggle), [role="button"], [role="tab"]')) {
      playClick();
    }
  }, true);

  /* ================= mute / unmute control (global) ================= */
  function buildButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'sound-toggle';
    btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
    btn.title = muted ? 'Unmute site sounds' : 'Mute site sounds';
    btn.innerHTML =
      '<svg class="snd-icon snd-on" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/>' +
      '<path d="M16.5 9.2a4 4 0 0 1 0 5.6"/>' +
      '<path d="M19 7a7.5 7.5 0 0 1 0 10"/></svg>' +
      '<svg class="snd-icon snd-off" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/>' +
      '<line x1="16.5" y1="9.5" x2="21" y2="14.5"/>' +
      '<line x1="21" y1="9.5" x2="16.5" y2="14.5"/></svg>' +
      '<span class="snd-label">Sound</span>';
    btn.addEventListener('click', function () {
      muted = !muted;
      store(LS_MUTED, muted ? '1' : '0');
      btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      btn.title = muted ? 'Unmute site sounds' : 'Mute site sounds';
      document.documentElement.classList.toggle('is-muted', muted);
      if (muted) {
        stopAmbience(FADE_UP);           // fade the forest out gracefully
      } else {
        primeAudio();
        startAmbience();                 // resumes exactly where it left off
        playClick();                     // audible confirmation of unmute
      }
    });
    document.body.appendChild(btn);
    if (muted) document.documentElement.classList.add('is-muted');
  }

  /* ================= interaction bootstrap (autoplay rules) ================= */
  function onFirstGesture() {
    cleanup();
    primeAudio();
    if (!muted) startAmbience();
  }

  function cleanup() {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.removeEventListener(ev, onFirstGesture);
    });
  }

  // Persist the live position right before navigating away, so the next
  // page picks the forest up mid-breath instead of from bar one.
  window.addEventListener('pagehide', savePos);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') savePos();
  });

  document.addEventListener('DOMContentLoaded', function () {
    buildButton();
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, onFirstGesture, { passive: true });
    });
  });
})();
