// Classement des hôpitaux — HAS e-Satis / ICSHA (Plotly.js, sans backend)

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#0ca30c";
const SURFACE = "#ffffff";
const TEXT_PRIMARY = "#0b0b0b";
const TEXT_SECONDARY = "#52514e";
const TEXT_MUTED = "#898781";
const GRIDLINE = "#ececE7";
const BASELINE = "#d8d6cf";
const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

const SEQUENTIAL_BLUE = [
  [0.0, "#e7f0fc"], [0.11, "#cde2fb"], [0.22, "#b7d3f6"], [0.33, "#9ec5f4"],
  [0.44, "#86b6ef"], [0.56, "#6da7ec"], [0.67, "#5598e7"], [0.78, "#3987e5"],
  [0.89, "#2a78d6"], [1.0, "#1c5cab"],
];

const CLASSE_COLORS = { A: "#0ca30c", B: "#5598e7", C: "#eda100", D: "#e66767" };

const state = {
  meta: null, esatisTop: [], esatisRegion: [], icshaRegion: [],
  esatisClassement: [], icshaClassement: [], etablissements: [], geo: null, names: {},
};

const etabState = { sortCol: "nom", sortDir: "asc", query: "" };
const ETAB_ROW_LIMIT = 200;

function baseLayout(height, topMargin) {
  return {
    paper_bgcolor: SURFACE,
    plot_bgcolor: SURFACE,
    font: { family: FONT, color: TEXT_SECONDARY, size: 12 },
    margin: { l: 10, r: 10, t: topMargin, b: 10 },
    height,
    hoverlabel: { bgcolor: "#ffffff", bordercolor: BASELINE, font: { color: TEXT_PRIMARY, family: FONT } },
  };
}

async function loadData() {
  const [meta, esatisTop, esatisRegion, icshaRegion, esatisClassement, icshaClassement, etablissements, geo] = await Promise.all([
    fetch("data/hopitaux_meta.json").then((r) => r.json()),
    fetch("data/hopitaux_esatis_top.json").then((r) => r.json()),
    fetch("data/hopitaux_esatis_region.json").then((r) => r.json()),
    fetch("data/hopitaux_icsha_region.json").then((r) => r.json()),
    fetch("data/hopitaux_esatis_classement.json").then((r) => r.json()),
    fetch("data/hopitaux_icsha_classement.json").then((r) => r.json()),
    fetch("data/hopitaux_etablissements.json").then((r) => r.json()),
    fetch("data/regions.geojson").then((r) => r.json()),
  ]);
  Object.assign(state, { meta, esatisTop, esatisRegion, icshaRegion, esatisClassement, icshaClassement, etablissements, geo });
  state.names = Object.fromEntries(geo.features.map((f) => [f.properties.code, f.properties.nom]));
}

function renderMeta() {
  const d = new Date(state.meta.last_updated);
  const formatted = d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  document.getElementById("last-updated").textContent = `Vérifié le ${formatted} · recueil HAS le plus récent`;
}

function renderKPIs() {
  const m = state.meta;
  document.getElementById("kpi-row").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Établissements notés (e-Satis)</div>
      <div class="kpi-value">${m.n_esatis}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Satisfaction moyenne</div>
      <div class="kpi-value">${m.score_esatis_moyen} / 100</div>
      <div class="kpi-delta">${m.part_esatis_a} % en classe A</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Établissements notés (hygiène)</div>
      <div class="kpi-value">${m.n_icsha}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Hygiène des mains — classe A</div>
      <div class="kpi-value">${m.part_icsha_a} %</div>
      <div class="kpi-delta">des établissements évalués</div>
    </div>
  `;
}

function renderInsights() {
  const m = state.meta;
  const best = state.esatisTop[0];
  const bullets = [
    `Sur <strong>${m.n_esatis} établissements</strong> notés par leurs patients (e-Satis), le score moyen est de <strong>${m.score_esatis_moyen}/100</strong> et <strong>${m.part_esatis_a} %</strong> obtiennent la meilleure classe (A).`,
    `<strong>${best.nom}</strong> (${best.region}) arrive en tête avec un score de <strong>${best.score}/100</strong>.`,
    `Côté hygiène des mains, <strong>${m.part_icsha_a} %</strong> des ${m.n_icsha} établissements évalués sont en classe A — un indicateur de processus, pas une mesure directe du taux d'infection.`,
  ];
  document.getElementById("insights").innerHTML =
    `<h2>À retenir</h2><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

function renderTop() {
  const rows = [...state.esatisTop].reverse();
  const trace = {
    type: "bar", orientation: "h",
    x: rows.map((d) => d.score), y: rows.map((d) => d.nom),
    marker: { color: rows.map((d) => CLASSE_COLORS[d.classement] || BLUE) },
    customdata: rows.map((d) => [d.region, d.classement]),
    text: rows.map((d) => d.score), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{customdata[0]} · classe %{customdata[1]}<br>Score : %{x}/100<extra></extra>",
  };
  const layout = baseLayout(560, 10);
  layout.margin = { l: 320, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_SECONDARY, linecolor: BASELINE, range: [0, 100] };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.showlegend = false;
  Plotly.react("top-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderRegionMap(elId, data, title, unit) {
  const layout = baseLayout(380, 10);
  layout.margin.r = 50;
  layout.geo = {
    visible: false, fitbounds: "locations", bgcolor: SURFACE, showcountries: false,
    projection: { type: "mercator" },
  };
  const trace = {
    type: "choropleth", geojson: state.geo, featureidkey: "properties.code",
    locations: data.map((d) => d.code_region), z: data.map((d) => d.score_moyen),
    text: data.map((d) => state.names[d.code_region] || d.code_region),
    colorscale: SEQUENTIAL_BLUE,
    marker: { line: { color: BASELINE, width: 0.6 } },
    colorbar: { title: { text: unit, font: { color: TEXT_SECONDARY } }, tickfont: { color: TEXT_SECONDARY }, len: 0.75 },
    hovertemplate: "<b>%{text}</b><br>" + title + " : %{z:.1f} " + unit + "<extra></extra>",
  };
  Plotly.react(elId, [trace], layout, { displayModeBar: false, responsive: true });
}

function renderClassementDist(elId, data, colorMap) {
  const trace = {
    type: "bar", x: data.map((d) => d.classe), y: data.map((d) => d.count),
    marker: { color: data.map((d) => colorMap[d.classe] || BLUE) },
    text: data.map((d) => d.count), textposition: "outside",
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "Classe %{x}<br>%{y} établissements<extra></extra>",
  };
  const layout = baseLayout(300, 10);
  layout.margin = { l: 45, r: 20, t: 10, b: 30 };
  layout.xaxis = { color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  Plotly.react(elId, [trace], layout, { displayModeBar: false, responsive: true });
}

function normalize(s) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function sortEtabs(rows, col, dir) {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[col], bv = b[col];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string") return mul * av.localeCompare(bv, "fr");
    return mul * (av - bv);
  });
}

function renderEtabTable() {
  const q = normalize(etabState.query);
  let rows = state.etablissements;
  if (q) {
    rows = rows.filter(
      (d) => normalize(d.nom).includes(q) || normalize(d.region).includes(q) || normalize(d.type).includes(q)
    );
  }
  rows = sortEtabs(rows, etabState.sortCol, etabState.sortDir);
  const total = rows.length;
  const shown = rows.slice(0, ETAB_ROW_LIMIT);

  document.getElementById("etab-table-body").innerHTML =
    shown
      .map(
        (d) => `
    <tr>
      <td>${d.nom}</td>
      <td>${d.region}</td>
      <td>${d.type || "—"}</td>
      <td>${d.score_esatis != null ? d.score_esatis.toFixed(1) : "—"}</td>
      <td>${d.classe_esatis || "—"}</td>
      <td>${d.score_icsha != null ? d.score_icsha.toFixed(1) + " %" : "—"}</td>
      <td>${d.classe_icsha || "—"}</td>
    </tr>`
      )
      .join("") || `<tr><td colspan="7">Aucun établissement ne correspond à la recherche.</td></tr>`;

  document.getElementById("etab-count").textContent =
    total > shown.length
      ? `${shown.length} établissements affichés sur ${total} résultats — affinez la recherche pour voir les autres.`
      : `${total} établissement${total > 1 ? "s" : ""} sur ${state.etablissements.length} au total.`;

  document.querySelectorAll("#etab-table th[data-col]").forEach((th) => {
    const active = th.dataset.col === etabState.sortCol;
    th.classList.toggle("sorted", active);
    th.classList.toggle("asc", active && etabState.sortDir === "asc");
  });
}

function initEtabTable() {
  document.querySelectorAll("#etab-table th[data-col]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (etabState.sortCol === col) {
        etabState.sortDir = etabState.sortDir === "asc" ? "desc" : "asc";
      } else {
        etabState.sortCol = col;
        etabState.sortDir = col === "nom" || col === "region" || col === "type" ? "asc" : "desc";
      }
      renderEtabTable();
    });
  });
  document.getElementById("etab-search").addEventListener("input", (e) => {
    etabState.query = e.target.value;
    renderEtabTable();
  });
  renderEtabTable();
}

async function init() {
  await loadData();
  renderMeta();
  document.getElementById("app-loading").classList.add("hidden");
  document.getElementById("app-content").classList.remove("hidden");
  renderKPIs();
  renderInsights();
  renderTop();
  renderRegionMap("map-esatis-graph", state.esatisRegion, "Satisfaction", "/100");
  renderRegionMap("map-icsha-graph", state.icshaRegion, "Hygiène des mains", "%");
  renderClassementDist("dist-esatis-graph", state.esatisClassement, CLASSE_COLORS);
  renderClassementDist("dist-icsha-graph", state.icshaClassement, CLASSE_COLORS);
  initEtabTable();
}

init();
