(async function () {
  const status = document.getElementById("status");

  function setStatus(t) {
    status.textContent = t;
  }

  function baseUrl() {
    return new URL("./", window.location.href).href;
  }

  async function fetchJson(url) {
    setStatus("Downloading one split file");
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    setStatus("Parsing JSON");
    return await r.json();
  }

  try {
    setStatus("Loading one ZIP prefix file");
    const topo = await fetchJson(baseUrl() + "zcta_zip1_9.topo.json");

    setStatus("Converting TopoJSON");
    const key = Object.keys(topo.objects)[0];
    const geo = topojson.feature(topo, topo.objects[key]);

    const all = geo.features || [];
    setStatus(`Loaded ${all.length} features. Drawing first 200 only`);

    const features = all.slice(0, 200);

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(1200, window.innerWidth);
    canvas.height = Math.min(700, window.innerHeight);
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    const projection = d3.geoAlbersUsa()
      .scale(1200)
      .translate([canvas.width / 2, canvas.height / 2]);

    const path = d3.geoPath().projection(projection).context(ctx);

    ctx.beginPath();
    for (const f of features) path(f);
    ctx.strokeStyle = "#2ecc71";
    ctx.lineWidth = 0.4;
    ctx.stroke();

    setStatus("Smoke test render succeeded");
  } catch (e) {
    setStatus(`Load failed: ${e.message || e}`);
    console.error(e);
  }
})();
