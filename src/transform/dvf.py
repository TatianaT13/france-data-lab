"""Nettoyage et agrégation des données DVF brutes."""

from pathlib import Path

import pandas as pd

USECOLS = [
    "date_mutation",
    "nature_mutation",
    "valeur_fonciere",
    "code_departement",
    "type_local",
    "surface_reelle_bati",
]

# Bornes de prix au m² pour écarter les erreurs de saisie / cas extrêmes.
PRIX_M2_MIN = 300
PRIX_M2_MAX = 25000


def load_year(path: Path, year: int) -> pd.DataFrame:
    """Charge et nettoie un fichier DVF annuel : ventes de maisons/appartements."""
    df = pd.read_csv(
        path,
        compression="gzip",
        usecols=USECOLS,
        dtype={"code_departement": "string"},
        low_memory=False,
    )

    df = df[
        (df["nature_mutation"] == "Vente")
        & (df["type_local"].isin(["Maison", "Appartement"]))
        & (df["valeur_fonciere"] > 1000)
        & (df["surface_reelle_bati"] > 8)
    ].copy()

    df["prix_m2"] = df["valeur_fonciere"] / df["surface_reelle_bati"]
    df = df[df["prix_m2"].between(PRIX_M2_MIN, PRIX_M2_MAX)]

    df["date_mutation"] = pd.to_datetime(df["date_mutation"])
    df["annee"] = year
    df["mois"] = df["date_mutation"].dt.to_period("M").astype(str)

    return df[
        ["code_departement", "type_local", "prix_m2", "valeur_fonciere", "annee", "mois"]
    ]


def aggregate_by_department(df: pd.DataFrame) -> pd.DataFrame:
    """Prix médian au m² et nombre de transactions par département / année / type."""

    par_type = (
        df.groupby(["code_departement", "annee", "type_local"])
        .agg(prix_m2_median=("prix_m2", "median"), transactions=("prix_m2", "size"))
        .reset_index()
    )

    tous = (
        df.groupby(["code_departement", "annee"])
        .agg(prix_m2_median=("prix_m2", "median"), transactions=("prix_m2", "size"))
        .reset_index()
    )
    tous["type_local"] = "Tous"

    result = pd.concat([par_type, tous], ignore_index=True)
    return result.sort_values(["annee", "code_departement", "type_local"]).reset_index(
        drop=True
    )


def aggregate_by_month(df: pd.DataFrame) -> pd.DataFrame:
    """Prix médian national au m² et transactions par mois / type de bien."""

    def agg_group(group: pd.DataFrame) -> pd.DataFrame:
        return (
            group.groupby("mois")
            .agg(prix_m2_median=("prix_m2", "median"), transactions=("prix_m2", "size"))
            .reset_index()
        )

    frames = []
    for type_local, group in df.groupby("type_local"):
        out = agg_group(group)
        out["type_local"] = type_local
        frames.append(out)

    tous = agg_group(df)
    tous["type_local"] = "Tous"
    frames.append(tous)

    result = pd.concat(frames, ignore_index=True)
    return result.sort_values(["mois", "type_local"]).reset_index(drop=True)
