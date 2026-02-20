(async function () {
  const root = document.getElementById("root");
  const status = document.getElementById("status");

  function setStatus(msg) {
    if (status) status.textContent = String(msg);
  }

  function fail(msg, err) {
    const detail = err ? `\n\n${err.stack || err.message || err}` : "";
    setStatus(`${msg}${detail}`);
  }

  function toZip5(v) {
    const s = String(v == null ? "" : v).trim();
    if (!s) return "";
    return s.padStart(5, "0");
  }

  function greenRamp(value, max) {
    const t = Math.max(0, Math.min(1, max ? value / max : 0));
    return [
      Math.round(220 - 180 * t),
      Math.round(245 - 120 * t),
      Math.round(220 - 160 * t),
      200
    ];
  }

  async function fetchGzipJson(url) {
    setStatus("Downloading topology file");
    const resp = await fetch(url, { cache: "no-store", redirect: "follow" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

    setStatus("Decompressing");
    const gzBytes = new Uint8Array(await resp.arrayBuffer());
    const jsonText = window.pako.ungzip(gzBytes, { to: "string" });

    setStatus("Parsing topology");
    return JSON.parse(jsonText);
  }

  function topoToFeatures(topo) {
    const objectKey = topo && topo.objects ? Object.keys(topo.objects)[0] : null;
    if (!objectKey) throw new Error("TopoJSON objects missing");

    const geo = window.topojson.feature(topo, topo.objects[objectKey]);
    if (!geo || !geo.features) throw new Error("TopoJSON conversion failed");

    return geo.features;
  }

  function getZipFromFeature(feature) {
    const p = feature && feature.properties ? feature.properties : {};
    return toZip5(p.ZCTA5CE20 ?? p.ZCTA5CE10 ?? p.GEOID ?? p.GEOID10 ?? p.ZIP ?? p.ZIPCODE ?? "");
  }

  function buildMetricsFromThoughtSpot() {
    if (!window.viz) return null;

    let rows = null;

    if (typeof window.viz.getDataFromSearchQuery === "function") {
      rows = window.viz.getDataFromSearchQuery() || [];
    } else if (typeof window.viz.getChartContext === "function" && window.viz.getChartContext()) {
      const ctx = window.viz.getChartContext();
      if (ctx && typeof ctx.getData === "function") {
        rows = ctx.getData();
      }
    }

    if (!rows || !rows.length) return null;

    const byZip = new Map();

    for (const r of rows) {
      const zip = toZip5(
        r.Zipcode ??
        r.ZIP ??
        r.zipcode ??
        r["Zipcode"] ??
        r["ZIP"]
      );

      if (!zip) continue;

      const impressions = Number(
        r.Impressions ??
        r["Total Impressions"] ??
        r["Impressions"] ??
        0
      );

      const conversions = Number(r.Conversions ?? r["Conversions"] ?? 0);
      const spend = Number(r.Spend ?? r["Spend"] ?? 0);

      byZip.set(zip, { impressions, conversions, spend });
    }

    return byZip;
  }

  function showTooltip(x, y, text) {
    if (window.viz && typeof window.viz.showTooltip === "function") {
      window.viz.showTooltip({ x, y, content: text });
      return;
    }
  }

  function render(features, byZip) {
    const DeckGL = window.deck && window.deck.DeckGL;
    const PolygonLayer = window.deck && window.deck.PolygonLayer;

    if (!DeckGL || !PolygonLayer) throw new Error("DeckGL or PolygonLayer missing");

    const hasTSData = !!byZip;
    let maxImp = 1;

    if (hasTSData) {
      for (const v of byZip.values()) {
        if (v.impressions > maxImp) maxImp = v.impressions;
      }
    }

    const layer = new PolygonLayer({
      id: "zip-polygons",
      data: features,
      getPolygon: f => f.geometry.coordinates,
      filled: true,
      stroked: true,
      wireframe: false,
      lineWidthMinPixels: 0.2,
      getLineColor: [255, 255, 255, 60],

      getFillColor: f => {
        const zip = getZipFromFeature(f);

        if (!hasTSData) {
          return [0, 180, 0, 120];
        }

        const m = byZip.get(zip);
        const imp = m ? Number(m.impressions || 0) : 0;
        return greenRamp(imp, maxImp);
      },

      pickable: true,
      autoHighlight: true,

      onHover: info => {
        const obj = info && info.object ? info.object : null;
        if (!obj) return;

        const zip = getZipFromFeature(obj);

        if (!hasTSData) {
          showTooltip(info.x, info.y, `ZIP ${zip}`);
          return;
        }

        const m = byZip.get(zip) || { impressions: 0, conversions: 0, spend: 0 };
        const imp = Number(m.impressions || 0).toLocaleString();
        const conv = Number(m.conversions || 0).toLocaleString();
        const spend = Number(m.spend || 0).toLocaleString();
        const cr = m.impressions ? (Number(m.conversions || 0) / Number(m.impressions || 1)) : 0;

        showTooltip(
          info.x,
          info.y,
          `ZIP ${zip}
Impressions: ${imp}
Conversions: ${conv}
Spend: ${spend}
Conversion rate: ${(cr * 100).toFixed(2)}%`
        );
      }
    });

    new DeckGL({
      parent: root,
      width: "100%",
      height: "100%",
      initialViewState: {
        longitude: -98,
        latitude: 39,
        zoom: 3
      },
      controller: true,
      layers: [layer]
    });

    setStatus(hasTSData ? "Rendered with ThoughtSpot data" : "Rendered in self test mode");
  }

  try {
    if (!window.deck || !window.topojson || !window.pako) {
      fail("Missing required libraries. Check index.html script tags.");
      return;
    }

    const RELEASE_GZ_URL = "https://github.com/alishayakmal/ts-zip-heatmap/releases/download/v1/tl_2020_us_zcta520.topo.json.gz";

    const topo = await fetchGzipJson(RELEASE_GZ_URL);
    const features = topoToFeatures(topo);

    const byZip = buildMetricsFromThoughtSpot();

    render(features, byZip);
  } catch (e) {
    fail("Load failed.", e);
  }
})();
