// Observatoire de la qualité de l'air — LCSQA / Géod'air (Plotly.js, sans backend)

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

const POLLUTANTS = {
  no2: { label: "NO₂", color: "#2a78d6", who: 10 },
  pm10: { label: "PM10", color: "#eb6834", who: 15 },
  pm25: { label: "PM2.5", color: "#1baf7a", who: 5 },
  o3: { label: "Ozone", color: "#eda100", who: null },
};
const KEYS = Object.keys(POLLUTANTS);

const state = {
  monthly: [], latest: null, geo: null, meta: null, months: [], idx: 0, pollutant: "no2", timer: null, names: {},
};

function baseLayout(height, topMargin) {
  return {
    paper_bgcolor: SURFACE, plot_bgcolor: SURFACE,
    font: { family: FONT, color: TEXT_SECONDARY, size: 12 },
    margin: { l: 10, r: 10, t: topMargin, b: 10 }, height,
    hoverlabel: { bgcolor: "#ffffff", bordercolor: BASELINE, font: { color: TEXT_PRIMARY, family: FONT } },
    legend: { orientation: "h", yanchor: "top", y: 1, x: 0, font: { color: TEXT_SECONDARY } },
  };
}

async function loadData() {
  const [monthly, latest, geo, meta] = await Promise.all([
    fetch("data/air_monthly.json").then((r) => r.json()),
    fetch("data/air_latest.json").then((r) => r.json()),
    fetch("data/regions.geojson").then((r) => r.json()),
    fetch("data/air_meta.json").then((r) => r.json()),
  ]);
  Object.assign(state, { monthly, latest, geo, meta });
  state.months = [...new Set(monthly.map((d) => d.mois))].sort();
  state.idx = state.months.length - 1;
  state.names = Object.fromEntries(geo.features.map((f) => [f.properties.code, f.properties.nom]));
}

function renderKPIs() {
  const n = state.latest.national;
  const tiles = KEYS.map((k) => {
    const p = POLLUTANTS[k];
    const ref = p.who ? `Repère OMS annuel : ${p.who} µg/m³` : "Pic estival possible l'après-midi";
    return `<div class="kpi-card">
      <div class="kpi-label">${p.label} — moyenne nationale</div>
      <div class="kpi-value">${n[k] == null ? "—" : n[k].toFixed(1)} µg/m³</div>
      <div class="kpi-delta">${ref}</div></div>`;
  });
  tiles.push(`<div class="kpi-card"><div class="kpi-label">Stations de mesure</div>
    <div class="kpi-value">${state.latest.stations}</div>
    <div class="kpi-delta">Relevé du ${new Date(state.latest.date).toLocaleDateString("fr-FR")}</div></div>`);
  document.getElementById("kpi-row").innerHTML = tiles.join("");
}

function renderAnim() {
  const month = state.months[state.idx];
  const p = POLLUTANTS[state.pollutant];
  const rows = state.monthly.filter((d) => d.mois === month && d[state.pollutant] != null);
  const all = state.monthly.map((d) => d[state.pollutant]).filter((v) => v != null);
  document.getElementById("anim-title").textContent = `${p.label} par région — ${month}`;
  document.getElementById("month-slider").value = state.idx;
  const layout = baseLayout(480, 10);
  layout.margin.r = 60;
  layout.geo = { visible: false, fitbounds: "locations", bgcolor: SURFACE, showcountries: false, projection: { type: "mercator" } };
  layout.transition = { duration: 500, easing: "cubic-in-out" };
  const trace = {
    type: "choropleth", geojson: state.geo, featureidkey: "properties.code",
    locations: rows.map((d) => d.code_insee_region), z: rows.map((d) => d[state.pollutant]),
    zmin: 0, zmax: Math.max(...all), text: rows.map((d) => state.names[d.code_insee_region]),
    colorscale: SEQUENTIAL_BLUE, marker: { line: { color: BASELINE, width: 0.6 } },
    colorbar: { title: { text: "µg/m³", font: { color: TEXT_SECONDARY } }, tickfont: { color: TEXT_SECONDARY }, len: 0.75 },
    hovertemplate: "<b>%{text}</b><br>" + p.label + " : %{z:.1f} µg/m³<extra></extra>",
  };
  Plotly.react("anim-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTrend() {
  const traces = KEYS.map((k) => {
    const pts = state.months.map((m) => {
      const vals = state.monthly.filter((d) => d.mois === m && d[k] != null).map((d) => d[k]);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return {
      x: state.months, y: pts, mode: "lines", name: POLLUTANTS[k].label, connectgaps: true,
      line: { color: POLLUTANTS[k].color, width: 2 },
      hovertemplate: "%{y:.1f} µg/m³<extra>" + POLLUTANTS[k].label + "</extra>",
    };
  });
  const layout = baseLayout(340, 36);
  layout.margin.l = 55; layout.margin.r = 20; layout.hovermode = "x unified";
  layout.xaxis = { showgrid: false, color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_MUTED, linecolor: BASELINE, ticksuffix: " µg" };
  Plotly.react("trend-graph", traces, layout, { displayModeBar: false, responsive: true });
}

function renderHourly() {
  const h = state.latest.hourly;
  document.getElementById("hourly-title").textContent =
    `Profil horaire national — ${new Date(state.latest.date).toLocaleDateString("fr-FR")}`;
  const traces = KEYS.map((k) => ({
    x: h.map((r) => r.heure), y: h.map((r) => r[k]), mode: "lines", name: POLLUTANTS[k].label,
    line: { color: POLLUTANTS[k].color, width: 2 },
    hovertemplate: "%{x} h — %{y:.1f} µg/m³<extra>" + POLLUTANTS[k].label + "</extra>",
  }));
  const layout = baseLayout(420, 36);
  layout.margin.l = 55; layout.margin.r = 20; layout.hovermode = "x unified";
  layout.xaxis = { showgrid: false, color: TEXT_MUTED, linecolor: BASELINE, ticksuffix: " h", dtick: 3 };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_MUTED, linecolor: BASELINE, ticksuffix: " µg" };
  Plotly.react("hourly-graph", traces, layout, { displayModeBar: false, responsive: true });
}

function renderBar() {
  const p = POLLUTANTS[state.pollutant];
  const rows = state.latest.regions
    .filter((d) => d[state.pollutant] != null && state.names[d.code_insee_region])
    .sort((a, b) => a[state.pollutant] - b[state.pollutant]);
  document.getElementById("bar-title").textContent = `${p.label} par région — dernier relevé`;
  const max = Math.max(...rows.map((d) => d[state.pollutant]), 0);
  const trace = {
    type: "bar", orientation: "h", x: rows.map((d) => d[state.pollutant]),
    y: rows.map((d) => state.names[d.code_insee_region]), marker: { color: p.color },
    text: rows.map((d) => d[state.pollutant].toFixed(1)), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 }, hovertemplate: "%{y}<br>%{x:.1f} µg/m³<extra></extra>",
  };
  const layout = baseLayout(420, 10);
  layout.margin = { l: 190, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, range: [0, max * 1.2] };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.showlegend = false;
  Plotly.react("bar-graph", [trace], layout, { displayModeBar: false, responsive: true });
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
  if (state.idx >= state.months.length - 1) state.idx = -1;
  state.timer = setInterval(() => {
    state.idx += 1;
    if (state.idx >= state.months.length) {
      state.idx = state.months.length - 1;
      return stopPlayback();
    }
    renderAnim();
  }, 350);
}

async function init() {
  await loadData();
  const d = new Date(state.meta.last_updated);
  document.getElementById("last-updated").textContent =
    `Page régénérée le ${d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  document.getElementById("app-loading").classList.add("hidden");
  document.getElementById("app-content").classList.remove("hidden");

  const slider = document.getElementById("month-slider");
  slider.min = 0;
  slider.max = state.months.length - 1;
  slider.addEventListener("input", () => {
    stopPlayback();
    state.idx = parseInt(slider.value, 10);
    renderAnim();
  });
  document.getElementById("play-btn").addEventListener("click", togglePlayback);
  document.querySelectorAll("#pollutant-toggle .segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#pollutant-toggle .segmented-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.pollutant = btn.dataset.p;
      renderAnim();
      renderBar();
    });
  });
  renderKPIs(); renderAnim(); renderTrend(); renderHourly(); renderBar();
}

init();
