import { component$ } from "@builder.io/qwik";
import { ReadMoreButton } from "../ReadMoreButton";

interface GroupCardProps {
  name: string;
  memberCount: number;
  image?: string | null;
  readMoreHref?: string;
}

const PEOPLE_PATH =
  "M12 12.75C11.0054 12.75 10.0516 12.3549 9.34835 11.6517C8.64509 10.9484 8.25 9.9946 8.25 9C8.25 8.0054 8.64509 7.05161 9.34835 6.34835C10.0516 5.64509 11.0054 5.25 12 5.25C12.9946 5.25 13.9484 5.64509 14.6517 6.34835C15.3549 7.05161 15.75 8.0054 15.75 9C15.75 9.9946 15.3549 10.9484 14.6517 11.6517C13.9484 12.3549 12.9946 12.75 12 12.75ZM12 6.75C11.4033 6.75 10.831 6.98705 10.409 7.40901C9.98705 7.83097 9.75 8.40326 9.75 9C9.75 9.59674 9.98705 10.169 10.409 10.591C10.831 11.0129 11.4033 11.25 12 11.25C12.5967 11.25 13.169 11.0129 13.591 10.591C14.0129 10.169 14.25 9.59674 14.25 9C14.25 8.40326 14.0129 7.83097 13.591 7.40901C13.169 6.98705 12.5967 6.75 12 6.75Z";

const PEOPLE_PATH_2 =
  "M18.75 18.75C18.5511 18.75 18.3603 18.671 18.2197 18.5303C18.079 18.3897 18 18.1989 18 18C18 16.8065 17.5259 15.6619 16.682 14.818C15.8381 13.9741 14.6935 13.5 13.5 13.5H10.5C9.30653 13.5 8.16193 13.9741 7.31802 14.818C6.47411 15.6619 6 16.8065 6 18C6 18.1989 5.92098 18.3897 5.78033 18.5303C5.63968 18.671 5.44891 18.75 5.25 18.75C5.05109 18.75 4.86032 18.671 4.71967 18.5303C4.57902 18.3897 4.5 18.1989 4.5 18C4.5 16.4087 5.13214 14.8826 6.25736 13.7574C7.38258 12.6321 8.9087 12 10.5 12H13.5C15.0913 12 16.6174 12.6321 17.7426 13.7574C18.8679 14.8826 19.5 16.4087 19.5 18C19.5 18.1989 19.421 18.3897 19.2803 18.5303C19.1397 18.671 18.9489 18.75 18.75 18.75Z";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export const GroupCard = component$<GroupCardProps>(
  ({ name, memberCount, image, readMoreHref = "#" }) => {
    const initials = getInitials(name);

    return (
      <div class="relative w-full bg-white rounded-[25px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] h-[200px] flex items-center">
        {/* Content Area */}
        <div class="flex-1 flex items-center px-8 pl-16">
          {/* Avatar / Image */}
          <div class="flex flex-col items-center justify-center min-w-[170px]">
            {image ? (
              <div class="w-[80px] h-[80px] rounded-full overflow-hidden flex-shrink-0">
                <img
                  src={image}
                  alt={name}
                  class="w-full h-full object-cover"
                  width={80}
                  height={80}
                />
              </div>
            ) : (
              <div class="w-[80px] h-[80px] rounded-full bg-[#034EA2] flex items-center justify-center flex-shrink-0">
                <span class="font-['Lato',sans-serif] font-bold text-[28px] text-white leading-none">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Divider Line */}
          <div class="h-24 w-px bg-black/20 mx-8" />

          {/* Name and Member Count */}
          <div class="flex-1 flex flex-col justify-center gap-4">
            <h3 class="font-['Lato',sans-serif] font-bold text-[26px] leading-[1.359] text-black">
              {name}
            </h3>

            <div class="flex items-center gap-2">
              <svg
                class="w-[20px] h-[20px] flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path d={PEOPLE_PATH} fill="black" />
                <path d={PEOPLE_PATH_2} fill="black" />
              </svg>
              <p class="font-['Lato',sans-serif] font-normal text-[15px] leading-[1.523] text-black">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </p>
            </div>
          </div>

          {/* Read More Button */}
          <div class="ml-8 flex-shrink-0">
            <ReadMoreButton href={readMoreHref} />
          </div>
        </div>
      </div>
    );
  },
);
