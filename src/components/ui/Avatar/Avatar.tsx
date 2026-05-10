import { component$ } from "@qwik.dev/core";

type AvatarSize = "sm" | "md" | "lg";

type AvatarProps = {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  class?: string;
};

const sizeClasses: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: "w-8 h-8", text: "text-xs" },
  md: { container: "w-12 h-12", text: "text-base" },
  lg: { container: "w-14 h-14", text: "text-xl" },
};

export const Avatar = component$<AvatarProps>(
  ({ src, name, size = "md", class: className }) => {
    const { container, text } = sizeClasses[size];

    if (src) {
      return (
        <img
          src={src}
          alt={name}
          width={size === "sm" ? 32 : size === "md" ? 48 : 56}
          height={size === "sm" ? 32 : size === "md" ? 48 : 56}
          class={`${container} rounded-full object-cover border-2 border-gray-200 flex-shrink-0 ${className || ""}`}
        />
      );
    }

    return (
      <div
        class={`${container} rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border-2 border-gray-200 ${className || ""}`}
      >
        <span class={`text-text-muted font-semibold ${text}`}>
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  },
);
