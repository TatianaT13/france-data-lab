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
