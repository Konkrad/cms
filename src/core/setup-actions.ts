/**
 * Actions a module view may embed. Kept out of `./index` because importing a `routeAction$` needs
 * the Qwik router runtime, which server code and unit tests that only want services must not load.
 * The catch-all route re-exports them via a relative path in `src/core/registry/actions.ts`.
 */
// Core's single step action for user requirements (spec 4.6), e.g. checkout steps.
export { useSubmitRequirement } from "~/core/requirements/useSubmitRequirement";
