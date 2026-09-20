// Observatoire immobilier français — dashboard statique (Plotly.js, sans backend)

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const SURFACE = "#ffffff";
const TEXT_PRIMARY = "#0b0b0b";
const TEXT_SECONDARY = "#52514e";
const TEXT_MUTED = "#898781";
const GRIDLINE = "#ececE7";
const BASELINE = "#d8d6cf";
const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

// Rampe séquentielle pastel -> bleu (palette validée, surface claire)
const SEQUENTIAL_BLUE = [
  [0.0, "#e7f0fc"], [0.11, "#cde2fb"], [0.22, "#b7d3f6"], [0.33, "#9ec5f4"],
  [0.44, "#86b6ef"], [0.56, "#6da7ec"], [0.67, "#5598e7"], [0.78, "#3987e5"],
  [0.89, "#2a78d6"], [1.0, "#1c5cab"],
];

const DIVERGING_BLUE_RED = [
  [0.0, "#c23b3a"], [0.25, "#e8a29f"], [0.5, "#f0efec"], [0.75, "#9ec5f4"], [1.0, "#2a78d6"],
];

const state = {
  deptData: [], monthData: [], geo: null, meta: null, deptNames: {},
  mapMode: "niveau", barSort: "desc",
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

function fmtEuro(v) {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €/m²";
}

function fmtInt(v) {
  return v.toLocaleString("fr-FR");
}

function currentFilters() {
  return {
    year: parseInt(document.getElementById("year-select").value, 10),
    type: document.querySelector('input[name="type"]:checked').value,
    pieces: document.getElementById("pieces-select").value,
  };
}

async function loadData() {
  const [deptData, monthData, geo, meta] = await Promise.all([
    fetch("data/dvf_dept_year.json").then((r) => r.json()),
    fetch("data/dvf_month.json").then((r) => r.json()),
    fetch("data/departements.geojson").then((r) => r.json()),
    fetch("data/meta.json").then((r) => r.json()),
  ]);
  state.deptData = deptData;
  state.monthData = monthData;
  state.geo = geo;
  state.meta = meta;
  state.deptNames = Object.fromEntries(
    geo.features.map((f) => [f.properties.code, f.properties.nom])
  );
}

function populateYearSelect() {
  const years = [...new Set(state.deptData.map((d) => d.annee))].sort();
  const select = document.getElementById("year-select");
  select.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  select.value = years[years.length - 1];
  return years;
}

function renderMeta() {
  const d = new Date(state.meta.last_updated);
  const formatted = d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const years = state.meta.years;
  document.getElementById("last-updated").textContent =
    `Données mises à jour le ${formatted} · années ${years[0]}–${years[years.length - 1]}`;
}

function renderKPIs(year, type, pieces) {
  const cur = state.deptData.filter(
    (d) => d.annee === year && d.type_local === type && d.pieces_cat === pieces
  );
  const prev = state.deptData.filter(
    (d) => d.annee === year - 1 && d.type_local === type && d.pieces_cat === pieces
  );

  const median = (arr, key) => {
    const vals = arr.map((d) => d[key]).sort((a, b) => a - b);
    if (!vals.length) return null;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  };

  const medianPrice = median(cur, "prix_m2_median");
  const totalTransactions = cur.reduce((s, d) => s + d.transactions, 0);

  let deltaHtml = "";
  if (prev.length && medianPrice !== null) {
    const prevMedian = median(prev, "prix_m2_median");
    const pct = ((medianPrice - prevMedian) / prevMedian) * 100;
    const cls = pct >= 0 ? "good" : "critical";
    const arrow = pct >= 0 ? "▲" : "▼";
    deltaHtml = `<div class="kpi-delta ${cls}">${arrow} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)} % vs ${year - 1}</div>`;
  }

  const topDept = [...cur]
    .filter((d) => state.deptNames[d.code_departement])
    .sort((a, b) => b.prix_m2_median - a.prix_m2_median)[0];
  const topName = topDept ? state.deptNames[topDept.code_departement] || topDept.code_departement : "—";
  const topValue = topDept ? fmtEuro(topDept.prix_m2_median) : "—";

  document.getElementById("kpi-row").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Prix médian national</div>
      <div class="kpi-value">${medianPrice !== null ? fmtEuro(medianPrice) : "—"}</div>
      ${deltaHtml}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Transactions</div>
      <div class="kpi-value">${fmtInt(totalTransactions)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Département le plus cher</div>
      <div class="kpi-value">${topName}</div>
      <div class="kpi-delta">${topValue}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Filtres actifs</div>
      <div class="kpi-value">${type}${pieces !== "Tous" ? " · " + pieces : ""}</div>
    </div>
  `;
}

function computeEvolution(year, type, pieces) {
  const years = [...new Set(state.deptData.map((d) => d.annee))].sort();
  const baseYear = years[0];
  const rows = state.deptData.filter((d) => d.type_local === type && d.pieces_cat === pieces);

  const byDept = {};
  rows.forEach((d) => {
    byDept[d.code_departement] = byDept[d.code_departement] || {};
    byDept[d.code_departement][d.annee] = d.prix_m2_median;
  });

  return Object.entries(byDept)
    .map(([code, byYear]) => {
      const base = byYear[baseYear];
      const cur = byYear[year];
      if (base == null || cur == null) return null;
      return { code_departement: code, pct: ((cur - base) / base) * 100 };
    })
    .filter((d) => d && state.deptNames[d.code_departement]);
}

function renderMap(year, type, pieces) {
  document.getElementById("map-title").textContent =
    state.mapMode === "niveau"
      ? `Prix médian au m² par département — ${year}`
      : `Évolution du prix médian au m² depuis ${Math.min(...state.deptData.map((d) => d.annee))} — ${year}`;

  const layout = baseLayout(560, 10);
  layout.margin.l = 10;
  layout.margin.r = 60;
  layout.geo = {
    visible: false, fitbounds: "locations", bgcolor: SURFACE, showcountries: false,
    projection: { type: "mercator" },
  };
  layout.transition = { duration: 700, easing: "cubic-in-out" };

  let trace;
  if (state.mapMode === "niveau") {
    const cur = state.deptData.filter(
      (d) => d.annee === year && d.type_local === type && d.pieces_cat === pieces
    );
    trace = {
      type: "choropleth",
      geojson: state.geo,
      featureidkey: "properties.code",
      locations: cur.map((d) => d.code_departement),
      z: cur.map((d) => d.prix_m2_median),
      text: cur.map((d) => state.deptNames[d.code_departement] || d.code_departement),
      customdata: cur.map((d) => [d.prix_m2_median, d.transactions]),
      colorscale: SEQUENTIAL_BLUE,
      marker: { line: { color: BASELINE, width: 0.6 } },
      colorbar: {
        title: { text: "€/m²", font: { color: TEXT_SECONDARY } },
        tickfont: { color: TEXT_SECONDARY },
        len: 0.75,
      },
      hovertemplate:
        "<b>%{text}</b><br>Prix médian : %{customdata[0]:,.0f} €/m²<br>Transactions : %{customdata[1]:,.0f}<extra></extra>",
    };
  } else {
    const evo = computeEvolution(year, type, pieces);
    trace = {
      type: "choropleth",
      geojson: state.geo,
      featureidkey: "properties.code",
      locations: evo.map((d) => d.code_departement),
      z: evo.map((d) => d.pct),
      zmid: 0,
      text: evo.map((d) => state.deptNames[d.code_departement] || d.code_departement),
      customdata: evo.map((d) => d.pct),
      colorscale: DIVERGING_BLUE_RED,
      marker: { line: { color: BASELINE, width: 0.6 } },
      colorbar: {
        title: { text: "% var.", font: { color: TEXT_SECONDARY } },
        tickfont: { color: TEXT_SECONDARY },
        ticksuffix: " %",
        len: 0.75,
      },
      hovertemplate: "<b>%{text}</b><br>Variation : %{customdata:+.1f} %<extra></extra>",
    };
  }

  Plotly.react("map-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTrend(type, pieces) {
  const traces = [];
  const series = type === "Tous" ? [["Appartement", ORANGE], ["Maison", BLUE]] : [[type, BLUE]];
  for (const [name, color] of series) {
    const d = state.monthData
      .filter((r) => r.type_local === name && r.pieces_cat === pieces)
      .sort((a, b) => (a.mois > b.mois ? 1 : -1));
    traces.push({
      x: d.map((r) => r.mois),
      y: d.map((r) => r.prix_m2_median),
      mode: "lines",
      name,
      line: { color, width: 2 },
      hovertemplate: "%{x}<br>%{y:,.0f} €/m²<extra>" + name + "</extra>",
    });
  }
  document.getElementById("trend-title").textContent = "Évolution du prix médian au m² (national)";
  const layout = baseLayout(380, type === "Tous" ? 36 : 10);
  layout.margin.l = 55;
  layout.margin.r = 20;
  layout.xaxis = { showgrid: false, color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = {
    gridcolor: GRIDLINE, zeroline: false, color: TEXT_MUTED, linecolor: BASELINE,
    tickformat: ",.0f", ticksuffix: " €",
  };
  layout.hovermode = "x unified";
  layout.showlegend = type === "Tous";
  Plotly.react("trend-graph", traces, layout, { displayModeBar: false, responsive: true });
}

function renderBar(year, type, pieces) {
  const ascending = state.barSort === "asc";
  const cur = [...state.deptData.filter(
    (d) => d.annee === year && d.type_local === type && d.pieces_cat === pieces
  )]
    .filter((d) => state.deptNames[d.code_departement])
    .sort((a, b) => (ascending ? a.prix_m2_median - b.prix_m2_median : b.prix_m2_median - a.prix_m2_median))
    .slice(0, 15)
    .reverse();
  const names = cur.map((d) => state.deptNames[d.code_departement] || d.code_departement);
  const labels = cur.map((d) => `${d.code_departement} · ${state.deptNames[d.code_departement] || ""}`);
  const maxPrice = Math.max(...cur.map((d) => d.prix_m2_median), 0);
  const trace = {
    type: "bar",
    orientation: "h",
    x: cur.map((d) => d.prix_m2_median),
    y: labels,
    customdata: names,
    marker: { color: BLUE },
    text: cur.map((d) => fmtEuro(d.prix_m2_median)),
    textposition: "outside",
    cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{customdata}<br>%{x:,.0f} €/m²<extra></extra>",
  };
  document.getElementById("bar-title").textContent =
    `Top 15 départements les ${ascending ? "moins" : "plus"} chers — ${year}`;
  const layout = baseLayout(560, 10);
  layout.xaxis = {
    showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE,
    range: [0, maxPrice * 1.2],
  };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.showlegend = false;
  layout.margin = { l: 165, r: 20, t: 10, b: 30 };
  Plotly.react("bar-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTable(year, type, pieces) {
  const container = document.getElementById("table-container");
  if (!document.getElementById("table-toggle").checked) {
    container.innerHTML = "";
    return;
  }
  const cur = [...state.deptData.filter(
    (d) => d.annee === year && d.type_local === type && d.pieces_cat === pieces
  )].sort((a, b) => b.prix_m2_median - a.prix_m2_median);
  const rows = cur
    .map(
      (d) => `
    <tr>
      <td>${d.code_departement}</td>
      <td>${state.deptNames[d.code_departement] || ""}</td>
      <td>${fmtInt(Math.round(d.prix_m2_median))}</td>
      <td>${fmtInt(d.transactions)}</td>
    </tr>`
    )
    .join("");
  container.innerHTML = `
    <table class="dvf-table">
      <thead><tr><th>Département</th><th>Nom</th><th>Prix médian €/m²</th><th>Transactions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}


function renderMovers(year, type, pieces) {
  const evo = computeEvolution(year, type, pieces).sort((a, b) => b.pct - a.pct);
  const base = Math.min(...state.deptData.map((d) => d.annee));
  document.getElementById("movers-title").textContent =
    `Plus fortes hausses et baisses depuis ${base} (${base} → ${year})`;
  const rows = [...evo.slice(0, 8), ...evo.slice(-8)].reverse();
  const trace = {
    type: "bar", orientation: "h",
    x: rows.map((d) => d.pct),
    y: rows.map((d) => `${d.code_departement} · ${state.deptNames[d.code_departement]}`),
    marker: { color: rows.map((d) => (d.pct >= 0 ? BLUE : ORANGE)) },
    text: rows.map((d) => `${d.pct >= 0 ? "+" : ""}${d.pct.toFixed(1)} %`),
    textposition: "outside", cliponaxis: false, textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x:+.1f} %<extra></extra>",
  };
  const maxAbs = Math.max(...rows.map((d) => Math.abs(d.pct)), 1);
  const layout = baseLayout(480, 10);
  layout.margin = { l: 170, r: 30, t: 10, b: 30 };
  layout.xaxis = {
    showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE,
    range: [-maxAbs * 1.3, maxAbs * 1.3], ticksuffix: " %", zeroline: true, zerolinecolor: BASELINE,
  };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.showlegend = false;
  Plotly.react("movers-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderScatter(year, pieces) {
  const pick = (t) =>
    Object.fromEntries(
      state.deptData
        .filter((d) => d.annee === year && d.type_local === t && d.pieces_cat === pieces && state.deptNames[d.code_departement])
        .map((d) => [d.code_departement, d.prix_m2_median])
    );
  const app = pick("Appartement");
  const mai = pick("Maison");
  const codes = Object.keys(app).filter((c) => mai[c] != null);
  document.getElementById("scatter-title").textContent = `Maison vs appartement : prix au m² par département — ${year}`;
  const max = Math.max(...codes.map((c) => Math.max(app[c], mai[c])), 1000) * 1.05;
  const traces = [
    { x: [0, max], y: [0, max], mode: "lines", line: { color: BASELINE, dash: "dash", width: 1 }, hoverinfo: "skip", showlegend: false },
    {
      x: codes.map((c) => app[c]), y: codes.map((c) => mai[c]), mode: "markers", showlegend: false,
      text: codes.map((c) => state.deptNames[c]),
      marker: { color: BLUE, size: 8, opacity: 0.75, line: { color: "#ffffff", width: 1 } },
      hovertemplate: "<b>%{text}</b><br>Appartement : %{x:,.0f} €/m²<br>Maison : %{y:,.0f} €/m²<extra></extra>",
    },
  ];
  const layout = baseLayout(480, 10);
  layout.margin = { l: 60, r: 20, t: 10, b: 50 };
  layout.xaxis = { title: { text: "Appartement (€/m²)" }, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, range: [0, max], zeroline: false };
  layout.yaxis = { title: { text: "Maison (€/m²)" }, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, range: [0, max], zeroline: false };
  Plotly.react("scatter-graph", traces, layout, { displayModeBar: false, responsive: true });
}

function renderInsights(year, type, pieces) {
  const cur = state.deptData.filter(
    (d) => d.annee === year && d.type_local === type && d.pieces_cat === pieces && state.deptNames[d.code_departement]
  );
  if (!cur.length) return;
  const sorted = [...cur].sort((a, b) => b.prix_m2_median - a.prix_m2_median);
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  const evo = computeEvolution(year, type, pieces).sort((a, b) => b.pct - a.pct);
  const base = Math.min(...state.deptData.map((d) => d.annee));
  const name = (c) => state.deptNames[c];
  const bullets = [
    `Le département le plus cher est <strong>${name(hi.code_departement)}</strong> (${fmtEuro(hi.prix_m2_median)}), soit <strong>${(hi.prix_m2_median / lo.prix_m2_median).toFixed(1).replace(".", ",")} fois</strong> le moins cher, <strong>${name(lo.code_departement)}</strong> (${fmtEuro(lo.prix_m2_median)}).`,
  ];
  if (evo.length && year > base) {
    const up = evo[0];
    const down = evo[evo.length - 1];
    bullets.push(
      `Depuis ${base}, la plus forte hausse est en <strong>${name(up.code_departement)}</strong> (${up.pct >= 0 ? "+" : ""}${up.pct.toFixed(1)} %) et la plus forte baisse en <strong>${name(down.code_departement)}</strong> (${down.pct >= 0 ? "+" : ""}${down.pct.toFixed(1)} %).`
    );
  }
  bullets.push(`Cette lecture porte sur ${fmtInt(cur.reduce((s, d) => s + d.transactions, 0))} ventes en ${year}.`);
  document.getElementById("insights").innerHTML =
    `<h2>À retenir</h2><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

function renderAll() {
  const { year, type, pieces } = currentFilters();
  renderKPIs(year, type, pieces);
  renderMap(year, type, pieces);
  renderTrend(type, pieces);
  renderBar(year, type, pieces);
  renderTable(year, type, pieces);
  renderInsights(year, type, pieces);
  renderMovers(year, type, pieces);
  renderScatter(year, pieces);
}

let playTimer = null;

function stopPlayback() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  const btn = document.getElementById("play-btn");
  btn.textContent = "▶ Animer";
  btn.classList.remove("playing");
}

function togglePlayback() {
  const btn = document.getElementById("play-btn");
  if (playTimer) {
    stopPlayback();
    return;
  }
  const select = document.getElementById("year-select");
  const years = [...select.options].map((o) => parseInt(o.value, 10));
  btn.textContent = "⏸ Pause";
  btn.classList.add("playing");

  let idx = years.indexOf(parseInt(select.value, 10));
  if (idx === -1 || idx === years.length - 1) idx = -1;

  playTimer = setInterval(() => {
    idx += 1;
    if (idx >= years.length) {
      stopPlayback();
      return;
    }
    select.value = years[idx];
    renderAll();
  }, 1300);
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
  populateYearSelect();
  renderMeta();
  document.getElementById("app-loading").classList.add("hidden");
  document.getElementById("app-content").classList.remove("hidden");
  renderAll();

  document.getElementById("year-select").addEventListener("change", () => {
    stopPlayback();
    renderAll();
  });
  document.getElementById("pieces-select").addEventListener("change", renderAll);
  document.querySelectorAll('input[name="type"]').forEach((el) => el.addEventListener("change", renderAll));
  document.getElementById("table-toggle").addEventListener("change", renderAll);
  document.getElementById("play-btn").addEventListener("click", togglePlayback);

  setupSegmented("map-mode-toggle", "mode", (mode) => {
    state.mapMode = mode;
    const { year, type, pieces } = currentFilters();
    renderMap(year, type, pieces);
  });
  setupSegmented("bar-sort-toggle", "sort", (sort) => {
    state.barSort = sort;
    const { year, type, pieces } = currentFilters();
    renderBar(year, type, pieces);
  });
}

init();
