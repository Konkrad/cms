import {
  component$,
  useSignal,
  useVisibleTask$,
} from "@builder.io/qwik";
import "./GroupsMap.css";

export interface GroupPin {
  id: number;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
}

interface GroupsMapProps {
  groups: GroupPin[];
  width?: number;
  height?: number;
  area?: string;
}

export const GroupsMap = component$<GroupsMapProps>((props) => {
  const svgRef = useSignal<SVGSVGElement>();
  const tooltipRef = useSignal<HTMLDivElement>();
  const width = props.width ?? 960;
  const height = props.height ?? 500;

  useVisibleTask$(async () => {
    const [
      { geoNaturalEarth1, geoPath, geoGraticule },
      { feature },
      topoData,
    ] = await Promise.all([
      import("d3-geo"),
      import("topojson-client"),
      fetch("/ne_10m_land.json").then((r) => r.json()),
    ]);

    const svg = svgRef.value;
    const tooltip = tooltipRef.value;
    if (!svg || !tooltip) return;

    const projection = geoNaturalEarth1()
      .scale(width / 6.3)
      .translate([width / 2, height / 2]);

    const path = geoPath(projection);
    const graticule = geoGraticule();
    const svgNS = "http://www.w3.org/2000/svg";

    const sphere = document.createElementNS(svgNS, "path");
    sphere.setAttribute("class", "groups-map-sphere");
    sphere.setAttribute("d", path({ type: "Sphere" } as any) ?? "");
    svg.appendChild(sphere);

    const graticuleEl = document.createElementNS(svgNS, "path");
    graticuleEl.setAttribute("class", "groups-map-graticule");
    graticuleEl.setAttribute("d", path(graticule()) ?? "");
    svg.appendChild(graticuleEl);

    const land = feature(topoData, topoData.objects.ne_10m_land);
    const landEl = document.createElementNS(svgNS, "path");
    landEl.setAttribute("class", "groups-map-land");
    landEl.setAttribute("d", path(land as any) ?? "");
    svg.appendChild(landEl);

    for (const group of props.groups) {
      const projected = projection([group.longitude, group.latitude]);
      if (!projected) continue;
      const [x, y] = projected;

      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("class", "groups-map-pin");
      circle.setAttribute("cx", String(x));
      circle.setAttribute("cy", String(y));
      circle.setAttribute("r", "5");

      circle.addEventListener("mouseenter", (e) => {
        (e.currentTarget as SVGCircleElement).setAttribute("r", "7");
        tooltip.textContent = group.name;
        const svgRect = svg.getBoundingClientRect();
        const wrapperRect = svg.parentElement!.getBoundingClientRect();
        const scaleX = svgRect.width / width;
        const scaleY = svgRect.height / height;
        tooltip.style.left = x * scaleX + (svgRect.left - wrapperRect.left) + "px";
        tooltip.style.top = y * scaleY + (svgRect.top - wrapperRect.top) + "px";
        tooltip.classList.add("visible");
      });

      circle.addEventListener("mouseleave", (e) => {
        (e.currentTarget as SVGCircleElement).setAttribute("r", "5");
        tooltip.classList.remove("visible");
      });

      circle.addEventListener("click", () => {
        window.location.href = "/groups/" + group.slug;
      });

      svg.appendChild(circle);
    }
  });

  return (
    <div
      class="groups-map-wrapper"
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <svg
        ref={svgRef}
        class="groups-map-svg"
        viewBox={"0 0 " + width + " " + height}
        xmlns="http://www.w3.org/2000/svg"
      />
      <div ref={tooltipRef} class="groups-map-tooltip" />
    </div>
  );
});
