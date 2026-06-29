import { $, component$ } from "@qwik.dev/core";

export interface DealBoxProps {
  type: "link" | "text" | "promo";
  title: string;
  description?: string;
  isLocked?: boolean;
  content?: string; // URL for link, or promo code for promo
  linkText?: string; // display label for link steps
}

export const DealBox = component$<DealBoxProps>(
  ({ type, title, description, isLocked = false, content, linkText }) => {
    return (
      <div
        class={[
          "relative bg-white w-[250px] min-h-[173px] rounded-[15px]",
          "shadow-[0px_0px_6px_0px_rgba(0,0,0,0.22)] p-5",
          "flex flex-col justify-start items-start overflow-hidden",
          "transition-transform duration-200 hover:-translate-y-0.5",
          type === "link" && !isLocked ? "cursor-pointer" : "",
        ].join(" ")}
        onClick$={
          type === "link" && !isLocked && content
            ? $(() => {
                window.open(content, "_blank", "noopener,noreferrer");
              })
            : undefined
        }
      >
        <h3 class="font-['Lato',sans-serif] font-bold text-[21px] leading-[1.359] text-[#121212] m-0 mb-3 text-left">
          {title}
        </h3>

        {type === "link" && !isLocked && (
          <div class="flex items-center gap-3 mt-auto mb-2">
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-[#96C046] to-[#D2DF83] flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </div>
            <p class="font-['Lato',sans-serif] font-bold text-[14px] leading-[1.348] text-[#121212] m-0">
              {linkText || content || "Go to the Website"}
            </p>
          </div>
        )}

        {type === "text" && !isLocked && (
          <div class="flex-1 flex items-start justify-start">
            {description && (
              <p class="font-['Lato',sans-serif] font-normal text-[15px] leading-[1.523] text-black m-0 text-left">
                {description}
              </p>
            )}
          </div>
        )}

        {type === "promo" && !isLocked && (
          <div class="flex-1 flex flex-col items-start justify-start gap-2">
            {description && (
              <p class="font-['Lato',sans-serif] font-normal text-[15px] leading-[1.523] text-black m-0 text-left">
                {description}
              </p>
            )}
            <p class="font-['Lato',sans-serif] font-bold text-[24px] leading-[1.523] text-[#96c046] mt-2 m-0 text-left">
              {content || "XXX XXXX XXX"}
            </p>
          </div>
        )}

        {isLocked && (
          <div class="absolute inset-0 bg-white/85 backdrop-blur-[3px] flex flex-col items-center justify-center gap-3 z-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#96c046" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <p class="font-['Lato',sans-serif] font-semibold text-[14px] text-[#121212] opacity-60 m-0">
              Login to unlock
            </p>
          </div>
        )}
      </div>
    );
  },
);
