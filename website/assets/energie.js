// Observatoire de l'énergie français — RTE éCO2mix (Plotly.js, sans backend)

const SURFACE = "#ffffff";
const TEXT_PRIMARY = "#0b0b0b";
const TEXT_SECONDARY = "#52514e";
const TEXT_MUTED = "#898781";
const GRIDLINE = "#ececE7";
const BASELINE = "#d8d6cf";
const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

// Ordre catégoriel fixe validé (skill dataviz) — utilisé tel quel pour l'empilement.
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const AQUA = "#1baf7a";
const YELLOW = "#eda100";
const MAGENTA = "#e87ba4";
const GREEN = "#008300";
const VIOLET = "#4a3aa7";

const SEQUENTIAL_BLUE = [
  [0.0, "#e7f0fc"], [0.11, "#cde2fb"], [0.22, "#b7d3f6"], [0.33, "#9ec5f4"],
  [0.44, "#86b6ef"], [0.56, "#6da7ec"], [0.67, "#5598e7"], [0.78, "#3987e5"],
  [0.89, "#2a78d6"], [1.0, "#1c5cab"],
];

const MIX_SERIES = [
  { key: "nucleaire", name: "Nucléaire", color: BLUE },
  { key: "gaz", name: "Gaz", color: ORANGE },
  { key: "hydraulique", name: "Hydraulique", color: AQUA },
  { key: "eolien", name: "Éolien", color: YELLOW },
  { key: "solaire", name: "Solaire", color: MAGENTA },
  { key: "bioenergies", name: "Bioénergies", color: GREEN },
  { key: "fioul_charbon", name: "Fioul & charbon", color: VIOLET },
];

const state = {
  latest: null, exchanges: [], history: [], regional: [], yearly: [], metric: "part_renouvelable", yearIdx: 0, years: [], timer: null, geo: null, meta: null, regionNames: {},
  mapMode: "consommation", barSort: "desc",
};

function baseLayout(height, topMargin) {
  return {
    paper_bgcolor: SURFACE,
    plot_bgcolor: SURFACE,
    font: { family: FONT, color: TEXT_SECONDARY, size: 12 },
    margin: { l: 10, r: 10, t: topMargin, b: 10 },
    height: height,
    hoverlabel: { bgcolor: "#ffffff", bordercolor: BASELINE, font: { color: TEXT_PRIMARY, family: FONT } },
    legend: { orientation: "h", yanchor: "top", y: 1, x: 0, font: { color: TEXT_SECONDARY } },
  };
}

function fmtMW(v) {
  return Math.round(v).toLocaleString("fr-FR") + " MW";
}

async function loadData() {
  const [latest, exchanges, history, regional, yearly, geo, meta] = await Promise.all([
    fetch("data/energie_latest.json").then((r) => r.json()),
    fetch("data/energie_exchanges.json").then((r) => r.json()),
    fetch("data/energie_history.json").then((r) => r.json()),
    fetch("data/energie_regional.json").then((r) => r.json()),
    fetch("data/energie_yearly.json").then((r) => r.json()),
    fetch("data/regions.geojson").then((r) => r.json()),
    fetch("data/energie_meta.json").then((r) => r.json()),
  ]);
  Object.assign(state, { latest, exchanges, history, regional, yearly, geo, meta });
  state.years = [...new Set(yearly.map((d) => d.annee))].sort();
  state.yearIdx = state.years.length - 1;
  state.regionNames = Object.fromEntries(geo.features.map((f) => [f.properties.code, f.properties.nom]));
}


const METRIC_LABELS = {
  part_renouvelable: "Part renouvelable", part_eolien: "Part éolienne",
  part_solaire: "Part solaire", part_nucleaire: "Part nucléaire",
};

function renderYearly() {
  const year = state.years[state.yearIdx];
  const rows = state.yearly.filter((d) => d.annee === year);
  const all = state.yearly.map((d) => d[state.metric]);
  document.getElementById("yearly-title").textContent =
    `${METRIC_LABELS[state.metric]} de la production régionale — ${year}`;
  document.getElementById("yearly-slider").value = state.yearIdx;
  const layout = baseLayout(480, 10);
  layout.margin.r = 60;
  layout.geo = {
    visible: false, fitbounds: "locations", bgcolor: SURFACE, showcountries: false,
    projection: { type: "mercator" },
  };
  layout.transition = { duration: 600, easing: "cubic-in-out" };
  const trace = {
    type: "choropleth",
    geojson: state.geo,
    featureidkey: "properties.code",
    locations: rows.map((d) => d.code_insee_region),
    z: rows.map((d) => d[state.metric]),
    zmin: 0,
    zmax: Math.max(...all),
    text: rows.map((d) => d.libelle_region),
    colorscale: SEQUENTIAL_BLUE,
    marker: { line: { color: BASELINE, width: 0.6 } },
    colorbar: { title: { text: "%", font: { color: TEXT_SECONDARY } }, tickfont: { color: TEXT_SECONDARY }, len: 0.75 },
    hovertemplate: "<b>%{text}</b><br>" + METRIC_LABELS[state.metric] + " : %{z:.1f} %<extra></extra>",
  };
  Plotly.react("yearly-graph", [trace], layout, { displayModeBar: false, responsive: true });
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
    renderYearly();
  }, 900);
}

function renderMeta() {
  const d = new Date(state.meta.last_updated);
  const formatted = d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const mesure = new Date(state.meta.latest_mesure).toLocaleString("fr-FR", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  });
  document.getElementById("last-updated").textContent =
    `Page régénérée le ${formatted} · dernier relevé réel : ${mesure}`;
}

function renderKPIs() {
  const l = state.latest;
  const exportNet = l.ech_physiques < 0;
  const topRegion = [...state.regional].sort((a, b) => b.consommation - a.consommation)[0];

  document.getElementById("kpi-row").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Consommation nationale</div>
      <div class="kpi-value">${fmtMW(l.consommation)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Intensité carbone</div>
      <div class="kpi-value">${l.taux_co2} gCO₂/kWh</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Part nucléaire</div>
      <div class="kpi-value">${l.part_nucleaire.toFixed(1)} %</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Part renouvelable</div>
      <div class="kpi-value">${l.part_renouvelable.toFixed(1)} %</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Solde international</div>
      <div class="kpi-value">${fmtMW(Math.abs(l.ech_physiques))}</div>
      <div class="kpi-delta ${exportNet ? "good" : ""}">${exportNet ? "Export net ▲" : "Import net ▼"}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Région la + consommatrice</div>
      <div class="kpi-value">${topRegion.libelle_region}</div>
      <div class="kpi-delta">${fmtMW(topRegion.consommation)}</div>
    </div>
  `;
}

function renderMix() {
  const x = state.history.map((h) => h.date_heure);
  const traces = MIX_SERIES.map((s) => ({
    x,
    y: state.history.map((h) => h[s.key]),
    name: s.name,
    mode: "lines",
    stackgroup: "mix",
    line: { width: 0.5, color: s.color },
    fillcolor: s.color,
    hovertemplate: "%{y:,.0f} MW<extra>" + s.name + "</extra>",
  }));
  const layout = baseLayout(420, 36);
  layout.margin.l = 55;
  layout.margin.r = 20;
  layout.legend.traceorder = "normal";
  layout.xaxis = { showgrid: false, color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = {
    gridcolor: GRIDLINE, zeroline: false, color: TEXT_MUTED, linecolor: BASELINE,
    ticksuffix: " MW",
  };
  layout.hovermode = "x unified";
  Plotly.react("mix-graph", traces, layout, { displayModeBar: false, responsive: true });
}

function renderCO2() {
  const x = state.history.map((h) => h.date_heure);
  const y = state.history.map((h) => h.taux_co2);
  const trace = {
    x, y, mode: "lines", fill: "tozeroy",
    line: { color: TEXT_SECONDARY, width: 2 },
    fillcolor: "rgba(82, 81, 78, 0.08)",
    hovertemplate: "%{y} gCO₂/kWh<extra></extra>",
  };
  const layout = baseLayout(220, 10);
  layout.margin.l = 55;
  layout.margin.r = 20;
  layout.xaxis = { showgrid: false, color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = {
    gridcolor: GRIDLINE, zeroline: false, color: TEXT_MUTED, linecolor: BASELINE,
    ticksuffix: " g",
  };
  Plotly.react("co2-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderMap() {
  const isRenouvelable = state.mapMode === "renouvelable";
  document.getElementById("map-title").textContent = isRenouvelable
    ? "Part renouvelable de la production régionale (instantané)"
    : "Consommation électrique par région (instantané)";

  const layout = baseLayout(520, 10);
  layout.margin.l = 10;
  layout.margin.r = 60;
  layout.geo = {
    visible: false, fitbounds: "locations", bgcolor: SURFACE, showcountries: false,
    projection: { type: "mercator" },
  };

  const trace = {
    type: "choropleth",
    geojson: state.geo,
    featureidkey: "properties.code",
    locations: state.regional.map((d) => d.code_insee_region),
    z: state.regional.map((d) => (isRenouvelable ? d.part_renouvelable : d.consommation)),
    text: state.regional.map((d) => d.libelle_region),
    customdata: state.regional.map((d) => [d.consommation, d.part_renouvelable]),
    colorscale: SEQUENTIAL_BLUE,
    marker: { line: { color: BASELINE, width: 0.6 } },
    colorbar: {
      title: { text: isRenouvelable ? "%" : "MW", font: { color: TEXT_SECONDARY } },
      tickfont: { color: TEXT_SECONDARY },
      len: 0.75,
    },
    hovertemplate:
      "<b>%{text}</b><br>Consommation : %{customdata[0]:,.0f} MW<br>Part renouvelable (production locale) : %{customdata[1]:.1f} %<extra></extra>",
  };
  Plotly.react("map-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderBar() {
  const ascending = state.barSort === "asc";
  const cur = [...state.regional]
    .sort((a, b) => (ascending ? a.consommation - b.consommation : b.consommation - a.consommation))
    .reverse();
  const labels = cur.map((d) => d.libelle_region);
  const trace = {
    type: "bar",
    orientation: "h",
    x: cur.map((d) => d.consommation),
    y: labels,
    marker: { color: BLUE },
    text: cur.map((d) => fmtMW(d.consommation)),
    textposition: "outside",
    cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x:,.0f} MW<extra></extra>",
  };
  const maxVal = Math.max(...cur.map((d) => d.consommation), 0);
  document.getElementById("bar-title").textContent =
    `Régions classées par consommation (${ascending ? "croissant" : "décroissant"})`;
  const layout = baseLayout(520, 10);
  layout.xaxis = {
    showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE,
    range: [0, maxVal * 1.2],
  };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.showlegend = false;
  layout.margin = { l: 190, r: 20, t: 10, b: 30 };
  Plotly.react("bar-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderExchanges() {
  const sorted = [...state.exchanges].sort((a, b) => a.solde - b.solde);
  const colors = sorted.map((d) => (d.solde >= 0 ? BLUE : ORANGE));
  const trace = {
    type: "bar",
    orientation: "h",
    x: sorted.map((d) => d.solde),
    y: sorted.map((d) => d.pays),
    marker: { color: colors },
    text: sorted.map((d) => `${d.solde >= 0 ? "+" : ""}${fmtMW(d.solde)}`),
    textposition: "outside",
    cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x:,.0f} MW<extra></extra>",
  };
  const layout = baseLayout(260, 10);
  const maxAbs = Math.max(...sorted.map((d) => Math.abs(d.solde)), 1);
  layout.xaxis = {
    showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE,
    range: [-maxAbs * 1.4, maxAbs * 1.4], zeroline: true, zerolinecolor: BASELINE,
  };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.showlegend = false;
  layout.margin = { l: 150, r: 20, t: 10, b: 30 };
  Plotly.react("exchange-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTable() {
  const container = document.getElementById("table-container");
  if (!document.getElementById("table-toggle").checked) {
    container.innerHTML = "";
    return;
  }
  const rows = [...state.regional]
    .sort((a, b) => b.consommation - a.consommation)
    .map(
      (d) => `
    <tr>
      <td>${d.libelle_region}</td>
      <td>${fmtMW(d.consommation)}</td>
      <td>${d.part_renouvelable.toFixed(1)} %</td>
      <td>${new Date(d.date_heure).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</td>
    </tr>`
    )
    .join("");
  container.innerHTML = `
    <table class="dvf-table">
      <thead><tr><th>Région</th><th>Consommation</th><th>% Renouvelable (local)</th><th>Dernier relevé</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function setupSegmented(containerId, dataAttr, onChange) {
  const container = document.getElementById(containerId);
  container.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".segmented-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onChange(btn.dataset[dataAttr]);
    });
  });
}

async function init() {
  await loadData();
  renderMeta();
  document.getElementById("app-loading").classList.add("hidden");
  document.getElementById("app-content").classList.remove("hidden");
  const slider = document.getElementById("yearly-slider");
  slider.min = 0;
  slider.max = state.years.length - 1;
  slider.addEventListener("input", () => {
    stopPlayback();
    state.yearIdx = parseInt(slider.value, 10);
    renderYearly();
  });
  document.getElementById("play-btn").addEventListener("click", togglePlayback);
  setupSegmented("yearly-metric-toggle", "metric", (m) => {
    state.metric = m;
    renderYearly();
  });
  renderYearly();
  renderKPIs();
  renderMix();
  renderCO2();
  renderMap();
  renderBar();
  renderExchanges();
  renderTable();

  document.getElementById("table-toggle").addEventListener("change", renderTable);
  setupSegmented("map-mode-toggle", "mode", (mode) => {
    state.mapMode = mode;
    renderMap();
  });
  setupSegmented("bar-sort-toggle", "sort", (sort) => {
    state.barSort = sort;
    renderBar();
  });
}

init();
