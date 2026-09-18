"""Nettoyage du taux de chômage localisé par département."""

from pathlib import Path

import pandas as pd

# Codes agrégats à exclure de la carte / du classement (pas de vrais départements).
AGGREGATE_CODES = {"F", "M"}


def load_chomage(path: Path) -> dict:
    """Charge le CSV et sépare départements et agrégats nationaux.

    Retourne un dict avec :
      - 'departements' : DataFrame (code, nom, taux_actuel, taux_precedent, taux_an_dernier)
      - 'national' : ligne 'France hors Mayotte' (code F)
      - 'labels' : intitulés des 3 colonnes de période, tels que publiés
    """
    with open(path, encoding="utf-8-sig") as f:
        header = f.readline().strip().split(";")
    labels = {"actuel": header[2], "precedent": header[3], "an_dernier": header[4]}

    df = pd.read_csv(path, sep=";", encoding="utf-8-sig")
    df.columns = ["code_departement", "departement", "taux_actuel", "taux_precedent", "taux_an_dernier"]

    df["code_departement"] = df["code_departement"].astype(str)
    national = df[df["code_departement"] == "F"].iloc[0].to_dict()

    departements = df[~df["code_departement"].isin(AGGREGATE_CODES)].copy()
    departements["evolution_pts"] = departements["taux_actuel"] - departements["taux_an_dernier"]

    return {"departements": departements, "national": national, "labels": labels}
