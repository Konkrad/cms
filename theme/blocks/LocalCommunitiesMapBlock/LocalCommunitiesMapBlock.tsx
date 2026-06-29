import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { BlockDefinition } from "~/db/schema";
import { Button } from "~/components/ui/Button";
import { groupsService } from "~/services/groups.service";
import "./LocalCommunitiesMapBlock.css";

export const definition: BlockDefinition = {
  name: "Local Communities Map",
  componentType: "LocalCommunitiesMapBlock",
  category: "dynamic",
  icon: "🗺️",
  configSchema: [],
  defaultData: {},
};

const MESH_DISTANCE_THRESHOLD = 80;
const CITY_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson";

interface MapPin {
  id: number;
  name: string;
  slug: string;
  cx: number;
  cy: number;
}

interface MapVariant {
  width: number;
  height: number;
  landPathD: string;
  meshPathD: string;
  cityPoints: [number, number][];
  pins: MapPin[];
}

interface MapRenderData {
  desktop: MapVariant;
  mobile: MapVariant;
}

function resolvePublicAssetPath(filename: string): string {
  const candidates = [
    join(process.cwd(), "dist", filename),
    join(process.cwd(), "public", filename),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`Could not locate static asset: ${filename}`);
  return found;
}

let staticGeoDataPromise: Promise<{ land: any; cityFeatures: any[] }> | null =
  null;

// Natural Earth land boundaries and populated places never change, so this is
// fetched/parsed once per server process instead of on every request.
function getStaticGeoData() {
  if (!staticGeoDataPromise) {
    staticGeoDataPromise = (async () => {
      const [landRaw, cityRaw] = await Promise.all([
        readFile(resolvePublicAssetPath("ne_10m_land.json"), "utf-8"),
        fetch(CITY_GEOJSON_URL).then((r) => r.json()),
      ]);
      const topoData = JSON.parse(landRaw);
      const land = feature(topoData, topoData.objects.ne_10m_land);
      return { land, cityFeatures: cityRaw.features as any[] };
    })();
  }
  return staticGeoDataPromise;
}

function buildVariant(
  land: any,
  cityFeatures: any[],
  communities: {
    id: number;
    name: string;
    slug: string;
    latitude: number;
    longitude: number;
  }[],
  width: number,
  isMobile: boolean,
): MapVariant {
  const height = Math.round(width * 0.65);
  const scale = Math.min(width, height) * (isMobile ? 2.8 : 1.4);

  const projection = (d3.geoAzimuthalEqualArea() as any)
    .center([15, 52])
    .scale(scale)
    .translate([width / 2, height / 2]);
  const path = d3.geoPath().projection(projection);

  const landPathD = path(land) ?? "";

  const cityPoints = cityFeatures
    .map((f) => projection(f.geometry.coordinates) as [number, number] | null)
    .filter((p): p is [number, number] => p !== null);

  const delaunay = d3.Delaunay.from(cityPoints);
  const { halfedges, triangles } = delaunay;
  const meshSegments: string[] = [];
  for (let i = 0; i < halfedges.length; i++) {
    const j = halfedges[i];
    if (j < i) continue;
    const p1 = cityPoints[triangles[i]];
    const p2 = cityPoints[triangles[j]];
    if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) < MESH_DISTANCE_THRESHOLD) {
      meshSegments.push(`M${p1[0]},${p1[1]}L${p2[0]},${p2[1]}`);
    }
  }

  const pins: MapPin[] = [];
  for (const community of communities) {
    const projected = projection([community.longitude, community.latitude]);
    if (!projected) continue;
    pins.push({
      id: community.id,
      name: community.name,
      slug: community.slug,
      cx: projected[0],
      cy: projected[1],
    });
  }

  return {
    width,
    height,
    landPathD,
    meshPathD: meshSegments.join(""),
    cityPoints,
    pins,
  };
}

const buildMapData = server$(async (): Promise<MapRenderData> => {
  const [{ land, cityFeatures }, allGroups] = await Promise.all([
    getStaticGeoData(),
    groupsService.getAll(),
  ]);

  const communities = (allGroups as any[])
    .filter((g) => g.latitude != null && g.longitude != null)
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      latitude: Number(g.latitude),
      longitude: Number(g.longitude),
    }));

  return {
    desktop: buildVariant(land, cityFeatures, communities, 1000, false),
    mobile: buildVariant(land, cityFeatures, communities, 800, true),
  };
});

interface LocalCommunitiesMapBlockProps {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

interface HoveredPin {
  id: number;
  name: string;
  slug: string;
  leftPercent: number;
  topPercent: number;
}

export default component$<LocalCommunitiesMapBlockProps>((props) => {
  const title = props.title ?? "Local Communities";
  const body =
    props.body ??
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
  const ctaLabel = props.ctaLabel ?? "Discover the Communities";
  const ctaHref = props.ctaHref ?? "/groups";

  const mapData = useSignal<MapRenderData | null>(null);
  const hoveredPin = useSignal<HoveredPin | null>(null);
  const tappedPin = useSignal<{ name: string; slug: string } | null>(null);
  const hideTooltipTimer = useSignal<number>();

  useTask$(async () => {
    mapData.value = await buildMapData();
  });

  const clearHideTimer = $(() => {
    if (hideTooltipTimer.value) {
      clearTimeout(hideTooltipTimer.value);
      hideTooltipTimer.value = undefined;
    }
  });

  return (
    <div class="lcm-section">
      <div class="lcm-text">
        <h2 class="lcm-title">{title}</h2>
        <p class="lcm-body">{body}</p>
        <Button href={ctaHref} size="xl">
          {ctaLabel}
        </Button>
      </div>

      <div class="lcm-map-wrap">
        {mapData.value &&
          (["desktop", "mobile"] as const).map((variant) => {
            const config = mapData.value![variant];
            return (
              <svg
                key={variant}
                class={`lcm-map-svg lcm-map-${variant}`}
                viewBox={`0 0 ${config.width} ${config.height}`}
              >
                <path class="lcm-land" d={config.landPathD} />
                <path class="lcm-mesh" d={config.meshPathD} />
                {config.cityPoints.map(([cx, cy], i) => (
                  <circle
                    key={i}
                    class="lcm-city"
                    cx={cx}
                    cy={cy}
                    r={variant === "mobile" ? 0.8 : 1.5}
                  />
                ))}
                {config.pins.map((pin) => (
                  <circle
                    key={pin.id}
                    class="lcm-pin"
                    cx={pin.cx}
                    cy={pin.cy}
                    r={7}
                    onMouseEnter$={() => {
                      if (hideTooltipTimer.value) {
                        clearTimeout(hideTooltipTimer.value);
                        hideTooltipTimer.value = undefined;
                      }
                      hoveredPin.value = {
                        id: pin.id,
                        name: pin.name,
                        slug: pin.slug,
                        leftPercent: (pin.cx / config.width) * 100,
                        topPercent: (pin.cy / config.height) * 100,
                      };
                    }}
                    onMouseLeave$={() => {
                      hideTooltipTimer.value = setTimeout(() => {
                        hoveredPin.value = null;
                      }, 200) as unknown as number;
                    }}
                    onClick$={() => {
                      tappedPin.value = { name: pin.name, slug: pin.slug };
                    }}
                  />
                ))}
              </svg>
            );
          })}

        <div
          class={`lcm-tooltip ${hoveredPin.value ? "visible" : ""}`}
          style={
            hoveredPin.value
              ? {
                  left: `${hoveredPin.value.leftPercent}%`,
                  top: `${hoveredPin.value.topPercent}%`,
                }
              : {}
          }
          onMouseEnter$={clearHideTimer}
          onMouseLeave$={() => {
            hoveredPin.value = null;
          }}
        >
          <span class="lcm-tooltip-name">{hoveredPin.value?.name}</span>
          <a
            class="lcm-tooltip-link"
            href={hoveredPin.value ? `/groups/${hoveredPin.value.slug}` : "#"}
          >
            Visit group page →
          </a>
        </div>

        <div class={`lcm-tap-card ${tappedPin.value ? "visible" : ""}`}>
          <span class="lcm-tap-card-name">{tappedPin.value?.name}</span>
          <a
            class="lcm-tap-card-link"
            href={tappedPin.value ? `/groups/${tappedPin.value.slug}` : "#"}
          >
            Visit group page →
          </a>
          <span
            class="lcm-tap-card-close"
            onClick$={() => {
              tappedPin.value = null;
            }}
          >
            ✕ close
          </span>
        </div>
      </div>
    </div>
  );
});
