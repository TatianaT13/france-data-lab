"""Pipeline air : échantillon mensuel (15 du mois) + dernier jour, agrégés par région."""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from src.extract.air import POLLUANTS, fetch_day, fetch_days, latest_available_day, sampled_days

ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT / "data" / "processed"
WEBSITE_DATA_DIR = ROOT / "website" / "data"
KEYS = list(POLLUANTS.values())


def num(v):
    return None if v is None or v != v else round(float(v), 1)


def region_means(df):
    """Moyenne par région : d'abord par station, puis entre stations."""
    per_site = df.groupby(["region", "code site", "polluant"])["valeur"].mean().reset_index()
    return per_site.groupby(["region", "polluant"])["valeur"].mean().unstack()


def build() -> None:
    print("[air] échantillon mensuel...")
    days = fetch_days(sampled_days())
    monthly = []
    for day, df in sorted(days.items()):
        table = region_means(df)
        for region, row in table.iterrows():
            rec = {"mois": day.strftime("%Y-%m"), "code_insee_region": region}
            for k in KEYS:
                v = row.get(k)
                rec[k] = num(v)
            monthly.append(rec)

    print("[air] dernier jour disponible...")
    last_day = latest_available_day()
    if last_day == date.today():
        last_day -= timedelta(days=1)
    df = fetch_day(last_day)
    table = region_means(df)
    latest_regions = []
    for region, row in table.iterrows():
        rec = {"code_insee_region": region}
        for k in KEYS:
            v = row.get(k)
            rec[k] = num(v)
        latest_regions.append(rec)

    hourly = df.groupby(["heure", "polluant"])["valeur"].mean().unstack().reset_index()
    hourly_out = [
        {"heure": int(r["heure"]), **{k: num(r.get(k)) for k in KEYS}}
        for _, r in hourly.iterrows()
    ]
    national = {k: num(df[df["polluant"] == k]["valeur"].mean()) for k in KEYS}
    latest = {
        "date": last_day.isoformat(),
        "stations": int(df["code site"].nunique()),
        "national": national,
        "regions": latest_regions,
        "hourly": hourly_out,
    }

    WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    for name, payload in [("air_monthly.json", monthly), ("air_latest.json", latest)]:
        text = json.dumps(payload)
        (WEBSITE_DATA_DIR / name).write_text(text)
        (PROCESSED_DIR / name).write_text(text)
    meta = {"last_updated": datetime.now(timezone.utc).isoformat(), "sampled_days": len(days)}
    (WEBSITE_DATA_DIR / "air_meta.json").write_text(json.dumps(meta))
    (PROCESSED_DIR / "air_meta.json").write_text(json.dumps(meta))
    print(f"[air] terminé : {len(days)} jours échantillonnés, dernier jour {last_day}")


if __name__ == "__main__":
    build()
