const form = document.getElementById("analyzeForm");
const chainEl = document.getElementById("chain");
const caEl = document.getElementById("ca");
const statusEl = document.getElementById("status");
const resultCardEl = document.getElementById("resultCard");
const metricsEl = document.getElementById("metrics");
const holdersBodyEl = document.getElementById("holdersBody");
const analyzeBtn = document.getElementById("analyzeBtn");

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtPct(v) {
  const n = Number(v || 0);
  return n.toFixed(4);
}

function setStatus(message, cls = "") {
  statusEl.className = `status ${cls}`.trim();
  statusEl.textContent = message;
}

function tipClass(type) {
  if (type === "Exchange") return "pill-exchange";
  if (type === "Contract") return "pill-contract";
  return "pill-wallet";
}

function renderMetrics(data) {
  const metrics = [
    ["Chain", data.chainName],
    ["CA", data.contractAddress],
    ["Symbol", data.symbol || "-"],
    ["Top 20 Total", `${fmtPct(data.top20PercentageSum)}%`],
    ["Contract", String(data.counts?.contract ?? 0)],
    ["Exchange", String(data.counts?.exchange ?? 0)],
    ["Wallet/EOA", String(data.counts?.wallet ?? 0)],
    ["Top 3", `${fmtPct(data.top3PercentageSum)}%`],
    ["Top 10", `${fmtPct(data.top10PercentageSum)}%`],
    ["Total Supply", data.totalSupply || "-"],
    ["Holders", data.holdersCount || "-"],
    ["Snapshot", data.asAtUtc || "-"]
  ];

  metricsEl.innerHTML = metrics
    .map(
      ([k, v]) =>
        `<div class="metric"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`
    )
    .join("");
}

function renderTableRows(data) {
  holdersBodyEl.innerHTML = data.holders
    .map((h) => {
      const label = h.label || `${h.address.slice(0, 8)}...${h.address.slice(-4)}`;
      const typeText = h.typeLabel || h.type || "Wallet/EOA";
      return `
        <tr>
          <td>${h.rank}</td>
          <td>
            <span class="holder-name">${escapeHtml(label)}</span>
            <span class="mono">${escapeHtml(h.address)}</span>
          </td>
          <td><span class="pill ${tipClass(h.type)}">${escapeHtml(typeText)}</span></td>
          <td>${fmtPct(h.percentage)}</td>
          <td>${escapeHtml(h.quantity || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const chain = chainEl.value.trim().toLowerCase();
  const ca = caEl.value.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(ca)) {
    setStatus("Invalid CA format. Must be 0x + 40 hex.", "err");
    return;
  }

  analyzeBtn.disabled = true;
  setStatus("Analyzing, please wait...");
  resultCardEl.classList.add("hidden");

  try {
    const resp = await fetch(`/api/analyze?chain=${encodeURIComponent(chain)}&ca=${encodeURIComponent(ca)}`);
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || `Error: ${resp.status}`);
    }

    renderMetrics(data);
    renderTableRows(data);
    resultCardEl.classList.remove("hidden");
    setStatus("Analysis completed.", "ok");
  } catch (err) {
    setStatus(err.message || "Analysis failed.", "err");
  } finally {
    analyzeBtn.disabled = false;
  }
});
