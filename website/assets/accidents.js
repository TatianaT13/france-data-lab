// Accidents corporels de la circulation — ONISR/BAAC (Plotly.js, sans backend)

const BLUE = "#2a78d6";
const RED = "#d03b3b";
const SURFACE = "#ffffff";
const TEXT_PRIMARY = "#0b0b0b";
const TEXT_SECONDARY = "#52514e";
const GRIDLINE = "#ececE7";
const BASELINE = "#d8d6cf";
const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

const SEQUENTIAL_BLUE = [
  [0.0, "#e7f0fc"], [0.11, "#cde2fb"], [0.22, "#b7d3f6"], [0.33, "#9ec5f4"],
  [0.44, "#86b6ef"], [0.56, "#6da7ec"], [0.67, "#5598e7"], [0.78, "#3987e5"],
  [0.89, "#2a78d6"], [1.0, "#1c5cab"],
];

const SEVERITY_COLORS = { "Indemne": "#0ca30c", "Blessé léger": "#eda100", "Blessé hospitalisé": "#eb6834", "Tué": RED };

const state = {
  meta: null, monthly: [], deptYear: [], severity: [], geo: null, names: {},
  roadCategory: [], topRoutes: null, speedLimit: [], maneuvers: [],
  years: [], yearIdx: 0, timer: null,
};

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

function fmtInt(v) {
  return Math.round(v).toLocaleString("fr-FR");
}

async function loadData() {
  const [meta, monthly, deptYear, severity, roadCategory, topRoutes, speedLimit, maneuvers, geo] = await Promise.all([
    fetch("data/accidents_meta.json").then((r) => r.json()),
    fetch("data/accidents_monthly.json").then((r) => r.json()),
    fetch("data/accidents_dept_year.json").then((r) => r.json()),
    fetch("data/accidents_severity.json").then((r) => r.json()),
    fetch("data/accidents_road_category.json").then((r) => r.json()),
    fetch("data/accidents_top_routes.json").then((r) => r.json()),
    fetch("data/accidents_speed_limit.json").then((r) => r.json()),
    fetch("data/accidents_maneuvers.json").then((r) => r.json()),
    fetch("data/departements.geojson").then((r) => r.json()),
  ]);
  Object.assign(state, { meta, monthly, deptYear, severity, roadCategory, topRoutes, speedLimit, maneuvers, geo });
  state.names = Object.fromEntries(geo.features.map((f) => [f.properties.code, f.properties.nom]));
  state.years = [...new Set(deptYear.map((d) => d.annee))].sort();
  state.yearIdx = state.years.length - 1;
}

function renderMeta() {
  const d = new Date(state.meta.last_updated);
  const formatted = d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  document.getElementById("last-updated").textContent =
    `Vérifié le ${formatted} · données ONISR ${state.meta.annee_min}-${state.meta.annee_max}`;
}

function renderKPIs() {
  const m = state.meta;
  const nYears = m.annee_max - m.annee_min + 1;
  document.getElementById("kpi-row").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Accidents corporels (${m.annee_min}-${m.annee_max})</div>
      <div class="kpi-value">${fmtInt(m.total_accidents)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Personnes tuées</div>
      <div class="kpi-value">${fmtInt(m.total_tues)}</div>
      <div class="kpi-delta critical">≈ ${fmtInt(m.total_tues / nYears)} / an</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Usagers impliqués</div>
      <div class="kpi-value">${fmtInt(m.total_usagers)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Départements couverts</div>
      <div class="kpi-value">${m.n_departements}</div>
    </div>
  `;
}

function renderInsights() {
  const m = state.meta;
  const tueCount = state.severity.find((s) => s.gravite === "Tué")?.count || 0;
  const pctTue = ((tueCount / m.total_usagers) * 100).toFixed(1);
  const topName = state.names[m.top_dept_tues_code] || m.top_dept_tues_code;
  const topCategorie = [...state.roadCategory].sort((a, b) => b.nb_tues - a.nb_tues)[0];
  const pctCategorie = ((topCategorie.nb_tues / m.total_tues) * 100).toFixed(0);
  const bullets = [
    `Entre ${m.annee_min} et ${m.annee_max}, la France a enregistré <strong>${fmtInt(m.total_accidents)} accidents corporels</strong>, causant <strong>${fmtInt(m.total_tues)} décès</strong>.`,
    `Sur les ${fmtInt(m.total_usagers)} usagers impliqués, <strong>${pctTue} %</strong> ont été tués — la majorité des accidents corporels n'est pas mortelle, mais chacun implique au moins un blessé.`,
    `La catégorie <strong>${topCategorie.categorie.toLowerCase()}</strong> concentre à elle seule <strong>${pctCategorie} %</strong> des tués (${fmtInt(topCategorie.nb_tues)}) — la catégorie de route la plus meurtrière, loin devant les autoroutes.`,
    `En ${m.top_dept_tues_annee} (dernière année disponible), <strong>${topName}</strong> est le département comptant le plus de tués en nombre brut (${fmtInt(m.top_dept_tues_valeur)}), ce qui reflète surtout le volume de trafic routier — pas un taux par habitant.`,
  ];
  document.getElementById("insights").innerHTML =
    `<h2>À retenir</h2><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

function renderMonthly() {
  const trace = {
    x: state.monthly.map((d) => d.mois), y: state.monthly.map((d) => d.nb_accidents), mode: "lines",
    line: { color: BLUE, width: 2 }, fill: "tozeroy", fillcolor: "rgba(42, 120, 214, 0.10)",
    hovertemplate: "%{y:,.0f} accidents<extra></extra>",
  };
  const layout = baseLayout(360, 10);
  layout.margin = { l: 55, r: 20, t: 10, b: 30 };
  layout.xaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  Plotly.react("monthly-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTuesMonthly() {
  const trace = {
    x: state.monthly.map((d) => d.mois), y: state.monthly.map((d) => d.nb_tues), mode: "lines",
    line: { color: RED, width: 2 }, fill: "tozeroy", fillcolor: "rgba(208, 59, 59, 0.10)",
    hovertemplate: "%{y:,.0f} tués<extra></extra>",
  };
  const layout = baseLayout(300, 10);
  layout.margin = { l: 40, r: 20, t: 10, b: 30 };
  layout.xaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  Plotly.react("tues-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderSeverity() {
  const trace = {
    type: "bar", x: state.severity.map((d) => d.gravite), y: state.severity.map((d) => d.count),
    marker: { color: state.severity.map((d) => SEVERITY_COLORS[d.gravite] || BLUE) },
    text: state.severity.map((d) => fmtInt(d.count)), textposition: "outside",
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{x}<br>%{y:,.0f} usagers<extra></extra>",
  };
  const layout = baseLayout(300, 10);
  layout.margin = { l: 50, r: 20, t: 10, b: 30 };
  layout.xaxis = { color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  Plotly.react("severity-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderRoadCategory() {
  const rows = [...state.roadCategory].reverse();
  const trace = {
    type: "bar", orientation: "h",
    x: rows.map((d) => d.nb_tues), y: rows.map((d) => d.categorie),
    marker: { color: RED },
    text: rows.map((d) => fmtInt(d.nb_tues)), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    customdata: rows.map((d) => d.nb_accidents),
    hovertemplate: "%{y}<br>%{customdata:,.0f} accidents<br>%{x:,.0f} tués<extra></extra>",
  };
  const layout = baseLayout(280, 10);
  layout.margin = { l: 190, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.showlegend = false;
  Plotly.react("road-category-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderSpeedLimit() {
  const trace = {
    type: "bar", x: state.speedLimit.map((d) => d.vitesse), y: state.speedLimit.map((d) => d.nb_tues),
    marker: { color: RED },
    text: state.speedLimit.map((d) => fmtInt(d.nb_tues)), textposition: "outside",
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{x}<br>%{y:,.0f} tués<extra></extra>",
  };
  const layout = baseLayout(300, 10);
  layout.margin = { l: 50, r: 20, t: 10, b: 30 };
  layout.xaxis = { color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  Plotly.react("speed-limit-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTopRoutes() {
  const rows = [...state.topRoutes.routes].reverse();
  document.getElementById("top-routes-note").textContent =
    `Numéro de route identifié avec certitude pour ${state.topRoutes.couverture_pct} % des accidents sur autoroute ou route nationale ; les enregistrements ambigus sont exclus plutôt que mal classés.`;
  const trace = {
    type: "bar", orientation: "h",
    x: rows.map((d) => d.nb_tues), y: rows.map((d) => `${d.route} · ${d.categorie}`),
    marker: { color: BLUE },
    text: rows.map((d) => fmtInt(d.nb_tues)), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    customdata: rows.map((d) => d.nb_accidents),
    hovertemplate: "%{y}<br>%{customdata:,.0f} accidents<br>%{x:,.0f} tués<extra></extra>",
  };
  const layout = baseLayout(420, 10);
  layout.margin = { l: 150, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.showlegend = false;
  Plotly.react("top-routes-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderManeuvers() {
  const rows = [...state.maneuvers].reverse();
  const trace = {
    type: "bar", orientation: "h",
    x: rows.map((d) => d.count), y: rows.map((d) => d.manoeuvre),
    marker: { color: RED },
    text: rows.map((d) => fmtInt(d.count)), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x:,.0f} véhicules<extra></extra>",
  };
  const layout = baseLayout(380, 10);
  layout.margin = { l: 230, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.showlegend = false;
  Plotly.react("maneuvers-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderMap() {
  const year = state.years[state.yearIdx];
  const rows = state.deptYear.filter((d) => d.annee === year);
  const all = state.deptYear.map((d) => d.nb_accidents);
  document.getElementById("map-title").textContent = `Accidents corporels par département — ${year}`;
  document.getElementById("year-slider").value = state.yearIdx;

  const layout = baseLayout(560, 10);
  layout.margin.l = 10;
  layout.margin.r = 60;
  layout.geo = {
    visible: false, fitbounds: "locations", bgcolor: SURFACE, showcountries: false,
    projection: { type: "mercator" },
  };
  layout.transition = { duration: 600, easing: "cubic-in-out" };

  const trace = {
    type: "choropleth", geojson: state.geo, featureidkey: "properties.code",
    locations: rows.map((d) => d.code_departement), z: rows.map((d) => d.nb_accidents),
    zmin: 0, zmax: Math.max(...all),
    text: rows.map((d) => state.names[d.code_departement] || d.code_departement),
    customdata: rows.map((d) => d.nb_tues),
    colorscale: SEQUENTIAL_BLUE,
    marker: { line: { color: BASELINE, width: 0.6 } },
    colorbar: { title: { text: "accidents", font: { color: TEXT_SECONDARY } }, tickfont: { color: TEXT_SECONDARY }, len: 0.75 },
    hovertemplate: "<b>%{text}</b><br>%{z:,.0f} accidents<br>%{customdata:,.0f} tués<extra></extra>",
  };
  Plotly.react("map-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function stopPlayback() {
  clearInterval(state.timer);
  state.timer = null;
  const btn = document.getElementById("play-btn");
  btn.textContent = "▶ Animer";
  btn.classList.remove("playing");
}

function togglePlayback() {
  if (state.timer) return stopPlayback();
  const btn = document.getElementById("play-btn");
  btn.textContent = "⏸ Pause";
  btn.classList.add("playing");
  if (state.yearIdx >= state.years.length - 1) state.yearIdx = -1;
  state.timer = setInterval(() => {
    state.yearIdx += 1;
    if (state.yearIdx >= state.years.length) {
      state.yearIdx = state.years.length - 1;
      return stopPlayback();
    }
    renderMap();
  }, 1100);
}

async function init() {
  await loadData();
  renderMeta();
  document.getElementById("app-loading").classList.add("hidden");
  document.getElementById("app-content").classList.remove("hidden");
  renderKPIs();
  renderInsights();
  renderMonthly();
  renderTuesMonthly();
  renderSeverity();
  renderRoadCategory();
  renderSpeedLimit();
  renderTopRoutes();
  renderManeuvers();

  const slider = document.getElementById("year-slider");
  slider.min = 0;
  slider.max = state.years.length - 1;
  slider.value = state.yearIdx;
  slider.addEventListener("input", () => {
    stopPlayback();
    state.yearIdx = parseInt(slider.value, 10);
    renderMap();
  });
  document.getElementById("play-btn").addEventListener("click", togglePlayback);
  renderMap();
}

init();
