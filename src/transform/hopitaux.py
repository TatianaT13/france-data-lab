"""Nettoyage et agrégation des indicateurs qualité des hôpitaux (HAS)."""

from pathlib import Path

import numpy as np
import pandas as pd

REGION_CODES = {
    "Île-de-France": "11", "Ile de France": "11",
    "Centre-Val de Loire": "24",
    "Bourgogne-Franche-Comté": "27",
    "Normandie": "28",
    "Hauts-de-France": "32", "Hauts de France": "32",
    "Grand Est": "44",
    "Pays de la Loire": "52",
    "Bretagne": "53",
    "Nouvelle-Aquitaine": "75", "Nouvelle Aquitaine": "75",
    "Occitanie": "76",
    "Auvergne-Rhône-Alpes": "84",
    "PACA": "93", "Provence-Alpes-Côte d'Azur": "93",
    "Corse": "94",
}

ESATIS_INVALID = {"DI", "NV", "NR"}
ICSHA_INVALID = {"Non concerné", "Non répondant", "Non Applicable"}


def load_esatis(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="Resultats")
    df = df.rename(columns={
        "rs_finess": "nom", "score_all_rea_ajust": "score",
        "taux_reco_brut": "taux_recommandation",
    })
    df["code_region"] = df["region"].map(REGION_CODES)
    df["classement"] = df["classement"].fillna("NR")
    df["valide"] = ~df["classement"].isin(ESATIS_INVALID)
    # ~180 FINESS apparaissent sur plusieurs lignes (unités distinctes d'un même hôpital,
    # parfois avec une région incohérente entre lignes) : on garde une ligne par établissement.
    df = df.sort_values("valide", ascending=False).drop_duplicates("finess", keep="first")
    return df[["finess", "nom", "region", "code_region", "type", "score", "classement", "evolution", "taux_recommandation", "valide"]]


def load_icsha(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="Resultats")
    df = df.rename(columns={"nom_ES": "nom", "classe_ias_icsha_v4": "classe"})
    df["code_region"] = df["region"].map(REGION_CODES)
    df["classe"] = df["classe"].fillna("Non concerné")
    df["valide"] = ~df["classe"].isin(ICSHA_INVALID)

    def to_pct(v):
        if isinstance(v, str) and v.endswith("%"):
            try:
                return float(v[:-1].replace(",", "."))
            except ValueError:
                return None
        return None

    df["score"] = df["res_ias_icsha_v4"].apply(to_pct)
    df["moyenne_nationale"] = df["moy_nat_ias_icsha_v4"].apply(to_pct)
    df["evolution"] = df["evol_ias_icsha_v4"]
    return df[["finess", "nom", "region", "code_region", "type", "score", "classe", "evolution", "moyenne_nationale", "valide"]]


def national_summary(esatis: pd.DataFrame, icsha: pd.DataFrame) -> dict:
    e_valid = esatis[esatis["valide"]]
    i_valid = icsha[icsha["valide"]]
    return {
        "n_esatis": int(len(e_valid)),
        "score_esatis_moyen": round(float(e_valid["score"].mean()), 1),
        "part_esatis_a": round(float((e_valid["classement"] == "A").mean() * 100), 1),
        "n_icsha": int(len(i_valid)),
        "score_icsha_moyen": round(float(i_valid["score"].mean()), 1),
        "part_icsha_a": round(float((i_valid["classe"] == "A").mean() * 100), 1),
    }


def classement_distribution(df: pd.DataFrame, col: str) -> list[dict]:
    valid = df[df["valide"]]
    counts = valid[col].value_counts()
    order = ["A", "B", "C", "D"]
    return [{"classe": c, "count": int(counts.get(c, 0))} for c in order if c in counts.index or counts.get(c, 0) > 0]


def regional_avg(df: pd.DataFrame) -> list[dict]:
    valid = df[df["valide"] & df["code_region"].notna()]
    g = valid.groupby("code_region")["score"].mean().round(1).reset_index()
    return [{"code_region": r["code_region"], "score_moyen": r["score"]} for _, r in g.iterrows()]


def top_establishments(df: pd.DataFrame, sort_col: str, n: int = 20) -> list[dict]:
    # Un même FINESS peut apparaître plusieurs fois (plusieurs unités/services surveyées
    # séparément) : on ne garde que la meilleure ligne par établissement pour éviter les
    # doublons et les incohérences de région entre lignes d'un même hôpital.
    valid = df[df["valide"]].sort_values(sort_col, ascending=False).drop_duplicates("finess", keep="first").head(n)
    cols = [c for c in ["finess", "nom", "region", "type", "score", "classement", "classe", "evolution", "taux_recommandation"] if c in valid.columns]
    return valid[cols].replace({np.nan: None}).to_dict("records")


def build_all(esatis_path: Path, qualhas_path: Path) -> dict:
    esatis = load_esatis(esatis_path)
    icsha = load_icsha(qualhas_path)
    return {
        "meta": national_summary(esatis, icsha),
        "esatis_classement": classement_distribution(esatis, "classement"),
        "icsha_classement": classement_distribution(icsha, "classe"),
        "esatis_region": regional_avg(esatis),
        "icsha_region": regional_avg(icsha),
        "esatis_top": top_establishments(esatis, "score"),
    }
