import { z } from "zod";
import { defineRequirement } from "~/core";

/**
 * What a buyer must answer before buying a ticket or registering for an event (spec 4.6):
 * checked by the checkout and event pages (`requirements.steps`) and again in their actions
 * (`requirements.pending`), submitted through core's single step action. The answers are
 * private; organisers read them through `participationService.getByEventIdWithEmailsAndRequirementValues`.
 */
export const CHECKOUT_CONTEXT = "event.checkout";

export const FOOD_PREFERENCES = [
	{ value: "none", label: "No restrictions" },
	{ value: "vegetarian", label: "Vegetarian" },
	{ value: "vegan", label: "Vegan" },
	{ value: "gluten_free", label: "Gluten-free" },
	{ value: "halal", label: "Halal" },
	{ value: "kosher", label: "Kosher" },
] as const;

const FOOD_VALUES = FOOD_PREFERENCES.map((p) => p.value) as [
	(typeof FOOD_PREFERENCES)[number]["value"],
	...(typeof FOOD_PREFERENCES)[number]["value"][],
];

export const foodPreferenceRequirement = defineRequirement({
	id: "events.foodPreference",
	version: 1,
	contexts: [CHECKOUT_CONTEXT],
	title: "Food preferences",
	description: "Tell us about your dietary needs so we can cater for you.",
	input: z.object({
		foodPreference: z.enum(FOOD_VALUES, { message: "Choose an option" }),
	}),
	fields: [
		{
			name: "foodPreference",
			label: "Food preference",
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
	title: "Photo consent",
	description:
		"We take photos at our events and may use them for promotion. Do you consent to being photographed?",
	input: z.object({
		photoConsentGiven: z
			.enum(["true", "false"], { message: "Choose an option" })
			.transform((v) => v === "true"),
	}),
	fields: [
		{
			name: "photoConsentGiven",
			label: "Photo consent",
			type: "radio",
			required: true,
			options: [
				{
					value: "true",
					label: "Yes, I consent",
					description: "You may appear in event photos.",
				},
				{
					value: "false",
					label: "No, I do not consent",
					description: "We will do our best to keep you out of photos.",
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
