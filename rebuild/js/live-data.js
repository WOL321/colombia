/* ==========================================================================
   LiveData — one small store that always has data.

   Rules baked in here:
   - Tries the live JSON first; on any failure falls back to the committed
     snapshot. The UI is never left showing "0" or an infinite spinner.
   - Exposes subscribe(renderFn) so every section (hero stats, directory,
     map) renders from the same trusted source.
   - getStats() derives Towns / Citizens / Leaders from the town list,
     not from a separate endpoint that could drift out of sync.
   ========================================================================== */
window.LiveData = (function () {
  'use strict';

  const config = window.SITE_CONFIG;
  const subscribers = [];

  let state = {
    data: null,        // current roster object being displayed
    source: 'pending', // 'live' | 'fallback' | 'pending'
    fetchedAt: null,   // Date when we pulled it (for "Updated X ago")
  };

  /* ---------- helpers ---------- */

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // A roster is only usable if it actually has towns. Guards against a
  // half-written or empty live.json replacing good fallback data.
  function isUsable(roster) {
    return roster && Array.isArray(roster.towns) && roster.towns.length > 0;
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

  /* ---------- load chain ---------- */

  async function tryLoadLive() {
    const roster = await fetchJson(config.LIVE_DATA_URL);
    if (!isUsable(roster)) throw new Error('live.json unusable');
    return roster;
  }

  async function load(showLoadingState) {
    if (showLoadingState && !state.data) notify(); // paint skeleton once

    let roster = null;
    let source = 'fallback';

    try {
      roster = await tryLoadLive();
      source = 'live';
    } catch (liveError) {
      try {
        roster = await fetchJson(config.FALLBACK_DATA_URL);
        source = 'fallback';
      } catch (fallbackError) {
        // Both failed: keep whatever we already had on screen.
        console.warn('[LiveData] refresh failed, keeping last known data.',
                     liveError, fallbackError);
        return;
      }
    }

    if (!isUsable(roster)) return; // refuse to overwrite good data with junk

    state.data = roster;
    state.source = source;
    state.fetchedAt = new Date();
    notify();
  }

  /* ---------- pub/sub ---------- */

  function notify() {
    subscribers.forEach(function (fn) { fn(state); });
  }

  function subscribe(renderFn) {
    subscribers.push(renderFn);
    if (state.data) renderFn(state); // late subscribers get current data now
  }

  /* ---------- public API ---------- */

  function getStats() {
    const roster = state.data;
    if (!roster) return null;
    const citizens = roster.towns.reduce(function (sum, town) {
      return sum + (town.residents ? town.residents.length : 0);
    }, 0);
    return {
      towns: roster.townCount || roster.towns.length,
      citizens: roster.residentCount || citizens,
      leaders: deriveLeaders(roster),
    };
  }

  function getState() { return state; }

  // Kick things off + background refresh.
  load(true);
  setInterval(function () { load(false); }, config.REFRESH_INTERVAL_MS);

  return { subscribe, getStats, getState };
})();
