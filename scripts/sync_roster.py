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
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MAP_BASE = "https://map.diplomaticamc.com"
MAP_WORLD = "minecraft_overworld"
NATION_FILTER = "Colombia"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "roster.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def fetch_markers_json(url: str) -> dict:
    """Fetch markers.json from the live map."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status != 200:
            raise RuntimeError(f"markers.json responded with HTTP {resp.status}")
        return json.loads(resp.read().decode("utf-8"))


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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", type=Path, help="Parse a local markers.json instead of fetching live")
    parser.add_argument("--nation", default=NATION_FILTER, help=f"Nation to filter by (default: {NATION_FILTER})")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH, help=f"Output path (default: {OUTPUT_PATH})")
    args = parser.parse_args()

    markers_data = load_markers_json(args.file) if args.file else fetch_markers_json(
        f"{MAP_BASE}/tiles/{MAP_WORLD}/markers.json"
    )

    towns = find_nation_towns(markers_data, args.nation)
    roster = build_roster(towns, args.nation)

    args.output.write_text(json.dumps(roster, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {roster['townCount']} towns ({roster['residentCount']} residents) to {args.output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print(f"Roster sync failed: {err}", file=sys.stderr)
        sys.exit(1)
