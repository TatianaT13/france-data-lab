"""Téléchargement des données d'accidents corporels de la circulation (ONISR/BAAC).

Avant 2019, le format change trop (séparateur, encodage du département, "an" sur
2 chiffres) pour être traité par le même code : on se limite donc aux années
récentes, dont le format est stable. Les noms de fichiers ont plusieurs variantes
au fil des ans ("caracteristiques-2019.csv", "Caract_2024.csv",
"carcteristiques-2022.csv"...) : on les résout par motif plutôt qu'en codant en dur.
"""

import re
from pathlib import Path

import requests

DATASET_ID = "53698f4ca3a729239d2036df"
DATASET_API_URL = f"https://www.data.gouv.fr/api/1/datasets/{DATASET_ID}/"

MIN_YEAR = 2019  # format stable (séparateur ";", "an" sur 4 chiffres, dep en clair)

CARACT_RE = re.compile(r"^(caracteristiques|caract|carcteristiques|carct)[-_](\d{4})\.csv$", re.I)
USAGERS_RE = re.compile(r"^usagers[-_](\d{4})\.csv$", re.I)
LIEUX_RE = re.compile(r"^lieux[-_](\d{4})\.csv$", re.I)
VEHICULES_RE = re.compile(r"^vehicules[-_](\d{4})\.csv$", re.I)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw" / "accidents"


def _resource_filename(resource: dict) -> str:
    return (resource.get("title") or resource.get("url", "").rsplit("/", 1)[-1]).strip()


def resolve_resources() -> dict[int, dict[str, str]]:
    """Retourne {année: {"caract": url, "usagers": url, "lieux": url, "vehicules": url}}."""
    meta = requests.get(DATASET_API_URL, timeout=30).json()
    by_year: dict[int, dict[str, str]] = {}
    for resource in meta["resources"]:
        name = _resource_filename(resource)
        m = CARACT_RE.match(name)
        if m:
            year = int(m.group(2))
            if year >= MIN_YEAR:
                by_year.setdefault(year, {})["caract"] = resource["url"]
            continue
        m = USAGERS_RE.match(name)
        if m:
            year = int(m.group(1))
            if year >= MIN_YEAR:
                by_year.setdefault(year, {})["usagers"] = resource["url"]
            continue
        m = LIEUX_RE.match(name)
        if m:
            year = int(m.group(1))
            if year >= MIN_YEAR:
                by_year.setdefault(year, {})["lieux"] = resource["url"]
            continue
        m = VEHICULES_RE.match(name)
        if m:
            year = int(m.group(1))
            if year >= MIN_YEAR:
                by_year.setdefault(year, {})["vehicules"] = resource["url"]
    required = {"caract", "usagers", "lieux", "vehicules"}
    return {year: urls for year, urls in by_year.items() if required.issubset(urls)}


def download_year(year: int, urls: dict[str, str], force: bool = False) -> dict[str, Path]:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    paths = {}
    for kind, url in urls.items():
        dest = RAW_DIR / f"{kind}_{year}.csv"
        if not dest.exists() or force:
            response = requests.get(url, timeout=180)
            response.raise_for_status()
            dest.write_bytes(response.content)
        paths[kind] = dest
    return paths
