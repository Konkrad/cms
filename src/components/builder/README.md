# Builder — Page Block Components

This directory contains the UI for the page builder (canvas, sidebar, properties panel). Page "blocks" (the actual pieces you add to pages) live under `theme/blocks/` and follow a simple convention so the builder can discover and render them.

Quick summary
- A page-block file must export:
  - a named `definition: BlockDefinition` (metadata + config schema)
  - a default Qwik component (the UI rendered on pages and in the canvas)
- Register the block in `theme/blocks/index.ts` (add it to `blockDefinitions` and `blockRegistry`) so it can be discovered and dynamically loaded by the builder — `src/services/component-loader.service.ts` just consumes that registry, no separate registration step needed there.
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
1. Create a new component file (example: `theme/blocks/MyBlock.tsx`).
2. Export a `definition: BlockDefinition` that describes the block and its `configSchema` and `defaultData`.
3. Export a default `component$` which accepts the fields from your `configSchema` as props and renders UI. If the block needs server data, see "Dynamic blocks" below first — theme files must not import `~/services/*`/`~/db/*` directly (enforced by a Biome rule).
4. Register it in `theme/blocks/index.ts`: import the component + `definition` and add both to `blockRegistry`/`blockDefinitions`.
5. Restart dev server (or clear the loader cache with `componentLoaderService.clearCache()` if you need to reload definitions at runtime).

Minimal example
```/dev/null/ExampleBlock.tsx#L1-80
import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";

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
```theme/blocks/index.ts
import ExampleBlock, { definition as ExampleBlockDef } from "./ExampleBlock";

export const blockDefinitions: BlockDefinition[] = [
  // ...existing definitions,
  ExampleBlockDef,
];

export const blockRegistry: Record<string, any> = {
  // ...existing components,
  ExampleBlock,
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
- For blocks that fetch server data: the page builder has no route loader to supply props, so the block itself must not import `~/services/*`/`~/db/*`/`~/utils/server-auth` directly (theme is licensed separately from core; this is enforced by a `noRestrictedImports` Biome rule scoped to `theme/**`). Instead, add a headless composable — a plain function using `useSignal`/`useTask$`/`server$()`, Qwik's native "custom hook" pattern — under `src/components/builder/blocks/useMyBlock.ts` that owns the service/db/auth calls and returns signals + action handlers. The theme block calls the composable and only renders. See `useUpcomingEvents.ts` (initial fetch + "Load More" pagination) or `useDealsList.ts` (simple single fetch) for the pattern, and the matching theme files (`UpcomingEventsBlock.tsx`, `DealsListBlock.tsx`) for how little the block itself does. Add any new public type the composable returns to `src/contracts/*.ts` rather than having the block import a raw `~/services/*`/`~/db/*` type. Mark the block `category: "dynamic"` in its definition so the UI groups it accordingly.

Tips
- Keep `componentType` unique and in sync with the key you add to `blockRegistry`.
- Ensure `defaultData` keys match your `configSchema` names so newly added blocks are pre-populated correctly.
- Look at existing blocks in `theme/blocks/` for examples and patterns.

That's it — create a new file in `theme/blocks/`, export `definition` + default component, register it in the loader, and you'll be able to add and edit it from the builder UI.