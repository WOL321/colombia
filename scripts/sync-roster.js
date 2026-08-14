// Fetches the live markers.json feed using a real headless browser (a plain
// HTTP request gets blocked with 403 — Cloudflare's bot protection rejects
// the GitHub Actions IP ranges), filters it down to this nation's towns and
// residents via the shared roster-core.js, and writes a small same-origin
// JSON file the website can read without hitting any CORS restrictions.
//
// Run manually with: node scripts/sync-roster.js
// Run automatically by: .github/workflows/sync-roster.yml (every 5 minutes)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const RosterCore = require('../roster-core.js');

const MAP_BASE = 'https://map.diplomaticamc.com';
const MAP_WORLD = 'minecraft_overworld';
const NATION_FILTER = 'Colombia';
const OUTPUT_PATH = path.join(__dirname, '..', 'roster.json');

// Wraps a Playwright browser context as a fetch()-shaped function so
// roster-core.js's parsing logic can stay identical between the browser and
// this Node script -- no second copy of the parsing rules to keep in sync.
function makeBrowserFetch(context) {
  return async function fetchImpl(url) {
    const page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      if (!response) throw new Error(`No response from page.goto(${url})`);
      const status = response.status();
      const ok = response.ok();
      const text = await response.text();
      return { ok, status, json: async () => JSON.parse(text) };
    } finally {
      await page.close();
    }
  };
}

async function main() {
  const browser = await chromium.launch();
  let towns;
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    });
    towns = await RosterCore.fetchNationTowns(makeBrowserFetch(context), {
      mapBase: MAP_BASE,
      world: MAP_WORLD,
      nation: NATION_FILTER,
    });
  } finally {
    await browser.close();
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
