"""Pipeline fuites de données : télécharge, agrège, écrit le JSON du site."""

import json
from datetime import datetime, timezone
from pathlib import Path

from src.extract.fuites import download_fuites
from src.transform.fuites import build_all

ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT / "data" / "processed"
WEBSITE_DATA_DIR = ROOT / "website" / "data"


def build() -> None:
    print("[fuites] téléchargement...")
    raw_path = download_fuites()
    result = build_all(raw_path)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)

    for name, payload in [
        ("fuites_meta.json", result["meta"]),
        ("fuites_monthly.json", result["monthly"]),
        ("fuites_sectors.json", result["sectors"]),
        ("fuites_taille.json", result["taille"]),
        ("fuites_origines.json", result["origines"]),
        ("fuites_causes.json", result["causes"]),
        ("fuites_info.json", result["info"]),
    ]:
        text = json.dumps(payload, ensure_ascii=False)
        (WEBSITE_DATA_DIR / name).write_text(text)
        (PROCESSED_DIR / name).write_text(text)

    meta = result["meta"]
    meta_out = {**meta, "last_updated": datetime.now(timezone.utc).isoformat()}
    text = json.dumps(meta_out, ensure_ascii=False)
    (WEBSITE_DATA_DIR / "fuites_meta.json").write_text(text)
    (PROCESSED_DIR / "fuites_meta.json").write_text(text)

    print(f"[fuites] terminé : {meta['total']} notifications, dernier mois {meta['last_month']}")


if __name__ == "__main__":
    build()
