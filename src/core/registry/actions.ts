// Public routeAction$s of every module. The catch-all route re-exports this file;
// re-export via RELATIVE paths only (the production Rollup transform mis-resolves aliases).
export { useSubmitApplication } from "../../modules/elections/actions";
export {
	useCreateCheckoutSession,
	useGenerateSecureUrl,
	useUpdateParticipation,
} from "../../modules/events/actions";
export {
	useDeleteMyJob,
	useSubmitJob,
	useUpdateMyJob,
} from "../../modules/jobs/actions";
// Core's single requirement step action, embedded by module views (via ~/core/setup-actions).
export { useSubmitRequirement } from "../requirements/useSubmitRequirement";
