"""Nettoyage et calculs dérivés pour les données éCO2mix (RTE)."""

SOURCES_NATIONAL = ["nucleaire", "gaz", "fioul_charbon", "hydraulique", "bioenergies", "eolien", "solaire"]

NEIGHBOR_LABELS = {
    "ech_comm_angleterre": "Angleterre",
    "ech_comm_espagne": "Espagne",
    "ech_comm_italie": "Italie",
    "ech_comm_suisse": "Suisse",
    "ech_comm_allemagne_belgique": "Allemagne / Belgique",
}


def _total_production(rec: dict) -> float:
    return sum(
        (rec.get(k) or 0)
        for k in ["nucleaire", "gaz", "fioul", "charbon", "hydraulique", "bioenergies", "eolien", "solaire"]
    )


def clean_national_record(rec: dict) -> dict:
    """Ajoute les parts (%) et regroupe fioul+charbon pour un enregistrement national."""
    total = _total_production(rec) or 1
    renouvelable = (rec.get("eolien") or 0) + (rec.get("solaire") or 0) + (rec.get("hydraulique") or 0) + (
        rec.get("bioenergies") or 0
    )
    out = {
        "date_heure": rec["date_heure"],
        "consommation": rec.get("consommation"),
        "taux_co2": rec.get("taux_co2"),
        "ech_physiques": rec.get("ech_physiques"),
        "nucleaire": rec.get("nucleaire") or 0,
        "gaz": rec.get("gaz") or 0,
        "fioul_charbon": (rec.get("fioul") or 0) + (rec.get("charbon") or 0),
        "hydraulique": rec.get("hydraulique") or 0,
        "bioenergies": rec.get("bioenergies") or 0,
        "eolien": rec.get("eolien") or 0,
        "solaire": rec.get("solaire") or 0,
        "part_nucleaire": round((rec.get("nucleaire") or 0) / total * 100, 1),
        "part_renouvelable": round(renouvelable / total * 100, 1),
    }
    return out


def build_neighbor_exchanges(rec: dict) -> list[dict]:
    """Échanges commerciaux avec les pays limitrophes (MW). Négatif = export net."""
    return [
        {"pays": label, "solde": rec.get(key) or 0}
        for key, label in NEIGHBOR_LABELS.items()
    ]


def clean_regional_record(rec: dict) -> dict:
    total = sum(
        (rec.get(k) or 0)
        for k in ["thermique", "nucleaire", "eolien", "solaire", "hydraulique", "bioenergies"]
    ) or 1
    renouvelable = (rec.get("eolien") or 0) + (rec.get("solaire") or 0) + (rec.get("hydraulique") or 0) + (
        rec.get("bioenergies") or 0
    )
    return {
        "code_insee_region": rec["code_insee_region"],
        "libelle_region": rec["libelle_region"],
        "date_heure": rec["date_heure"],
        "consommation": rec.get("consommation") or 0,
        "part_renouvelable": round(renouvelable / total * 100, 1),
    }


def clean_yearly(records: list[dict], names: dict) -> list[dict]:
    out = []
    for r in records:
        year = r.get("year(date_heure)")
        if year is None or year < 2013 or r["code_insee_region"] not in names:
            continue
        g = lambda k: r.get(k) or 0
        eolien = g("eol_t") + g("eol_o")
        parts = {
            "thermique": g("thermique"), "nucleaire": g("nucleaire"), "eolien": eolien,
            "solaire": g("solaire"), "hydraulique": g("hydraulique"), "bioenergies": g("bioenergies"),
        }
        total = sum(parts.values()) or 1
        out.append({
            "code_insee_region": r["code_insee_region"],
            "libelle_region": names[r["code_insee_region"]],
            "annee": year,
            "consommation": round(g("consommation")),
            "part_renouvelable": round((eolien + parts["solaire"] + parts["hydraulique"] + parts["bioenergies"]) / total * 100, 1),
            "part_eolien": round(eolien / total * 100, 1),
            "part_solaire": round(parts["solaire"] / total * 100, 1),
            "part_nucleaire": round(parts["nucleaire"] / total * 100, 1),
        })
    return out
