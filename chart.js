(async function () {
  const root = document.getElementById("root");
  const status = document.getElementById("status");

  function setStatus(msg) {
    if (status) status.textContent = String(msg);
  }

  async function fetchFirstWorkingJson(urls) {
    let lastErr = null;

    for (const url of urls) {
      try {
        setStatus(`Trying GeoJSON source:\n${url}`);

        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) {
          lastErr = new Error(`HTTP ${resp.status} ${resp.statusText}`);
          continue;
        }

        return await resp.json();
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("All GeoJSON sources failed");
  }

  try {
    if (!window.deck || !window.deck.DeckGL || !window.deck.GeoJsonLayer) {
      setStatus("Deck.gl did not load correctly. Check the script tag in index.html.");
      return;
    }

    const DeckGL = window.deck.DeckGL;
    const GeoJsonLayer = window.deck.GeoJsonLayer;

    setStatus("Loading ZIP GeoJSON");

    const geojsonUrls = [
      "https://cdn.statically.io/gh/OpenDataDE/State-zip-code-GeoJSON/master/zcta5.json",
      "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/zcta5.json",
      "https://cdn.jsdelivr.net/gh/OpenDataDE/State-zip-code-GeoJSON@master/zcta5.json"
    ];

    const geojson = await fetchFirstWorkingJson(geojsonUrls);

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
      initialViewState: { longitude: -98, latitude: 39, zoom: 3 },
      controller: true,
      layers: [layer]
    });

    setStatus("Self test mode map rendered");
  } catch (e) {
    setStatus(`GeoJSON load failed.\n${e && (e.message || e.toString())}`);
  }
})();
