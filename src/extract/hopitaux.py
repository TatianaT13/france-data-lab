"""Téléchargement des indicateurs qualité des hôpitaux (HAS, ex-Scope Santé).

Deux indicateurs officiels, tous deux conçus par la HAS pour la comparaison
inter-établissements (et déjà ajustés/gradés par elle, pas par nous) :
  - e-Satis : satisfaction des patients hospitalisés plus de 48h (secteur MCO)
  - ICSHA v4 : indicateur d'hygiène des mains (consommation de solution
    hydro-alcoolique rapportée à l'activité), tous secteurs

La HAS republie un nouveau « recueil » chaque année sous un nouvel identifiant
data.gouv.fr : à défaut de mieux, l'identifiant du recueil le plus récent connu
est codé en dur ci-dessous et devra être mis à jour manuellement l'an prochain.
"""

from pathlib import Path

import requests

DATASET_ID = "66e936005e9b27856ef160d1"  # "Indicateurs de qualité et de sécurité des soins - recueil 2024"
DATASET_API_URL = f"https://www.data.gouv.fr/api/1/datasets/{DATASET_ID}/"

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw" / "hopitaux"
ESATIS_PATH = RAW_DIR / "esatis.xlsx"
QUALHAS_PATH = RAW_DIR / "qualhas.xlsx"


def _download_resource(meta: dict, title_contains: str, dest: Path) -> Path:
    resource = next(
        r for r in meta["resources"]
        if r.get("format", "").lower() == "xlsx" and title_contains in r.get("title", "")
    )
    response = requests.get(resource["url"], timeout=180)
    response.raise_for_status()
    dest.write_bytes(response.content)
    return dest


def download_hopitaux(force: bool = True) -> dict:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if not force and ESATIS_PATH.exists() and QUALHAS_PATH.exists():
        return {"esatis": ESATIS_PATH, "qualhas": QUALHAS_PATH}

    meta = requests.get(DATASET_API_URL, timeout=30).json()
    _download_resource(meta, "resultats-iqss-esatis48h-mco", ESATIS_PATH)
    _download_resource(meta, "resultats-iqss-qualhas", QUALHAS_PATH)
    return {"esatis": ESATIS_PATH, "qualhas": QUALHAS_PATH}
