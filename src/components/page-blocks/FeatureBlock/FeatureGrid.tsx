import { component$, Slot } from "@builder.io/qwik";
import "./FeatureGrid.css";

interface FeatureGridProps {
  layout?: string;
  gap?: number;
  class?: string;
}

const DEFAULT_LAYOUT = `
  "left-top middle right-top"
  "left-bottom middle right-top"
  "left-bottom middle right-bottom"
`;

export const FeatureGrid = component$<FeatureGridProps>((props) => {
  const layout = props.layout || DEFAULT_LAYOUT;
  const gap = props.gap ?? 24;

  return (
    <div
      class={`feature-grid ${props.class ?? ""}`}
      style={{
        gridTemplateAreas: layout,
        gap: `${gap}px`,
      }}
    >
      <Slot />
    </div>
  );
});
