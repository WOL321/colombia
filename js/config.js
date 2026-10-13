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

  // How often the open page re-checks the live file (ms).
  REFRESH_INTERVAL_MS: 5 * 60 * 1000,

  // Nation identity constants used across sections.
  CAPITAL: 'Maicao',
  KING: 'ueq_',

  DISCORD_INVITE: 'https://discord.gg/YUyHgnpXwj',
  SERVER_IP: 'play.diplomaticamc.com',

  // Grant form posts here. Paste your Discord webhook URL when ready;
  // until then the form validates and tells the user to ping staff in
  // Discord instead of silently failing.
  WEBHOOK_URL: '',
};
