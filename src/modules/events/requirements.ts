import { z } from "zod";
import { defineRequirement, t } from "~/core";

/**
 * What a buyer must answer before buying a ticket or registering for an event (spec 4.6):
 * checked by the checkout and event pages (`requirements.steps`) and again in their actions
 * (`requirements.pending`), submitted through core's single step action. The answers are
 * private; organisers read them through `participationService.getByEventIdWithEmailsAndRequirementValues`.
 */
export const CHECKOUT_CONTEXT = "event.checkout";

export const FOOD_PREFERENCES = [
	{ value: "none", label: t("events.requirements.noRestrictions") },
	{ value: "vegetarian", label: t("events.requirements.vegetarian") },
	{ value: "vegan", label: t("events.requirements.vegan") },
	{ value: "gluten_free", label: "Gluten-free" },
	{ value: "halal", label: t("events.requirements.halal") },
	{ value: "kosher", label: t("events.requirements.kosher") },
] as const;

const FOOD_VALUES = FOOD_PREFERENCES.map((p) => p.value) as [
	(typeof FOOD_PREFERENCES)[number]["value"],
	...(typeof FOOD_PREFERENCES)[number]["value"][],
];

export const foodPreferenceRequirement = defineRequirement({
	id: "events.foodPreference",
	version: 1,
	contexts: [CHECKOUT_CONTEXT],
	title: t("events.requirements.foodPreferences"),
	description: t("events.requirements.tellUsAboutYourDietary"),
	input: z.object({
		foodPreference: z.enum(FOOD_VALUES, { message: "Choose an option" }),
	}),
	fields: [
		{
			name: "foodPreference",
			label: t("events.requirements.foodPreference"),
			type: "select",
			required: true,
			options: FOOD_PREFERENCES.map((p) => ({ ...p })),
		},
	],
});

export const photoConsentRequirement = defineRequirement({
	id: "events.photoConsent",
	version: 1,
	contexts: [CHECKOUT_CONTEXT],
	title: t("events.requirements.photoConsent"),
	description: t("events.requirements.weTakePhotosAtOur"),
	input: z.object({
		photoConsentGiven: z
			.enum(["true", "false"], {
				message: t("events.requirements.chooseAnOption"),
			})
			.transform((v) => v === "true"),
	}),
	fields: [
		{
			name: "photoConsentGiven",
			label: t("events.requirements.photoConsent"),
			type: "radio",
			required: true,
			options: [
				{
					value: "true",
					label: t("events.requirements.yesIConsent"),
					description: t("events.requirements.youMayAppearInEvent"),
				},
				{
					value: "false",
					label: t("events.requirements.noIDoNotConsent"),
					description: t("events.requirements.weWillDoOurBest"),
				},
			],
		},
	],
});

export const eventsRequirements = [
	foodPreferenceRequirement,
	photoConsentRequirement,
];

/** Label of a stored food preference (older free-text values are shown as stored). */
export const foodPreferenceLabel = (value: unknown): string | null => {
	if (typeof value !== "string" || !value) return null;
	return FOOD_PREFERENCES.find((p) => p.value === value)?.label ?? value;
};
