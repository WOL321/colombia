// roster-core.js
//
// Shared logic for pulling this nation's towns + residents from the
// DiplomaticaMC live map. Used by BOTH the browser (index.html) and the
// Node-based GitHub Actions sync script (scripts/sync-roster.js), so the
// fetch/parse logic only has to be correct in one place.
//
// ROOT CAUSE OF THE PREVIOUS BREAKAGE:
// The old code (here and in scripts/sync-roster.js) assumed a Dynmap-style
// feed: `{ layers: [{ id: 'towny_claims', markers: [{ meta: {'%nation%': ...} }] }] }`.
// map.diplomaticamc.com runs squaremap, not Dynmap (confirmed via the map's
// own page template/meta tags, identical to squaremap's default). squaremap's
// actual API is two calls:
//   GET {mapBase}/tiles/{world}/markers.json       -> list of layers (key/label only)
//   GET {mapBase}/tiles/{world}/{layerKey}.json    -> the markers in that layer
// and there's no literal `%nation%`/`%town%` JSON field anywhere — those are
// MapTowny's (the Towny <-> squaremap bridge plugin) *template placeholders*.
// By the time squaremap serves a marker, MapTowny has already substituted
// them into a plain HTML popup string, e.g. (MapTowny's default click_tooltip.html):
//   <span>%town% (%nation%)</span> ... Mayor: %mayor% ... Residents: %residents%
// So nation/mayor/residents have to be parsed back out of that HTML instead
// of read off a metadata object that never existed.
//
// If DiplomaticaMC ever customizes their click_tooltip.html wording, only the
// regexes in parseTownMarker() below need to change.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RosterCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.markers)) return payload.markers;
    if (payload && typeof payload === 'object') return Object.values(payload);
    return [];
  }

  // squaremap's exact field name for a marker's popup HTML isn't nailed down
  // in public docs, so we check every plausible name MapTowny/squaremap could
  // be using rather than betting the whole feature on one guess.
  function popupHTMLFrom(marker) {
    const opts = marker.options || {};
    return (
      opts.popup || opts.popupContent || marker.popup || marker.popupContent ||
      opts.clickTooltip || marker.clickTooltip ||
      opts.tooltip || marker.tooltip || ''
    );
  }

  function htmlToLines(html) {
    if (!html) return [];
    const withBreaks = String(html).replace(/<\s*(br|\/p|\/div|\/li)[^>]*>/gi, '\n');
    const text = withBreaks.replace(/<[^>]+>/g, '');
    return text
      .split('\n')
      .map(l => l.replace(/&nbsp;/g, ' ').trim())
      .filter(Boolean);
  }

  function extractLine(lines, regex, group) {
    for (const line of lines) {
      const m = line.match(regex);
      if (m) return m[group || 1].trim();
    }
    return null;
  }

  // Parses one marker's popup into { name, nation, mayor, residents }.
  // Handles MapTowny's default "Town (Nation)" header line AND a standalone
  // "Nation:" line, in case DiplomaticaMC customized their tooltip template.
  function parseTownMarker(marker) {
    const lines = htmlToLines(popupHTMLFrom(marker));
    const opts = marker.options || {};

    let name = null;
    let nation = null;
    const headerMatch = (lines[0] || '').match(/^(.+?)\s*\(([^()]+)\)\s*$/);
    if (headerMatch) {
      name = headerMatch[1].trim();
      nation = headerMatch[2].trim();
    }

    nation = extractLine(lines, /nation\s*:\s*([^\n]+)/i) || nation;
    name = extractLine(lines, /^town\s*:\s*([^\n]+)/i) || name ||
      (typeof opts.tooltip === 'string' ? opts.tooltip.replace(/<[^>]+>/g, '').trim() : null) ||
      marker.key || marker.name || null;

    const mayor = extractLine(lines, /mayor\s*:\s*([^\n]+)/i);
    const residentsRaw = extractLine(lines, /residents?\s*(?:\(\s*\d+\s*\))?\s*:\s*([^\n]+)/i);
    const residentNames = residentsRaw
      ? residentsRaw.split(',').map(s => s.trim()).filter(Boolean)
      : (mayor ? [mayor] : []);

    // The site tags residents[0] as "Mayor of <town>" positionally, so the
    // mayor has to be placed first deliberately — the map's residents list
    // isn't guaranteed to be mayor-first.
    const ordered = mayor && residentNames.includes(mayor)
      ? [mayor, ...residentNames.filter(r => r !== mayor)]
      : residentNames;

    return {
      name,
      nation,
      residents: ordered.map(username => ({ username })),
    };
  }

  async function findTownyLayerKey(fetchImpl, mapBase, world, layerKeyOverride) {
    if (layerKeyOverride) return layerKeyOverride;
    const res = await fetchImpl(`${mapBase}/tiles/${world}/markers.json`);
    if (!res.ok) throw new Error(`markers.json responded with ${res.status}`);
    const layers = normalizeList(await res.json());
    const townLayer = layers.find(l => {
      const label = (l.label || '').toLowerCase();
      const key = (l.key || '').toLowerCase();
      return label.includes('town') || key.includes('town');
    });
    if (!townLayer) {
      throw new Error('Could not find a Towny layer in markers.json — pass layerKeyOverride, or MapTowny\'s layer name/key changed.');
    }
    return townLayer.key;
  }

  // Fetches this nation's towns from the map, returned as
  // [{ name, residents: [{ username }] }], sorted alphabetically, mayor
  // always first within each town. Throws if nothing matches.
  //
  // fetchImpl must behave like the Fetch API: (url) => Promise<{ ok, status, json() }>
  async function fetchNationTowns(fetchImpl, { mapBase, world, nation, layerKeyOverride }) {
    const layerKey = await findTownyLayerKey(fetchImpl, mapBase, world, layerKeyOverride);
    const res = await fetchImpl(`${mapBase}/tiles/${world}/${layerKey}.json`);
    if (!res.ok) throw new Error(`${layerKey}.json responded with ${res.status}`);
    const markers = normalizeList(await res.json());

    const towns = markers
      .map(parseTownMarker)
      .filter(t => t.name && t.nation && t.nation.toLowerCase() === nation.toLowerCase() && t.residents.length)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!towns.length) {
      throw new Error(`No towns matched nation "${nation}" in the "${layerKey}" layer.`);
    }
    return towns;
  }

  return { fetchNationTowns, parseTownMarker, normalizeList };
});
