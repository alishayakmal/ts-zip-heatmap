(async function () {

  console.log("Loading ZIP polygons...");

  // IMPORTANT
  // This must match your repo filename EXACTLY
  const GEO_URL = "./tl_2020_us_zcta520.topo.json";

  // Load topojson
  const topo = await fetch(GEO_URL).then(r => r.json());

  console.log("TopoJSON loaded");

  // Convert to GeoJSON
  const geo = topojson.feature(
    topo,
    topo.objects[Object.keys(topo.objects)[0]]
  );

  console.log("GeoJSON features:", geo.features.length);

  // Fake demo values so you SEE colors
  const values = {};
  geo.features.forEach(f => {
    values[f.properties.ZCTA5CE20] = Math.random();
  });

  const canvas = document.getElementById("zipMap");
  const ctx = canvas.getContext("2d");

  // Projection
  const projection = d3.geoAlbersUsa()
    .scale(1300)
    .translate([window.innerWidth / 2, window.innerHeight / 2]);

  const path = d3.geoPath().projection(projection).context(ctx);

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    geo.features.forEach(feature => {

      const zip = feature.properties.ZCTA5CE20;
      const v = values[zip] || 0;

      // heat color
      ctx.fillStyle = `rgba(255,0,0,${v})`;
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 0.3;

      ctx.beginPath();
      path(feature);
      ctx.fill();
      ctx.stroke();
    });
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  draw();

})();
