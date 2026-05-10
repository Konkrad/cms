# Builder — Page Block Components

This directory contains the UI for the page builder (canvas, sidebar, properties panel). Page "blocks" (the actual pieces you add to pages) live under `src/components/page-blocks/` and follow a simple convention so the builder can discover and render them.

Quick summary
- A page-block file must export:
  - a named `definition: BlockDefinition` (metadata + config schema)
  - a default Qwik component (the UI rendered on pages and in the canvas)
- Register the block in `src/services/component-loader.service.ts` so it can be discovered and dynamically loaded by the builder.
- The admin builder UI uses the `definition` to render the sidebar and the `PropertiesPanel` to edit a block's `data`.

Key types (see schema)
```src/db/schemas/shared.ts#L1-40
export interface BlockData {
	id: string;
	componentType: string;
	order: number;
	data: Record<string, any>;
}

export interface FieldDefinition {
	name: string;
	label: string;
	type: "text" | "textarea" | "number" | "boolean" | "select" | "color" | "url";
	defaultValue?: any;
	options?: { label: string; value: string }[];
	placeholder?: string;
	required?: boolean;
}

export interface BlockDefinition {
	name: string;
	componentType: string;
	category: "content" | "dynamic";
	icon: string;
	configSchema: FieldDefinition[];
	defaultData: Record<string, any>;
}
```

How the builder uses these
- When you add a block, the builder creates a `BlockData` with `data` initialized from `definition.defaultData`.
- `Canvas` and `BlockWrapper` display blocks; `BlockRenderer` dynamically loads the component using `componentLoaderService.loadComponent(componentType)` and spreads `...block.data` as props into the component.
- `PropertiesPanel` reads `definition.configSchema` and renders the appropriate input controls. It calls `onUpdateData(blockId, data)` when fields change.

Creating a new block (step-by-step)
1. Create a new component file (example: `src/components/page-blocks/MyBlock.tsx`).
2. Export a `definition: BlockDefinition` that describes the block and its `configSchema` and `defaultData`.
3. Export a default `component$` which accepts the fields from your `configSchema` as props and renders UI.
4. Register it in `src/services/component-loader.service.ts` by adding a mapping to `componentModules`.
5. Restart dev server (or clear the loader cache with `componentLoaderService.clearCache()` if you need to reload definitions at runtime).

Minimal example
```/dev/null/ExampleBlock.tsx#L1-80
import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/db/schema";

interface ExampleBlockProps {
  title?: string;
  count?: number;
  featured?: boolean;
}

export const definition: BlockDefinition = {
  name: "Example Block",
  componentType: "ExampleBlock",
  category: "content",
  icon: "✨",
  configSchema: [
    { name: "title", label: "Title", type: "text", defaultValue: "Hello" },
    { name: "count", label: "Count", type: "number", defaultValue: 3 },
    { name: "featured", label: "Featured", type: "boolean", defaultValue: false }
  ],
  defaultData: { title: "Hello", count: 3, featured: false },
};

export default component$<ExampleBlockProps>((props) => {
  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h2>{props.title}</h2>
      <p>{props.count} items</p>
      {props.featured && <strong>Featured</strong>}
    </div>
  );
});
```

Registering the component
```src/services/component-loader.service.ts#L1-24
const componentModules = {
  HeroBlock: () => import("~/components/page-blocks/HeroBlock"),
  TextBlock: () => import("~/components/page-blocks/TextBlock"),
  // add your block:
  ExampleBlock: () => import("~/components/page-blocks/ExampleBlock"),
};
```

Field types supported by the `PropertiesPanel` UI
- `text`, `url` → single-line input
- `textarea` → multi-line input
- `number` → numeric input
- `boolean` → checkbox
- `select` + `options` → dropdown
- `color` → color picker

Dynamic blocks
- For blocks that fetch server data, use `server$` or existing services (see `UpcomingEventsBlock` / `PostsListBlock` for examples). Mark the block `category: "dynamic"` in its definition so the UI groups it accordingly.

Tips
- Keep `componentType` unique and in sync with the key you add to `componentModules`.
- Ensure `defaultData` keys match your `configSchema` names so newly added blocks are pre-populated correctly.
- Look at existing blocks in `src/components/page-blocks/` for examples and patterns.

That's it — create a new file in `src/components/page-blocks/`, export `definition` + default component, register it in the loader, and you'll be able to add and edit it from the builder UI.