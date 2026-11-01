#!/usr/bin/env python3
"""
Pulls this nation's towns + residents from the DiplomaticaMC live map and
writes roster.json — a same-origin snapshot the website reads as a fallback
when it can't fetch the map directly (CORS).

Mirrors roster-core.js's parsing logic (same markers.json schema, same
mayor-first resident ordering). If the map's data shape ever changes,
update both files together.

Usage:
    python3 scripts/sync_roster.py                     # fetches the live map
    python3 scripts/sync_roster.py --file markers.json  # parses a local copy instead

CONFIRMED SCHEMA (verified against a real markers.json pull from
map.diplomaticamc.com):

    GET {MAP_BASE}/tiles/{MAP_WORLD}/markers.json
    -> { "layers": [ { "id": "towny_claims", "markers": [ ... ] }, ... ] }

Each marker in the "towny_claims" layer has a "meta" dict with keys like
"%town%", "%nation%", "%mayor%", "%residents%" (comma-separated, mayor not
guaranteed to be listed first).
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MAP_BASE = "https://map.diplomaticamc.com"
MAP_WORLD = "minecraft_overworld"
NATION_FILTER = "Colombia"
REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "roster.json"
SNAPSHOT_PATH = REPO_ROOT / "data" / "roster.snapshot.json"
LASTGOOD_PATH = REPO_ROOT / "data" / "roster.lastgood.json"

# Optional cookie copied from a browser that passed the map's Cloudflare
# challenge (e.g. via a GitHub Actions secret). Without it the map may
# answer 403 — in that case the script keeps the last known good roster
# instead of failing the workflow.
CF_COOKIE = os.environ.get("MAP_COOKIE", "").strip()

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


class BlockedByWaf(Exception):
    """The map answered with an HTML anti-bot page instead of JSON."""


def _looks_like_challenge(body: bytes) -> bool:
    head = body[:2048].lstrip()
    return head.startswith(b"<") or b"Just a moment" in body or b"cloudflare" in body.lower()


def fetch_markers_json(url: str, attempts: int = 3) -> dict:
    """Fetch markers.json from the live map, with retries and jitter.

    Scheduled GitHub Actions runners get IPs that Cloudflare sometimes
    flags, so a few spaced-out retries are worthwhile. If every attempt
    comes back with an HTML challenge page we raise BlockedByWaf so the
    caller can fall back to the last known good data rather than commit
    garbage (or fail the whole run).
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": MAP_BASE + "/",
    }
    if CF_COOKIE:
        headers["Cookie"] = CF_COOKIE

    last_status = None
    for attempt in range(1, attempts + 1):
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"markers.json responded with HTTP {resp.status}")
                body = resp.read()
        except urllib.error.HTTPError as err:
            body = err.read() if err.fp else b""
            last_status = err.code
            if _looks_like_challenge(body):
                # Anti-bot page: retrying from the same IP rarely helps,
                # but one more spaced attempt is cheap.
                if attempt < attempts:
                    time.sleep(5 * attempt + random.uniform(0, 3))
                    continue
                raise BlockedByWaf(
                    f"map returned an anti-bot page (HTTP {err.code}). "
                    "Consider setting the MAP_COOKIE secret."
                ) from None
            raise RuntimeError(f"markers.json responded with HTTP {err.code}") from None

        if _looks_like_challenge(body):
            if attempt < attempts:
                time.sleep(5 * attempt + random.uniform(0, 3))
                continue
            raise BlockedByWaf(
                f"map returned an anti-bot page (HTTP 200). "
                "Consider setting the MAP_COOKIE secret."
            )
        return json.loads(body.decode("utf-8"))

    raise RuntimeError(f"markers.json fetch failed after {attempts} attempts (last HTTP {last_status})")


def load_markers_json(path: Path) -> dict:
    """Load markers.json from a local file instead of fetching it."""
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def parse_town(marker: dict) -> dict:
    """Turn one towny_claims marker into {name, nation, residents}."""
    meta = marker.get("meta", {})

    name = meta.get("%town%", "").replace("_", " ")
    nation = meta.get("%nation%", "")
    mayor = meta.get("%mayor%", "").strip()

    residents = [r.strip() for r in meta.get("%residents%", "").split(",") if r.strip()]

    # The website tags residents[0] as "Mayor of <town>" by position, so the
    # mayor has to be placed first on purpose — %residents% doesn't
    # guarantee that order.
    if mayor:
        residents = [mayor] + [r for r in residents if r != mayor]

    return {
        "name": name,
        "nation": nation,
        "residents": [{"username": r} for r in residents],
    }


def find_nation_towns(markers_data: dict, nation: str) -> list[dict]:
    """Filter and sort every town belonging to `nation`."""
    layers = markers_data.get("layers", [])
    claims_layer = next((layer for layer in layers if layer.get("id") == "towny_claims"), None)
    if claims_layer is None:
        raise RuntimeError('No "towny_claims" layer in markers.json — has the map plugin changed?')

    towns = [parse_town(marker) for marker in claims_layer.get("markers", [])]
    towns = [t for t in towns if t["name"] and t["residents"] and t["nation"] == nation]
    towns.sort(key=lambda t: t["name"])

    if not towns:
        raise RuntimeError(f'No towns matched nation "{nation}".')
    return towns


def build_roster(towns: list[dict], nation: str) -> dict:
    towns_out = [{"name": t["name"], "residents": t["residents"]} for t in towns]
    return {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "nation": nation,
        "townCount": len(towns_out),
        "residentCount": sum(len(t["residents"]) for t in towns_out),
        "towns": towns_out,
    }


def write_json(path: Path, roster: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(roster, indent=2) + "\n", encoding="utf-8")


def load_last_good() -> dict | None:
    """Return the last successfully scraped roster, if we have one."""
    for candidate in (LASTGOOD_PATH, OUTPUT_PATH):
        try:
            data = json.loads(candidate.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(data, dict) and data.get("towns"):
            return data
    return None


def keep_last_good(reason: str) -> None:
    """Scrape unavailable: keep the last known good numbers untouched and
    only refresh the committed fallback snapshot's note so the site's
    "Synced snapshot · <date>" badge stays honest. Never fabricate data."""
    last = load_last_good()
    if not last:
        print(f"BLOCKED: {reason} — and no previous roster exists to fall back to.",
              file=sys.stderr)
        sys.exit(1)
    note = ("Automated scrape blocked by the map's anti-bot protection; this "
            f"is the last verified data (originally synced {last.get('updatedAt', 'unknown')}).")
    stamped = dict(last)
    stamped["snapshotNote"] = note
    write_json(SNAPSHOT_PATH, stamped)
    print(f"WARN: {reason}", file=sys.stderr)
    print(f"WARN: kept last known good roster "
          f"({stamped.get('townCount')} towns / {stamped.get('residentCount')} residents).",
          file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", type=Path, help="Parse a local markers.json instead of fetching live")
    parser.add_argument("--nation", default=NATION_FILTER, help=f"Nation to filter by (default: {NATION_FILTER})")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH, help=f"Output path (default: {OUTPUT_PATH})")
    args = parser.parse_args()

    try:
        markers_data = load_markers_json(args.file) if args.file else fetch_markers_json(
            f"{MAP_BASE}/tiles/{MAP_WORLD}/markers.json"
        )
    except BlockedByWaf as err:
        if args.file:
            raise
        keep_last_good(str(err))
        return

    towns = find_nation_towns(markers_data, args.nation)
    roster = build_roster(towns, args.nation)

    write_json(args.output, roster)
    # Keep the fallback snapshot and last-good copy in step with every
    # successful scrape, so the files can never drift from reality.
    if args.output == OUTPUT_PATH:
        write_json(SNAPSHOT_PATH, roster)
        write_json(LASTGOOD_PATH, roster)
    print(f"Wrote {roster['townCount']} towns ({roster['residentCount']} residents) to {args.output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print(f"Roster sync failed: {err}", file=sys.stderr)
        sys.exit(1)
