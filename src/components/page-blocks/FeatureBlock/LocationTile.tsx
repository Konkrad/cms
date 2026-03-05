import { component$ } from "@builder.io/qwik";

interface LocationTileProps {
  image: string;
  location: string;
  area?: string;
}

export const LocationTile = component$<LocationTileProps>((props) => {
  return (
    <div
      class="relative rounded-[25px] overflow-hidden h-full w-full"
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <img
        src={props.image}
        alt={props.location}
        class="w-full h-full object-cover"
        width={800}
        height={600}
      />

      {/* Top overlay with location pin + address */}
      <div class="absolute top-8 left-8 right-8 flex items-start gap-3">
        {/* Map pin icon */}
        <div class="w-9 h-9 flex-shrink-0">
          <svg class="w-full h-full" fill="none" viewBox="0 0 36 36">
            <path
              d="M18 2C12.48 2 8 6.48 8 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.52-4.48-10-10-10zm0 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"
              fill="white"
            />
          </svg>
        </div>
        <h3 class="font-['Rubik',sans-serif] font-semibold text-[25px] md:text-[30px] leading-[1.406] text-white drop-shadow-lg">
          {props.location}
        </h3>
      </div>
    </div>
  );
});
