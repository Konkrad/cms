# Onboarding step components

Each step (`ProfileStep`, `LocationStep`, `FoodPreferenceStep`) is self-contained: the component file exports both the UI component **and** a co-located `routeAction$` hook. Steps can be embedded in any route and work standalone or as part of a multi-step page.

## Co-located actions

Every step file exports its server action alongside the component:

```ts
// FoodPreferenceStep.tsx
export const useSaveFoodPreference = routeAction$(...);
export const FoodPreferenceStep = component$(...);
```

Any route that renders the component must **re-export the action** so Qwik City registers it for that route:

```ts
// routes/checkout/index.tsx  (or any other route)
export { useSaveFoodPreference } from "~/components/onboarding/FoodPreferenceStep";
```

## Standalone use (step has its own save button)

When `saveTrigger` is not passed the step renders its own "Save" button:

```tsx
import { useSaveFoodPreference, FoodPreferenceStep } from "~/components/onboarding/FoodPreferenceStep";
export { useSaveFoodPreference }; // re-export in the route file

export default component$(() => {
  const saveFood = useSaveFoodPreference();
  return <FoodPreferenceStep updateAction={saveFood} isComplete={!!user.foodPreference} />;
});
```

## Multi-step use (parent controls saving with `saveTrigger`)

When `saveTrigger` is passed the step hides its own button and watches the signal instead:

```tsx
import { useUpdateProfile, ProfileStep } from "~/components/onboarding/ProfileStep";
import { useMarkLocation, LocationStep }  from "~/components/onboarding/LocationStep";
import { useSaveFoodPreference, FoodPreferenceStep } from "~/components/onboarding/FoodPreferenceStep";
export { useUpdateProfile, useMarkLocation, useSaveFoodPreference };

export default component$(() => {
  const updateProfile = useUpdateProfile();
  const markLocation  = useMarkLocation();
  const saveFoodPref  = useSaveFoodPreference();
  const saveTrigger   = useSignal(0);

  return (
    <>
      <ProfileStep  profile={user} updateAction={updateProfile} saveTrigger={saveTrigger} />
      <LocationStep isComplete={Boolean(consent.locationVerification)} updateAction={markLocation} saveTrigger={saveTrigger} />
      <FoodPreferenceStep initialPreference={user.foodPreference} isComplete={Boolean(consent.foodPreference)} updateAction={saveFoodPref} saveTrigger={saveTrigger} />
      <button onClick$={$(() => { saveTrigger.value++; })}>Continue</button>
    </>
  );
});
```

## Props reference

| Prop | Type | Description |
|------|------|-------------|
| `updateAction` | action instance | Result of calling the co-located hook (required) |
| `saveTrigger` | `Signal<number>` | When provided: parent-controlled save; no save button rendered |
| `isComplete` | `boolean` | Initialises to "completed" view (e.g. step already done) |
| `initialPreference` | `string \| null` | `FoodPreferenceStep` only — pre-fills the select |
| `profile` | object | `ProfileStep` only — pre-fills the form fields |
| `onComplete` | `() => void` | Optional callback fired after a successful save |

## Database

`food_preference TEXT` column lives on the `users` table (added via `ALTER TABLE`).  
`locationVerification` and `foodPreference` completion is tracked in the JSON `consent` column via `markConsentStepComplete`.

