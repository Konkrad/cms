# Design System

## Philosophy

Every component—whether on the website, in emails, or in the page builder—draws from a single set of design tokens. Colors, spacing, typography, and radii are defined once in `tokens.css` (CSS custom properties) and `tokens.ts` (TypeScript constants). Components never hardcode hex values; they reference tokens.

## Brand Palette

| Token              | Value     | Usage                            |
| ------------------ | --------- | -------------------------------- |
| `--color-primary`  | `#034EA2` | Brand blue, buttons, links       |
| `--color-primary-light` | `#0a6dd6` | Hover states, gradients     |
| `--color-primary-dark`  | `#031241` | Dark gradient stops, headers |
| `--color-accent`   | `#96C247` | CTA buttons, success highlights  |
| `--color-accent-dark` | `#7da636` | Hover state for accent         |

## Neutrals

| Token                     | Value     | Usage                   |
| ------------------------- | --------- | ----------------------- |
| `--color-bg`              | `#f9fafb` | Page background         |
| `--color-bg-card`         | `#ffffff` | Card / panel background |
| `--color-bg-muted`        | `#f3f4f6` | Secondary backgrounds   |
| `--color-text`            | `#1f2937` | Primary body text       |
| `--color-text-secondary`  | `#4b5563` | Descriptions, captions  |
| `--color-text-muted`      | `#6b7280` | Placeholders, hints     |
| `--color-text-heading`    | `#111827` | Headings                |
| `--color-border`          | `#e5e7eb` | Default borders         |
| `--color-border-strong`   | `#d1d5db` | Emphasized borders      |

## Semantic Colors

| Token                       | Value     | Usage              |
| --------------------------- | --------- | ------------------ |
| `--color-error`             | `#b91c1c` | Error text         |
| `--color-error-bg`          | `#fef2f2` | Error background   |
| `--color-error-border`      | `#fca5a5` | Error border       |
| `--color-success`           | `#047857` | Success text       |
| `--color-success-bg`        | `#ecfdf5` | Success background |
| `--color-success-border`    | `#6ee7b7` | Success border     |
| `--color-info`              | `#1d4ed8` | Info text          |
| `--color-info-bg`           | `#eff6ff` | Info background    |
| `--color-info-border`       | `#bfdbfe` | Info border        |
| `--color-danger`            | `#dc2626` | Danger buttons     |
| `--color-danger-dark`       | `#b91c1c` | Danger hover       |

## Focus & Interaction

| Token               | Value                                | Usage               |
| -------------------- | ------------------------------------ | -------------------- |
| `--color-focus-ring` | `#034EA2`                            | Focus outline color  |
| `--focus-ring`       | `0 0 0 2px rgba(3, 78, 162, 0.25)`  | Box-shadow shorthand |

## Radii

| Token          | Value    |
| -------------- | -------- |
| `--radius-sm`  | `0.375rem` |
| `--radius-md`  | `0.5rem`   |
| `--radius-lg`  | `0.75rem`  |
| `--radius-xl`  | `1rem`     |

## Shadows

| Token          | Value                                         |
| -------------- | --------------------------------------------- |
| `--shadow-sm`  | `0 1px 2px rgba(0,0,0,0.05)`                 |
| `--shadow-md`  | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` |

## Typography

System font stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`.

CTA / action button font: `'Lato', sans-serif` at `20px` bold.

## Component Folder Convention

Every component lives in its own folder:

```
ComponentName/
  ComponentName.tsx   — main Qwik component
  ComponentName.css   — scoped styles (optional, for non-trivial CSS)
  index.ts            — barrel export
```

Sub-components go in the same folder as siblings (e.g. `FeatureBlock/StatTile.tsx`).

## Token Consumption

- **Tailwind classes**: Use extended palette names (`bg-primary`, `text-accent`, `border-border`, etc.) — configured via `tokens.ts` in `tailwind.config.js`.
- **Custom CSS**: Use `var(--color-primary)`, `var(--radius-md)`, etc.
- **Email inline styles**: Import from `~/design/tokens.ts`.
- **SurveyJS**: Overridden via `survey-theme.css` which maps `.sd-*` selectors to the same CSS variables.

---

## Shared UI Components

All shared components live in `src/components/ui/` and are barrel-exported from `src/components/ui/index.ts`. Always import from there, never from the individual file directly.

```ts
import { Button, Modal, Badge, Alert, ... } from "~/components/ui";
```

Do not create new primitive components (buttons, inputs, modals, etc.) without first checking if one already exists here.

---

### Button

```tsx
<Button variant="primary" size="md" href="/path">Label</Button>
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `"primary" \| "secondary" \| "danger"` | `"primary"` | |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | `"md"` | |
| `href` | `string` | — | Renders as `<a>` instead of `<button>` |

All other native `<button>` attributes are forwarded. Never wrap `<Button>` inside `<a>` or `<Link>` — use `href` instead.

---

### Input

```tsx
<Input name="email" type="email" label="Email" required error={errors.email} />
```

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Renders `<label>` above input |
| `error` | `string` | Red error message below input |

All native `<input>` attributes are forwarded.

---

### Select / TextArea

Same pattern as `Input` — accepts `label`, `error`, plus all native attributes.

---

### Modal

```tsx
<Modal open={isOpen.value} onClose$={closeHandler} title="Dialog Title" size="lg">
  {/* content */}
</Modal>
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | `boolean` | — | Controls visibility |
| `onClose$` | `QRL<() => void>` | — | Called on backdrop click or close button |
| `title` | `string` | — | Optional header |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | `"lg"` | Max-width of dialog panel |

Content goes in the default `<Slot />`.

---

### Badge

```tsx
<Badge variant="success">Active</Badge>
```

Variants: `"default"` · `"success"` · `"warning"` · `"error"` · `"info"`

---

### Alert

```tsx
<Alert variant="error">Something went wrong.</Alert>
```

Variants: `"success"` · `"error"` · `"info"` · `"warning"`

---

### Avatar

```tsx
<Avatar src={user.photoUrl} name={user.name} size="md" />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `src` | `string \| null` | — | Falls back to initial letter if omitted |
| `name` | `string` | — | Used for alt text and fallback initial |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | |

---

### Card

```tsx
<Card hover>Content</Card>
```

White rounded panel (`bg-white rounded-lg shadow-md p-6`). `hover` adds lift on hover.

---

### SectionCard

```tsx
<SectionCard title="Members">
  <Button q:slot="header-right" variant="secondary" size="sm">Add</Button>
  {/* body content */}
</SectionCard>
```

Named slot `header-right` renders to the right of the title.

---

### EmptyState

```tsx
<EmptyState message="No results found" description="Try adjusting your search.">
  <SomeIcon />
</EmptyState>
```

Default `<Slot />` is for an optional icon above the message.

---

### AdminTable

```tsx
<AdminTable>
  <thead>…</thead>
  <tbody>…</tbody>
</AdminTable>
```

Wraps a `<table>` in a white rounded shadow container. Add standard `<thead>` / `<tbody>` / `<tr>` / `<td>` inside.

---

### ImageUpload

```tsx
<ImageUpload
  name="image"
  label="Cover Image"
  currentImageUrl={data.imageUrl}
  pipeline="square"
  onUploadComplete$={$((urls) => { form.image = urls.original; })}
/>
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | `string` | — | Hidden `<input>` name for form submission |
| `label` | `string` | — | |
| `currentImageUrl` | `string \| null` | — | Pre-fills preview |
| `uploadPath` | `string` | `"public/"` | S3 prefix |
| `pipeline` | `string` | `"square"` | `"square"` and `"profile-picture"` show crop UI; others show simple file input |
| `crop` | `boolean` | auto from pipeline | Override crop UI |
| `previewShape` | `"square" \| "circle"` | `"square"` | Shape of the preview thumbnail |
| `onUploadComplete$` | `QRL<(urls) => void>` | — | Called with `{ original, thumbnail?, ... }` after upload |

`pipeline="profile-picture"` posts to `/api/images/profile-picture`. All other pipelines post to `/api/images?pipeline=<value>`.
