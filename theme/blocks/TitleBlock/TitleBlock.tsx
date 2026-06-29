import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/db/schema";

interface TitleBlockProps {
  text?: string;
  level?: number | string;
  align?: "left" | "center" | "right";
}

export const definition: BlockDefinition = {
  name: "Title",
  componentType: "TitleBlock",
  category: "content",
  icon: "🏷️",
  configSchema: [
    {
      name: "text",
      label: "Text",
      type: "text",
      defaultValue: "Section Title",
      required: true,
    },
    {
      name: "level",
      label: "Heading Level",
      type: "select",
      defaultValue: "2",
      options: [
        { label: "H1", value: "1" },
        { label: "H2", value: "2" },
        { label: "H3", value: "3" },
        { label: "H4", value: "4" },
        { label: "H5", value: "5" },
        { label: "H6", value: "6" },
      ],
    },
    {
      name: "align",
      label: "Alignment",
      type: "select",
      defaultValue: "left",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
  ],
  defaultData: {
    text: "Section Title",
    level: "2",
    align: "left",
  },
};

export default component$<TitleBlockProps>((props) => {
  const text = props.text ?? "Section Title";
  const levelNum = Math.min(Math.max(Number(props.level ?? 2), 1), 6);
  const Tag = `h${levelNum}` as unknown as any;

  const sizeClass = (() => {
    switch (levelNum) {
      case 1:
        return "text-5xl md:text-6xl";
      case 2:
        return "text-3xl md:text-4xl";
      case 3:
        return "text-2xl md:text-3xl";
      case 4:
        return "text-xl md:text-2xl";
      case 5:
        return "text-lg md:text-xl";
      default:
        return "text-base md:text-lg";
    }
  })();

  const alignClass =
    props.align === "center"
      ? "text-center"
      : props.align === "right"
        ? "text-right"
        : "text-left";

  return (
    <div class="max-w-6xl mx-auto px-4 py-6">
      <Tag class={`${sizeClass} font-bold text-text-heading ${alignClass}`}>
        {text}
      </Tag>
    </div>
  );
});
