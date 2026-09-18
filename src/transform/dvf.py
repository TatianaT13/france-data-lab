"""Nettoyage et agrégation des données DVF brutes."""

from pathlib import Path

import numpy as np
import pandas as pd

USECOLS = [
    "date_mutation",
    "nature_mutation",
    "valeur_fonciere",
    "code_departement",
    "type_local",
    "surface_reelle_bati",
    "nombre_pieces_principales",
]

# Bornes de prix au m² pour écarter les erreurs de saisie / cas extrêmes.
PRIX_M2_MIN = 300
PRIX_M2_MAX = 25000

PIECES_ALL = "Tous"
TYPE_ALL = "Tous"


def _pieces_category(n: pd.Series) -> pd.Series:
    """Studio / T2 / T3 / T4 / T5+, ou <NA> si inconnu (0 ou manquant)."""
    conditions = [n == 1, n == 2, n == 3, n == 4, n >= 5]
    choices = ["Studio", "T2", "T3", "T4", "T5+"]
    return pd.Series(np.select(conditions, choices, default=None), index=n.index, dtype="object")


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
    df["pieces_cat"] = _pieces_category(df["nombre_pieces_principales"])

    return df[
        ["code_departement", "type_local", "pieces_cat", "prix_m2", "annee", "mois"]
    ]


def _agg(df: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    return (
        df.groupby(group_cols)
        .agg(prix_m2_median=("prix_m2", "median"), transactions=("prix_m2", "size"))
        .reset_index()
    )


def _with_rollups(df: pd.DataFrame, base_dims: list[str]) -> pd.DataFrame:
    """Ajoute les combinaisons type_local x pieces_cat, avec rollups 'Tous' pour chaque axe."""
    has_pieces = df[df["pieces_cat"].notna()]

    specific_specific = _agg(has_pieces, base_dims + ["type_local", "pieces_cat"])

    type_specific = _agg(df, base_dims + ["type_local"])
    type_specific["pieces_cat"] = PIECES_ALL

    pieces_specific = _agg(has_pieces, base_dims + ["pieces_cat"])
    pieces_specific["type_local"] = TYPE_ALL

    grand_total = _agg(df, base_dims)
    grand_total["type_local"] = TYPE_ALL
    grand_total["pieces_cat"] = PIECES_ALL

    return pd.concat(
        [specific_specific, type_specific, pieces_specific, grand_total], ignore_index=True
    )


def aggregate_by_department(df: pd.DataFrame) -> pd.DataFrame:
    """Prix médian au m² et transactions par département / année / type / pièces."""
    result = _with_rollups(df, ["code_departement", "annee"])
    return result.sort_values(
        ["annee", "code_departement", "type_local", "pieces_cat"]
    ).reset_index(drop=True)


def aggregate_by_month(df: pd.DataFrame) -> pd.DataFrame:
    """Prix médian national au m² et transactions par mois / type / pièces."""
    result = _with_rollups(df, ["mois"])
    return result.sort_values(["mois", "type_local", "pieces_cat"]).reset_index(drop=True)
