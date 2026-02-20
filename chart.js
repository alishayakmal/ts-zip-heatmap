(async function () {
  const root = document.getElementById("root");

  // Initialize ThoughtSpot chart context
  const ctx = await window.tssdk.getChartContext();

  async function render() {
    root.innerHTML = "";

    // Get data from ThoughtSpot
    const dataResponse = await ctx.getData();
    const rows = dataResponse?.data ?? [];

    // Build lookup table by ZIP
    const byZip = new Map();

    rows.forEach(r => {
      const zip = String(
        r["ZIP"] ??
        r["Tes"] ??
        r["ZCTA5CE10"] ??
        ""
      ).padStart(5, "0");

      byZip.set(zip, {
        impressions: Number(r["Total Impressions"] ?? 0),
        conversions: Number(r["Conversions"] ?? 0),
        spend: Number(r["Spend"] ?? 0),
        cvr: Number(r["Conversion Rate"] ?? 0)
      });
    });

    // Load USA ZIP boundaries from CDN
    const topo = await fetch(
      "https://cdn.jsdelivr.net/gh/OpenDataDE/State-zip-code-GeoJSON@master/zcta.topo.json"
    ).then(r => r.json());

    const objectKey = Object.keys(topo.objects)[0];
    const geo = window.topojson.feature(topo, topo.objects[objectKey]);

    // Inject ThoughtSpot metrics into polygons
    geo.features.forEach(f => {
      const zipKey = String(
        f.properties.ZCTA5CE10 ??
        f.properties.ZIP_CODE ??
        ""
      ).padStart(5, "0");

      const m = byZip.get(zipKey);

      f.properties.__zip = zipKey;
      f.properties.__impressions = m?.impressions ?? 0;
      f.properties.__conversions = m?.conversions ?? 0;
      f.properties.__spend = m?.spend ?? 0;
      f.properties.__cvr = m?.cvr ?? 0;
    });

    // Build green color ramp
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
      initialViewState: {
        longitude: -98,
        latitude: 39,
        zoom: 3
      },
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
