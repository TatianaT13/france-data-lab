// Observatoire immobilier français — dashboard statique (Plotly.js, sans backend)

const BLUE = "#3987e5";
const ORANGE = "#d95926";
const SURFACE = "#1a1a19";
const TEXT_PRIMARY = "#ffffff";
const TEXT_SECONDARY = "#c3c2b7";
const TEXT_MUTED = "#898781";
const GRIDLINE = "#2c2c2a";
const BASELINE = "#383835";
const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

const SEQUENTIAL_BLUE = [
  [0.0, "#0d0d0d"], [0.11, "#104281"], [0.22, "#184f95"], [0.33, "#1c5cab"],
  [0.44, "#256abf"], [0.56, "#2a78d6"], [0.67, "#3987e5"], [0.78, "#5598e7"],
  [0.89, "#6da7ec"], [1.0, "#86b6ef"],
];

const state = { deptData: [], monthData: [], geo: null, meta: null, deptNames: {} };

function baseLayout(title, height) {
  return {
    title: { text: title, font: { color: TEXT_PRIMARY, size: 14, family: FONT } },
    paper_bgcolor: SURFACE,
    plot_bgcolor: SURFACE,
    font: { family: FONT, color: TEXT_SECONDARY, size: 12 },
    margin: { l: 10, r: 10, t: 40, b: 10 },
    height: height,
    hoverlabel: { bgcolor: "#0d0d0d", font: { color: TEXT_PRIMARY, family: FONT } },
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, x: 0, font: { color: TEXT_SECONDARY } },
  };
}

function fmtEuro(v) {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €/m²";
}

function fmtInt(v) {
  return v.toLocaleString("fr-FR");
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

function renderKPIs(year, type) {
  const cur = state.deptData.filter((d) => d.annee === year && d.type_local === type);
  const prev = state.deptData.filter((d) => d.annee === year - 1 && d.type_local === type);

  const median = (arr, key) => {
    const vals = arr.map((d) => d[key]).sort((a, b) => a - b);
    if (!vals.length) return null;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  };

  const medianPrice = median(cur, "prix_m2_median");
  const totalTransactions = cur.reduce((s, d) => s + d.transactions, 0);

  let deltaHtml = "";
  if (prev.length) {
    const prevMedian = median(prev, "prix_m2_median");
    const pct = ((medianPrice - prevMedian) / prevMedian) * 100;
    const cls = pct >= 0 ? "good" : "critical";
    const arrow = pct >= 0 ? "▲" : "▼";
    deltaHtml = `<div class="kpi-delta ${cls}">${arrow} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)} % vs ${year - 1}</div>`;
  }

  const topDept = [...cur].sort((a, b) => b.prix_m2_median - a.prix_m2_median)[0];
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
      <div class="kpi-label">Type de bien</div>
      <div class="kpi-value">${type}</div>
    </div>
  `;
}

function renderMap(year, type) {
  const cur = state.deptData.filter((d) => d.annee === year && d.type_local === type);
  const trace = {
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
  const layout = baseLayout(`Prix médian au m² par département — ${year}`, 560);
  layout.geo = { visible: false, fitbounds: "locations", bgcolor: SURFACE, showcountries: false };
  Plotly.react("map-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTrend(type) {
  const traces = [];
  const series = type === "Tous" ? [["Appartement", ORANGE], ["Maison", BLUE]] : [[type, BLUE]];
  for (const [name, color] of series) {
    const d = state.monthData
      .filter((r) => r.type_local === name)
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
  const layout = baseLayout("Évolution du prix médian au m² (national)", 380);
  layout.xaxis = { showgrid: false, color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_MUTED, linecolor: BASELINE };
  layout.hovermode = "x unified";
  Plotly.react("trend-graph", traces, layout, { displayModeBar: false, responsive: true });
}

function renderBar(year, type) {
  const cur = [...state.deptData.filter((d) => d.annee === year && d.type_local === type)]
    .sort((a, b) => b.prix_m2_median - a.prix_m2_median)
    .slice(0, 15)
    .reverse();
  const names = cur.map((d) => state.deptNames[d.code_departement] || d.code_departement);
  const trace = {
    type: "bar",
    orientation: "h",
    x: cur.map((d) => d.prix_m2_median),
    y: names,
    marker: { color: BLUE },
    text: cur.map((d) => fmtEuro(d.prix_m2_median)),
    textposition: "outside",
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x:,.0f} €/m²<extra></extra>",
  };
  const layout = baseLayout(`Top 15 départements les plus chers — ${year}`, 560);
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE };
  layout.showlegend = false;
  layout.margin = { l: 10, r: 60, t: 40, b: 10 };
  Plotly.react("bar-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTable(year, type) {
  const container = document.getElementById("table-container");
  if (!document.getElementById("table-toggle").checked) {
    container.innerHTML = "";
    return;
  }
  const cur = [...state.deptData.filter((d) => d.annee === year && d.type_local === type)].sort(
    (a, b) => b.prix_m2_median - a.prix_m2_median
  );
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

function renderAll() {
  const year = parseInt(document.getElementById("year-select").value, 10);
  const type = document.querySelector('input[name="type"]:checked').value;
  renderKPIs(year, type);
  renderMap(year, type);
  renderTrend(type);
  renderBar(year, type);
  renderTable(year, type);
}

async function init() {
  await loadData();
  populateYearSelect();
  renderMeta();
  document.getElementById("app-loading").classList.add("hidden");
  document.getElementById("app-content").classList.remove("hidden");
  renderAll();

  document.getElementById("year-select").addEventListener("change", renderAll);
  document.querySelectorAll('input[name="type"]').forEach((el) => el.addEventListener("change", renderAll));
  document.getElementById("table-toggle").addEventListener("change", () => {
    const year = parseInt(document.getElementById("year-select").value, 10);
    const type = document.querySelector('input[name="type"]:checked').value;
    renderTable(year, type);
  });
}

init();
