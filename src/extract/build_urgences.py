"""Pipeline urgences : télécharge, agrège, écrit le JSON du site."""

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from src.extract.dvf import GEO_PATH, download_geojson
from src.extract.urgences import download_urgences
from src.transform.urgences import build_all

ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT / "data" / "processed"
WEBSITE_DATA_DIR = ROOT / "website" / "data"


def build() -> None:
    print("[urgences] téléchargement...")
    raw_path = download_urgences()
    result = build_all(raw_path)

    download_geojson()

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)

    for name, payload in [
        ("urgences_weekly.json", result["weekly"]),
        ("urgences_dept_year.json", result["dept_year"]),
    ]:
        text = json.dumps(payload, ensure_ascii=False)
        (WEBSITE_DATA_DIR / name).write_text(text)
        (PROCESSED_DIR / name).write_text(text)

    meta = {**result["meta"], "last_updated": datetime.now(timezone.utc).isoformat()}
    text = json.dumps(meta, ensure_ascii=False)
    (WEBSITE_DATA_DIR / "urgences_meta.json").write_text(text)
    (PROCESSED_DIR / "urgences_meta.json").write_text(text)

    shutil.copyfile(GEO_PATH, WEBSITE_DATA_DIR / "departements.geojson")

    print(f"[urgences] terminé : {meta['total_passages']:,} passages estimés, {meta['date_min']} → {meta['date_max']}")


if __name__ == "__main__":
    build()
