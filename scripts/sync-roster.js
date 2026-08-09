// Fetches the live Towny/Dynmap marker feed using a real headless browser
// (since a plain HTTP request gets blocked with 403, likely due to the map
// host blocking known cloud/CI IP ranges), filters it down to this nation's
// towns and residents, and writes a small same-origin JSON file the website
// can read without hitting any CORS restrictions.
//
// Run manually with: node scripts/sync-roster.js
// Run automatically by: .github/workflows/sync-roster.yml (every 5 minutes)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DYNMAP_MARKERS_URL = 'https://map.diplomaticamc.com/tiles/minecraft_overworld/markers.json';
const NATION_FILTER = 'Colombia';
const OUTPUT_PATH = path.join(__dirname, '..', 'roster.json');

async function fetchMarkersViaBrowser(url) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    if (!response) {
      throw new Error('No response from page.goto');
    }
    if (!response.ok()) {
      throw new Error(`Map feed responded with ${response.status()} ${response.statusText()}`);
    }
    const text = await response.text();
    return JSON.parse(text);
  } finally {
    await browser.close();
  }
}

async function main() {
  const data = await fetchMarkersViaBrowser(DYNMAP_MARKERS_URL);

  const claimsLayer = (data.layers || []).find(l => l.id === 'towny_claims');
  if (!claimsLayer) {
    throw new Error('No "towny_claims" layer found in the map feed — has the map plugin changed?');
  }

  const towns = claimsLayer.markers
    .filter(m => m.meta && m.meta['%nation%'] === NATION_FILTER && m.meta['%town%'])
    .map(m => {
      const rawResidents = (m.meta['%residents%'] || m.meta['%mayor%'] || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      return {
        name: (m.meta['%town%'] || '').replace(/_/g, ' '),
        residents: rawResidents.map(username => ({ username })),
      };
    })
    .filter(t => t.name && t.residents.length)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!towns.length) {
    throw new Error(`No towns matched nation "${NATION_FILTER}" — check the filter or map data.`);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    nation: NATION_FILTER,
    townCount: towns.length,
    residentCount: towns.reduce((sum, t) => sum + t.residents.length, 0),
    towns,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote ${towns.length} towns (${output.residentCount} residents) to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Roster sync failed:', err.message);
  process.exit(1);
});
