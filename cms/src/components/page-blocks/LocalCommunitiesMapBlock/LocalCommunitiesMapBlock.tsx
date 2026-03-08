import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import type { BlockDefinition } from "~/db/schema";
import "./LocalCommunitiesMapBlock.css";

export const definition: BlockDefinition = {
  name: "Local Communities Map",
  componentType: "LocalCommunitiesMapBlock",
  category: "dynamic",
  icon: "🗺️",
  configSchema: [],
  defaultData: {},
};

interface CommunityPin {
  id: number;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
}

const fetchCommunities = server$(async (): Promise<CommunityPin[]> => {
  const { groupsService } = await import("~/services/groups.service");
  const all = await groupsService.getAll();
  return (all as any[])
    .filter((g) => g.latitude != null && g.longitude != null)
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      latitude: Number(g.latitude),
      longitude: Number(g.longitude),
    }));
});

interface LocalCommunitiesMapBlockProps {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default component$<LocalCommunitiesMapBlockProps>((props) => {
  const title = props.title ?? "Local Communities";
  const body =
    props.body ??
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
  const ctaLabel = props.ctaLabel ?? "Discover the Communities";
  const ctaHref = props.ctaHref ?? "/groups";

  const mapWrapRef = useSignal<HTMLDivElement>();
  const tooltipRef = useSignal<HTMLDivElement>();
  const tapCardRef = useSignal<HTMLDivElement>();
  const tapCardNameRef = useSignal<HTMLSpanElement>();
  const tapCardLinkRef = useSignal<HTMLAnchorElement>();

  useVisibleTask$(async () => {
    const [d3, { feature }, communities] = await Promise.all([
      import("d3"),
      import("topojson-client"),
      fetchCommunities(),
    ]);

    const wrap = mapWrapRef.value;
    if (!wrap) return;

    const width = wrap.clientWidth || 900;
    const height = Math.round(width * 0.65);

    const svg = d3
      .select(wrap)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // Azimuthal Equal Area — matches the original map look
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

    // ── Land ──
    const land = feature(topoData, topoData.objects.ne_10m_land);
    svg
      .append("path")
      .datum(land)
      .attr("class", "lcm-land")
      .attr("d", path as any);

    // ── Mesh from city points (background dot network) ──
    const cityPoints = (cityData.features as any[])
      .map((f) => projection(f.geometry.coordinates) as [number, number] | null)
      .filter((p): p is [number, number] => p !== null);

    const delaunay = d3.Delaunay.from(cityPoints);
    const { halfedges, triangles } = delaunay;

    const meshLines: string[] = [];
    for (let i = 0; i < halfedges.length; i++) {
      const j = halfedges[i];
      if (j < i) continue;
      const p1 = cityPoints[triangles[i]];
      const p2 = cityPoints[triangles[j]];
      if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) < 40) {
        meshLines.push(`M${p1[0]},${p1[1]}L${p2[0]},${p2[1]}`);
      }
    }

    svg.append("path").attr("class", "lcm-mesh").attr("d", meshLines.join(""));

    svg
      .selectAll(".lcm-city")
      .data(cityPoints)
      .enter()
      .append("circle")
      .attr("class", "lcm-city")
      .attr("cx", (d) => d[0])
      .attr("cy", (d) => d[1])
      .attr("r", 1.2);

    // ── Community pins (on top) ──
    const tooltip = tooltipRef.value;
    const tapCard = tapCardRef.value;
    const tapCardName = tapCardNameRef.value;
    const tapCardLink = tapCardLinkRef.value;

    let hideTooltipTimer: ReturnType<typeof setTimeout> | null = null;

    for (const community of communities) {
      const projected = projection([community.longitude, community.latitude]);
      if (!projected) continue;
      const [cx, cy] = projected as [number, number];

      const circle = svg
        .append("circle")
        .attr("class", "lcm-pin")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", 7);

      // Desktop — hover tooltip
      circle.on("mouseenter", function () {
        d3.select(this as SVGCircleElement).attr("r", 10);

        if (!tooltip || !wrap) return;
        if (hideTooltipTimer) clearTimeout(hideTooltipTimer);

        const svgRect = (wrap.querySelector("svg") as SVGSVGElement)!.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const scaleX = svgRect.width / width;
        const scaleY = svgRect.height / height;

        tooltip.querySelector(".lcm-tooltip-name")!.textContent = community.name;
        const link = tooltip.querySelector(".lcm-tooltip-link") as HTMLAnchorElement;
        link.href = "/groups/" + community.slug;

        tooltip.style.left = cx * scaleX + (svgRect.left - wrapRect.left) + "px";
        tooltip.style.top = cy * scaleY + (svgRect.top - wrapRect.top) + "px";
        tooltip.classList.add("visible");
      });

      circle.on("mouseleave", function () {
        d3.select(this as SVGCircleElement).attr("r", 7);
        if (!tooltip) return;
        // small delay so the user can hover into the tooltip itself
        hideTooltipTimer = setTimeout(() => {
          tooltip.classList.remove("visible");
        }, 200);
      });

      // Mobile — tap card at bottom
      circle.on("click", function () {
        if (!tapCard || !tapCardName || !tapCardLink) return;
        tapCardName.textContent = community.name;
        tapCardLink.href = "/groups/" + community.slug;
        tapCard.classList.add("visible");
      });
    }

    // Keep tooltip alive when hovering over it
    if (tooltip) {
      tooltip.addEventListener("mouseenter", () => {
        if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
      });
      tooltip.addEventListener("mouseleave", () => {
        tooltip.classList.remove("visible");
      });
    }
  });

  return (
    <div class="lcm-section">
      {/* Left text */}
      <div class="lcm-text">
        <h2 class="lcm-title">{title}</h2>
        <p class="lcm-body">{body}</p>
        <a href={ctaHref} class="lcm-cta">
          {ctaLabel}
        </a>
      </div>

      {/* Map */}
      <div class="lcm-map-wrap" ref={mapWrapRef}>
        {/* Desktop hover tooltip */}
        <div ref={tooltipRef} class="lcm-tooltip">
          <span class="lcm-tooltip-name" />
          <a class="lcm-tooltip-link" href="#">
            Visit group page →
          </a>
        </div>

        {/* Mobile tap card */}
        <div ref={tapCardRef} class="lcm-tap-card">
          <span ref={tapCardNameRef} class="lcm-tap-card-name" />
          <a ref={tapCardLinkRef} class="lcm-tap-card-link" href="#">
            Visit group page →
          </a>
          <span
            class="lcm-tap-card-close"
            onClick$={() => {
              if (tapCardRef.value) tapCardRef.value.classList.remove("visible");
            }}
          >
            ✕ close
          </span>
        </div>
      </div>
    </div>
  );
});
