(async function () {
  const root = document.getElementById("root");

  function setMessage(msg) {
    root.innerHTML = `<div style="font-family: Arial; padding: 12px;">${msg}</div>`;
  }

  // Deck and topojson must load from index.html
  if (!window.deck) {
    setMessage("Deck.gl did not load. Check the deck.gl script tag in index.html.");
    return;
  }
  if (!window.topojson) {
    setMessage("TopoJSON client did not load. Check the topojson script tag in index.html.");
    return;
  }

  // Detect ThoughtSpot SDK global safely
  const sdk =
    window.tssdk ||
    window.tsChartSdk ||
    window.tsChartSDK ||
    window.TSChartSDK ||
    null;

  const isInsideThoughtSpot = !!(sdk && typeof sdk.getChartContext === "function");

  // Self test mode when you open GitHub Pages directly
  if (!isInsideThoughtSpot) {
    setMessage("Self test mode. Rendering ZIP polygons without ThoughtSpot data.");

    const topo = await fetch(
      "https://cdn.jsdelivr.net/gh/OpenDataDE/State-zip-code-GeoJSON@master/zcta.topo.json"
    ).then(r => r.json());

    const objectKey = Object.keys(topo.objects)[0];
    const geo = window.topojson.feature(topo, topo.objects[objectKey]);

    const { DeckGL, PolygonLayer } = window.deck;

    new DeckGL({
      parent: root,
      controller: true,
      initialViewState: { longitude: -98, latitude: 39, zoom: 3 },
      layers: [
        new PolygonLayer({
          id: "self-test",
          data: geo.features,
          getPolygon: f => f.geometry.coordinates,
          getFillColor: [200, 230, 200, 180],
          getLineColor: [255, 255, 255, 60],
          lineWidthMinPixels: 0.2,
          pickable: false
        })
      ]
    });

    return;
  }

  // Normal ThoughtSpot mode
  const ctx = await sdk.getChartContext();

  async function render() {
    root.innerHTML = "";

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

    const topo = await fetch(
      "https://cdn.jsdelivr.net/gh/OpenDataDE/State-zip-code-GeoJSON@master/zcta.topo.json"
    ).then(r => r.json());

    const objectKey = Object.keys(topo.objects)[0];
    const geo = window.topojson.feature(topo, topo.objects[objectKey]);

    geo.features.forEach(f => {
      const zipKey = String(f.properties.ZCTA5CE10 ?? f.properties.ZIP_CODE ?? "").padStart(5, "0");
      const m = byZip.get(zipKey);
      f.properties.__zip = zipKey;
      f.properties.__impressions = m?.impressions ?? 0;
      f.properties.__conversions = m?.conversions ?? 0;
      f.properties.__spend = m?.spend ?? 0;
      f.properties.__cvr = m?.cvr ?? 0;
    });

    const values = geo.features.map(f => f.properties.__impressions);
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

    const { DeckGL, PolygonLayer } = window.deck;

    new DeckGL({
      parent: root,
      controller: true,
      initialViewState: { longitude: -98, latitude: 39, zoom: 3 },
      layers: [
        new PolygonLayer({
          id: "zip-heatmap",
          data: geo.features,
          getPolygon: f => f.geometry.coordinates,
          getFillColor: f => greenRamp(f.properties.__impressions),
          getLineColor: [255, 255, 255, 80],
          lineWidthMinPixels: 0.5,
          pickable: true,
          autoHighlight: true
        })
      ],
      getTooltip: ({ object }) => {
        if (!object) return null;
        const p = object.properties;
        return {
          html: `
            <div style="font-family: Arial; font-size: 12px;">
              <div><b>ZIP:</b> ${p.__zip}</div>
              <div><b>Impressions:</b> ${p.__impressions.toLocaleString()}</div>
              <div><b>Conversions:</b> ${p.__conversions.toLocaleString()}</div>
              <div><b>Spend:</b> ${p.__spend.toLocaleString()}</div>
              <div><b>Conversion Rate:</b> ${p.__cvr}</div>
            </div>
          `
        };
      }
    });
  }

  ctx.on(ctx.Event.QueryChanged, render);
  await render();
})();
