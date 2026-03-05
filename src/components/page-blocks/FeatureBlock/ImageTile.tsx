import { component$, Slot } from "@builder.io/qwik";

interface ImageTileProps {
  image: string;
  alt?: string;
  overlayText?: string;
  area?: string;
}

export const ImageTile = component$<ImageTileProps>((props) => {
  const hasOverlay = props.overlayText;

  return (
    <div
      class="relative rounded-[25px] overflow-hidden h-full w-full"
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <img
        src={props.image}
        alt={props.alt ?? ""}
        class="w-full h-full object-cover"
        width={800}
        height={600}
      />

      {/* Gradient overlay for text readability */}
      {hasOverlay && (
        <div
          class="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.36) 33.1%, rgba(19,19,19,0.36) 46.4%, rgba(102,102,102,0) 100%)",
          }}
        />
      )}

      {props.overlayText && (
        <div class="absolute bottom-8 left-8 right-8">
          <p class="font-['Rubik',sans-serif] font-normal text-[19px] leading-[1.406] text-white">
            {props.overlayText}
          </p>
        </div>
      )}

      {/* Slot for arbitrary child content positioned over the image */}
      <div class="absolute inset-0">
        <Slot />
      </div>
    </div>
  );
});
