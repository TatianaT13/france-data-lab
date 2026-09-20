// Observatoire de l'emploi français — taux de chômage par département (Plotly.js, sans backend)

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const SURFACE = "#ffffff";
const TEXT_PRIMARY = "#0b0b0b";
const TEXT_SECONDARY = "#52514e";
const TEXT_MUTED = "#898781";
const GRIDLINE = "#ececE7";
const BASELINE = "#d8d6cf";
const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

// Rampe séquentielle pastel -> bleu (même rampe que le site immobilier)
const SEQUENTIAL_BLUE = [
  [0.0, "#e7f0fc"], [0.11, "#cde2fb"], [0.22, "#b7d3f6"], [0.33, "#9ec5f4"],
  [0.44, "#86b6ef"], [0.56, "#6da7ec"], [0.67, "#5598e7"], [0.78, "#3987e5"],
  [0.89, "#2a78d6"], [1.0, "#1c5cab"],
];

const DIVERGING_BLUE_RED = [
  [0.0, "#c23b3a"], [0.25, "#e8a29f"], [0.5, "#f0efec"], [0.75, "#9ec5f4"], [1.0, "#2a78d6"],
];

const state = { deptData: [], geo: null, meta: null, deptNames: {}, mapMode: "niveau", barSort: "desc" };

function baseLayout(height, topMargin) {
  return {
    paper_bgcolor: SURFACE,
    plot_bgcolor: SURFACE,
    font: { family: FONT, color: TEXT_SECONDARY, size: 12 },
    margin: { l: 10, r: 10, t: topMargin, b: 10 },
    height: height,
    hoverlabel: { bgcolor: "#ffffff", bordercolor: BASELINE, font: { color: TEXT_PRIMARY, family: FONT } },
  };
}

function fmtPct(v) {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}

async function loadData() {
  const [deptData, geo, meta] = await Promise.all([
    fetch("data/chomage_dept.json").then((r) => r.json()),
    fetch("data/departements.geojson").then((r) => r.json()),
    fetch("data/chomage_meta.json").then((r) => r.json()),
  ]);
  state.deptData = deptData;
  state.geo = geo;
  state.meta = meta;
  state.deptNames = Object.fromEntries(
    geo.features.map((f) => [f.properties.code, f.properties.nom])
  );
}

function renderMeta() {
  const d = new Date(state.meta.last_updated);
  const formatted = d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  document.getElementById("last-updated").textContent =
    `Données mises à jour le ${formatted} · ${state.meta.labels.actuel}`;
}

function renderKPIs() {
  const national = state.meta.national;
  const pct = national.taux_actuel - national.taux_an_dernier;
  const cls = pct <= 0 ? "good" : "critical";
  const arrow = pct <= 0 ? "▼" : "▲";
  const deltaHtml = `<div class="kpi-delta ${cls}">${arrow} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)} pt vs ${state.meta.labels.an_dernier}</div>`;

  const named = state.deptData.filter((d) => state.deptNames[d.code_departement]);
  const highest = [...named].sort((a, b) => b.taux_actuel - a.taux_actuel)[0];
  const lowest = [...named].sort((a, b) => a.taux_actuel - b.taux_actuel)[0];

  document.getElementById("kpi-row").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Taux national (${state.meta.labels.actuel})</div>
      <div class="kpi-value">${fmtPct(national.taux_actuel)}</div>
      ${deltaHtml}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Département le plus touché</div>
      <div class="kpi-value">${state.deptNames[highest.code_departement]}</div>
      <div class="kpi-delta">${fmtPct(highest.taux_actuel)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Département le moins touché</div>
      <div class="kpi-value">${state.deptNames[lowest.code_departement]}</div>
      <div class="kpi-delta">${fmtPct(lowest.taux_actuel)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Départements couverts</div>
      <div class="kpi-value">${named.length}</div>
    </div>
  `;
}

function renderMap() {
  document.getElementById("map-title").textContent =
    state.mapMode === "niveau"
      ? `Taux de chômage par département — ${state.meta.labels.actuel}`
      : `Évolution du taux de chômage vs ${state.meta.labels.an_dernier}`;

  const layout = baseLayout(560, 10);
  layout.margin.l = 10;
  layout.margin.r = 60;
  layout.geo = {
    visible: false, fitbounds: "locations", bgcolor: SURFACE, showcountries: false,
    projection: { type: "mercator" },
  };

  const named = state.deptData.filter((d) => state.deptNames[d.code_departement]);
  let trace;
  if (state.mapMode === "niveau") {
    trace = {
      type: "choropleth",
      geojson: state.geo,
      featureidkey: "properties.code",
      locations: named.map((d) => d.code_departement),
      z: named.map((d) => d.taux_actuel),
      text: named.map((d) => state.deptNames[d.code_departement]),
      customdata: named.map((d) => d.taux_actuel),
      colorscale: SEQUENTIAL_BLUE,
      marker: { line: { color: BASELINE, width: 0.6 } },
      colorbar: { title: { text: "%", font: { color: TEXT_SECONDARY } }, tickfont: { color: TEXT_SECONDARY }, len: 0.75 },
      hovertemplate: "<b>%{text}</b><br>Taux de chômage : %{customdata:.1f} %<extra></extra>",
    };
  } else {
    trace = {
      type: "choropleth",
      geojson: state.geo,
      featureidkey: "properties.code",
      locations: named.map((d) => d.code_departement),
      z: named.map((d) => d.evolution_pts),
      zmid: 0,
      text: named.map((d) => state.deptNames[d.code_departement]),
      customdata: named.map((d) => d.evolution_pts),
      colorscale: DIVERGING_BLUE_RED,
      marker: { line: { color: BASELINE, width: 0.6 } },
      colorbar: { title: { text: "pts", font: { color: TEXT_SECONDARY } }, tickfont: { color: TEXT_SECONDARY }, len: 0.75 },
      hovertemplate: "<b>%{text}</b><br>Variation : %{customdata:+.1f} pt<extra></extra>",
    };
  }

  Plotly.react("map-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderBar() {
  const ascending = state.barSort === "asc";
  const cur = [...state.deptData.filter((d) => state.deptNames[d.code_departement])]
    .sort((a, b) => (ascending ? a.taux_actuel - b.taux_actuel : b.taux_actuel - a.taux_actuel))
    .slice(0, 15)
    .reverse();
  const names = cur.map((d) => state.deptNames[d.code_departement]);
  const labels = cur.map((d) => `${d.code_departement} · ${state.deptNames[d.code_departement]}`);

  const trace = {
    type: "bar",
    orientation: "h",
    x: cur.map((d) => d.taux_actuel),
    y: labels,
    customdata: names,
    marker: { color: BLUE },
    text: cur.map((d) => fmtPct(d.taux_actuel)),
    textposition: "outside",
    cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{customdata}<br>%{x:.1f} %<extra></extra>",
  };
  const maxRate = Math.max(...cur.map((d) => d.taux_actuel), 0);

  document.getElementById("bar-title").textContent =
    `Top 15 départements les ${ascending ? "moins" : "plus"} touchés par le chômage`;
  const layout = baseLayout(560, 10);
  layout.xaxis = {
    showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE,
    range: [0, maxRate * 1.2], ticksuffix: " %",
  };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.showlegend = false;
  layout.margin = { l: 165, r: 20, t: 10, b: 30 };
  Plotly.react("bar-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTable() {
  const container = document.getElementById("table-container");
  if (!document.getElementById("table-toggle").checked) {
    container.innerHTML = "";
    return;
  }
  const rows = [...state.deptData]
    .sort((a, b) => b.taux_actuel - a.taux_actuel)
    .map(
      (d) => `
    <tr>
      <td>${d.code_departement}</td>
      <td>${state.deptNames[d.code_departement] || d.departement}</td>
      <td>${fmtPct(d.taux_actuel)}</td>
      <td>${d.evolution_pts >= 0 ? "+" : ""}${d.evolution_pts.toFixed(1)} pt</td>
    </tr>`
    )
    .join("");
  container.innerHTML = `
    <table class="dvf-table">
      <thead><tr><th>Département</th><th>Nom</th><th>Taux actuel</th><th>Évolution / an dernier</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}


function renderInsights() {
  const nat = state.meta.national;
  const named = state.deptData.filter((d) => state.deptNames[d.code_departement]);
  const up = named.filter((d) => d.evolution_pts > 0).length;
  const sorted = [...named].sort((a, b) => b.taux_actuel - a.taux_actuel);
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  const diff = nat.taux_actuel - nat.taux_an_dernier;
  const bullets = [
    `Au niveau national, le taux de chômage est de <strong>${fmtPct(nat.taux_actuel)}</strong> (${state.meta.labels.actuel}), soit <strong>${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")} point</strong> en un an.`,
    `Il a augmenté dans <strong>${up} départements sur ${named.length}</strong> depuis ${state.meta.labels.an_dernier}.`,
    `L'écart est large : <strong>${state.deptNames[hi.code_departement]}</strong> (${fmtPct(hi.taux_actuel)}) contre <strong>${state.deptNames[lo.code_departement]}</strong> (${fmtPct(lo.taux_actuel)}), soit ${(hi.taux_actuel / lo.taux_actuel).toFixed(1).replace(".", ",")} fois plus.`,
  ];
  document.getElementById("insights").innerHTML =
    `<h2>À retenir</h2><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

function renderDumbbell() {
  const rows = [...state.deptData.filter((d) => state.deptNames[d.code_departement])]
    .sort((a, b) => b.taux_actuel - a.taux_actuel)
    .slice(0, 20)
    .reverse();
  document.getElementById("dumbbell-title").textContent =
    `Les 20 départements les plus touchés : ${state.meta.labels.an_dernier} → ${state.meta.labels.actuel}`;
  const names = rows.map((d) => state.deptNames[d.code_departement]);
  const traces = rows.map((d, i) => ({
    x: [d.taux_an_dernier, d.taux_actuel], y: [names[i], names[i]], mode: "lines",
    line: { color: BASELINE, width: 3 }, hoverinfo: "skip", showlegend: false,
  }));
  traces.push({
    x: rows.map((d) => d.taux_an_dernier), y: names, mode: "markers", name: state.meta.labels.an_dernier,
    marker: { color: "#ffffff", size: 11, line: { color: BLUE, width: 2 } },
    hovertemplate: "%{y}<br>%{x:.1f} %<extra>" + state.meta.labels.an_dernier + "</extra>",
  });
  traces.push({
    x: rows.map((d) => d.taux_actuel), y: names, mode: "markers", name: state.meta.labels.actuel,
    marker: { color: BLUE, size: 11 },
    hovertemplate: "%{y}<br>%{x:.1f} %<extra>" + state.meta.labels.actuel + "</extra>",
  });
  const layout = baseLayout(560, 36);
  layout.margin = { l: 170, r: 20, t: 36, b: 30 };
  layout.xaxis = { gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, ticksuffix: " %", zeroline: false };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.legend = { orientation: "h", yanchor: "top", y: 1.08, x: 0, font: { color: TEXT_SECONDARY } };
  Plotly.react("dumbbell-graph", traces, layout, { displayModeBar: false, responsive: true });
}

function renderHist() {
  const vals = state.deptData.filter((d) => state.deptNames[d.code_departement]).map((d) => d.taux_actuel);
  const trace = {
    type: "histogram", x: vals, xbins: { start: 4, end: 14, size: 1 }, marker: { color: BLUE, line: { color: "#ffffff", width: 1 } },
    hovertemplate: "%{x} % : %{y} départements<extra></extra>",
  };
  const layout = baseLayout(340, 10);
  layout.margin = { l: 45, r: 20, t: 10, b: 45 };
  layout.bargap = 0.05;
  layout.xaxis = { title: { text: "Taux de chômage" }, ticksuffix: " %", color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = { title: { text: "Nombre de départements" }, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, zeroline: false };
  layout.shapes = [{
    type: "line", x0: state.meta.national.taux_actuel, x1: state.meta.national.taux_actuel, y0: 0, y1: 1, yref: "paper",
    line: { color: ORANGE, width: 2, dash: "dash" },
  }];
  layout.annotations = [{
    x: state.meta.national.taux_actuel, y: 1, yref: "paper", text: "France", showarrow: false, xanchor: "left", yanchor: "top", font: { color: ORANGE, size: 12 },
  }];
  Plotly.react("hist-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderDom() {
  const dom = state.deptData.filter((d) => ["971", "972", "973", "974"].includes(d.code_departement));
  const rows = [...dom.map((d) => ({ name: d.departement, v: d.taux_actuel, dom: true })),
    { name: "France hors Mayotte", v: state.meta.national.taux_actuel, dom: false }].sort((a, b) => a.v - b.v);
  const trace = {
    type: "bar", orientation: "h", x: rows.map((r) => r.v), y: rows.map((r) => r.name),
    marker: { color: rows.map((r) => (r.dom ? BLUE : BASELINE)) },
    text: rows.map((r) => fmtPct(r.v)), textposition: "outside", cliponaxis: false, textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x:.1f} %<extra></extra>",
  };
  const layout = baseLayout(340, 10);
  layout.margin = { l: 150, r: 40, t: 10, b: 30 };
  layout.xaxis = { gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, ticksuffix: " %", range: [0, Math.max(...rows.map((r) => r.v)) * 1.2] };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.showlegend = false;
  Plotly.react("dom-graph", [trace], layout, { displayModeBar: false, responsive: true });
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
  renderKPIs();
  renderInsights();
  renderDumbbell();
  renderHist();
  renderDom();
  renderMap();
  renderBar();
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
