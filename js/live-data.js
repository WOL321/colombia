/* ==========================================================================
   LiveData — one small store that always has data.

   Rules baked in here:
   - Tries the live JSON first (cache-busted + no-store so the CDN can never
     hand back a stale copy); on any failure falls back to the committed
     snapshot. The UI is never left showing "0" or an infinite spinner.
   - Timestamps are honest: every successful fetch is stamped with the
     browser's clock ("Updated 4 minutes ago" = when WE last pulled good
     data), and the roster's own updatedAt is kept as serverUpdatedAt for
     the badge tooltip. A broken/future-dated updatedAt from the sync bot
     can never make the site claim "1 day ago" after a fresh pull.
   - Exposes subscribe(renderFn) so every section (hero stats, directory,
     map) renders from the same trusted source.
   - getStats() derives Towns / Citizens / Leaders from the town list,
     not from a separate endpoint that could drift out of sync.
   - Refreshes on page load, on a fixed interval, and immediately when the
     tab becomes visible again. Falls back to localStorage's last known
     good copy if both network sources fail, so the page never goes blank.
   ========================================================================== */
window.LiveData = (function () {
  'use strict';

  const config = window.SITE_CONFIG;
  const subscribers = [];

  const CACHE_KEY = 'colombiadmc:lastGoodRoster';

  let state = {
    data: null,        // current roster object being displayed
    source: 'pending', // 'live' | 'fallback' | 'cache' | 'pending'
    fetchedAt: null,   // Date (browser clock) of the last successful fetch
    serverUpdatedAt: null, // roster.updatedAt from the sync bot, for tooltips
    error: null,       // last error message, shown honestly in the status text
    empireStatus: loadStatusFromCache(), // {status, note, updatedAt} or null
  };

  /* ---------- helpers ---------- */

  // Cache-bust + no-store: GitHub Pages' CDN serves roster.json with
  // max-age=600, so without this a poll can return a ~10-minute-old copy
  // (or worse, a cached error). A unique query string forces origin fetch.
  function bustedUrl(url) {
    const param = config.CACHE_BUST_PARAM || '_';
    return url + (url.indexOf('?') === -1 ? '?' : '&') + param + '=' + Date.now();
  }

  async function fetchJson(url, opts) {
    const options = Object.assign({ cache: 'no-store' }, opts || {});
    const timeoutMs = config.FETCH_TIMEOUT_MS || 10000;

    // Abort slow requests instead of letting the page hang on "Syncing…".
    let timer = null;
    if (typeof AbortController === 'function') {
      const controller = new AbortController();
      options.signal = controller.signal;
      timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    }

    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (timer) clearTimeout(timer);
      return json;
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('timed out');
      throw err;
    }
  }

  // Some ancient browsers lack AbortController; keep a simple fallback path.
  async function fetchJsonWithTimeout(url) {
    if (typeof AbortController === 'function') return fetchJson(url);
    const timeoutMs = config.FETCH_TIMEOUT_MS || 10000;
    return Promise.race([
      fetchJson(url),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('timed out')); }, timeoutMs);
      }),
    ]);
  }

  // A roster is only usable if it actually has towns. Guards against a
  // half-written or empty live.json replacing good fallback data.
  function isUsable(roster) {
    return !!(roster && Array.isArray(roster.towns) && roster.towns.length > 0);
  }

  // Sanity-check the bot's updatedAt: only trust it if it parses to a real
  // past-or-now date. Otherwise we rely purely on our own fetch clock.
  function parseServerStamp(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    // Future-dated (clock skew) → untrustworthy.
    if (d.getTime() > Date.now() + 5 * 60 * 1000) return null;
    return d;
  }

  function deriveLeaders(roster) {
    // One leader per town (first resident listed) + the king.
    const leaders = new Set();
    if (config.KING) leaders.add(config.KING);
    roster.towns.forEach(function (town) {
      if (town.residents && town.residents[0]) leaders.add(town.residents[0].username);
    });
    return leaders.size;
  }

  /* ---------- localStorage: last known good copy ---------- */

  function saveToCache(roster, fetchedAtIso) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({
        roster: roster,
        fetchedAt: fetchedAtIso,
      }));
    } catch (e) { /* storage full/blocked — non-fatal */ }
  }

  function loadFromCache() {
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !isUsable(parsed.roster)) return null;
      return parsed;
    } catch (e) { return null; }
  }

  /* ---------- Empire Status (Stable / Expanding / Quiet) ---------- */

  // Single source of truth for the status indicator: data/empire-status.json
  // (edit that file and push — live first, committed snapshot as fallback).
  // Every page renders from here so the label can never disagree between them.
  const STATUS_KEY   = 'colombiadmc:empireStatus';
  const STATUS_VALID = ['Stable', 'Expanding', 'Quiet'];

  function normalizeStatus(obj) {
    if (!obj) return null;
    const s = typeof obj === 'string' ? { status: obj } : obj;
    let status = String(s.status || '').trim();
    STATUS_VALID.forEach(function (v) { if (v.toLowerCase() === status.toLowerCase()) status = v; });
    if (STATUS_VALID.indexOf(status) === -1) return null;
    return {
      status: status,
      note: typeof s.note === 'string' ? s.note.slice(0, 240) : '',
      updatedAt: s.updatedAt || null,
    };
  }

  function saveStatus(value) {
    try { window.localStorage.setItem(STATUS_KEY, JSON.stringify(value)); } catch (e) {}
  }

  function loadStatusFromCache() {
    try { return normalizeStatus(JSON.parse(window.localStorage.getItem(STATUS_KEY))); }
    catch (e) { return null; }
  }

  async function tryLoadStatusLive() {
    const roster = await fetchJsonWithTimeout(bustedUrl(config.EMPIRE_STATUS_URL));
    const value = normalizeStatus(roster);
    if (!value) throw new Error('status file unusable');
    return value;
  }

  async function tryLoadStatusFallback() {
    const roster = await fetchJsonWithTimeout(config.EMPIRE_STATUS_FALLBACK_URL);
    const value = normalizeStatus(roster);
    if (!value) throw new Error('status snapshot unusable');
    return value;
  }

  async function loadStatus() {
    try {
      const value = await tryLoadStatusLive();
      state.empireStatus = value;
      saveStatus(value);
      notify();
      return;
    } catch (e) { /* fall through to snapshot */ }
    try {
      const value = await tryLoadStatusFallback();
      state.empireStatus = value;
      saveStatus(value);
      notify();
      return;
    } catch (e2) {
      console.warn('[LiveData] empire status unavailable; keeping last known value.', e2);
      // Keep whatever we already had (in-memory or cached at boot) — never blank it.
      notify();
    }
  }

  /* ---------- applying data ---------- */

  function applyRoster(roster, source) {
    state.data = roster;
    state.source = source;
    // Honest timestamp: the moment THIS browser successfully got the data.
    state.fetchedAt = new Date();
    state.serverUpdatedAt = parseServerStamp(roster.updatedAt);
    state.error = null;
    if (source !== 'cache') saveToCache(roster, state.fetchedAt.toISOString());
    notify();
  }

  /* ---------- load chain ---------- */

  async function tryLoadLive() {
    const roster = await fetchJsonWithTimeout(bustedUrl(config.LIVE_DATA_URL));
    if (!isUsable(roster)) throw new Error('live roster unusable (no towns)');
    return roster;
  }

  async function tryLoadFallback() {
    const roster = await fetchJsonWithTimeout(config.FALLBACK_DATA_URL);
    if (!isUsable(roster)) throw new Error('snapshot unusable (no towns)');
    return roster;
  }

  let loading = false;

  async function load(showLoadingState) {
    if (loading) return; // never stack overlapping refreshes
    loading = true;

    if (showLoadingState && !state.data) {
      // First paint before any network result: show locally cached good
      // data immediately (if present) so nothing ever looks empty.
      const cached = loadFromCache();
      if (cached) {
        state.data = cached.roster;
        state.source = 'cache';
        state.fetchedAt = new Date(cached.fetchedAt) || new Date();
        state.serverUpdatedAt = parseServerStamp(cached.roster.updatedAt);
        notify();
      } else {
        notify(); // paint skeleton once
      }
    }

    let lastError = null;
    try {
      const roster = await tryLoadLive();
      loading = false;
      applyRoster(roster, 'live');
      return;
    } catch (liveError) {
      lastError = liveError;
    }

    try {
      const roster = await tryLoadFallback();
      loading = false;
      applyRoster(roster, 'fallback');
      return;
    } catch (fallbackError) {
      console.warn('[LiveData] live + snapshot both failed; keeping last known data.',
                   lastError, fallbackError);
      state.error = String((lastError && lastError.message) || lastError || 'fetch failed');
      loading = false;
      // If we still have data on screen (from an earlier fetch or cache),
      // keep it. Only if the screen is truly empty do we re-notify so the
      // UI can show an honest "unavailable" state instead of spinning.
      if (!state.data) notify();
    }
  }

  /* ---------- pub/sub ---------- */

  function notify() {
    subscribers.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error('[LiveData] subscriber error', e); }
    });
  }

  function subscribe(renderFn) {
    subscribers.push(renderFn);
    renderFn(state); // late subscribers get current data (or pending) now
  }

  /* ---------- public API ---------- */

  function getStats() {
    const roster = state.data;
    if (!roster) return null;
    const citizens = roster.towns.reduce(function (sum, town) {
      return sum + (town.residents ? town.residents.length : 0);
    }, 0);
    const actualTowns = roster.towns.length;
    const actualCitizens = citizens;
    // If the file's declared counts disagree with its contents, trust the
    // contents — stats and directory are derived from the SAME array, so
    // the hero numbers and the citizen list can never drift apart.
    return {
      towns: actualTowns,
      citizens: actualCitizens,
      leaders: deriveLeaders(roster),
      declaredTownCount: roster.townCount || null,
      declaredResidentCount: roster.residentCount || null,
    };
  }

  function getState() { return state; }

  /* ---------- kick off + background refresh ---------- */

  load(true);
  loadStatus();

  setInterval(function () { load(false); }, config.REFRESH_INTERVAL_MS || 120000);
  setInterval(function () { loadStatus(); }, config.STATUS_REFRESH_INTERVAL_MS || 600000);

  // Re-sync as soon as the visitor comes back to the tab — they should
  // never stare at hours-old numbers after switching away and back.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { load(false); loadStatus(); }
  });

  return { subscribe, getStats, getState, refresh: function () { load(false); } };
})();
