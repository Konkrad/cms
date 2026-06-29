# Onboarding step actions (core half)

Each step (`ProfileStep`, `LocationStep`, `FoodPreferenceStep`, `PhotoConsentStep`)
is split across the theme/core boundary:

- **Core** (`src/components/setup/<Step>/use<Step>.ts`, this folder): the
  `routeAction$` only — server-side mutation, auth, validation. No JSX.
- **Theme** (`theme/shared/<Step>/<Step>.tsx`): the presentational component
  only. Takes `updateAction: any` (the result of calling the core hook) as a
  prop — it never imports the action itself.

This split exists because of a Qwik production-build footgun: a re-exported
`routeAction$`/`routeLoader$` is only resolved correctly by Qwik's Rollup
optimizer when re-exported via a **relative** import path, never `~` or
`~theme`. Keeping the action in core and re-exporting it relatively from the
route file works around this; the JSX half has no such restriction and is
imported via `~theme/shared/...` like any other themed component.

## Wiring a step into a route

```tsx
// routes/profile/setup/index.tsx
import { useSaveFoodPreference } from "../../../components/setup/FoodPreferenceStep/useSaveFoodPreference"; // relative — required
import { FoodPreferenceStep } from "~theme/shared/FoodPreferenceStep/FoodPreferenceStep"; // alias — fine here

export { useSaveFoodPreference }; // re-export so Qwik City registers the action for this route

export default component$(() => {
  const saveFood = useSaveFoodPreference();
  return <FoodPreferenceStep updateAction={saveFood} isComplete={!!user.foodPreference} />;
});
```

## Standalone vs multi-step use

When `saveTrigger` is **not** passed, the step renders its own "Save" button
and saves on change. When `saveTrigger` **is** passed, the step hides its
button and saves whenever the parent increments the signal — see
`routes/profile/setup/index.tsx` for the multi-step usage with `ProfileStep`
+ `LocationStep` sharing one "Continue" button.

## Props reference

| Prop | Type | Description |
|------|------|-------------|
| `updateAction` | action instance | Result of calling the core hook in the route (required) |
| `saveTrigger` | `Signal<number>` | When provided: parent-controlled save; no save button rendered |
| `isComplete` | `boolean` | Initialises to "completed" view (e.g. step already done) |
| `initialPreference` | `string \| null` | `FoodPreferenceStep` only — pre-fills the select |
| `profile` | object | `ProfileStep` only — pre-fills the form fields |
| `onComplete$` | `QRL<() => void>` | Optional callback fired after a successful save |

## Database

`food_preference TEXT` column lives on the `users` table (added via `ALTER TABLE`).
`locationVerification` and `foodPreference` completion is tracked in the JSON `consent` column via `markConsentStepComplete`.
