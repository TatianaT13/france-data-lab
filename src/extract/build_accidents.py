"""Pipeline accidents : télécharge, agrège, écrit le JSON du site."""

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from src.extract.accidents import download_route_geometry, download_year, resolve_resources
from src.extract.dvf import GEO_PATH, download_geojson
from src.transform.accidents import build_all

ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT / "data" / "processed"
WEBSITE_DATA_DIR = ROOT / "website" / "data"


def build_route_geometries(routes: list[dict]) -> list[dict]:
    """Associe à chaque route du classement son tracé géographique (IGN)."""
    features = []
    for r in routes:
        segments = download_route_geometry(r["route"])
        if segments:
            features.append({**r, "segments": segments})
    return features


def build() -> None:
    print("[accidents] résolution des fichiers disponibles...")
    resources = resolve_resources()

    years_paths = {}
    for year, urls in sorted(resources.items()):
        print(f"[accidents] téléchargement {year}...")
        years_paths[year] = download_year(year, urls)

    result = build_all(years_paths)

    print("[accidents] tracé des routes du classement...")
    route_geometries = build_route_geometries(result["top_routes"]["routes"])

    download_geojson()

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)

    for name, payload in [
        ("accidents_monthly.json", result["monthly"]),
        ("accidents_dept_year.json", result["dept_year"]),
        ("accidents_severity.json", result["severity"]),
        ("accidents_road_category.json", result["road_category"]),
        ("accidents_top_routes.json", result["top_routes"]),
        ("accidents_speed_limit.json", result["speed_limit"]),
        ("accidents_maneuvers.json", result["maneuvers"]),
        ("accidents_mortal_points.json", result["mortal_points"]),
        ("accidents_route_geometries.json", route_geometries),
    ]:
        text = json.dumps(payload, ensure_ascii=False)
        (WEBSITE_DATA_DIR / name).write_text(text)
        (PROCESSED_DIR / name).write_text(text)

    meta = {**result["meta"], "last_updated": datetime.now(timezone.utc).isoformat()}
    text = json.dumps(meta, ensure_ascii=False)
    (WEBSITE_DATA_DIR / "accidents_meta.json").write_text(text)
    (PROCESSED_DIR / "accidents_meta.json").write_text(text)

    shutil.copyfile(GEO_PATH, WEBSITE_DATA_DIR / "departements.geojson")

    print(
        f"[accidents] terminé : {meta['total_accidents']:,} accidents, "
        f"{meta['total_tues']:,} tués, {meta['annee_min']}-{meta['annee_max']}"
    )


if __name__ == "__main__":
    build()
