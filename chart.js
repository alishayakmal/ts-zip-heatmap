(async function () {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const tooltip = document.getElementById("tooltip");
  const status = document.getElementById("status");

  function setStatus(t) { status.textContent = t; }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function baseUrl() {
    return new URL("./", window.location.href).href;
  }

  async function loadTopo(fileName) {
    const url = baseUrl() + fileName;
    setStatus("Loading " + fileName);
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(fileName + " HTTP " + r.status);
    return await r.json();
  }

  function normalizeZip(z) {
    if (z === null || z === undefined) return "";
    const s = String(z).trim();
    const digits = s.replace(/\D/g, "");
    return digits.padStart(5, "0").slice(0, 5);
  }

  function num(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtInt(n) {
    return Math.round(n).toLocaleString();
  }

  function fmtMoney(n) {
    return "$" + Number(n || 0).toFixed(2);
  }

  function fmtPct(n) {
    return (Number(n || 0) * 100).toFixed(2) + "%";
  }

  function getRowsFromThoughtSpotOrMock() {
    try {
      if (window.viz && typeof window.viz.getDataFromSearchQuery === "function") {
        const data = window.viz.getDataFromSearchQuery();
        if (Array.isArray(data) && data.length) return data;
      }
    } catch (e) {}

    return [
      { Zipcode: "90001", Impressions: 12000, Conversions: 34, Spend: 420.15 },
      { Zipcode: "90210", Impressions: 45000, Conversions: 80, Spend: 1500.00 },
      { Zipcode: "33101", Impressions: 18000, Conversions: 22, Spend: 610.40 },
      { Zipcode: "10001", Impressions: 52000, Conversions: 95, Spend: 2100.10 }
    ];
  }

  function buildMetricMap(rows) {
    const map = new Map();

    rows.forEach(r => {
      const zip = normalizeZip(r.Zipcode ?? r.zip ?? r.ZIP ?? r.Zip ?? r["Zip code"]);
      if (!zip) return;

      const impressions = num(r.Impressions ?? r["Total Impressions"] ?? r.impressions);
      const conversions = num(r.Conversions ?? r.conversions);
      const spend = num(r.Spend ?? r.spend);

      const cvr = impressions > 0 ? conversions / impressions : 0;

      map.set(zip, {
        zip,
        impressions,
        conversions,
        spend,
        cvr
      });
    });

    return map;
  }

  function colorForValue(v, vMax) {
    if (!vMax || vMax <= 0) return "rgba(220,220,220,0.35)";
    const t = Math.max(0, Math.min(1, v / vMax));
    const a = 0.15 + 0.75 * t;
    return "rgba(46,204,113," + a.toFixed(3) + ")";
  }

  function hideTooltip() { tooltip.style.display = "none"; }

  function showTooltip(x, y, m) {
    tooltip.style.left = (x + 12) + "px";
    tooltip.style.top = (y + 12) + "px";
    tooltip.style.display = "block";
    tooltip.innerHTML = `
      <div class="ttTitle">ZIP ${m.zip}</div>
      <div class="ttRow"><div class="ttKey">Impressions</div><div class="ttVal">${fmtInt(m.impressions)}</div></div>
      <div class="ttRow"><div class="ttKey">Conversions</div><div class="ttVal">${fmtInt(m.conversions)}</div></div>
      <div class="ttRow"><div class="ttKey">Spend</div><div class="ttVal">${fmtMoney(m.spend)}</div></div>
      <div class="ttRow"><div class="ttKey">Conversion rate</div><div class="ttVal">${fmtPct(m.cvr)}</div></div>
    `;
  }

  resize();
  window.addEventListener("resize", () => {
    resize();
    draw();
  });

  setStatus("Loading geometry");

  const files = [
    "zcta_zip1_ca.topo.json",
    "zcta_zip1_fl.topo.json",
    "zcta_zip1_ny.topo.json"
  ];

  const topoList = await Promise.all(files.map(loadTopo));

  setStatus("Preparing polygons");

  let features = [];
  topoList.forEach(topo => {
    const key = Object.keys(topo.objects)[0];
    const geo = topojson.feature(topo, topo.objects[key]);
    features = features.concat(geo.features || []);
  });

  const projection = d3.geoAlbersUsa();
  const geoPath = d3.geoPath(projection, ctx);

  function fitProjection() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    projection.translate([w / 2, h / 2]).scale(1000);

    const fc = { type: "FeatureCollection", features };
    const b = geoPath.bounds(fc);
    const dx = b[1][0] - b[0][0];
    const dy = b[1][1] - b[0][1];
    const s = 0.95 / Math.max(dx / w, dy / h);
    const t = [
      (w - s * (b[1][0] + b[0][0])) / 2,
      (h - s * (b[1][1] + b[0][1])) / 2
    ];

    projection.scale(projection.scale() * s).translate([t[0], t[1]]);
  }

  fitProjection();

  const rows = getRowsFromThoughtSpotOrMock();
  const metricMap = buildMetricMap(rows);

  let vMax = 0;
  metricMap.forEach(m => { if (m.impressions > vMax) vMax = m.impressions; });

  setStatus("Indexing for hover");

  const bboxes = features.map((f, i) => {
    const bb = geoPath.bounds(f);
    return {
      i,
      x0: bb[0][0],
      y0: bb[0][1],
      x1: bb[1][0],
      y1: bb[1][1]
    };
  });

  let transform = d3.zoomIdentity;
  let rafPending = false;

  function scheduleDraw() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      draw();
    });
  }

  function clear() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function draw() {
    clear();

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    ctx.lineWidth = 0.35 / transform.k;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";

    features.forEach(f => {
      const zip = normalizeZip(f.properties && (f.properties.ZCTA5CE20 || f.properties.ZCTA5CE10 || f.properties.GEOID20 || f.properties.GEOID10 || f.properties.GEOID));
      const m = zip ? metricMap.get(zip) : null;

      ctx.beginPath();
      geoPath(f);

      ctx.fillStyle = m ? colorForValue(m.impressions, vMax) : "rgba(220,220,220,0.22)";
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();

    setStatus("Ready");
  }

  draw();

  const zoom = d3.zoom()
    .scaleExtent([1, 18])
    .on("zoom", (event) => {
      transform = event.transform;
      scheduleDraw();
      hideTooltip();
    });

  d3.select(canvas).call(zoom);

  function screenToWorld(x, y) {
    return {
      x: (x - transform.x) / transform.k,
      y: (y - transform.y) / transform.k
    };
  }

  function pickFeature(worldX, worldY) {
    const candidates = [];
    for (const bb of bboxes) {
      if (worldX >= bb.x0 && worldX <= bb.x1 && worldY >= bb.y0 && worldY <= bb.y1) {
        candidates.push(bb.i);
      }
    }
    if (!candidates.length) return null;

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    for (let j = 0; j < candidates.length; j++) {
      const f = features[candidates[j]];
      ctx.beginPath();
      geoPath(f);
      if (ctx.isPointInPath(worldX, worldY)) {
        ctx.restore();
        return f;
      }
    }

    ctx.restore();
    return null;
  }

  canvas.addEventListener("mousemove", (e) => {
    const x = e.clientX;
    const y = e.clientY;
    const w = screenToWorld(x, y);
    const f = pickFeature(w.x, w.y);

    if (!f) { hideTooltip(); return; }

    const zip = normalizeZip(f.properties && (f.properties.ZCTA5CE20 || f.properties.ZCTA5CE10 || f.properties.GEOID20 || f.properties.GEOID10 || f.properties.GEOID));
    const m = zip ? metricMap.get(zip) : null;

    if (!m) { hideTooltip(); return; }

    showTooltip(x, y, m);
  });

  canvas.addEventListener("mouseleave", hideTooltip);

  canvas.addEventListener("click", (e) => {
    const x = e.clientX;
    const y = e.clientY;
    const w = screenToWorld(x, y);
    const f = pickFeature(w.x, w.y);
    if (!f) return;

    const bb = geoPath.bounds(f);
    const wv = window.innerWidth;
    const hv = window.innerHeight;
    const dx = bb[1][0] - bb[0][0];
    const dy = bb[1][1] - bb[0][1];

    const k = Math.max(1, Math.min(18, 0.80 / Math.max(dx / wv, dy / hv)));
    const cx = (bb[0][0] + bb[1][0]) / 2;
    const cy = (bb[0][1] + bb[1][1]) / 2;

    const tx = wv / 2 - k * cx;
    const ty = hv / 2 - k * cy;

    d3.select(canvas)
      .transition()
      .duration(450)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  });

})();
