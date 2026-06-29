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
      class="bg-[#034ea2] rounded-[25px] p-8 flex flex-col justify-between h-full"
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
