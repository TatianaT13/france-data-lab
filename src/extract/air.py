"""Qualité de l'air : concentrations horaires de polluants (LCSQA / Géod'air, data.gouv.fr).

Un fichier CSV (~12 Mo, ~500 stations) par jour, depuis 2021. On échantillonne le 15 de chaque
mois pour l'historique et on prend le dernier jour disponible pour l'instantané.
"""

import io
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import pandas as pd
import requests

BASE = (
    "https://files.data.gouv.fr/ineris/lcsqa/concentrations-de-polluants-"
    "atmospheriques-reglementes/temps-reel"
)
POLLUANTS = {"NO2": "no2", "PM10": "pm10", "PM2.5": "pm25", "O3": "o3"}
REGIONS = {"11", "24", "27", "28", "32", "44", "52", "53", "75", "76", "84", "93", "94"}
USECOLS = ["Date de début", "code zas", "code site", "Polluant", "valeur", "validité"]


def fetch_day(day: date) -> pd.DataFrame | None:
    url = f"{BASE}/{day.year}/FR_E2_{day.isoformat()}.csv"
    response = requests.get(url, timeout=120)
    if response.status_code != 200:
        return None
    df = pd.read_csv(
        io.BytesIO(response.content), sep=";", encoding="utf-8-sig", usecols=USECOLS,
        dtype={"code zas": "string", "code site": "string"},
    )
    df = df[(df["validité"] > 0) & df["Polluant"].isin(POLLUANTS)].copy()
    df["region"] = df["code zas"].str[2:4]
    df = df[df["region"].isin(REGIONS)]
    df["polluant"] = df["Polluant"].map(POLLUANTS)
    df["heure"] = pd.to_datetime(df["Date de début"]).dt.hour
    df["valeur"] = pd.to_numeric(df["valeur"], errors="coerce")
    return df.dropna(subset=["valeur"])[["region", "code site", "polluant", "heure", "valeur"]]


def fetch_days(days: list[date]) -> dict[date, pd.DataFrame]:
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(fetch_day, days))
    return {d: df for d, df in zip(days, results) if df is not None and not df.empty}


def sampled_days(start_year: int = 2021) -> list[date]:
    today = date.today()
    days = []
    for year in range(start_year, today.year + 1):
        for month in range(1, 13):
            d = date(year, month, 15)
            if d < today - timedelta(days=2):
                days.append(d)
    return days


def latest_available_day() -> date:
    day = date.today()
    for _ in range(10):
        with requests.get(f"{BASE}/{day.year}/FR_E2_{day.isoformat()}.csv", stream=True, timeout=30) as r:
            if r.status_code == 200:
                return day
        day -= timedelta(days=1)
    raise RuntimeError("Aucun fichier LCSQA récent")
