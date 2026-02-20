(async function () {
  document.body.style.margin = "0";

  const status = document.createElement("div");
  status.style.position = "fixed";
  status.style.top = "8px";
  status.style.left = "8px";
  status.style.zIndex = "9999";
  status.style.background = "rgba(255,255,255,0.95)";
  status.style.padding = "6px 8px";
  status.style.borderRadius = "6px";
  status.style.fontFamily = "Arial";
  status.style.fontSize = "12px";
  status.textContent = "Starting";
  document.body.appendChild(status);

  function setStatus(t) {
    status.textContent = t;
  }

  function baseUrl() {
    return new URL("./", window.location.href).href;
  }

  async function fetchJson(url) {
    setStatus("Downloading geometry");
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    setStatus("Parsing JSON");
    return await r.json();
  }

  try {
    if (!window.d3 || !window.topojson) {
      throw new Error("Missing d3 or topojson. Check index.html script tags.");
    }

    const url = baseUrl() + "zcta_zip1_9.topo.json";
    const topo = await fetchJson(url);

    setStatus("Converting TopoJSON");
    const key = Object.keys(topo.objects)[0];
    const geo = topojson.feature(topo, topo.objects[key]);

    const featuresAll = geo.features || [];
    setStatus(`Features loaded: ${featuresAll.length}. Rendering first 300 only.`);

    const features = featuresAll.slice(0, 300);

    document.body.innerHTML = "";
    document.body.appendChild(status);

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(1200, window.innerWidth);
    canvas.height = Math.min(700, window.innerHeight);
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    const projection = d3.geoAlbersUsa()
      .scale(1200)
      .translate([canvas.width / 2, canvas.height / 2]);

    const path = d3.geoPath().projection(projection).context(ctx);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (const f of features) path(f);
    ctx.strokeStyle = "#2ecc71";
    ctx.lineWidth = 0.4;
    ctx.stroke();

    setStatus("Rendered smoke test subset successfully.");
  } catch (e) {
    setStatus(`Load failed: ${e.message || e}`);
    console.error(e);
  }
})();
