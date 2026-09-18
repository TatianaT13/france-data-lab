"""Observatoire immobilier français — dashboard interactif basé sur les DVF (data.gouv.fr).

Lancer depuis la racine du repo :
    python dashboards/dvf_dashboard.py
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
from dash import Dash, Input, Output, State, dash_table, dcc, html

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.extract.build_dataset import build  # noqa: E402

PROCESSED_DIR = ROOT / "data" / "processed"
GEO_PATH = ROOT / "data" / "raw" / "departements.geojson"

# --- Palette (dataviz skill — validé pour surface sombre #1a1a19) ---
BLUE = "#3987e5"
ORANGE = "#d95926"
AQUA = "#199e70"
GOOD = "#0ca30c"
CRITICAL = "#e66767"
SURFACE = "#1a1a19"
TEXT_PRIMARY = "#ffffff"
TEXT_SECONDARY = "#c3c2b7"
TEXT_MUTED = "#898781"
GRIDLINE = "#2c2c2a"
BASELINE = "#383835"
FONT = "system-ui, -apple-system, Segoe UI, sans-serif"

SEQUENTIAL_BLUE = [
    "#0d0d0d", "#104281", "#184f95", "#1c5cab", "#256abf",
    "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef",
]

TYPE_OPTIONS = ["Tous", "Appartement", "Maison"]


def load_data():
    by_dept = pd.read_csv(PROCESSED_DIR / "dvf_dept_year.csv", dtype={"code_departement": "string"})
    by_month = pd.read_csv(PROCESSED_DIR / "dvf_month.csv")
    meta = json.loads((PROCESSED_DIR / "dvf_meta.json").read_text())
    geo = json.loads(GEO_PATH.read_text())
    return by_dept, by_month, meta, geo


DEPT_NAMES = {}


def base_layout(height: int = 380, top_margin: int = 10) -> dict:
    return dict(
        paper_bgcolor=SURFACE,
        plot_bgcolor=SURFACE,
        font=dict(family=FONT, color=TEXT_SECONDARY, size=12),
        margin=dict(l=10, r=10, t=top_margin, b=10),
        height=height,
        hoverlabel=dict(bgcolor="#0d0d0d", font=dict(color=TEXT_PRIMARY, family=FONT)),
        legend=dict(
            orientation="h", yanchor="top", y=1, x=0,
            font=dict(color=TEXT_SECONDARY),
        ),
    )


def make_map(by_dept: pd.DataFrame, geo: dict, year: int, type_local: str) -> go.Figure:
    df = by_dept[(by_dept["annee"] == year) & (by_dept["type_local"] == type_local)]

    fig = go.Figure(
        go.Choropleth(
            geojson=geo,
            featureidkey="properties.code",
            locations=df["code_departement"],
            z=df["prix_m2_median"],
            colorscale=SEQUENTIAL_BLUE,
            marker_line_color=BASELINE,
            marker_line_width=0.6,
            colorbar=dict(
                title=dict(text="€/m²", font=dict(color=TEXT_SECONDARY)),
                tickfont=dict(color=TEXT_SECONDARY),
                len=0.75,
            ),
            customdata=df[["prix_m2_median", "transactions"]],
            hovertemplate=(
                "<b>%{location}</b><br>"
                "Prix médian : %{customdata[0]:,.0f} €/m²<br>"
                "Transactions : %{customdata[1]:,.0f}<extra></extra>"
            ),
        )
    )
    fig.update_geos(
        visible=False, fitbounds="locations",
        bgcolor=SURFACE, showcountries=False,
    )
    fig.update_layout(**base_layout(height=560))
    fig.update_layout(margin=dict(l=10, r=60, t=10, b=10))
    return fig


def make_trend(by_month: pd.DataFrame, type_local: str) -> go.Figure:
    fig = go.Figure()
    if type_local == "Tous":
        series = [("Appartement", ORANGE), ("Maison", BLUE)]
    else:
        series = [(type_local, BLUE)]

    for name, color in series:
        d = by_month[by_month["type_local"] == name].sort_values("mois")
        fig.add_trace(
            go.Scatter(
                x=d["mois"], y=d["prix_m2_median"], mode="lines", name=name,
                line=dict(color=color, width=2),
                hovertemplate="%{x}<br>%{y:,.0f} €/m²<extra>" + name + "</extra>",
            )
        )

    top_margin = 36 if type_local == "Tous" else 10
    fig.update_layout(**base_layout(top_margin=top_margin))
    fig.update_layout(margin=dict(l=55, r=20, t=top_margin, b=10))
    fig.update_xaxes(showgrid=False, color=TEXT_MUTED, linecolor=BASELINE)
    fig.update_yaxes(
        gridcolor=GRIDLINE, zeroline=False, color=TEXT_MUTED, linecolor=BASELINE,
        tickformat=",.0f", ticksuffix=" €",
    )
    fig.update_layout(hovermode="x unified", showlegend=type_local == "Tous")
    return fig


def make_top_departments(by_dept: pd.DataFrame, year: int, type_local: str, geo: dict) -> go.Figure:
    names = {f["properties"]["code"]: f["properties"]["nom"] for f in geo["features"]}
    df = by_dept[(by_dept["annee"] == year) & (by_dept["type_local"] == type_local)].copy()
    df = df[df["code_departement"].isin(names)]
    df["nom"] = df["code_departement"].map(names)
    df["label"] = df["code_departement"] + " · " + df["nom"]
    df = df.sort_values("prix_m2_median", ascending=False).head(15).sort_values("prix_m2_median")
    max_price = df["prix_m2_median"].max()

    fig = go.Figure(
        go.Bar(
            x=df["prix_m2_median"], y=df["label"], orientation="h",
            marker_color=BLUE,
            text=[f"{v:,.0f} €" for v in df["prix_m2_median"]],
            textposition="outside",
            cliponaxis=False,
            textfont=dict(color=TEXT_SECONDARY, size=11),
            hovertemplate="%{y}<br>%{x:,.0f} €/m²<extra></extra>",
        )
    )
    fig.update_layout(**base_layout(height=560))
    fig.update_xaxes(
        showgrid=True, gridcolor=GRIDLINE, color=TEXT_MUTED, linecolor=BASELINE,
        range=[0, max_price * 1.2],
    )
    fig.update_yaxes(showgrid=False, color=TEXT_SECONDARY, linecolor=BASELINE)
    fig.update_layout(showlegend=False, margin=dict(l=165, r=20, t=10, b=30))
    return fig


def kpi_card(label: str, value: str, delta: str = None, delta_class: str = "") -> html.Div:
    children = [
        html.Div(label, className="kpi-label"),
        html.Div(value, className="kpi-value"),
    ]
    if delta:
        children.append(html.Div(delta, className=f"kpi-delta {delta_class}"))
    return html.Div(children, className="kpi-card")


app = Dash(__name__)
app.title = "Observatoire immobilier français"

by_dept_df, by_month_df, meta_data, geo_data = load_data()
years_available = sorted(by_dept_df["annee"].unique().tolist())

app.layout = html.Div(
    [
        dcc.Store(id="data-version", data=0),
        html.Div(
            [
                html.Div(
                    [
                        html.H1("Observatoire immobilier français 🇫🇷", className="app-title"),
                        html.P(
                            "Prix de l'immobilier par département — DVF, data.gouv.fr",
                            className="app-subtitle",
                        ),
                    ]
                ),
                html.Div(
                    [
                        html.Div(id="last-updated", className="app-meta"),
                        html.Button(
                            "🔄 Actualiser depuis data.gouv.fr",
                            id="refresh-btn",
                            className="refresh-btn",
                        ),
                    ]
                ),
            ],
            className="app-header",
        ),
        html.Div(
            [
                html.Div(
                    [
                        html.Div("Année", className="filter-label"),
                        dcc.Dropdown(
                            id="year-dropdown",
                            options=[{"label": str(y), "value": y} for y in years_available],
                            value=years_available[-1],
                            clearable=False,
                            style={"width": "140px", "color": "#0b0b0b"},
                        ),
                    ]
                ),
                html.Div(
                    [
                        html.Div("Type de bien", className="filter-label"),
                        dcc.RadioItems(
                            id="type-radio",
                            options=[{"label": t, "value": t} for t in TYPE_OPTIONS],
                            value="Tous",
                            inline=True,
                            inputStyle={"marginRight": "4px", "marginLeft": "12px"},
                        ),
                    ]
                ),
            ],
            className="filters-row",
        ),
        dcc.Loading(
            html.Div(id="kpi-row", className="kpi-row"),
            type="circle",
        ),
        dcc.Loading(
            html.Div(
                [
                    html.Div(
                        [
                            html.Div(id="map-title", className="chart-title"),
                            dcc.Graph(id="map-graph", config={"displayModeBar": False}),
                        ],
                        className="chart-card",
                    ),
                    html.Div(
                        [
                            html.Div(
                                [
                                    html.Div(id="trend-title", className="chart-title"),
                                    dcc.Graph(id="trend-graph", config={"displayModeBar": False}),
                                ],
                                className="chart-card",
                            ),
                            html.Div(
                                [
                                    html.Div(id="bar-title", className="chart-title"),
                                    dcc.Graph(id="bar-graph", config={"displayModeBar": False}),
                                ],
                                className="chart-card",
                            ),
                        ],
                        className="right-col",
                    ),
                ],
                className="charts-grid",
            ),
        ),
        dcc.Checklist(
            id="table-toggle",
            options=[{"label": " Voir les données en tableau", "value": "show"}],
            value=[],
            className="table-toggle",
        ),
        html.Div(id="table-container"),
    ],
    className="app-shell",
)


@app.callback(
    Output("kpi-row", "children"),
    Output("map-graph", "figure"),
    Output("map-title", "children"),
    Output("trend-graph", "figure"),
    Output("trend-title", "children"),
    Output("bar-graph", "figure"),
    Output("bar-title", "children"),
    Output("last-updated", "children"),
    Output("table-container", "children"),
    Input("year-dropdown", "value"),
    Input("type-radio", "value"),
    Input("table-toggle", "value"),
    Input("data-version", "data"),
)
def update_dashboard(year, type_local, table_toggle, _version):
    by_dept, by_month, meta, geo = load_data()

    cur = by_dept[(by_dept["annee"] == year) & (by_dept["type_local"] == type_local)]
    prev_year = year - 1
    prev = by_dept[(by_dept["annee"] == prev_year) & (by_dept["type_local"] == type_local)]

    median_price = cur["prix_m2_median"].median()
    total_transactions = int(cur["transactions"].sum())

    delta_children = None
    delta_class = ""
    if not prev.empty:
        prev_median = prev["prix_m2_median"].median()
        pct = (median_price - prev_median) / prev_median * 100
        arrow = "▲" if pct >= 0 else "▼"
        delta_class = "good" if pct >= 0 else "critical"
        delta_children = f"{arrow} {pct:+.1f} % vs {prev_year}"

    names = {f["properties"]["code"]: f["properties"]["nom"] for f in geo["features"]}
    top_dept_row = (
        cur[cur["code_departement"].isin(names)]
        .sort_values("prix_m2_median", ascending=False)
        .head(1)
    )
    top_dept_name = (
        names.get(top_dept_row["code_departement"].iloc[0], "—") if not top_dept_row.empty else "—"
    )
    top_dept_value = (
        f"{top_dept_row['prix_m2_median'].iloc[0]:,.0f} €/m²" if not top_dept_row.empty else "—"
    )

    kpis = [
        kpi_card("Prix médian national", f"{median_price:,.0f} €/m²", delta_children, delta_class),
        kpi_card("Transactions", f"{total_transactions:,.0f}"),
        kpi_card("Département le plus cher", top_dept_name, top_dept_value),
        kpi_card("Type de bien", type_local),
    ]

    map_fig = make_map(by_dept, geo, year, type_local)
    trend_fig = make_trend(by_month, type_local)
    bar_fig = make_top_departments(by_dept, year, type_local, geo)

    updated = datetime.fromisoformat(meta["last_updated"]).strftime("%d/%m/%Y %H:%M UTC")
    last_updated_text = f"Données mises à jour le {updated} · années {meta['years'][0]}–{meta['years'][-1]}"

    table = None
    if "show" in table_toggle:
        table_df = cur.copy()
        table_df["nom"] = table_df["code_departement"].map(names)
        table_df = table_df[["code_departement", "nom", "prix_m2_median", "transactions"]]
        table_df = table_df.sort_values("prix_m2_median", ascending=False)
        table_df["prix_m2_median"] = table_df["prix_m2_median"].round(0)
        table = dash_table.DataTable(
            data=table_df.to_dict("records"),
            columns=[
                {"name": "Département", "id": "code_departement"},
                {"name": "Nom", "id": "nom"},
                {"name": "Prix médian €/m²", "id": "prix_m2_median"},
                {"name": "Transactions", "id": "transactions"},
            ],
            style_header={"backgroundColor": SURFACE, "color": TEXT_PRIMARY, "fontWeight": "600"},
            style_cell={
                "backgroundColor": SURFACE,
                "color": TEXT_SECONDARY,
                "border": f"1px solid {GRIDLINE}",
                "fontFamily": FONT,
                "fontSize": "13px",
            },
            page_size=20,
            sort_action="native",
        )

    map_title = f"Prix médian au m² par département — {year}"
    trend_title = "Évolution du prix médian au m² (national)"
    bar_title = f"Top 15 départements les plus chers — {year}"

    return (
        kpis, map_fig, map_title, trend_fig, trend_title, bar_fig, bar_title,
        last_updated_text, table,
    )


@app.callback(
    Output("data-version", "data"),
    Input("refresh-btn", "n_clicks"),
    State("data-version", "data"),
    prevent_initial_call=True,
)
def refresh_data(n_clicks, version):
    build()
    return (version or 0) + 1


if __name__ == "__main__":
    app.run(debug=True)
