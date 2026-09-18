"""Téléchargement du taux de chômage localisé par département (INSEE, via data.gouv.fr).

Le jeu de données est republié chaque trimestre par le Département de Seine-
Saint-Denis à partir des chiffres INSEE. On récupère l'URL de la ressource CSV
dynamiquement (plutôt que de coder en dur un lien qui changera de nom au
prochain trimestre) via l'identifiant stable du jeu de données data.gouv.fr.
"""

from pathlib import Path

import requests

DATASET_ID = "6a0eb9ef4780a16c39e21b76"
DATASET_API_URL = f"https://www.data.gouv.fr/api/1/datasets/{DATASET_ID}/"

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_PATH = DATA_DIR / "raw" / "chomage" / "latest.csv"


def download_chomage(force: bool = True) -> Path:
    """Télécharge le CSV le plus récent du jeu de données (toujours rafraîchi)."""
    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    if RAW_PATH.exists() and not force:
        return RAW_PATH

    meta = requests.get(DATASET_API_URL, timeout=30).json()
    csv_resource = next(
        r for r in meta["resources"] if r.get("format", "").lower() == "csv"
    )
    response = requests.get(csv_resource["url"], timeout=60)
    response.raise_for_status()
    RAW_PATH.write_bytes(response.content)
    return RAW_PATH
