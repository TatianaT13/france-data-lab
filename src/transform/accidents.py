"""Nettoyage et agrégation des accidents corporels de la circulation (ONISR/BAAC)."""

import re
from pathlib import Path

import pandas as pd

# Codes officiels ONISR (voir "Description des bases de données annuelles", fiche BAAC).
GRAV_LABELS = {1: "Indemne", 2: "Tué", 3: "Blessé hospitalisé", 4: "Blessé léger"}

CATR_LABELS = {
    1: "Autoroute", 2: "Route nationale", 3: "Route départementale", 4: "Voie communale",
    5: "Hors réseau public", 6: "Parking ouvert à la circulation publique",
    7: "Route de métropole urbaine", 9: "Autre",
}

MANV_LABELS = {
    0: "Inconnue", 1: "Sans changement de direction", 2: "Même sens, même file",
    3: "Entre 2 files", 4: "En marche arrière", 5: "À contresens",
    6: "En franchissant le terre-plein central", 7: "Dans le couloir bus, même sens",
    8: "Dans le couloir bus, sens inverse", 9: "En s'insérant",
    10: "En faisant demi-tour sur la chaussée", 11: "Changeant de file (à gauche)",
    12: "Changeant de file (à droite)", 13: "Déporté à gauche", 14: "Déporté à droite",
    15: "Tournant à gauche", 16: "Tournant à droite", 17: "Dépassant à gauche",
    18: "Dépassant à droite", 19: "Traversant la chaussée", 20: "Manœuvre de stationnement",
    21: "Manœuvre d'évitement", 22: "Ouverture de porte", 23: "Arrêté (hors stationnement)",
    24: "En stationnement (avec occupants)", 25: "Circulant sur trottoir", 26: "Autres manœuvres",
}

SPEED_BUCKETS = [30, 50, 70, 80, 90, 110, 130]

ROUTE_SENS_RE = re.compile(r"-?\s*SENS.*", re.I)
ROUTE_RN_RE = re.compile(r"\bRN\s?0*(\d+)\s?([A-Z]?)\b")
ROUTE_NATIONALE_RE = re.compile(r"\bROUTE\s+NATIONALE\s?0*(\d+)\b")
ROUTE_AN_RE = re.compile(r"\b([AN])\s?0*(\d+)\s?([A-Z]?)\b")
ROUTE_BARE_NUMBER_RE = re.compile(r"^0*(\d+)\s?([A-Z]?)$")


def normalize_route(voie, catr: int) -> str | None:
    """Normalise le champ libre "voie" en identifiant de route (ex. "A6", "N104").

    Seulement pour les autoroutes (catr=1) et routes nationales (catr=2), dont la
    numérotation est unique au niveau national. Retourne None si le texte est trop
    libre pour être identifié avec certitude (ex. un nom de rue en zone DOM-TOM classée
    "route nationale") plutôt que de risquer un classement erroné.
    """
    if pd.isna(voie) or catr not in (1, 2):
        return None
    v = ROUTE_SENS_RE.sub("", str(voie).strip().upper())
    m = ROUTE_RN_RE.search(v)
    if m:
        return f"N{m.group(1)}{m.group(2)}"
    m = ROUTE_NATIONALE_RE.search(v)
    if m:
        return f"N{m.group(1)}"
    m = ROUTE_AN_RE.search(v)
    if m:
        return f"{m.group(1)}{m.group(2)}{m.group(3)}"
    m = ROUTE_BARE_NUMBER_RE.match(v)
    if m:
        prefix = "A" if catr == 1 else "N"
        return f"{prefix}{m.group(1)}{m.group(2)}"
    return None


def bucket_speed(vma) -> str:
    if pd.isna(vma) or vma not in SPEED_BUCKETS:
        return "Autre / inconnue"
    return f"{int(vma)} km/h"


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


def load_lieux(path: Path, year: int) -> pd.DataFrame:
    df = pd.read_csv(
        path, sep=";", encoding="utf-8-sig",
        dtype={"catr": "Int64", "voie": "string"}, low_memory=False,
    )
    df["Num_Acc"] = df["Num_Acc"].astype(str)
    df["vma"] = pd.to_numeric(df["vma"], errors="coerce")
    df["route"] = [normalize_route(v, c) for v, c in zip(df["voie"], df["catr"])]
    # Plusieurs lignes "lieux" peuvent exister par accident (rare) : on garde la première.
    return df[["Num_Acc", "catr", "route", "vma"]].drop_duplicates("Num_Acc", keep="first")


def load_vehicules(path: Path, year: int) -> pd.DataFrame:
    df = pd.read_csv(path, sep=";", encoding="utf-8-sig", dtype={"manv": "Int64"}, low_memory=False)
    df["Num_Acc"] = df["Num_Acc"].astype(str)
    return df[["Num_Acc", "manv"]]


def load_year(paths: dict[str, Path], year: int) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Retourne (accidents, usagers, vehicules) pour une année : un accident = un Num_Acc."""
    caract = load_caract(paths["caract"], year)
    usagers = load_usagers(paths["usagers"], year)
    lieux = load_lieux(paths["lieux"], year)
    vehicules = load_vehicules(paths["vehicules"], year)

    counts = pd.crosstab(usagers["Num_Acc"], usagers["grav"]).reindex(columns=[1, 2, 3, 4], fill_value=0)
    per_acc = pd.DataFrame({
        "nb_usagers": counts.sum(axis=1),
        "nb_tues": counts[2],
        "nb_hospitalises": counts[3],
        "nb_blesses_legers": counts[4],
    })

    accidents = caract.merge(per_acc, on="Num_Acc", how="left").merge(lieux, on="Num_Acc", how="left")
    for col in ["nb_usagers", "nb_tues", "nb_hospitalises", "nb_blesses_legers"]:
        accidents[col] = accidents[col].fillna(0).astype(int)
    accidents["mortel"] = accidents["nb_tues"] > 0
    return accidents, usagers, vehicules


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


def road_category_distribution(accidents: pd.DataFrame) -> list[dict]:
    g = accidents.groupby("catr").agg(nb_accidents=("Num_Acc", "count"), nb_tues=("nb_tues", "sum"))
    g = g.sort_values("nb_accidents", ascending=False)
    return [
        {
            "categorie": CATR_LABELS.get(int(catr), "Autre"),
            "nb_accidents": int(r["nb_accidents"]),
            "nb_tues": int(r["nb_tues"]),
        }
        for catr, r in g.iterrows()
        if pd.notna(catr)
    ]


def top_named_roads(accidents: pd.DataFrame, n: int = 15) -> list[dict]:
    """Classement des autoroutes/routes nationales les plus accidentogènes (nombre brut).

    Limité aux enregistrements où le numéro de route a pu être identifié avec certitude
    (~84% des accidents sur autoroute/route nationale) : les textes libres ambigus sont
    exclus plutôt que mal classés.
    """
    eligible = accidents[accidents["catr"].isin([1, 2])]
    matched = eligible[eligible["route"].notna()]
    coverage = len(matched) / len(eligible) if len(eligible) else 0
    g = (
        matched.groupby("route")
        .agg(nb_accidents=("Num_Acc", "count"), nb_tues=("nb_tues", "sum"), catr=("catr", "first"))
        .reset_index()
        .sort_values("nb_tues", ascending=False)
        .head(n)
    )
    return {
        "couverture_pct": round(coverage * 100, 1),
        "routes": [
            {
                "route": r["route"],
                "categorie": CATR_LABELS.get(int(r["catr"]), "Autre"),
                "nb_accidents": int(r["nb_accidents"]),
                "nb_tues": int(r["nb_tues"]),
            }
            for _, r in g.iterrows()
        ],
    }


def speed_limit_distribution(accidents: pd.DataFrame) -> list[dict]:
    bucketed = accidents["vma"].apply(bucket_speed)
    g = accidents.groupby(bucketed).agg(nb_accidents=("Num_Acc", "count"), nb_tues=("nb_tues", "sum"))
    order = [f"{v} km/h" for v in SPEED_BUCKETS] + ["Autre / inconnue"]
    g = g.reindex(order).dropna(how="all")
    return [
        {"vitesse": label, "nb_accidents": int(r["nb_accidents"]), "nb_tues": int(r["nb_tues"])}
        for label, r in g.iterrows()
    ]


def maneuver_distribution(accidents: pd.DataFrame, vehicules: pd.DataFrame, n: int = 10) -> list[dict]:
    """Manœuvres les plus fréquentes des véhicules impliqués dans un accident mortel.

    "manv" décrit le déplacement du véhicule juste avant le choc (ex. "tournant à
    gauche"), tel que relevé par les forces de l'ordre : ce n'est pas une détermination
    de responsabilité ou de cause légale de l'accident.
    """
    mortal_ids = set(accidents.loc[accidents["mortel"], "Num_Acc"])
    sub = vehicules[vehicules["Num_Acc"].isin(mortal_ids)]
    counts = sub["manv"].value_counts().head(n)
    return [
        {"manoeuvre": MANV_LABELS.get(int(code), "Autre"), "count": int(count)}
        for code, count in counts.items()
        if pd.notna(code)
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
    all_accidents, all_usagers, all_vehicules = [], [], []
    for year, paths in sorted(years_paths.items()):
        accidents, usagers, vehicules = load_year(paths, year)
        all_accidents.append(accidents)
        all_usagers.append(usagers)
        all_vehicules.append(vehicules)
    accidents = pd.concat(all_accidents, ignore_index=True)
    usagers = pd.concat(all_usagers, ignore_index=True)
    vehicules = pd.concat(all_vehicules, ignore_index=True)

    return {
        "meta": build_summary(accidents, usagers),
        "monthly": aggregate_national_monthly(accidents),
        "dept_year": aggregate_dept_year(accidents),
        "severity": severity_distribution(usagers),
        "road_category": road_category_distribution(accidents),
        "top_routes": top_named_roads(accidents),
        "speed_limit": speed_limit_distribution(accidents),
        "maneuvers": maneuver_distribution(accidents, vehicules),
    }
