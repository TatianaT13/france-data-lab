// Passages aux urgences par département — DREES (Plotly.js, sans backend)

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
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

const state = {
  meta: null, weekly: [], deptYear: [], geo: null, names: {},
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
  const [meta, weekly, deptYear, geo] = await Promise.all([
    fetch("data/urgences_meta.json").then((r) => r.json()),
    fetch("data/urgences_weekly.json").then((r) => r.json()),
    fetch("data/urgences_dept_year.json").then((r) => r.json()),
    fetch("data/departements.geojson").then((r) => r.json()),
  ]);
  Object.assign(state, { meta, weekly, deptYear, geo });
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
    `Vérifié le ${formatted} · données DREES ${state.meta.date_min} → ${state.meta.date_max}`;
}

function renderKPIs() {
  const m = state.meta;
  document.getElementById("kpi-row").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Passages estimés (2017-2023)</div>
      <div class="kpi-value">${fmtInt(m.total_passages)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Départements couverts</div>
      <div class="kpi-value">${m.n_departements}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Département le plus actif</div>
      <div class="kpi-value">${m.top_dept_nom}</div>
      <div class="kpi-delta">${fmtInt(m.top_dept_valeur)} / jour en moyenne</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Effet confinement (avril 2020 vs 2019)</div>
      <div class="kpi-value">${m.covid_pct_avril} %</div>
      <div class="kpi-delta critical">Passages quotidiens nationaux</div>
    </div>
  `;
}

function renderInsights() {
  const m = state.meta;
  const bullets = [
    `Entre 2017 et 2023, la France a enregistré environ <strong>${fmtInt(m.total_passages)} passages</strong> aux urgences sur ${m.n_departements} départements suivis.`,
    `En avril 2020, au premier confinement, les passages quotidiens ont chuté de <strong>${Math.abs(m.covid_pct_avril)} %</strong> par rapport à avril 2019 — les patients évitant ou reportant les soins non urgents.`,
    `<strong>${m.top_dept_nom}</strong> concentre le plus de passages en moyenne journalière (${fmtInt(m.top_dept_valeur)}/jour), ce qui reflète surtout sa population.`,
  ];
  document.getElementById("insights").innerHTML =
    `<h2>À retenir</h2><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

function renderTrend() {
  const trace = {
    x: state.weekly.map((d) => d.semaine), y: state.weekly.map((d) => d.total), mode: "lines",
    line: { color: BLUE, width: 2 }, fill: "tozeroy", fillcolor: "rgba(42, 120, 214, 0.10)",
    hovertemplate: "%{y:,.0f} passages<extra></extra>",
  };
  const layout = baseLayout(380, 26);
  layout.margin.l = 65;
  layout.margin.r = 20;
  layout.margin.b = 30;
  layout.xaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.shapes = [{
    type: "rect", xref: "x", yref: "paper", x0: "2020-03-16", x1: "2020-05-11", y0: 0, y1: 1,
    fillcolor: ORANGE, opacity: 0.08, line: { width: 0 },
  }];
  layout.annotations = [{
    x: "2020-04-13", y: 1.04, yref: "paper", text: "1er confinement", showarrow: false,
    yanchor: "bottom", font: { color: ORANGE, size: 11 },
  }];
  Plotly.react("trend-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderMap() {
  const year = state.years[state.yearIdx];
  const rows = state.deptYear.filter((d) => d.annee === year);
  const all = state.deptYear.map((d) => d.moyenne_journaliere);
  document.getElementById("map-title").textContent = `Moyenne journalière de passages aux urgences par département — ${year}`;
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
    locations: rows.map((d) => d.code_departement), z: rows.map((d) => d.moyenne_journaliere),
    zmin: 0, zmax: Math.max(...all),
    text: rows.map((d) => d.departement),
    colorscale: SEQUENTIAL_BLUE,
    marker: { line: { color: BASELINE, width: 0.6 } },
    colorbar: { title: { text: "passages/jour", font: { color: TEXT_SECONDARY } }, tickfont: { color: TEXT_SECONDARY }, len: 0.75 },
    hovertemplate: "<b>%{text}</b><br>%{z:.0f} passages/jour en moyenne<extra></extra>",
  };
  Plotly.react("map-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderBar() {
  const year = state.years[state.yearIdx];
  const rows = [...state.deptYear.filter((d) => d.annee === year)]
    .sort((a, b) => b.moyenne_journaliere - a.moyenne_journaliere)
    .slice(0, 15)
    .reverse();
  document.getElementById("bar-title").textContent = `Top 15 départements par passages aux urgences/jour — ${year}`;
  const trace = {
    type: "bar", orientation: "h",
    x: rows.map((d) => d.moyenne_journaliere),
    y: rows.map((d) => `${d.code_departement} · ${d.departement}`),
    marker: { color: BLUE },
    text: rows.map((d) => fmtInt(d.moyenne_journaliere)), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x:.0f} passages/jour<extra></extra>",
  };
  const layout = baseLayout(480, 10);
  layout.margin = { l: 230, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_SECONDARY, linecolor: BASELINE, range: [0, Math.max(...rows.map((d) => d.moyenne_journaliere)) * 1.2], ticksuffix: "/j" };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.showlegend = false;
  Plotly.react("bar-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderYear() {
  renderMap();
  renderBar();
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
    renderYear();
  }, 1100);
}

async function init() {
  await loadData();
  renderMeta();
  document.getElementById("app-loading").classList.add("hidden");
  document.getElementById("app-content").classList.remove("hidden");
  renderKPIs();
  renderInsights();
  renderTrend();

  const slider = document.getElementById("year-slider");
  slider.min = 0;
  slider.max = state.years.length - 1;
  slider.addEventListener("input", () => {
    stopPlayback();
    state.yearIdx = parseInt(slider.value, 10);
    renderYear();
  });
  document.getElementById("play-btn").addEventListener("click", togglePlayback);
  renderYear();
}

init();
