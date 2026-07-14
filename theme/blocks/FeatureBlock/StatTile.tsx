import { component$ } from "@qwik.dev/core";

interface StatTileProps {
  number: string;
  title: string;
  description?: string;
  area?: string;
}

export const StatTile = component$<StatTileProps>((props) => {
  return (
    <div
      class="bg-bg-card border border-border p-8 flex flex-col justify-between h-full"
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <div>
        <p class="font-bold text-[50px] md:text-[40px] leading-none text-primary mb-2">
          {props.number}
        </p>
        <h3 class="font-semibold text-[24px] leading-snug text-text-heading mb-4">
          {props.title}
        </h3>
      </div>
      {props.description && (
        <p class="text-[16px] leading-relaxed text-text-secondary mt-auto">
          {props.description}
        </p>
      )}
    </div>
  );
});
