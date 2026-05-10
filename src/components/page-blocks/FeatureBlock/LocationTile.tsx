import { component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
interface LocationTileProps {
  image: string;
  location: string;
  area?: string;
  lat?: number;
  lng?: number;
  mapboxAccessToken?: string;
}

export const LocationTile = component$<LocationTileProps>((props) => {
  const mapContainer = useSignal<HTMLDivElement>();

  useVisibleTask$(({ track, cleanup }) => {
    const lat = track(() => props.lat);
    const lng = track(() => props.lng);

    if (
      lat !== undefined &&
      lng !== undefined &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      mapContainer.value
    ) {
      if (props.mapboxAccessToken) {
        mapboxgl.accessToken = props.mapboxAccessToken;
      }
      const map = new mapboxgl.Map({
        container: mapContainer.value,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        zoom: 14,
        interactive: false,
      });

      map.on("load", () => {
        if (map.getLayer("poi-label")) {
          map.setLayoutProperty("poi-label", "visibility", "none");
        }
      });

      new mapboxgl.Marker({ color: "#ff0000" })
        .setLngLat([lng, lat])
        .addTo(map);

      cleanup(() => map.remove());
    }
  });

  return (
    <div
      class="relative rounded-[25px] overflow-hidden h-full w-full"
      style={props.area ? { gridArea: props.area } : undefined}
    >
      {props.lat !== undefined &&
      props.lng !== undefined &&
      !isNaN(props.lat) &&
      !isNaN(props.lng) ? (
        <div ref={mapContainer} class="w-full h-full absolute inset-0" />
      ) : (
        <img
          src={props.image}
          alt={props.location}
          class="w-full h-full object-cover"
          width={800}
          height={600}
        />
      )}

      {/* Top overlay with location pin + address */}
      <div class="absolute top-8 left-8 right-8 flex items-start gap-3">
        {/* Map pin icon */}
        <div class="w-9 h-9 flex-shrink-0">
          <svg class="w-full h-full" fill="none" viewBox="0 0 36 36">
            <path
              d="M18 2C12.48 2 8 6.48 8 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.52-4.48-10-10-10zm0 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"
              fill="black"
            />
          </svg>
        </div>
        <h3 class="font-['Rubik',sans-serif] font-semibold text-[25px] md:text-[30px] leading-[1.406] text-black drop-shadow-lg">
          {props.location}
        </h3>
      </div>
    </div>
  );
});
