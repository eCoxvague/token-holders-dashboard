const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const EXPLORERS = {
  eth: {
    chainName: "Ethereum (ETH)",
    baseUrl: "https://etherscan.io",
    rpcUrl: "https://ethereum.publicnode.com"
  },
  bsc: {
    chainName: "BNB Smart Chain (BSC)",
    baseUrl: "https://bscscan.com",
    rpcUrl: "https://bsc-dataseed.binance.org/"
  }
};

const CONTRACT_NAME_CACHE = new Map();

function json(res, statusCode, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(data);
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function serveStatic(reqPath, res) {
  let filePath = reqPath === "/" ? "/index.html" : reqPath;
  filePath = decodeURIComponent(filePath);
  const resolved = path.normalize(path.join(ROOT, filePath));
  if (!resolved.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeType(resolved) });
    res.end(data);
  });
}

function matchOne(text, regex) {
  const m = text.match(regex);
  return m ? m[1] : "";
}

function stripTags(str) {
  return String(str || "").replace(/<[^>]*>/g, "");
}

function decodeHtml(str) {
  return String(str || "")
    .replace(/&#10;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function parseFloatSafe(value) {
  const n = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9,tr;q=0.8"
    }
  });
  if (!resp.ok) {
    throw new Error(`Fetch failed: ${resp.status} ${url}`);
  }
  return await resp.text();
}

async function rpcGetCode(rpcUrl, address) {
  const body = {
    jsonrpc: "2.0",
    method: "eth_getCode",
    params: [address, "latest"],
    id: 1
  };

  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(`RPC failed: ${resp.status}`);
  }
  const data = await resp.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message || "unknown"}`);
  }
  return data.result && data.result !== "0x";
}

function detectExchange(label) {
  const x = String(label || "").toLowerCase();
  if (x.includes("bybit")) return "Bybit";
  if (x.includes("gate")) return "Gate";
  if (x.includes("mexc")) return "MEXC";
  if (x.includes("binance")) return "Binance";
  if (x.includes("okx")) return "OKX";
  if (x.includes("kucoin")) return "KuCoin";
  if (x.includes("bitget")) return "Bitget";
  if (x.includes("kraken")) return "Kraken";
  if (x.includes("coinbase")) return "Coinbase";
  return "";
}

function normalizeContractName(name, label) {
  const raw = `${name || ""} ${label || ""}`.toLowerCase();
  if (raw.includes("safeproxy") || raw.includes("safe proxy")) return "SafeProxy";
  if (raw.includes("pancake")) return "Pancake";
  if (raw.includes("uniswap")) return "Uniswap";
  if (raw.includes("vault")) return "Vault";
  return name ? name.trim() : "Unknown";
}

async function fetchContractName(baseUrl, address) {
  const cacheKey = `${baseUrl}:${address.toLowerCase()}`;
  if (CONTRACT_NAME_CACHE.has(cacheKey)) {
    return CONTRACT_NAME_CACHE.get(cacheKey);
  }

  const html = await fetchText(`${baseUrl}/address/${address}`);
  let contractName = "";

  if (!contractName) {
    const block = matchOne(html, /Contract Name([\s\S]{0,800})Compiler Version/i);
    contractName = matchOne(block, /<h4 class="h6 mb-0">\s*([^<\r\n]+)/i);
  }
  if (!contractName) {
    const block = matchOne(html, /Contract Name([\s\S]{0,800})Compiler Version/i);
    contractName = matchOne(block, /<span class="h6 fw-bold mb-0">\s*([^<\r\n]+)/i);
  }
  if (!contractName && html.toLowerCase().includes("safeproxy")) {
    contractName = "SafeProxy";
  }

  contractName = decodeHtml(stripTags(contractName)).trim();
  CONTRACT_NAME_CACHE.set(cacheKey, contractName || "");
  return contractName || "";
}

function parseTokenMeta(tokenHtml, contractAddress) {
  const sid = matchOne(tokenHtml, /var sid = '([^']+)'/);
  const mode = matchOne(tokenHtml, /window\.mode = '([^']+)'/) || "light";
  const holdersParam = matchOne(tokenHtml, /var litTokenholdersContractUrlPara = '([^']+)'/);
  const totalSupply = matchOne(tokenHtml, /hdnTotalSupply" value="([^"]+)"/);
  const symbol = matchOne(tokenHtml, /hdnSymbol" value="([^"]+)"/);
  const holdersCount = matchOne(tokenHtml, /Holders:\s*([0-9,]+)/i);
  const asAtUtc = matchOne(tokenHtml, /As at ([^"]+\(UTC\))/i);

  if (!sid || !holdersParam) {
    throw new Error(`Token page parse failed for ${contractAddress}`);
  }

  return {
    sid,
    mode,
    holdersParam,
    totalSupply,
    symbol,
    holdersCount,
    asAtUtc
  };
}

function parseTopHolders(holdersHtml) {
  const rows = [...holdersHtml.matchAll(/<tr><td>(\d+)<\/td>([\s\S]*?)<\/tr>/g)];
  const items = [];

  for (const rowMatch of rows) {
    const rank = Number.parseInt(rowMatch[1], 10);
    if (!Number.isFinite(rank) || rank < 1 || rank > 20) continue;

    const rowHtml = rowMatch[2];
    const holderCell = matchOne(
      rowHtml,
      /<td><div class='d-flex align-items-center gap-1'>([\s\S]*?)<\/div><\/td>/
    );
    if (!holderCell) continue;

    const address = matchOne(holderCell, /data-clipboard-text='([^']+)'/);
    if (!address) continue;

    const labelRaw = matchOne(holderCell, /<a [^>]*target='_parent'[^>]*>([\s\S]*?)<\/a>/);
    const label = decodeHtml(stripTags(labelRaw)).trim() || `${address.slice(0, 8)}...${address.slice(-4)}`;

    const pct = parseFloatSafe(matchOne(rowHtml, /<td>([0-9.]+)%/));
    const titles = [...rowHtml.matchAll(/title='([^']+)'/g)].map((m) => m[1]);
    const quantity = titles.find((x) => /^[0-9,]+(\.[0-9]+)?$/.test(x)) || "";

    const hasContractHint =
      /title="Contract"/.test(holderCell) ||
      /data-bs-title="Contract"/.test(holderCell) ||
      /fa-file-alt/.test(holderCell) ||
      /fa-memo/.test(holderCell);

    items.push({
      rank,
      address,
      label,
      percentage: pct,
      quantity,
      typeHint: hasContractHint ? "Contract" : "Wallet/EOA"
    });
  }

  return items.sort((a, b) => a.rank - b.rank);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  let active = 0;

  return await new Promise((resolve, reject) => {
    function runNext() {
      if (index >= items.length && active === 0) {
        resolve(results);
        return;
      }
      while (active < limit && index < items.length) {
        const currentIndex = index++;
        active++;
        Promise.resolve(worker(items[currentIndex], currentIndex))
          .then((res) => {
            results[currentIndex] = res;
            active--;
            runNext();
          })
          .catch(reject);
      }
    }
    runNext();
  });
}

async function analyzeToken(chain, contractAddress) {
  const cfg = EXPLORERS[chain];
  if (!cfg) throw new Error("Unsupported chain");

  const tokenUrl = `${cfg.baseUrl}/token/${contractAddress}`;
  const tokenHtml = await fetchText(tokenUrl);
  const meta = parseTokenMeta(tokenHtml, contractAddress);
  const holdersUrl = `${cfg.baseUrl}/token/generic-tokenholders2?m=${meta.mode}&a=${meta.holdersParam}&sid=${meta.sid}&p=1`;
  const holdersHtml = await fetchText(holdersUrl);
  const topHolders = parseTopHolders(holdersHtml);

  const classified = await mapLimit(topHolders, 5, async (holder) => {
    let isContract = holder.typeHint === "Contract";
    try {
      isContract = await rpcGetCode(cfg.rpcUrl, holder.address);
    } catch (_) {
      isContract = holder.typeHint === "Contract";
    }

    const exchangeName = !isContract ? detectExchange(holder.label) : "";
    if (exchangeName) {
      return {
        ...holder,
        type: "Exchange",
        typeLabel: `Exchange - ${exchangeName}`
      };
    }

    if (!isContract) {
      return {
        ...holder,
        type: "Wallet/EOA",
        typeLabel: "Wallet/EOA"
      };
    }

    let cName = "";
    try {
      cName = await fetchContractName(cfg.baseUrl, holder.address);
    } catch (_) {
      cName = "";
    }
    const detail = normalizeContractName(cName, holder.label);
    return {
      ...holder,
      type: "Contract",
      typeLabel: `Contract - ${detail}`
    };
  });

  const top20PercentageSum = classified.reduce((s, x) => s + (x.percentage || 0), 0);
  const top3PercentageSum = classified
    .filter((x) => x.rank <= 3)
    .reduce((s, x) => s + (x.percentage || 0), 0);
  const top10PercentageSum = classified
    .filter((x) => x.rank <= 10)
    .reduce((s, x) => s + (x.percentage || 0), 0);

  const counts = {
    contract: classified.filter((x) => x.type === "Contract").length,
    exchange: classified.filter((x) => x.type === "Exchange").length,
    wallet: classified.filter((x) => x.type === "Wallet/EOA").length
  };

  return {
    chain,
    chainName: cfg.chainName,
    contractAddress,
    symbol: meta.symbol || "",
    totalSupply: meta.totalSupply || "",
    holdersCount: meta.holdersCount || "",
    asAtUtc: meta.asAtUtc || "",
    top20PercentageSum,
    top3PercentageSum,
    top10PercentageSum,
    counts,
    holders: classified
  };
}

async function handleApi(req, res, parsedUrl) {
  if (parsedUrl.pathname !== "/api/analyze") {
    json(res, 404, { error: "Not found" });
    return;
  }

  const chain = String(parsedUrl.searchParams.get("chain") || "").toLowerCase();
  const ca = String(parsedUrl.searchParams.get("ca") || "").trim();

  if (!EXPLORERS[chain]) {
    json(res, 400, { error: "Invalid chain. Use 'eth' or 'bsc'." });
    return;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(ca)) {
    json(res, 400, { error: "Invalid CA format. Must be 0x + 40 hex." });
    return;
  }

  try {
    const data = await analyzeToken(chain, ca);
    json(res, 200, data);
  } catch (err) {
    json(res, 500, { error: err.message || "Analysis failed" });
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);

  if (parsed.pathname.startsWith("/api/")) {
    await handleApi(req, res, parsed);
    return;
  }

  serveStatic(parsed.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
