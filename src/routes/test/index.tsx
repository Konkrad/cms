import { component$, useVisibleTask$ } from "@builder.io/qwik";

export default component$(() => {
  useVisibleTask$(async () => {
    const [d3, { feature }] = await Promise.all([
      import("d3"),
      import("topojson-client"),
    ]);

    const container = document.getElementById("map-container")!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3
      .select("#map-container")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const projection = (d3.geoAzimuthalEqualArea() as any)
      .center([15, 52])
      .scale(Math.min(width, height) * 1.2)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const [topoData, cityData] = await Promise.all([
      fetch("/ne_10m_land.json").then((r) => r.json()),
      fetch(
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson",
      ).then((r) => r.json()),
    ]);

    const land = feature(topoData, topoData.objects.ne_10m_land);

    svg
      .append("path")
      .datum(land)
      .attr("class", "land")
      .attr("d", path as any);

    const points = (cityData.features as any[])
      .map((f) => projection(f.geometry.coordinates) as [number, number] | null)
      .filter((p): p is [number, number] => p !== null);

    const delaunay = d3.Delaunay.from(points);
    const { halfedges, triangles } = delaunay;

    const meshLines: string[] = [];
    for (let i = 0; i < halfedges.length; i++) {
      const j = halfedges[i];
      if (j < i) continue;
      const p1 = points[triangles[i]];
      const p2 = points[triangles[j]];
      const dist = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      if (dist < 40) {
        meshLines.push(`M${p1[0]},${p1[1]}L${p2[0]},${p2[1]}`);
      }
    }

    svg.append("path").attr("class", "mesh-line").attr("d", meshLines.join(""));

    svg
      .selectAll(".city-dot")
      .data(points)
      .enter()
      .append("circle")
      .attr("class", "city-dot")
      .attr("cx", (d) => d[0])
      .attr("cy", (d) => d[1])
      .attr("r", 1.2);
  });

  return (
    <div
      style={{
        margin: 0,
        background: "#ffffff",
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <style>{`
        #map-container svg { display: block; }
        #map-container .land { fill: #ffffff; stroke: #000000; stroke-width: 0.5; }
        #map-container .mesh-line { fill: none; stroke: #aaaaaa; stroke-width: 0.3; stroke-opacity: 1; }
        #map-container .city-dot { fill: #000000; }
      `}</style>
      <div id="map-container" style={{ width: "90vw", height: "90vh" }} />
    </div>
  );
});
