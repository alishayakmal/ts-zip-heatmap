(function () {

const testZipPrefix = "9"; // ONLY LOAD WEST COAST FOR TEST

async function loadTopo(file) {
    const base = window.location.origin + window.location.pathname;
    const r = await fetch(base + file);
    return await r.json();
}

function draw(features) {

    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 600;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    const projection = d3.geoAlbersUsa()
        .scale(1200)
        .translate([500,300]);

    const path = d3.geoPath()
        .projection(projection)
        .context(ctx);

    ctx.beginPath();

    features.forEach(f => path(f));

    ctx.strokeStyle = "#2ecc71";
    ctx.stroke();
}

(async function init(){

    document.body.innerHTML = "Loading optimized ZIP map...";

    const topo = await loadTopo("zcta_zip1_9.topo.json");

    const key = Object.keys(topo.objects)[0];
    const geo = topojson.feature(topo, topo.objects[key]);

    document.body.innerHTML = "";

    draw(geo.features);

})();
})();
