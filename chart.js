(function () {

let ctx;

if (window.viz) {
    ctx = viz.getChartContext();
} else {
    document.body.innerHTML = "Self test mode. Rendering ZIP polygons without ThoughtSpot data.";
}

const files = [
    "zcta_zip1_0.topo.json",
    "zcta_zip1_1.topo.json",
    "zcta_zip1_2.topo.json",
    "zcta_zip1_3.topo.json",
    "zcta_zip1_4.topo.json",
    "zcta_zip1_5.topo.json",
    "zcta_zip1_6.topo.json",
    "zcta_zip1_7.topo.json",
    "zcta_zip1_8.topo.json",
    "zcta_zip1_9.topo.json"
];

async function loadAllTopo() {

    const base = window.location.origin + window.location.pathname;

    const responses = await Promise.all(
        files.map(f => fetch(base + f))
    );

    const jsons = await Promise.all(
        responses.map(r => r.json())
    );

    return jsons;
}

function draw(features) {

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 700;
    document.body.appendChild(canvas);

    const ctx2 = canvas.getContext("2d");

    const projection = d3.geoAlbersUsa().scale(1300).translate([600,350]);
    const path = d3.geoPath().projection(projection).context(ctx2);

    ctx2.clearRect(0,0,1200,700);
    ctx2.beginPath();

    features.forEach(f => path(f));

    ctx2.strokeStyle = "#2ecc71";
    ctx2.stroke();
}

(async function init() {

    document.body.innerHTML = "Loading ZIP polygons...";

    const topoParts = await loadAllTopo();

    let features = [];

    topoParts.forEach(tp => {

        const key = Object.keys(tp.objects)[0];
        const geo = topojson.feature(tp, tp.objects[key]);

        features = features.concat(geo.features);
    });

    document.body.innerHTML = "";

    draw(features);

})();
})();
