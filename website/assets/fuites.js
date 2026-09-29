// Fuites et violations de données en France — CNIL (Plotly.js, sans backend)

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const AQUA = "#1baf7a";
const YELLOW = "#eda100";
const MAGENTA = "#e87ba4";
const GREEN = "#008300";
const SURFACE = "#ffffff";
const TEXT_PRIMARY = "#0b0b0b";
const TEXT_SECONDARY = "#52514e";
const TEXT_MUTED = "#898781";
const GRIDLINE = "#ececE7";
const BASELINE = "#d8d6cf";
const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

// Libellés longs -> version courte pour les graphiques (la légende explique le détail).
const SHORT_LABELS = {
  "Piratage, logiciel malveillant (par exemple rançongiciel) et/ou hameçonnage": "Piratage / rançongiciel / hameçonnage",
  "Données personnelles envoyées à un mauvais destinataire": "Erreur de destinataire",
  "Publication non volontaire d'informations": "Publication non volontaire",
  "Equipement perdu ou volé": "Équipement perdu ou volé",
  "Données de la mauvaise personne affichées sur le portail du client": "Mauvaises données affichées (portail client)",
  "Papier perdu, volé ou laissé accessible dans un endroit non sécurisé": "Document papier perdu ou volé",
  "Informations personnelles divulguées de façon verbale": "Divulgation verbale",
  "Courrier perdu ou ouvert avant d'être retourné à l'envoyeur": "Courrier perdu ou ouvert",
};
const short = (l) => SHORT_LABELS[l] || l;

const CAUSE_COLORS = {
  "Acte externe malveillant": ORANGE,
  "Acte interne malveillant": "#c23b3a",
  "Acte externe accidentel": BLUE,
  "Acte interne accidentel": AQUA,
  Inconnu: TEXT_MUTED,
  Autre: BASELINE,
};

const state = { meta: null, monthly: [], sectors: [], taille: [], origines: [], causes: [], info: [] };

function baseLayout(height, topMargin) {
  return {
    paper_bgcolor: SURFACE,
    plot_bgcolor: SURFACE,
    font: { family: FONT, color: TEXT_SECONDARY, size: 12 },
    margin: { l: 10, r: 10, t: topMargin, b: 10 },
    height,
    hoverlabel: { bgcolor: "#ffffff", bordercolor: BASELINE, font: { color: TEXT_PRIMARY, family: FONT } },
    legend: { orientation: "h", yanchor: "top", y: 1, x: 0, font: { color: TEXT_SECONDARY } },
  };
}

function fmtInt(v) {
  return v.toLocaleString("fr-FR");
}

async function loadData() {
  const [meta, monthly, sectors, taille, origines, causes, info] = await Promise.all([
    fetch("data/fuites_meta.json").then((r) => r.json()),
    fetch("data/fuites_monthly.json").then((r) => r.json()),
    fetch("data/fuites_sectors.json").then((r) => r.json()),
    fetch("data/fuites_taille.json").then((r) => r.json()),
    fetch("data/fuites_origines.json").then((r) => r.json()),
    fetch("data/fuites_causes.json").then((r) => r.json()),
    fetch("data/fuites_info.json").then((r) => r.json()),
  ]);
  Object.assign(state, { meta, monthly, sectors, taille, origines, causes, info });
}

function renderMeta() {
  const d = new Date(state.meta.last_updated);
  const formatted = d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  document.getElementById("last-updated").textContent =
    `Données mises à jour le ${formatted} · dernier mois disponible : ${state.meta.last_month}`;
}

function renderKPIs() {
  const m = state.meta;
  let deltaHtml = "";
  if (m.count_prev12 != null && m.count_prev12 > 0) {
    const pct = ((m.count_last12 - m.count_prev12) / m.count_prev12) * 100;
    deltaHtml = `<div class="kpi-delta">${pct >= 0 ? "+" : ""}${pct.toFixed(0)} % vs les 12 mois précédents</div>`;
  }
  document.getElementById("kpi-row").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Notifications depuis 2018</div>
      <div class="kpi-value">${fmtInt(m.total)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Sur les 12 derniers mois</div>
      <div class="kpi-value">${fmtInt(m.count_last12)}</div>
      ${deltaHtml}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Impliquent des données sensibles</div>
      <div class="kpi-value">${m.part_sensible.toFixed(1)} %</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Secteur le plus concerné</div>
      <div class="kpi-value">${m.top_secteur}</div>
    </div>
  `;
}

function renderInsights() {
  const m = state.meta;
  const topOrigin = state.origines[0];
  const originShare = ((topOrigin.count / m.total) * 100).toFixed(0);
  const bullets = [
    `Depuis mai 2018, la CNIL a reçu <strong>${fmtInt(m.total)} notifications</strong> de violations de données, dont <strong>${m.part_sensible.toFixed(0)} %</strong> concernaient des données sensibles.`,
    `<strong>${short(topOrigin.label)}</strong> est l'origine la plus fréquente, présente dans environ <strong>${originShare} %</strong> des notifications.`,
    `Le secteur <strong>${m.top_secteur}</strong> est le plus concerné, ce qui reflète aussi le grand nombre de données personnelles qu'il traite.`,
  ];
  document.getElementById("insights").innerHTML =
    `<h2>À retenir</h2><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

function renderTrend() {
  const x = state.monthly.map((d) => d.mois);
  const total = {
    x, y: state.monthly.map((d) => d.total), mode: "lines", name: "Total",
    line: { color: BLUE, width: 2 }, fill: "tozeroy", fillcolor: "rgba(42, 120, 214, 0.10)",
    hovertemplate: "%{y} notifications<extra>Total</extra>",
  };
  const sensible = {
    x, y: state.monthly.map((d) => d.sensibles), mode: "lines", name: "Dont données sensibles",
    line: { color: ORANGE, width: 2 },
    hovertemplate: "%{y} notifications<extra>Données sensibles</extra>",
  };
  const layout = baseLayout(380, 36);
  layout.margin.l = 55;
  layout.margin.r = 20;
  layout.hovermode = "x unified";
  layout.xaxis = { showgrid: false, color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_MUTED, linecolor: BASELINE };
  Plotly.react("trend-graph", [total, sensible], layout, { displayModeBar: false, responsive: true });
}

function renderSectors() {
  const rows = [...state.sectors].slice(0, 15).reverse();
  const trace = {
    type: "bar", orientation: "h", x: rows.map((d) => d.total), y: rows.map((d) => d.secteur),
    marker: { color: BLUE },
    text: rows.map((d) => fmtInt(d.total)), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x} notifications<extra></extra>",
  };
  const layout = baseLayout(480, 10);
  layout.margin = { l: 230, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, range: [0, Math.max(...rows.map((d) => d.total)) * 1.2] };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.showlegend = false;
  Plotly.react("sectors-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderOrigins() {
  const total = state.meta.total;
  const rows = [...state.origines].slice(0, 8).reverse();
  const trace = {
    type: "bar", orientation: "h", x: rows.map((d) => (d.count / total) * 100), y: rows.map((d) => short(d.label)),
    marker: { color: AQUA },
    text: rows.map((d) => `${((d.count / total) * 100).toFixed(0)} %`), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    customdata: rows.map((d) => d.count),
    hovertemplate: "%{y}<br>%{customdata} notifications (%{x:.1f} %)<extra></extra>",
  };
  const layout = baseLayout(480, 10);
  layout.margin = { l: 230, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, ticksuffix: " %" };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.showlegend = false;
  Plotly.react("origins-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderTaille() {
  const short2 = (l) => l.replace("Entre ", "").replace(" personnes", "").replace("Plus de 5000", "> 5000");
  const trace = {
    type: "bar", x: state.taille.map((d) => short2(d.label)), y: state.taille.map((d) => d.count),
    marker: { color: MAGENTA },
    text: state.taille.map((d) => fmtInt(d.count)), textposition: "outside",
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{x} personnes<br>%{y} notifications<extra></extra>",
  };
  const layout = baseLayout(340, 10);
  layout.margin = { l: 50, r: 20, t: 20, b: 40 };
  layout.xaxis = { color: TEXT_MUTED, linecolor: BASELINE };
  layout.yaxis = { gridcolor: GRIDLINE, zeroline: false, color: TEXT_MUTED, linecolor: BASELINE };
  Plotly.react("taille-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderCauses() {
  const rows = [...state.causes];
  const trace = {
    type: "pie", hole: 0.55, sort: false,
    labels: rows.map((d) => d.label), values: rows.map((d) => d.count),
    marker: { colors: rows.map((d) => CAUSE_COLORS[d.label] || BASELINE), line: { color: "#ffffff", width: 2 } },
    textinfo: "percent", textfont: { color: "#ffffff", size: 12 },
    hovertemplate: "%{label}<br>%{value} notifications (%{percent})<extra></extra>",
  };
  const layout = baseLayout(340, 10);
  layout.legend = { orientation: "v", x: 1, y: 0.5, font: { color: TEXT_SECONDARY } };
  layout.margin = { l: 10, r: 10, t: 10, b: 10 };
  Plotly.react("causes-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

function renderInfo() {
  const order = [
    "Oui, les personnes ont été informées",
    "Non, mais elles le seront",
    "Non déterminé pour le moment",
    "Non ils ne le seront pas",
  ];
  const colors = { [order[0]]: GREEN, [order[1]]: YELLOW, [order[2]]: TEXT_MUTED, [order[3]]: "#c23b3a" };
  const rows = order.map((label) => state.info.find((d) => d.label === label)).filter(Boolean);
  const trace = {
    type: "bar", orientation: "h", x: rows.map((d) => d.count), y: rows.map((d) => d.label),
    marker: { color: rows.map((d) => colors[d.label]) },
    text: rows.map((d) => fmtInt(d.count)), textposition: "outside", cliponaxis: false,
    textfont: { color: TEXT_SECONDARY, size: 11 },
    hovertemplate: "%{y}<br>%{x} notifications<extra></extra>",
  };
  const layout = baseLayout(220, 10);
  layout.margin = { l: 260, r: 30, t: 10, b: 30 };
  layout.xaxis = { showgrid: true, gridcolor: GRIDLINE, color: TEXT_MUTED, linecolor: BASELINE, range: [0, Math.max(...rows.map((d) => d.count)) * 1.2] };
  layout.yaxis = { showgrid: false, color: TEXT_SECONDARY, linecolor: BASELINE, automargin: true };
  layout.showlegend = false;
  Plotly.react("info-graph", [trace], layout, { displayModeBar: false, responsive: true });
}

async function init() {
  await loadData();
  renderMeta();
  document.getElementById("app-loading").classList.add("hidden");
  document.getElementById("app-content").classList.remove("hidden");
  renderKPIs();
  renderInsights();
  renderTrend();
  renderSectors();
  renderOrigins();
  renderTaille();
  renderCauses();
  renderInfo();
}

init();
