/* ==========================================================================
   Config — single place to edit URLs, keys and tunables.
   Everything the site touches externally lives here, nowhere else.
   ========================================================================== */
window.SITE_CONFIG = {
  // Live roster produced by scripts/sync_roster.py (GitHub Actions cron),
  // served from the site root. Swap to your new endpoint here if it moves.
  LIVE_DATA_URL: 'https://colombiadmc.site/roster.json',

  // Committed fallback: last known good data. If the live fetch fails or
  // returns nothing usable, the site shows this instead — never zeros,
  // never an endless "loading".
  FALLBACK_DATA_URL: 'data/roster.snapshot.json',

  // CDN caching note: the Pages CDN serves roster.json with max-age=600,
  // so a plain reload can return a copy up to ~10 minutes old. The client
  // adds a fresh ?_=<timestamp> cache-buster to every poll and uses
  // cache:'no-store', which guarantees each request hits origin and gets
  // the newest committed file. Keep both if you change the URL above.
  CACHE_BUST_PARAM: '_',

  // How often the open page re-checks the live file (ms).
  REFRESH_INTERVAL_MS: 2 * 60 * 1000,

  // Give up on a slow fetch after this long (ms) so the page can fall back
  // to the last known good data instead of hanging on "Syncing…".
  FETCH_TIMEOUT_MS: 10 * 1000,

  // Nation identity constants used across sections.
  CAPITAL: 'Maicao',
  KING: '9_88',

  DISCORD_INVITE: 'https://discord.gg/YUyHgnpXwj',
  // Invite code only (used by the live member-count widget).
  DISCORD_INVITE_CODE: 'YUyHgnpXwj',
  SERVER_IP: 'play.diplomaticamc.com',

  // Grant form posts here. Paste your Discord webhook URL when ready;
  // until then the form validates and tells the user to ping staff in
  // Discord instead of silently failing.
  WEBHOOK_URL: '',
};
