import { component$ } from "@builder.io/qwik";

interface ReadMoreButtonProps {
  href?: string;
  label?: string;
}

const ARROW_PATH =
  "M15.7501 10.5C15.7458 10.0397 15.5603 9.59953 15.2338 9.275L11.4801 5.5125C11.3161 5.34953 11.0944 5.25806 10.8632 5.25806C10.632 5.25806 10.4103 5.34953 10.2463 5.5125C10.1643 5.59384 10.0992 5.69062 10.0548 5.79724C10.0104 5.90387 9.98749 6.01824 9.98749 6.13375C9.98749 6.24926 10.0104 6.36363 10.0548 6.47025C10.0992 6.57688 10.1643 6.67366 10.2463 6.755L13.1251 9.62499H4.37506C4.143 9.62499 3.92044 9.71718 3.75635 9.88128C3.59225 10.0454 3.50006 10.2679 3.50006 10.5C3.50006 10.7321 3.59225 10.9546 3.75635 11.1187C3.92044 11.2828 4.143 11.375 4.37506 11.375H13.1251L10.2463 14.2537C10.0815 14.4173 9.98852 14.6397 9.9877 14.8719C9.98688 15.1041 10.0783 15.3271 10.2419 15.4919C10.4055 15.6566 10.6279 15.7497 10.8601 15.7505C11.0923 15.7513 11.3153 15.6598 11.4801 15.4962L15.2338 11.7337C15.5625 11.4071 15.7481 10.9634 15.7501 10.5V10.5Z";

export const ReadMoreButton = component$<ReadMoreButtonProps>(
  ({ href = "#", label = "Read More" }) => {
    return (
      <a href={href} class="flex items-center gap-2 group">
        {/* Green Circle with Arrow */}
        <div class="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
          <svg class="w-full h-full" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" fill="#96C247" r="12" />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-[21px] h-[21px]" fill="none" viewBox="0 0 21 21">
              <path d={ARROW_PATH} fill="black" />
            </svg>
          </div>
        </div>

        {/* Label */}
        <span class="font-['Lato',sans-serif] font-bold text-sm leading-[1.348] group-hover:underline transition-all">
          {label}
        </span>
      </a>
    );
  },
);
