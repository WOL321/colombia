/* ============================================================
   Reino de Colombia · Sound page shim  (v3)
   The real engine lives in /assets/js/sound-system.js (loaded
   early in <head> on every page). This file only guarantees a
   mute/unmute "Sound" button exists in the page: if an author
   has already placed one with id="sound-toggle" in the HTML,
   sound-system.js wires it via window.toggleSound(); otherwise
   this shim creates the standard component. It adds no audio
   logic of its own, so there is exactly ONE ambience engine and
   ONE click pipeline site-wide — no double sounds, no restarts.

   Attribution (Creative Commons 0):
     https://freesound.org/people/fran_marenco/sounds/796625/
     https://freesound.org/people/fran_marenco/sounds/796623/
     https://freesound.org/people/Robo9418/sounds/840321/
     https://freesound.org/people/cabled_mess/sounds/370962/
   ============================================================ */
(function () {
  'use strict';

  var CSS = [
    '#sound-toggle{position:fixed;left:1.25rem;bottom:1.25rem;z-index:9998;',
    'display:inline-flex;align-items:center;gap:.5rem;padding:.6rem 1rem;',
    'border-radius:999px;border:1px solid rgba(201,162,39,.55);',
    'background:rgba(28,22,18,.85);color:#c9a227;font:inherit;font-size:.85rem;',
    'letter-spacing:.04em;cursor:pointer;backdrop-filter:blur(6px);',
    'transition:background .3s ease,color .3s ease,transform .2s ease}',
    '#sound-toggle:hover{background:#c9a227;color:#1c1612;transform:translateY(-1px)}',
    '#sound-toggle .snd-icon{display:none;flex-shrink:0}',
    'html:not(.is-muted) #sound-toggle .snd-on{display:block}',
    'html.is-muted #sound-toggle .snd-off{display:block}',
    '@media (max-width:600px){#sound-toggle{left:1rem;bottom:1rem;padding:.55rem .8rem}',
    '#sound-toggle .snd-label{display:none}}'
  ].join('');

  var ICONS =
    '<svg class="snd-icon snd-on" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/>' +
    '<path d="M16.5 9.2a4 4 0 0 1 0 5.6"/>' +
    '<path d="M19 7a7.5 7.5 0 0 1 0 10"/></svg>' +
    '<svg class="snd-icon snd-off" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/>' +
    '<line x1="16.5" y1="9.5" x2="21" y2="14.5"/>' +
    '<line x1="21" y1="9.5" x2="16.5" y2="14.5"/></svg>';

  function ensureButton() {
    var btn = document.getElementById('sound-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'sound-toggle';
      btn.className = 'sound-toggle';
      btn.innerHTML = ICONS + '<span class="snd-label">Sound</span>';
      document.body.appendChild(btn);
    }
    // Wire the click handler exactly once (works for author-placed buttons
    // too). All mute logic is delegated to the global manager.
    if (!btn.hasAttribute('data-sound-wired')) {
      btn.setAttribute('data-sound-wired', '');
      btn.addEventListener('click', function () {
        if (typeof window.toggleSound === 'function') window.toggleSound();
      });
    }
    // Sync initial visual state (icon + aria + title) with persisted mute.
    // toggleSound(false) when already unmuted only refreshes the DOM —
    // startAmbience() returns early because playback is already running.
    if (typeof window.toggleSound === 'function') {
      var mutedNow = document.documentElement.classList.contains('is-muted');
      window.toggleSound(mutedNow ? true : false);
    } else {
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  function injectStyle() {
    if (document.getElementById('sound-toggle-style')) return;
    var s = document.createElement('style');
    s.id = 'sound-toggle-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function boot() {
    injectStyle();
    ensureButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
