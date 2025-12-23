import { component$, useSignal, useComputed$, $, useTask$ } from "@builder.io/qwik";

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
    const startDate = useSignal("");
    const startTime = useSignal("09:00");
    const endDate = useSignal("");
    const endTime = useSignal("17:00");
    const isAll
