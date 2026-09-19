"""Téléchargement des données éCO2mix (RTE) : consommation et mix de production électrique.

Source : opendata.reseaux-energies.fr (plateforme OpenDataSoft de RTE), sans authentification.
"""

from pathlib import Path

import requests

BASE = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets"
NATIONAL_DATASET = "eco2mix-national-tr"
REGIONAL_DATASET = "eco2mix-regional-tr"

REGIONS_GEOJSON_URL = (
    "https://raw.githubusercontent.com/gregoiredavid/france-geojson/"
    "master/regions-version-simplifiee.geojson"
)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
REGIONS_GEO_PATH = DATA_DIR / "raw" / "regions.geojson"

REGION_CODES = ["11", "24", "27", "28", "32", "44", "52", "53", "75", "76", "84", "93", "94"]


def _get(dataset: str, **params) -> dict:
    response = requests.get(f"{BASE}/{dataset}/records", params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def fetch_national_latest() -> dict:
    """Dernier relevé national avec des valeurs réelles (non prévisionnelles)."""
    data = _get(
        NATIONAL_DATASET,
        limit=1,
        order_by="date_heure desc",
        where="consommation is not null",
    )
    return data["results"][0]


def fetch_national_history(hours: int = 48) -> list[dict]:
    """Historique national des dernières `hours` heures, au pas de 15 minutes."""
    from datetime import datetime, timedelta, timezone

    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    records: list[dict] = []
    offset = 0
    while True:
        data = _get(
            NATIONAL_DATASET,
            limit=100,
            offset=offset,
            order_by="date_heure asc",
            where=f"date_heure > date'{since}' and consommation is not null",
        )
        batch = data["results"]
        records.extend(batch)
        if len(batch) < 100:
            break
        offset += 100
    return records


def fetch_regional_latest() -> list[dict]:
    """Dernier relevé réel disponible pour chaque région (indépendamment, certaines
    régions ayant un décalage de publication plus important que d'autres)."""
    records = []
    for code in REGION_CODES:
        data = _get(
            REGIONAL_DATASET,
            limit=1,
            order_by="date_heure desc",
            where=f"code_insee_region='{code}' and consommation is not null",
        )
        if data["results"]:
            records.append(data["results"][0])
    return records


def download_regions_geojson(force: bool = True) -> Path:
    REGIONS_GEO_PATH.parent.mkdir(parents=True, exist_ok=True)
    if REGIONS_GEO_PATH.exists() and not force:
        return REGIONS_GEO_PATH
    response = requests.get(REGIONS_GEOJSON_URL, timeout=60)
    response.raise_for_status()
    REGIONS_GEO_PATH.write_bytes(response.content)
    return REGIONS_GEO_PATH


def fetch_regional_yearly() -> list[dict]:
    """Moyennes annuelles par région (éCO2mix consolidé, depuis 2013), agrégées côté API."""
    select = (
        "code_insee_region, year(date_heure) as an, avg(consommation) as consommation, "
        "avg(thermique) as thermique, avg(nucleaire) as nucleaire, avg(solaire) as solaire, "
        "avg(hydraulique) as hydraulique, avg(bioenergies) as bioenergies, "
        "avg(eolien_terrestre) as eol_t, avg(eolien_offshore) as eol_o"
    )
    records, offset = [], 0
    while True:
        data = _get(
            "eco2mix-regional-cons-def",
            select=select,
            group_by="code_insee_region, year(date_heure)",
            order_by="an",
            limit=100,
            offset=offset,
        )
        batch = data["results"]
        records.extend(batch)
        if len(batch) < 100:
            break
        offset += 100
    return records
