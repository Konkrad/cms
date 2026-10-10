// Public routeAction$s of every module. The catch-all route re-exports this file;
// re-export via RELATIVE paths only (the production Rollup transform mis-resolves aliases).
export { useSubmitApplication } from "../../../modules/elections/actions";
export {
	useCheckPaymentStatus,
	useCreateCheckoutSession,
	useGenerateSecureUrl,
	useUpdateParticipation,
} from "../../../modules/events/actions";
export {
	useDeleteMyJob,
	useSubmitJob,
	useUpdateMyJob,
} from "../../../modules/jobs/actions";
// Setup-widget actions the events checkout embeds (core user fields, used via ~/core/setup-actions).
export { useSaveFoodPreference } from "../users/setup/FoodPreferenceStep/useSaveFoodPreference";
export { useSavePhotoConsent } from "../users/setup/PhotoConsentStep/useSavePhotoConsent";
