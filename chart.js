(async function () {

  const root = document.getElementById("root");

  // -----------------------------
  // SELF TEST MODE (GitHub Pages)
  // -----------------------------
  if (typeof window.viz === "undefined") {

    root.innerHTML = "Self test mode. Rendering ZIP polygons without ThoughtSpot data.";

    const geojson = await fetch(
      "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/zcta5.json"
    ).then(r => r.json());

    new deck.DeckGL({
      parent: root,
      width: "100%",
      height: "100%",
      initialViewState: {
        longitude: -98,
        latitude: 39,
        zoom: 3
      },
      controller: true,
      layers: [
        new deck.GeoJsonLayer({
          id: "zip-layer",
          data: geojson,
          filled: true,
          stroked: false,
          getFillColor: [0, 180, 0, 120]
        })
      ]
    });

    return;
  }

  // -----------------------------
  // THOUGHTSPOT MODE
  // -----------------------------
  const context = viz.getChartContext();

  const data = await context.getData();

  const zipMap = {};
  data.forEach(row => {
    zipMap[row["Zipcode"]] = row["Impressions"];
  });

  const geojson = await fetch(
    "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/zcta5.json"
  ).then(r => r.json());

  new deck.DeckGL({
    parent: root,
    width: "100%",
    height: "100%",
    initialViewState: {
      longitude: -98,
      latitude: 39,
      zoom: 3
    },
    controller: true,
    layers: [
      new deck.GeoJsonLayer({
        id: "zip-layer",
        data: geojson,
        filled: true,
        stroked: false,
        getFillColor: f => {
          const zip = f.properties.ZCTA5CE10;
          const value = zipMap[zip] || 0;

          if (value > 100000) return [0,120,0,200];
          if (value > 50000) return [0,180,0,180];
          if (value > 10000) return [120,220,0,160];
          return [200,240,200,120];
        },
        pickable: true,
        onHover: ({object, x, y}) => {
          if (!object) return;
          const zip = object.properties.ZCTA5CE10;
          const value = zipMap[zip] || 0;

          context.showTooltip({
            x,
            y,
            content: `ZIP ${zip} — Impressions: ${value}`
          });
        }
      })
    ]
  });

})();
