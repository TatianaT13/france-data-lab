"""Pipeline hôpitaux : télécharge, agrège, écrit le JSON du site."""

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from src.extract.dvf import GEO_PATH as DEPT_GEO_PATH
from src.extract.energie import REGIONS_GEO_PATH, download_regions_geojson
from src.extract.hopitaux import download_hopitaux
from src.transform.hopitaux import build_all

ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT / "data" / "processed"
WEBSITE_DATA_DIR = ROOT / "website" / "data"


def build() -> None:
    print("[hopitaux] téléchargement...")
    paths = download_hopitaux()
    result = build_all(paths["esatis"], paths["qualhas"])

    download_regions_geojson()

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)

    for name, payload in [
        ("hopitaux_esatis_classement.json", result["esatis_classement"]),
        ("hopitaux_icsha_classement.json", result["icsha_classement"]),
        ("hopitaux_esatis_region.json", result["esatis_region"]),
        ("hopitaux_icsha_region.json", result["icsha_region"]),
        ("hopitaux_esatis_top.json", result["esatis_top"]),
    ]:
        text = json.dumps(payload, ensure_ascii=False)
        (WEBSITE_DATA_DIR / name).write_text(text)
        (PROCESSED_DIR / name).write_text(text)

    meta = {**result["meta"], "last_updated": datetime.now(timezone.utc).isoformat()}
    text = json.dumps(meta, ensure_ascii=False)
    (WEBSITE_DATA_DIR / "hopitaux_meta.json").write_text(text)
    (PROCESSED_DIR / "hopitaux_meta.json").write_text(text)

    shutil.copyfile(REGIONS_GEO_PATH, WEBSITE_DATA_DIR / "regions.geojson")
    if not (WEBSITE_DATA_DIR / "departements.geojson").exists():
        shutil.copyfile(DEPT_GEO_PATH, WEBSITE_DATA_DIR / "departements.geojson")

    print(f"[hopitaux] terminé : {meta['n_esatis']} ES notés e-Satis, {meta['n_icsha']} ES notés ICSHA")


if __name__ == "__main__":
    build()
