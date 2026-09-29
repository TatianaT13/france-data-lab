"""Nettoyage et agrégation des passages aux urgences par département (DREES)."""

from pathlib import Path

import pandas as pd


def load_urgences(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, sep=";", encoding="utf-8-sig", dtype={"dep": "string"})
    df["date"] = pd.to_datetime(df["date"])
    df["annee"] = df["date"].dt.year
    df["semaine"] = df["date"].dt.to_period("W").dt.start_time.dt.strftime("%Y-%m-%d")
    return df


def aggregate_national_weekly(df: pd.DataFrame) -> list[dict]:
    g = df.groupby("semaine").agg(total=("nb_passages", "sum"), n_jours=("date", "nunique")).reset_index()
    g = g[g["n_jours"] >= 7]  # écarte les semaines incomplètes en début/fin de série
    return [{"semaine": r["semaine"], "total": int(round(r["total"]))} for _, r in g.iterrows()]


def aggregate_dept_year(df: pd.DataFrame) -> list[dict]:
    g = df.groupby(["dep", "libelle_dep", "annee"])["nb_passages"].mean().round(1).reset_index()
    return [
        {
            "code_departement": r["dep"],
            "departement": r["libelle_dep"],
            "annee": int(r["annee"]),
            "moyenne_journaliere": r["nb_passages"],
        }
        for _, r in g.iterrows()
    ]


def build_summary(df: pd.DataFrame) -> dict:
    total = int(round(df["nb_passages"].sum()))
    by_dept_all = df.groupby(["dep", "libelle_dep"])["nb_passages"].mean().round(1)
    top = by_dept_all.idxmax()

    def month_avg(year: int, month: int) -> float:
        sub = df[(df["date"].dt.year == year) & (df["date"].dt.month == month)]
        return sub.groupby("date")["nb_passages"].sum().mean()

    avril_2019 = month_avg(2019, 4)
    avril_2020 = month_avg(2020, 4)
    covid_pct = float(round((avril_2020 - avril_2019) / avril_2019 * 100, 1)) if avril_2019 else None

    return {
        "total_passages": total,
        "date_min": df["date"].min().strftime("%Y-%m-%d"),
        "date_max": df["date"].max().strftime("%Y-%m-%d"),
        "top_dept_code": top[0],
        "top_dept_nom": top[1],
        "top_dept_valeur": float(by_dept_all.max()),
        "covid_pct_avril": covid_pct,
        "n_departements": int(df["dep"].nunique()),
    }


def build_all(path: Path) -> dict:
    df = load_urgences(path)
    return {
        "meta": build_summary(df),
        "weekly": aggregate_national_weekly(df),
        "dept_year": aggregate_dept_year(df),
    }
