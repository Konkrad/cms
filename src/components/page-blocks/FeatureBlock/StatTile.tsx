import { component$ } from "@builder.io/qwik";

interface StatTileProps {
  number: string;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  area?: string;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "min-h-[240px]",
  md: "min-h-[280px]",
  lg: "min-h-[360px]",
};

export const StatTile = component$<StatTileProps>((props) => {
  const sizeClass = SIZE_CLASSES[props.size ?? "md"];

  return (
    <div
      class={`bg-[#034ea2] rounded-[25px] p-8 flex flex-col justify-between ${sizeClass}`}
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <div>
        <p class="font-['Rubik',sans-serif] font-normal text-[50px] md:text-[30px] leading-[1.406] text-white mb-2">
          {props.number}
        </p>
        <h3 class="font-['Rubik',sans-serif] font-semibold text-[30px] leading-[1.406] text-white mb-4">
          {props.title}
        </h3>
      </div>
      {props.description && (
        <p class="font-['Rubik',sans-serif] font-normal text-[18px] leading-[1.406] text-white mt-auto">
          {props.description}
        </p>
      )}
    </div>
  );
});
