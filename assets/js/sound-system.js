/* ============================================================
   Reino de Colombia · Sound System  (sound-system.js v1)
   Production-ready vanilla JS. No dependencies. Loads early
   (plain <script> in <head>) so state is restored before paint.

   LAYER 1 — Forest ambience (Tayrona National Park field
   recordings by fran_marenco, CC0). Two dense-forest takes at
   very low volume (MASTER = 0.12), cross-faded on a gentle
   rotation. Playback position + paused/muted state are stored
   in localStorage and restored on every page so the forest
   RESUMES MID-BREATH across navigations — never restarts from
   zero, never snaps in: it fades up smoothly on arrival.
   Autoplay policy is respected: if play() rejects with
   NotAllowedError, playback is queued onto the first user
   gesture automatically.

   LAYER 2 — UI clicks. Global event delegation plays the
   wooden click (robo9418, CC0) on buttons, links, nav-links,
   form controls, [role="button"], clickable cards, and any
   element with cursor:pointer. Rapid clicks never cut off:
   each click spawns an independent WebAudio BufferSource
   (instant, overlapping-safe); a pooled <audio> fallback also
   resets currentTime = 0 per play. Opt out per element with
   data-sound="none"; pick the subtle mini click (cabled_mess,
   CC0) with data-sound="secondary".

   CONTROLS — window.toggleSound(force) flips/sets the global
   mute state, persists it to localStorage, and syncs the DOM
   of any #sound-toggle button (existing or auto-created):
   aria-pressed, title, .is-muted / .sound-on classes on both
   the button and <html>.

   Attribution (Creative Commons 0):
     https://freesound.org/people/fran_marenco/sounds/796625/
     https://freesound.org/people/fran_marenco/sounds/796623/
     https://freesound.org/people/Robo9418/sounds/840321/
     https://freesound.org/people/cabled_mess/sounds/370962/
   ============================================================ */
(function () {
  'use strict';

  /* ---------- asset paths (root-relative: identical on every page) ---------- */
  var BASE = '/assets/audio/';
  var AMBIENCE_FILES = [
    BASE + '796625-fran-marenco-dense-forest.mp3',
    BASE + '796623-fran-marenco-dense-forest.mp3'
  ];
  var CLICK_PRIMARY   = BASE + '840321-robo9418-wooden-short-cli.mp3';
  var CLICK_SECONDARY = BASE + '370962-cabled-mess-click-01-mini.mp3';

  /* ---------- persisted state keys ---------- */
  var LS_STATE = 'co_sound_state'; // JSON: { muted, currentTime, paused }
  var LS_TS    = 'co_sound_ts';    // Date.now() when the snapshot was saved

  /* ---------- tuning: elegant, calm, barely-there ---------- */
  var MASTER      = 0.12;           // ambience ceiling (within 0.10–0.15)
  var FADE_UP     = 2.5;            // s: fade-in on (re)start — no popping
  var FADE        = 4;              // s: crossfade between the two takes
  var ROTATE      = 45000;          // ms between gentle take rotations
  var STALE       = 15 * 60 * 1000; // trust a stored position for 15 min
  var CLICK_VOL   = 0.18;           // click level (WebAudio gain)
  var CLICK_GAP   = 40;             // ms guard against double-fire bursts

  /* ================= small helpers ================= */
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k)     { try { return localStorage.getItem(k); } catch (e) { return null; } }

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
      if (!running && toV !== 0) { clearInterval(id); return; } // deck reset mid-fade
      i++;
      var k = i / steps;
      fromDeck.el.volume = Math.max(0, Math.min(MASTER, fromV * (1 - k)));
      toDeck.el.volume   = Math.max(0, Math.min(MASTER, startV + (target - startV) * k));
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
  var muted   = false;
  try {
    muted = !!(JSON.parse(load(LS_STATE) || '{}').muted);
  } catch (e) { muted = load(LS_STATE) === '1'; } // tolerate legacy format
  var pendingResume = false;   // play() was blocked -> retry on first gesture

  // The position we resume from after a page change. Kept separately from
  // the live deck clock so it is never overwritten by a fresh (t = 0)
  // timeupdate event while the fade-in ramp is still running.
  var resumeAt = 0;

  /* ---------- state snapshot (currentTime + paused + muted) ---------- */
  function liveDeck() {
    if (!running) return null;
    return deckA.fadeIn ? deckA : deckB;
  }

  function saveState() {
    var live = liveDeck();
    var t = live ? live.el.currentTime : 0;
    // A fresh (re)start briefly reports currentTime = 0 while the deck is
    // still positioned at the restored spot; never let that clobber the
    // resume position — continuity across pages wins over a spurious zero.
    if (t === 0 && resumeAt > 0) t = resumeAt;
    store(LS_STATE, JSON.stringify({ muted: muted, currentTime: t, paused: !running }));
    store(LS_TS, String(Date.now()));
  }

  function readState() {
    try {
      var raw = load(LS_STATE);
      var ts = parseInt(load(LS_TS), 10) || 0;
      if (!raw || !ts || Date.now() - ts > STALE) return null;
      var s = JSON.parse(raw);
      if (typeof s.currentTime !== 'number' || s.currentTime < 0) return null;
      return s;
    } catch (e) { return null; }
  }

  function placeDeck(deck, t) {
    // Resume mid-forest, honouring the loop phase so the handoff between
    // pages stays continuous even after some minutes away.
    var dur = deck.el.duration;
    if (typeof t !== 'number' || t < 0) t = 0;
    if (isFinite(dur) && dur > 0) t = t % dur;
    try {
      deck.el.currentTime = t;
    } catch (e) {
      deck.pendingSeek = t; // applied on loadedmetadata
    }
  }

  function startAmbience() {
    if (running || muted) return;
    var s = readState();
    resumeAt = s ? s.currentTime : 0;   // remember where the forest left off
    placeDeck(deckA, resumeAt);
    placeDeck(deckB, resumeAt);
    var first = deckA;
    first.el.play().then(function () {
      pendingResume = false;
      running = true;
      first.fadeIn = true;
      // Fade up from silence instead of snapping in (prevents popping).
      first.el.volume = 0;
      ramp(deckB, first, null, FADE_UP);
      rotateTimer = setTimeout(crossfade, ROTATE);
    }).catch(function (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        // Autoplay policy: queue playback onto the first user gesture.
        pendingResume = true;
        armGestureRetry();
      }
    });
  }

  function stopAmbience(fadeSecs) {
    if (!running) return;
    saveState();
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

  var rotateTimer = null;

  function crossfade() {
    if (!running || muted) return;
    var idle = deckA.fadeIn ? deckB : deckA;
    var busy = deckA.fadeIn ? deckA : deckB;
    placeDeck(idle, busy.el.currentTime); // keep the same timeline position
    idle.el.play().catch(function () {});
    ramp(busy, idle, null, FADE, function () {
      busy.el.pause();
      busy.el.volume = 0;
      busy.fadeIn = false;
      idle.fadeIn = true;
      rotateTimer = setTimeout(crossfade, ROTATE);
    });
  }

  /* ---------- persistence hooks: timeupdate / visibilitychange / unload ---- */
  deckA.el.addEventListener('timeupdate', saveState);
  deckB.el.addEventListener('timeupdate', saveState);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveState();
  });
  window.addEventListener('beforeunload', saveState);
  window.addEventListener('pagehide', saveState);

  /* ================= layer 2: UI clicks ================= */
  var AC = window.AudioContext || window.webkitAudioContext;
  var audioCtx = null;
  var clickBuffers = {};   // url -> decoded AudioBuffer | 'loading' | 'error'
  var clickEl = null;      // pooled <audio> fallback
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
          c.decodeAudioData(xhr.response,
            function (buf) { clickBuffers[url] = buf; },
            function ()    { clickBuffers[url] = 'error'; });
        } else {
          clickBuffers[url] = 'error';
        }
      };
      xhr.onerror = function () { clickBuffers[url] = 'error'; };
      xhr.send();
    } catch (e) { clickBuffers[url] = 'error'; }
  }

  function spawnBuffer(c, buf) {
    try {
      var src = c.createBufferSource(); // fresh node per click: rapid clicks overlap cleanly
      src.buffer = buf;
      var gain = c.createGain();
      gain.gain.value = CLICK_VOL;
      src.connect(gain).connect(c.destination);
      src.start(0);
      return true;
    } catch (e) { return false; }
  }

  // Fallback when WebAudio is unavailable: reuse one <audio>, always
  // rewinding currentTime = 0 so repeated clicks retrigger instead of cutting off.
  function playViaElement(url) {
    if (!clickEl) {
      clickEl = new Audio(CLICK_PRIMARY);
      clickEl.preload = 'auto';
      clickEl.volume = CLICK_VOL;
    }
    if (clickEl.src.indexOf(url) === -1) clickEl.src = url;
    try {
      clickEl.currentTime = 0;
      clickEl.play().catch(function () {});
    } catch (e) {}
  }

  function playClick(kind) {
    if (muted) return;
    var now = Date.now();
    if (now - lastClickAt < CLICK_GAP) return;
    lastClickAt = now;

    var primary = (kind === 'secondary') ? CLICK_SECONDARY : CLICK_PRIMARY;
    var backup  = (kind === 'secondary') ? CLICK_PRIMARY   : CLICK_SECONDARY;

    var c = ctx();
    if (c) {
      var buf = clickBuffers[primary];
      if (buf && buf !== 'loading' && buf !== 'error') {
        if (spawnBuffer(c, buf)) return;
      }
      loadBuffer(primary);
      var fb = clickBuffers[backup];
      if (fb && fb !== 'loading' && fb !== 'error') spawnBuffer(c, fb);
      return;
    }
    playViaElement(primary);
  }

  /* ---------- which elements count as "interactive"? ---------- */
  var CLICK_SELECTOR = [
    'a[href]',
    'button',
    'input[type="button"], input[type="submit"], input[type="reset"]',
    '[role="button"], [role="tab"], [role="menuitem"], [role="link"]',
    '.btn', '.nav-link',
    '.chip', '.district-tab', '.brochure-dot', '.brochure-nav',
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

  /* ---------- global click delegation ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // The sound toggle handles its own feedback inside toggleSound().
    if (t.closest('#sound-toggle')) return;

    // Explicit opt-out anywhere in the ancestry.
    if (t.closest('[data-sound="none"]')) return;

    var interactive = t.closest(CLICK_SELECTOR);
    if (interactive && !isDisabled(interactive)) {
      var opted = interactive.closest('[data-sound]');
      playClick(opted && opted.getAttribute('data-sound') === 'secondary'
        ? 'secondary' : 'primary');
      return;
    }

    // Catch-all: interactive cards / anything CSS invites clicking.
    try {
      if (getComputedStyle(t).cursor === 'pointer') {
        var el = t.closest('[data-sound]');
        playClick(el && el.getAttribute('data-sound') === 'secondary'
          ? 'secondary' : 'primary');
      }
    } catch (err) {}
  }, true);

  // Keyboard activation feels identical to mouse activation.
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') &&
        e.target && e.target.matches &&
        e.target.matches('button, [role="button"], [role="tab"]') &&
        !e.target.closest('#sound-toggle') &&
        !e.target.closest('[data-sound="none"]')) {
      playClick('primary');
    }
  }, true);

  /* ================= global mute control ================= */
  // window.toggleSound()        -> flip mute state
  // window.toggleSound(true)    -> force muted
  // window.toggleSound(false)   -> force unmuted
  function syncToggleButtons() {
    document.querySelectorAll('#sound-toggle').forEach(function (btn) {
      btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      btn.title = muted ? 'Unmute site sounds' : 'Mute site sounds';
      btn.classList.toggle('is-muted', muted);
      btn.classList.toggle('sound-on', !muted);
    });
    document.documentElement.classList.toggle('is-muted', muted);
    document.documentElement.classList.toggle('sound-on', !muted);
  }

  window.toggleSound = function (force) {
    muted = (typeof force === 'boolean') ? force : !muted;
    saveState();                 // persists muted + position + paused
    syncToggleButtons();
    if (muted) {
      stopAmbience(FADE_UP);     // fade the forest out gracefully
    } else {
      primeAudio();
      startAmbience();           // resumes exactly where it left off
      playClick('primary');      // audible confirmation of unmute
    }
    return !muted;               // true = sound is now ON
  };

  /* ================= interaction bootstrap (autoplay rules) ================= */
  function primeAudio() {
    ctx();
    loadBuffer(CLICK_PRIMARY);
    loadBuffer(CLICK_SECONDARY);
  }

  function onFirstGesture() {
    cleanupGestures();
    primeAudio();
    if (!muted) {
      if (pendingResume || !running) startAmbience();
    }
  }

  function cleanupGestures() {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.removeEventListener(ev, onFirstGesture);
    });
  }

  function armGestureRetry() {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, onFirstGesture, { passive: true });
    });
  }

  function boot() {
    syncToggleButtons();
    if (!muted) {
      startAmbience();           // may succeed directly (returning visitors)
    }
    // Always keep a gesture fallback armed in case autoplay was blocked.
    armGestureRetry();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
