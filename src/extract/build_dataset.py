"""Pipeline complet : télécharge les DVF, nettoie, agrège, écrit les CSV traités.

Utilisé par le dashboard (bouton "Actualiser") et par la CI hebdomadaire
(.github/workflows/update-data.yml).
"""

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

from src.extract.dvf import DATA_DIR, DVF_BASE_URL, GEO_PATH, download_geojson, download_year
from src.transform.dvf import aggregate_by_department, aggregate_by_month, load_year

FIRST_YEAR = 2021
DEFAULT_YEARS = None  # résolu dynamiquement : toutes les années publiées depuis FIRST_YEAR
PROCESSED_DIR = DATA_DIR / "processed"
WEBSITE_DATA_DIR = DATA_DIR.parent / "website" / "data"


def available_years() -> list[int]:
    """Années dont le fichier national DVF est publié (2021 -> année en cours)."""
    years = []
    for year in range(FIRST_YEAR, datetime.now().year + 1):
        with requests.get(f"{DVF_BASE_URL}/{year}/full.csv.gz", stream=True, timeout=30) as r:
            if r.status_code == 200:
                years.append(year)
    return years


def build(years: list[int] = None, force_download: bool = False) -> None:
    years = years or available_years()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    frames = []
    for year in years:
        print(f"[dvf] téléchargement {year}...")
        raw_path = download_year(year, force=force_download)
        print(f"[dvf] nettoyage {year}...")
        frames.append(load_year(raw_path, year))

    full = pd.concat(frames, ignore_index=True)

    by_dept = aggregate_by_department(full)
    by_month = aggregate_by_month(full)

    by_dept.to_csv(PROCESSED_DIR / "dvf_dept_year.csv", index=False)
    by_month.to_csv(PROCESSED_DIR / "dvf_month.csv", index=False)

    download_geojson()

    meta = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "years": years,
        "total_transactions": int(len(full)),
    }
    (PROCESSED_DIR / "dvf_meta.json").write_text(json.dumps(meta, indent=2))

    export_website_data(by_dept, by_month, meta)

    print(f"[dvf] terminé : {len(full):,} transactions sur {years}")


def export_website_data(by_dept: pd.DataFrame, by_month: pd.DataFrame, meta: dict) -> None:
    """Écrit les données agrégées en JSON pour le site statique (website/data/)."""
    WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)

    (WEBSITE_DATA_DIR / "dvf_dept_year.json").write_text(
        by_dept.to_json(orient="records")
    )
    (WEBSITE_DATA_DIR / "dvf_month.json").write_text(by_month.to_json(orient="records"))
    (WEBSITE_DATA_DIR / "meta.json").write_text(json.dumps(meta))
    shutil.copyfile(GEO_PATH, WEBSITE_DATA_DIR / "departements.geojson")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Construit le dataset DVF agrégé")
    parser.add_argument("--years", nargs="+", type=int, default=None)
    parser.add_argument("--force-download", action="store_true")
    args = parser.parse_args()
    build(years=args.years, force_download=args.force_download)
