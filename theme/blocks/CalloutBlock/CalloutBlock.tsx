import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/db/schema";

type CalloutType = "info" | "tip" | "warning" | "danger";

interface CalloutBlockProps {
  type?: CalloutType;
  title?: string;
  body?: string;
}

const STYLES: Record<CalloutType, { border: string; bg: string; icon: string; text: string }> = {
  info:    { border: "border-info",    bg: "bg-info-bg",    icon: "ℹ️", text: "text-info" },
  tip:     { border: "border-success", bg: "bg-success-bg", icon: "💡", text: "text-success" },
  warning: { border: "border-warning", bg: "bg-warning-bg", icon: "⚠️", text: "text-warning" },
  danger:  { border: "border-error",   bg: "bg-error-bg",   icon: "🚨", text: "text-error" },
};

export const definition: BlockDefinition = {
  name: "Callout",
  componentType: "CalloutBlock",
  category: "content",
  icon: "📣",
  configSchema: [
    {
      name: "type",
      label: "Type",
      type: "select",
      options: [
        { label: "Info", value: "info" },
        { label: "Tip", value: "tip" },
        { label: "Warning", value: "warning" },
        { label: "Danger", value: "danger" },
      ],
      defaultValue: "info",
    },
    { name: "title", label: "Title", type: "text", required: false },
    { name: "body",  label: "Body",  type: "textarea", defaultValue: "Add your callout message here." },
  ],
  defaultData: { type: "info", title: "", body: "Add your callout message here." },
};

export default component$<CalloutBlockProps>((props) => {
  const type: CalloutType = (props.type as CalloutType) ?? "info";
  const s = STYLES[type];

  return (
    <div class={`max-w-4xl mx-auto px-4 py-4`}>
      <div class={`border-l-4 ${s.border} ${s.bg} p-4 flex gap-3`}>
        <span class="text-xl shrink-0 mt-0.5" aria-hidden="true">{s.icon}</span>
        <div>
          {props.title && (
            <p class={`font-semibold mb-1 ${s.text}`}>{props.title}</p>
          )}
          {props.body && (
            <p class="text-sm text-text-secondary leading-relaxed">{props.body}</p>
          )}
        </div>
      </div>
    </div>
  );
});
