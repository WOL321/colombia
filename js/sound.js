/* ============================================================
   Reino de Colombia · Imperial Sound System
   Runs on every page. Two layers:

   1) Forest ambience (Tayrona National Park field recordings,
      fran_marenco on Freesound, CC0): two dense-forest tracks
      cross-faded on a loop at very low volume. Playback state
      (muted or not + current position) is stored in
      localStorage so the soundscape resumes seamlessly across
      page changes without restarting. Autoplay policy is
      respected: audio only starts after the first user gesture.

   2) Wooden click (robo9418, CC0): a short, quiet organic tap
      played on navigation links and primary buttons. The mini
      click (cabled_mess, CC0) is kept as a fallback if the
      wooden file fails to load.

   Attribution (Creative Commons 0):
     https://freesound.org/people/fran_marenco/sounds/796625/
     https://freesound.org/people/fran_marenco/sounds/796623/
     https://freesound.org/people/Robo9418/sounds/840321/
     https://freesound.org/people/cabled_mess/sounds/370962/
   ============================================================ */
(function () {
  'use strict';

  var BASE = 'assets/audio/';
  var AMBIENCE_FILES = [
    BASE + '796625-fran-marenco-dense-forest.mp3',
    BASE + '796623-fran-marenco-dense-forest.mp3'
  ];
  var CLICK_FILE = BASE + '840321-robo9418-wooden-short-cli.mp3';
  var CLICK_FALLBACK = BASE + '370962-cabled-mess-click-01-mini.mp3';

  var LS_MUTED = 'co_site_muted';       // '1' when the visitor muted the site
  var LS_POS = 'co_amb_pos';            // JSON: { t: seconds, f: which deck }
  var LS_TS = 'co_amb_ts';              // Date.now() when position was saved

  var MASTER = 0.14;                    // ambience master ceiling (very quiet)
  var FADE = 4;                         // crossfade seconds between decks
  var STALE = 3 * 60 * 1000;            // resume window across pages: 3 min
  var SAVE_EVERY = 2;                   // persist position every 2 s
  var CLICK_VOL = 0.16;                 // wooden click level
  var CLICK_GAP = 70;                   // ms debounce between clicks

  function readPos() {
    try {
      var raw = localStorage.getItem(LS_POS);
      var ts = parseInt(localStorage.getItem(LS_TS), 10) || 0;
      if (!raw || !ts || Date.now() - ts > STALE) return null;
      var p = JSON.parse(raw);
      if (typeof p.t !== 'number' || p.t < 0) return null;
      return p;
    } catch (e) { return null; }
  }

  function savePos() {
    if (!deckA || !running) return;
    try {
      var live = deckA.el.currentTime >= deckB.el.currentTime ? deckA : deckB;
      localStorage.setItem(LS_POS, JSON.stringify({ t: live.el.currentTime, f: live === deckA ? 0 : 1 }));
      localStorage.setItem(LS_TS, String(Date.now()));
    } catch (e) { /* private mode etc. */ }
  }

  var deckA = { el: new Audio(AMBIENCE_FILES[0]), fadeIn: false };
  var deckB = { el: new Audio(AMBIENCE_FILES[1]), fadeIn: false };
  deckA.el.loop = true;
  deckB.el.loop = true;
  deckA.el.preload = 'auto';
  deckB.el.preload = 'auto';
  deckA.el.volume = 0;
  deckB.el.volume = 0;

  var running = false;
  var muted = false;
  try { muted = localStorage.getItem(LS_MUTED) === '1'; } catch (e) {}

  function setVol(deck, v) {
    deck.el.volume = Math.max(0, Math.min(MASTER, v));
  }

  function ramp(fromDeck, toDeck, fromV, toV, secs, done) {
    var steps = Math.max(1, Math.round((secs * 1000) / 100));
    var i = 0;
    var id = setInterval(function () {
      i++;
      var k = i / steps;
      setVol(fromDeck, fromV + (0 - fromV) * k);
      setVol(toDeck, toV + (MASTER - toV) * k);
      if (i >= steps) { clearInterval(id); if (done) done(); }
    }, 100);
  }

  function crossfade() {
    if (!running) return;
    var idle = deckA.fadeIn ? deckB : deckA;
    var busy = deckA.fadeIn ? deckA : deckB;
    idle.el.currentTime = 0;
    idle.el.play().catch(function () {});
    ramp(busy, idle, busy.el.volume, 0, FADE, function () {
      busy.el.pause();
      busy.el.volume = 0;
      busy.fadeIn = false;
      idle.fadeIn = true;
    });
  }

  function startAmbience() {
    if (running || muted) return;
    var pos = readPos();
    var first = deckA;
    if (pos && pos.f === 1) first = deckB;
    try { first.el.currentTime = pos ? pos.t : 0; } catch (e) {}
    first.el.play().then(function () {
      running = true;
      first.fadeIn = true;
      setVol(first, MASTER);
      setTimeout(crossfade, 45000);          // gentle rotation between takes
      setInterval(savePos, SAVE_EVERY * 1000);
    }).catch(function () {
      /* autoplay blocked: retry on next user gesture */
    });
  }

  function stopAmbience() {
    if (!running) return;
    savePos();
    deckA.el.pause();
    deckB.el.pause();
    deckA.el.volume = 0;
    deckB.el.volume = 0;
    deckA.fadeIn = false;
    deckB.fadeIn = false;
    running = false;
  }

  /* ---------- click layer ---------- */
  var clickPool = [];
  var lastClick = 0;

  function playClick() {
    var now = Date.now();
    if (now - lastClick < CLICK_GAP) return;
    lastClick = now;
    var el = null;
    for (var i = 0; i < clickPool.length; i++) {
      if (clickPool[i].ended || clickPool[i].currentTime === 0) { el = clickPool[i]; break; }
    }
    if (!el) {
      if (clickPool.length >= 6) return;
      el = new Audio(CLICK_FILE);
      el.addEventListener('error', function () {
        el.src = CLICK_FALLBACK;   // wooden click unavailable: use mini click
      });
      clickPool.push(el);
    }
    el.volume = CLICK_VOL;
    try {
      el.currentTime = 0;
      el.play().catch(function () {});
    } catch (e) {}
  }

  /* ---------- mute / unmute control ---------- */
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
      try { localStorage.setItem(LS_MUTED, muted ? '1' : '0'); } catch (e) {}
      btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      btn.title = muted ? 'Unmute site sounds' : 'Mute site sounds';
      document.documentElement.classList.toggle('is-muted', muted);
      if (muted) { stopAmbience(); } else { startAmbience(); }
      playClick();
    });
    document.body.appendChild(btn);
    if (muted) document.documentElement.classList.add('is-muted');
  }

  /* ---------- interaction bootstrap (autoplay rules) ---------- */
  var CLICK_SELECTOR = 'a[href], button:not(#sound-toggle), .btn, .chip-btn, .bet-chip, .action-btn';

  function onFirstGesture() {
    startAmbience();
    cleanup();
  }

  function cleanup() {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.removeEventListener(ev, onFirstGesture);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest(CLICK_SELECTOR) : null;
    if (t) playClick();
  }, true);

  // Save position right before navigating away, for a seamless handoff.
  window.addEventListener('pagehide', savePos);

  document.addEventListener('DOMContentLoaded', function () {
    buildButton();
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, onFirstGesture, { once: false, passive: true });
    });
  });
})();
