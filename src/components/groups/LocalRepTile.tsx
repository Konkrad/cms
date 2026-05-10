import { component$ } from "@builder.io/qwik";
import { Avatar, Button } from "~/components/ui";

interface LocalRepTileProps {
  area?: string;
  name: string;
  subtitle: string;
  profilePictureUrl?: string | null;
  profileUrl?: string | null;
}

export const LocalRepTile = component$<LocalRepTileProps>((props) => {
  return (
    <div
      class="bg-[#034ea2] rounded-[25px] p-8 h-full flex flex-col justify-between"
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <div>
        <h3 class="font-['Rubik',sans-serif] font-semibold text-[24px] text-white mb-4">
          Local Rep
        </h3>

        <div class="flex items-center gap-3">
          <Avatar src={props.profilePictureUrl} name={props.name} size="md" class="border-white/40" />
          <div class="min-w-0">
            <p class="font-['Lato',sans-serif] font-bold text-white truncate">{props.name}</p>
            <p class="font-['Lato',sans-serif] text-white/80 text-sm truncate">{props.subtitle}</p>
          </div>
        </div>
      </div>

      {props.profileUrl ? (
        <div class="mt-6">
          <Button href={props.profileUrl} variant="secondary">
            View Profile
          </Button>
        </div>
      ) : null}
    </div>
  );
});
