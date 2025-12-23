import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  type Signal,
} from "@builder.io/qwik";
import flatpickr from "flatpickr";
import type { Instance } from "flatpickr/dist/types/instance";

interface SmartDatePickerProps {
  startDateName?: string;
  endDateName?: string;
  label?: string;
  required?: boolean;
  startValue?: string;
  endValue?: string;
}

export const SmartDatePicker = component$<SmartDatePickerProps>(
  ({
    startDateName = "startDate",
    endDateName = "endDate",
    label = "Date & Time",
    required = false,
    startValue = "",
    endValue = "",
  }) => {
    const startInputRef = useSignal<HTMLInputElement>();
    const endInputRef = useSignal<HTMLInputElement>();
    const startDateTime = useSignal(startValue);
    const endDateTime = useSignal(endValue);
    const isAllDay = useSignal(false);
    const isMultiDay = useSignal(false);

    // Initialize multi-day state from values
    useVisibleTask$(({ track }) => {
      track(() => startValue);
      track(() => endValue);

      if (startValue && endValue) {
        const startDate = new Date(startValue).toDateString();
        const endDate = new Date(endValue).toDateString();
        isMultiDay.value = startDate !== endDate;

        // Check if it's all day
        const start = new Date(startValue);
        const end = new Date(endValue);
        if (
          start.getHours() === 0 &&
          start.getMinutes() === 0 &&
          end.getHours() === 23 &&
          end.getMinutes() === 59
        ) {
          isAllDay.value = true;
        }
      }
    });

    // Initialize Flatpickr for start date
    useVisibleTask$(({ track, cleanup }) => {
      track(() => isAllDay.value);
      track(() => isMultiDay.value);

      const input = startInputRef.value;
      if (!input) return;

      // Load CSS
      if (!document.querySelector('link[href*="flatpickr"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
          "https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css";
        document.head.appendChild(link);
      }

      let fp: Instance | null = null;

      const initFlatpickr = () => {
        fp = flatpickr(input, {
          enableTime: !isAllDay.value,
          time_24hr: true,
          dateFormat: isAllDay.value ? "Y-m-d" : "Y-m-d H:i",
          defaultDate: startValue || new Date(),
          onChange: (selectedDates) => {
            if (selectedDates[0]) {
              const date = selectedDates[0];
              if (isAllDay.value) {
                date.setHours(0, 0, 0, 0);
              }
              startDateTime.value = date.toISOString();

              // If not multi-day, sync end date
              if (!isMultiDay.value && endInputRef.value) {
                const endDate = new Date(date);
                if (isAllDay.value) {
                  endDate.setHours(23, 59, 59, 999);
                } else {
                  endDate.setHours(date.getHours() + 1);
                }
                endDateTime.value = endDate.toISOString();

                // Update end input display
                const endFp = (endInputRef.value as any)._flatpickr;
                if (endFp) {
                  endFp.setDate(endDate, false);
                }
              }
            }
          },
        });
      };

      // Small delay to ensure DOM is ready
      setTimeout(initFlatpickr, 10);

      cleanup(() => {
        if (fp) {
          fp.destroy();
        }
      });
    });

    // Initialize Flatpickr for end date
    useVisibleTask$(({ track, cleanup }) => {
      track(() => isAllDay.value);
      track(() => isMultiDay.value);

      const input = endInputRef.value;
      if (!input || !isMultiDay.value) return;

      let fp: Instance | null = null;

      const initFlatpickr = () => {
        fp = flatpickr(input, {
          enableTime: !isAllDay.value,
          time_24hr: true,
          dateFormat: isAllDay.value ? "Y-m-d" : "Y-m-d H:i",
          defaultDate: endValue || startValue || new Date(),
          onChange: (selectedDates) => {
            if (selectedDates[0]) {
              const date = selectedDates[0];
              if (isAllDay.value) {
                date.setHours(23, 59, 59, 999);
              }
              endDateTime.value = date.toISOString();
            }
          },
        });
      };

      setTimeout(initFlatpickr, 10);

      cleanup(() => {
        if (fp) {
          fp.destroy();
        }
      });
    });

    const handleAllDayToggle$ = $((checked: boolean) => {
      isAllDay.value = checked;

      // Update dates
      if (checked) {
        if (startDateTime.value) {
          const start = new Date(startDateTime.value);
          start.setHours(0, 0, 0, 0);
          startDateTime.value = start.toISOString();
        }
        if (endDateTime.value) {
          const end = new Date(endDateTime.value);
          end.setHours(23, 59, 59, 999);
          endDateTime.value = end.toISOString();
        }
      }
    });

    const handleMultiDayToggle$ = $((checked: boolean) => {
      isMultiDay.value = checked;

      if (!checked && startDateTime.value) {
        // Sync end date to start date
        const start = new Date(startDateTime.value);
        const end = new Date(start);
        if (isAllDay.value) {
          end.setHours(23, 59, 59, 999);
        } else {
          end.setHours(start.getHours() + 1);
        }
        endDateTime.value = end.toISOString();
      }
    });

    return (
      <div class="space-y-4">
        <label class="block text-sm font-medium text-gray-700">
          {label}
          {required && <span class="text-red-500 ml-1">*</span>}
        </label>

        {/* Hidden inputs for form submission */}
        <input type="hidden" name={startDateName} value={startDateTime.value} />
        <input type="hidden" name={endDateName} value={endDateTime.value} />

        {/* Options row */}
        <div class="flex gap-6">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDay.value}
              onChange$={(e) =>
                handleAllDayToggle$((e.target as HTMLInputElement).checked)
              }
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">All day</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isMultiDay.value}
              onChange$={(e) =>
                handleMultiDayToggle$((e.target as HTMLInputElement).checked)
              }
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">Multi-day event</span>
          </label>
        </div>

        {/* Start date/time */}
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="text-sm font-medium text-gray-700 mb-2">Start</div>
          <input
            ref={startInputRef}
            type="text"
            placeholder="Select start date"
            required={required}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* End date/time - only show if multi-day */}
        {isMultiDay.value && (
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm font-medium text-gray-700 mb-2">End</div>
            <input
              ref={endInputRef}
              type="text"
              placeholder="Select end date"
              required={required}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>
    );
  },
);
