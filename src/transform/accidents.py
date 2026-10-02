"""Nettoyage et agrégation des accidents corporels de la circulation (ONISR/BAAC)."""

from pathlib import Path

import pandas as pd

# Code officiel ONISR de la gravité des usagers impliqués.
GRAV_LABELS = {1: "Indemne", 2: "Tué", 3: "Blessé hospitalisé", 4: "Blessé léger"}


def load_caract(path: Path, year: int) -> pd.DataFrame:
    df = pd.read_csv(path, sep=";", encoding="utf-8-sig", dtype={"dep": "string"}, low_memory=False)
    df = df.rename(columns={"Accident_Id": "Num_Acc"})
    df["Num_Acc"] = df["Num_Acc"].astype(str)
    # En 2019 uniquement, les départements 1 à 9 ne sont pas zéro-paddés ("1" au lieu
    # de "01"), ce qui les séparerait à tort des mêmes départements des autres années.
    df["dep"] = df["dep"].str.strip().str.zfill(2)
    df["annee"] = year
    df["mois"] = pd.to_numeric(df["mois"], errors="coerce")
    return df[["Num_Acc", "annee", "mois", "dep"]]


def load_usagers(path: Path, year: int) -> pd.DataFrame:
    df = pd.read_csv(path, sep=";", encoding="utf-8-sig", dtype={"grav": "Int64"}, low_memory=False)
    df["Num_Acc"] = df["Num_Acc"].astype(str)
    return df[["Num_Acc", "grav"]]


def load_year(caract_path: Path, usagers_path: Path, year: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Retourne (accidents, usagers) pour une année : un accident = un Num_Acc."""
    caract = load_caract(caract_path, year)
    usagers = load_usagers(usagers_path, year)

    counts = pd.crosstab(usagers["Num_Acc"], usagers["grav"]).reindex(columns=[1, 2, 3, 4], fill_value=0)
    per_acc = pd.DataFrame({
        "nb_usagers": counts.sum(axis=1),
        "nb_tues": counts[2],
        "nb_hospitalises": counts[3],
        "nb_blesses_legers": counts[4],
    })

    accidents = caract.merge(per_acc, on="Num_Acc", how="left")
    for col in ["nb_usagers", "nb_tues", "nb_hospitalises", "nb_blesses_legers"]:
        accidents[col] = accidents[col].fillna(0).astype(int)
    accidents["mortel"] = accidents["nb_tues"] > 0
    return accidents, usagers


def aggregate_national_monthly(accidents: pd.DataFrame) -> list[dict]:
    g = (
        accidents.groupby(["annee", "mois"])
        .agg(nb_accidents=("Num_Acc", "count"), nb_tues=("nb_tues", "sum"))
        .reset_index()
    )
    g["mois_str"] = g["annee"].astype(str) + "-" + g["mois"].astype(int).astype(str).str.zfill(2)
    g = g.sort_values(["annee", "mois"])
    return [
        {"mois": r["mois_str"], "nb_accidents": int(r["nb_accidents"]), "nb_tues": int(r["nb_tues"])}
        for _, r in g.iterrows()
    ]


def aggregate_dept_year(accidents: pd.DataFrame) -> list[dict]:
    g = (
        accidents.groupby(["dep", "annee"])
        .agg(nb_accidents=("Num_Acc", "count"), nb_tues=("nb_tues", "sum"))
        .reset_index()
    )
    return [
        {
            "code_departement": r["dep"],
            "annee": int(r["annee"]),
            "nb_accidents": int(r["nb_accidents"]),
            "nb_tues": int(r["nb_tues"]),
        }
        for _, r in g.iterrows()
    ]


def severity_distribution(all_usagers: pd.DataFrame) -> list[dict]:
    counts = all_usagers["grav"].value_counts()
    return [
        {"gravite": GRAV_LABELS[code], "count": int(counts.get(code, 0))}
        for code in [1, 4, 3, 2]
        if code in counts.index
    ]


def build_summary(accidents: pd.DataFrame, all_usagers: pd.DataFrame) -> dict:
    last_year = int(accidents["annee"].max())
    first_year = int(accidents["annee"].min())
    by_dept_last_year = accidents[accidents["annee"] == last_year].groupby("dep")["nb_tues"].sum()
    top_dep = by_dept_last_year.idxmax() if len(by_dept_last_year) else None

    return {
        "total_accidents": int(len(accidents)),
        "total_tues": int(accidents["nb_tues"].sum()),
        "total_usagers": int(len(all_usagers)),
        "annee_min": first_year,
        "annee_max": last_year,
        "top_dept_tues_code": top_dep,
        "top_dept_tues_annee": last_year,
        "top_dept_tues_valeur": int(by_dept_last_year.max()) if top_dep is not None else None,
        "n_departements": int(accidents["dep"].nunique()),
    }


def build_all(years_paths: dict[int, dict[str, Path]]) -> dict:
    all_accidents = []
    all_usagers = []
    for year, paths in sorted(years_paths.items()):
        accidents, usagers = load_year(paths["caract"], paths["usagers"], year)
        all_accidents.append(accidents)
        all_usagers.append(usagers)
    accidents = pd.concat(all_accidents, ignore_index=True)
    usagers = pd.concat(all_usagers, ignore_index=True)

    return {
        "meta": build_summary(accidents, usagers),
        "monthly": aggregate_national_monthly(accidents),
        "dept_year": aggregate_dept_year(accidents),
        "severity": severity_distribution(usagers),
    }
