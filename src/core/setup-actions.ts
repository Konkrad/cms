/**
 * Setup-widget actions a module view may embed (core user fields). Kept out of `./index` because
 * importing a `routeAction$` needs the Qwik router runtime, which server code and unit tests that
 * only want services must not load. The catch-all route re-exports them via a relative path in
 * `src/core/registry/actions.ts`.
 */
export { useSaveFoodPreference } from "~/core/users/setup/FoodPreferenceStep/useSaveFoodPreference";
export { useSavePhotoConsent } from "~/core/users/setup/PhotoConsentStep/useSavePhotoConsent";
