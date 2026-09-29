"""Nettoyage et agrégation des notifications de violations de données (CNIL)."""

import re
from collections import Counter
from pathlib import Path

import pandas as pd

# Les cellules à choix multiples sont jointes par une simple virgule, mais certains libellés
# contiennent eux-mêmes une virgule suivie d'une espace (ex: "Piratage, logiciel malveillant...").
# Seule une virgule SANS espace après sépare deux valeurs distinctes.
MULTI_VALUE_SPLIT = re.compile(r",(?=\S)")

COLS = {
    "mois": "Date de réception de la notification",
    "secteur": "Secteur d'activité de l'organisme concerné",
    "nature": "Natures de la violation",
    "taille": "Nombre de personnes impactées",
    "sensible": "Données sensibles",
    "origine": "Origines de l'incident",
    "cause": "Causes de l'incident",
    "info": "Information des personnes",
}

TAILLE_ORDER = [
    "Entre 0 et 5 personnes",
    "Entre 6 et 50 personnes",
    "Entre 51 et 300 personnes",
    "Entre 301 et 5000 personnes",
    "Plus de 5000 personnes",
]


def load_fuites(path: Path) -> pd.DataFrame:
    with open(path, encoding="cp1252") as f:
        lines = f.readlines()
    # La première ligne est une note d'extraction, pas l'en-tête.
    df = pd.read_csv(pd.io.common.StringIO("".join(lines[1:])), sep=";")
    df.columns = [c.strip().rstrip("\xa0") for c in df.columns]
    rename = {v.strip(): k for k, v in COLS.items()}
    df = df.rename(columns=rename)
    df["sensible"] = df["sensible"].fillna("") == "Oui"
    df["secteur"] = df["secteur"].str.replace("''", "'", regex=False)
    return df


def _split_counts(series: pd.Series) -> list[dict]:
    """Compte chaque valeur d'une colonne à choix multiples (jointes par une virgule)."""
    counter: Counter = Counter()
    for cell in series.dropna():
        for value in MULTI_VALUE_SPLIT.split(str(cell)):
            value = value.strip().replace("''", "'")
            if value:
                counter[value] += 1
    return [{"label": k, "count": v} for k, v in counter.most_common()]


def aggregate_monthly(df: pd.DataFrame) -> list[dict]:
    g = df.groupby("mois").agg(
        total=("mois", "size"),
        sensibles=("sensible", "sum"),
    ).reset_index()
    return [
        {"mois": r["mois"], "total": int(r["total"]), "sensibles": int(r["sensibles"])}
        for _, r in g.sort_values("mois").iterrows()
    ]


def aggregate_sectors(df: pd.DataFrame) -> list[dict]:
    g = df.groupby("secteur").agg(
        total=("secteur", "size"),
        sensibles=("sensible", "sum"),
    ).reset_index()
    g["part_sensible"] = (g["sensibles"] / g["total"] * 100).round(1)
    return [
        {"secteur": r["secteur"], "total": int(r["total"]), "part_sensible": r["part_sensible"]}
        for _, r in g.sort_values("total", ascending=False).iterrows()
    ]


def aggregate_taille(df: pd.DataFrame) -> list[dict]:
    counts = df["taille"].value_counts()
    return [{"label": t, "count": int(counts.get(t, 0))} for t in TAILLE_ORDER]


def build_summary(df: pd.DataFrame) -> dict:
    total = len(df)
    months = sorted(df["mois"].dropna().unique())
    last12 = months[-12:] if len(months) >= 12 else months
    prev12 = months[-24:-12] if len(months) >= 24 else []
    return {
        "total": total,
        "part_sensible": round(df["sensible"].mean() * 100, 1),
        "last_month": months[-1] if months else None,
        "count_last12": int(df[df["mois"].isin(last12)].shape[0]),
        "count_prev12": int(df[df["mois"].isin(prev12)].shape[0]) if prev12 else None,
        "top_secteur": df["secteur"].value_counts().idxmax(),
        "top_origine": _split_counts(df["origine"])[0]["label"] if len(df) else None,
    }


def build_all(path: Path) -> dict:
    df = load_fuites(path)
    return {
        "meta": build_summary(df),
        "monthly": aggregate_monthly(df),
        "sectors": aggregate_sectors(df),
        "taille": aggregate_taille(df),
        "origines": _split_counts(df["origine"])[:10],
        "causes": _split_counts(df["cause"])[:8],
        "info": _split_counts(df["info"]),
    }
