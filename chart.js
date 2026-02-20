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

  try {
    setStatus("Starting");

    if (!window.deck) {
      fail("Deck.gl did not load. The script tag in index.html is failing.");
      return;
    }

    const DeckGL = window.deck.DeckGL;
    const GeoJsonLayer = window.deck.GeoJsonLayer;

    if (!DeckGL) {
      fail("DeckGL is missing on the deck global. Deck.gl bundle did not initialize correctly.");
      return;
    }

    if (!GeoJsonLayer) {
      fail("GeoJsonLayer is missing. This deck.gl bundle did not include layers.");
      return;
    }

    setStatus("Loading ZIP GeoJSON");

    const geojsonUrl =
      "https://cdn.jsdelivr.net/gh/OpenDataDE/State-zip-code-GeoJSON@master/zcta5.json";

    const resp = await fetch(geojsonUrl, { cache: "no-store" });
    if (!resp.ok) {
      fail(`GeoJSON download failed. HTTP ${resp.status} ${resp.statusText}`);
      return;
    }

    const geojson = await resp.json();

    setStatus("Rendering map");

    const layer = new GeoJsonLayer({
      id: "zip-layer",
      data: geojson,
      filled: true,
      stroked: true,
      getFillColor: [0, 180, 0, 120],
      getLineColor: [255, 255, 255, 60],
      lineWidthMinPixels: 0.2,
      pickable: true
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

    setStatus("Self test mode map rendered");
  } catch (e) {
    fail("Chart crashed while loading.", e);
  }
})();
