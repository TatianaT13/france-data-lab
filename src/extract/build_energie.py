"""Pipeline énergie : télécharge éCO2mix (RTE), calcule les indicateurs, écrit le JSON du site."""

import json
from datetime import datetime, timezone
from pathlib import Path

from src.extract.energie import (
    download_regions_geojson,
    fetch_national_history,
    fetch_national_latest,
    fetch_regional_latest,
)
from src.transform.energie import build_neighbor_exchanges, clean_national_record, clean_regional_record

ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT / "data" / "processed"
WEBSITE_DATA_DIR = ROOT / "website" / "data"


def build(history_hours: int = 48) -> None:
    print("[energie] téléchargement du relevé national...")
    latest_raw = fetch_national_latest()
    latest = clean_national_record(latest_raw)
    exchanges = build_neighbor_exchanges(latest_raw)

    print("[energie] téléchargement de l'historique national...")
    history_raw = fetch_national_history(hours=history_hours)
    history = [clean_national_record(r) for r in history_raw]

    print("[energie] téléchargement des relevés régionaux...")
    regional_raw = fetch_regional_latest()
    regional = [clean_regional_record(r) for r in regional_raw]

    download_regions_geojson()

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)

    for name, payload in [
        ("energie_latest.json", latest),
        ("energie_exchanges.json", exchanges),
        ("energie_history.json", history),
        ("energie_regional.json", regional),
    ]:
        text = json.dumps(payload)
        (WEBSITE_DATA_DIR / name).write_text(text)
        (PROCESSED_DIR / name).write_text(text)

    import shutil

    shutil.copyfile(ROOT / "data" / "raw" / "regions.geojson", WEBSITE_DATA_DIR / "regions.geojson")

    meta = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "history_hours": history_hours,
        "latest_mesure": latest["date_heure"],
    }
    (WEBSITE_DATA_DIR / "energie_meta.json").write_text(json.dumps(meta))
    (PROCESSED_DIR / "energie_meta.json").write_text(json.dumps(meta))

    print(f"[energie] terminé : {len(history)} points d'historique, {len(regional)} régions")


if __name__ == "__main__":
    build()
