// roster-core.js
//
// Shared logic for pulling this nation's towns + residents from the
// DiplomaticaMC live map. Used by BOTH the browser (index.html) and the
// Node-based GitHub Actions sync script (scripts/sync-roster.js), so the
// fetch/parse logic only has to be correct in one place.
//
// CONFIRMED SCHEMA (verified against a real markers.json pull from
// map.diplomaticamc.com on 2026-08-14 — do not re-guess this, check a fresh
// pull from the live map first if it ever needs changing):
//
//   GET {mapBase}/tiles/{world}/markers.json
//   -> { "layers": [ { "id": "towny_claims", "markers": [ ... ] }, ... ] }
//
// Each marker in the "towny_claims" layer looks like:
//   {
//     "meta": {
//       "%town%": "Cali",
//       "%nation%": "Colombia",        // "" if no nation; underscores for spaces (e.g. "The_Commonwealth")
//       "%mayor%": "LukasKung",
//       "%residents%": "LukasKung, Someone_Else",   // comma-separated, mayor NOT guaranteed first
//       ...
//     },
//     "point": { "x": ..., "z": ... },
//     ...
//   }
//
// This is a single request — there is no separate per-layer endpoint here.
// (An earlier version of this file incorrectly assumed squaremap's
// documented two-step tiles API; that does not match what this server
// actually serves at this URL. Verified directly against a live pull —
// see git history if curious.)

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RosterCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function parseTownMarker(marker) {
    const meta = marker.meta || {};
    const name = (meta['%town%'] || '').replace(/_/g, ' ');
    const nation = meta['%nation%'] || '';
    const mayor = meta['%mayor%'] || '';

    const residentNames = (meta['%residents%'] || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // The site tags residents[0] as "Mayor of <town>" positionally, so the
    // mayor has to be placed first deliberately — %residents% isn't
    // guaranteed to list the mayor first.
    const ordered = mayor && residentNames.includes(mayor)
      ? [mayor, ...residentNames.filter(r => r !== mayor)]
      : (mayor ? [mayor, ...residentNames] : residentNames);

    return { name, nation, residents: ordered.map(username => ({ username })) };
  }

  // Fetches this nation's towns from the map, returned as
  // [{ name, residents: [{ username }] }], sorted alphabetically, mayor
  // always first within each town. Throws if nothing matches.
  //
  // fetchImpl must behave like the Fetch API: (url) => Promise<{ ok, status, json() }>
  async function fetchNationTowns(fetchImpl, { mapBase, world, nation }) {
    const res = await fetchImpl(`${mapBase}/tiles/${world}/markers.json`);
    if (!res.ok) throw new Error(`markers.json responded with ${res.status}`);
    const data = await res.json();

    const layers = Array.isArray(data.layers) ? data.layers : [];
    const claimsLayer = layers.find(l => l.id === 'towny_claims');
    if (!claimsLayer) {
      throw new Error('No "towny_claims" layer found in markers.json — has the map plugin changed?');
    }

    const towns = (claimsLayer.markers || [])
      .map(parseTownMarker)
      .filter(t => t.name && t.nation === nation && t.residents.length)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!towns.length) {
      throw new Error(`No towns matched nation "${nation}" in the "towny_claims" layer.`);
    }
    return towns;
  }

  return { fetchNationTowns, parseTownMarker };
});
