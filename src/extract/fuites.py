"""Téléchargement des notifications de violations de données à la CNIL (fuites de données).

Source : data.gouv.fr, republiée périodiquement par la CNIL. Le nom du fichier CSV change
à chaque publication (suffixe de date), donc on résout la ressource dynamiquement via
l'identifiant stable du jeu de données.
"""

from pathlib import Path

import requests

DATASET_ID = "5cd42a86634f4147a23df1be"
DATASET_API_URL = f"https://www.data.gouv.fr/api/1/datasets/{DATASET_ID}/"

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_PATH = DATA_DIR / "raw" / "fuites" / "latest.csv"


def download_fuites(force: bool = True) -> Path:
    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    if RAW_PATH.exists() and not force:
        return RAW_PATH

    meta = requests.get(DATASET_API_URL, timeout=30).json()
    csv_resource = next(r for r in meta["resources"] if r.get("format", "").lower() == "csv")
    response = requests.get(csv_resource["url"], timeout=120)
    response.raise_for_status()
    RAW_PATH.write_bytes(response.content)
    return RAW_PATH
