"""Téléchargement des Demandes de Valeurs Foncières (DVF) depuis data.gouv.fr.

Source : geo-dvf (Etalab), fichiers annuels nationaux.
https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/full.csv.gz
"""

from pathlib import Path

import requests

DVF_BASE_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv"
GEOJSON_URL = (
    "https://raw.githubusercontent.com/gregoiredavid/france-geojson/"
    "master/departements-version-simplifiee.geojson"
)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw" / "dvf"
GEO_PATH = DATA_DIR / "raw" / "departements.geojson"


def download_year(year: int, force: bool = False) -> Path:
    """Télécharge le fichier DVF national d'une année (mis en cache localement)."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = RAW_DIR / f"{year}.csv.gz"
    if dest.exists() and not force:
        return dest

    url = f"{DVF_BASE_URL}/{year}/full.csv.gz"
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    dest.write_bytes(response.content)
    return dest


def download_geojson(force: bool = False) -> Path:
    """Télécharge le contour géographique des départements français."""
    GEO_PATH.parent.mkdir(parents=True, exist_ok=True)
    if GEO_PATH.exists() and not force:
        return GEO_PATH

    response = requests.get(GEOJSON_URL, timeout=60)
    response.raise_for_status()
    GEO_PATH.write_bytes(response.content)
    return GEO_PATH
