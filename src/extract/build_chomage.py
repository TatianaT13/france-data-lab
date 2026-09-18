"""Pipeline chômage : télécharge, nettoie, écrit les JSON pour le site."""

import json
import shutil
from datetime import datetime, timezone

from src.extract.chomage import DATA_DIR, download_chomage
from src.extract.dvf import GEO_PATH, download_geojson
from src.transform.chomage import load_chomage

PROCESSED_DIR = DATA_DIR / "processed"
WEBSITE_DATA_DIR = DATA_DIR.parent / "website" / "data"


def build() -> None:
    print("[chomage] téléchargement...")
    raw_path = download_chomage()
    result = load_chomage(raw_path)

    departements = result["departements"]
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    departements.to_csv(PROCESSED_DIR / "chomage_dept.csv", index=False)

    download_geojson()

    WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    (WEBSITE_DATA_DIR / "chomage_dept.json").write_text(
        departements.to_json(orient="records")
    )
    shutil.copyfile(GEO_PATH, WEBSITE_DATA_DIR / "departements.geojson")

    meta = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "labels": result["labels"],
        "national": {k: v for k, v in result["national"].items()},
    }
    (WEBSITE_DATA_DIR / "chomage_meta.json").write_text(json.dumps(meta, indent=2))
    (PROCESSED_DIR / "chomage_meta.json").write_text(json.dumps(meta, indent=2))

    print(f"[chomage] terminé : {len(departements)} départements, {result['labels']['actuel']}")


if __name__ == "__main__":
    build()
