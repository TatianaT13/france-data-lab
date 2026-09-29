"""Téléchargement des passages aux urgences par département (DREES, 2017-2023).

Étude figée (pas de flux continu) : l'URL est tout de même résolue dynamiquement
via l'identifiant stable du jeu de données data.gouv.fr, au cas où la DREES
publierait une version mise à jour.
"""

from pathlib import Path

import requests

DATASET_ID = "675b7bbf79cf8f76c2b02f3f"
DATASET_API_URL = f"https://www.data.gouv.fr/api/1/datasets/{DATASET_ID}/"

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_PATH = DATA_DIR / "raw" / "urgences" / "latest.csv"


def download_urgences(force: bool = True) -> Path:
    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    if RAW_PATH.exists() and not force:
        return RAW_PATH

    meta = requests.get(DATASET_API_URL, timeout=30).json()
    csv_resource = next(r for r in meta["resources"] if r.get("format", "").lower() == "csv")
    response = requests.get(csv_resource["url"], timeout=180)
    response.raise_for_status()
    RAW_PATH.write_bytes(response.content)
    return RAW_PATH
