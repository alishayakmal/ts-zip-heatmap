(async function () {
  const root = document.getElementById("root");
  const status = document.getElementById("status");

  function setStatus(msg) {
    if (status) status.textContent = msg;
  }

  if (!window.deck) {
    setStatus("Deck.gl missing. Check index.html script tags.");
    return;
  }
  if (!window.topojson) {
    setStatus("TopoJSON client missing. Check index.html script tags.");
    return;
  }

  const sdk =
    window.tssdk ||
    window.tsChartSdk ||
    window.tsChartSDK ||
    window.TSChartSDK ||
    null;

  const isInsideThoughtSpot = !!(sdk && typeof sdk.getChartContext === "function");

  async function loadZipPolygons() {
    setStatus("Loading ZIP polygons");
    const topo = await fetch(
      "https://cdn.jsdelivr.net/gh/OpenDataDE/State-zip-code-GeoJSON@master/zcta.topo.json"
    ).then(r => r.json());

    const objectKey = Object.keys(topo.objects)[0];
    return window.topojson.feature(topo, topo.objects[objectKey]);
  }

  function renderMap(features, getValueFn) {
    const { DeckGL, PolygonLayer } = window.deck;

    const values = features.map(f => getValueFn(f));
    const max = Math.max(1, ...values);

    function greenRamp(v) {
      const t = Math.max(0, Math.min(1, v / max));
      return [
        Math.round(229 - 180 * t),
        Math.round(245 - 120 * t),
        Math.round(224 - 160 * t),
        200
      ];
    }

    setStatus(isInsideThoughtSpot ? "Rendering ThoughtSpot map" : "Self test mode");

    new DeckGL({
      parent: root,
      controller: true,
      initialViewState: { longitude: -98, latitude: 39, zoom: 3 },
      layers: [
        new PolygonLayer({
          id: "zip-polygons",
          data: features,
          getPolygon: f => f.geometry.coordinates,
          getFillColor: f => greenRamp(getValueFn(f)),
          getLineColor: [255, 255, 255, 70],
          lineWidthMinPixels: 0.4,
          pickable: true,
          autoHighlight: true
        })
      ],
      getTooltip: ({ object }) => {
        if (!object) return null;
        const p = object.properties || {};
        const zip = String(p.ZCTA5CE10 ?? p.ZIP_CODE ?? "").padStart(5, "0");
        const imp = p.__impressions ?? 0;
        const conv = p.__conversions ?? 0;
        const spend = p.__spend ?? 0;
        const cvr = p.__cvr ?? 0;

        return {
          html: `
            <div style="font-family: Arial; font-size: 12px;">
              <div><b>ZIP</b>: ${zip}</div>
              <div><b>Impressions</b>: ${Number(imp).toLocaleString()}</div>
              <div><b>Conversions</b>: ${Number(conv).toLocaleString()}</div>
              <div><b>Spend</b>: ${Number(spend).toLocaleString()}</div>
              <div><b>Conversion rate</b>: ${cvr}</div>
            </div>
          `
        };
      }
    });
  }

  if (!isInsideThoughtSpot) {
    const geo = await loadZipPolygons();

    geo.features.forEach(f => {
      f.properties = f.properties || {};
      f.properties.__impressions = 1;
    });

    renderMap(geo.features, f => f.properties.__impressions);
    return;
  }

  const ctx = await sdk.getChartContext();

  async function renderFromThoughtSpot() {
    setStatus("Reading ThoughtSpot data");

    const dataResponse = await ctx.getData();
    const rows = dataResponse?.data ?? [];

    const byZip = new Map();
    for (const r of rows) {
      const zip = String(r["ZIP"] ?? r["Zipcode"] ?? r["Tes"] ?? "").padStart(5, "0");
      byZip.set(zip, {
        impressions: Number(r["Impressions"] ?? r["Total Impressions"] ?? 0),
        conversions: Number(r["Conversions"] ?? 0),
        spend: Number(r["Spend"] ?? 0),
        cvr: Number(r["Conversion Rate"] ?? 0)
      });
    }

    const geo = await loadZipPolygons();

    geo.features.forEach(f => {
      f.properties = f.properties || {};
      const zipKey = String(f.properties.ZCTA5CE10 ?? f.properties.ZIP_CODE ?? "").padStart(5, "0");
      const m = byZip.get(zipKey);

      f.properties.__impressions = m?.impressions ?? 0;
      f.properties.__conversions = m?.conversions ?? 0;
      f.properties.__spend = m?.spend ?? 0;
      f.properties.__cvr = m?.cvr ?? 0;
    });

    renderMap(geo.features, f => f.properties.__impressions);
  }

  ctx.on(ctx.Event.QueryChanged, renderFromThoughtSpot);
  await renderFromThoughtSpot();
})();
