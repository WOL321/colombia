# Reino de Colombia — site rebuild

Built from scratch. No code copied from the old site. Static HTML + CSS +
vanilla JS, deployable to any host (GitHub Pages works as-is).

## File structure

```
rebuild/
├── index.html                  # All sections, semantic markup
├── css/
│   └── main.css                # Tokens → base → components → sections (in page order)
├── js/
│   ├── config.js               # Every external URL / tunable in one place
│   ├── live-data.js            # LiveData store: fetch → validate → fallback → pub/sub
│   ├── main.js                 # Page behaviour (header, reveals, hero stats)
│   ├── directory.js            # Citizens & towns search/filter        [step 6]
│   └── grants.js               # Grant form → Discord webhook          [step 7]
├── data/
│   └── roster.snapshot.json    # Last known good data shipped with the site
└── assets/
    ├── escudo.png              # Coat of arms (falls back to Wikimedia if missing)
    ├── maicao-*.webp           # Capital showcase shots                 [step 2]
    └── towns/*.webp            # Featured town screenshots              [step 3]
```

## Data rules (hard requirement)

- `LiveData` tries the live roster first (`config.LIVE_DATA_URL`).
- On **any** failure it loads `data/roster.snapshot.json` instead.
- If both fail, the screen keeps the last rendered numbers. It never
  shows `0`, and it never sits on an endless "loading…".
- Stats are derived from the town list itself (towns, residents, unique
  mayors + king), so they can't drift out of sync with a second endpoint.
- Background refresh every 5 min while the tab is open; the strip shows
  "Updated X minutes ago" from the roster's own timestamp.

## Editing later

- Colors/fonts/spacing: only in the `:root` tokens at the top of `main.css`.
- URLs, capital name, king, webhook: only in `js/config.js`.
- Each section = one `<section>` block in `index.html` + one numbered
  block in `main.css` + (if interactive) its own small JS file.

## Status

| Section                       | State |
|-------------------------------|-------|
| 1. Hero (live stats, crest)   | ✅ done, awaiting approval |
| 2. Capital showcase — Maicao  | next |
| 3. Featured towns             | next |
| 4. Imperial cabinet           | next |
| 5. Territory / map            | next |
| 6. Citizens & towns directory | next |
| 7. Grants & how to join       | next |
