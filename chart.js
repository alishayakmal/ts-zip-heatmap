(async function () {

  document.body.innerHTML = "";
  const banner = document.createElement("div");
  banner.style.padding = "12px";
  banner.style.fontFamily = "Arial";
  banner.style.fontSize = "16px";
  banner.style.background = "#fff3cd";
  banner.style.border = "1px solid #ffeeba";
  banner.style.margin = "8px";
  banner.textContent = "NEW BUILD v30001 loaded. If you still see 'Rendered smoke test subset successfully' you are not on the new code.";
  document.body.appendChild(banner);

  const status = document.createElement("div");
  status.style.position = "fixed";
  status.style.top = "8px";
  status.style.left = "8px";
  status.style.background = "#fff";
  status.style.padding = "6px 8px";
  status.style.fontFamily = "Arial";
  status.style.fontSize = "12px";
  status.style.zIndex = "9999";
  document.body.appendChild(status);

  function setStatus(t) { status.textContent = t; }

  function baseUrl() { return new URL("./", window.location.href).href; }

  async function loadTopo(prefix) {
    const url = baseUrl() + `zcta_zip1_${prefix}.topo.json`;
    setStatus(`Loading ZIP prefix ${prefix} from ${url}`);
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  try {

    const rows = [
      { zip: "90210", value: 10 },
      { zip: "10001", value: 20 },
      { zip: "73301", value: 30 }
    ];

    const prefixes = [...new Set(rows.map(r => r.zip.charAt(0)))];

    setStatus(`Need ${prefixes.length} topology files: ${prefixes.join(", ")}`);

    const topoList = await Promise.all(prefixes.map(p => loadTopo(p)));

    let features = [];

    topoList.forEach(topo => {
      const key = Object.keys(topo.objects)[0];
      const geo = topojson.feature(topo, topo.objects[key]);
      features = features.concat(geo.features);
    });

    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    const projection = d3.geoAlbersUsa()
      .scale(1300)
      .translate([canvas.width / 2, canvas.height / 2]);

    const path = d3.geoPath().projection(projection).context(ctx);

    setStatus(`Rendering ${features.length} polygons`);

    ctx.beginPath();
    features.forEach(f => path(f));
    ctx.strokeStyle = "#2ecc71";
    ctx.lineWidth = 0.35;
    ctx.stroke();

    setStatus("DONE v30001");

  } catch (e) {
    setStatus(`Load failed: ${e.message || e}`);
    console.error(e);
  }

})();
