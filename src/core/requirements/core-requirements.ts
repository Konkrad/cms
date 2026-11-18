import { z } from "zod";
import { FormAnswerError, formQuestions } from "~/core/forms/answers";
import { formResultsService } from "~/core/forms/form-results.service";
import {
	formAssignmentsService,
	formsService,
} from "~/core/forms/forms.service";
import { ONBOARDING_PURPOSE } from "~/core/forms/purposes";
import { t } from "~/core/i18n";
import { getRootScope } from "~/core/scopes/access";
import { usersService } from "~/core/users/users.service";
import {
	defineRequirement,
	GLOBAL_CONTEXT,
	RequirementInputError,
	type RequirementUser,
} from "./define";

/**
 * Core's requirements (spec 4.6): profile basics, location and the onboarding survey, all in the
 * `global` context, so the root layout sends a user to `/profile/setup` until they are done.
 */

export const SEX_OPTIONS = [
	"male",
	"female",
	"other",
	"prefer_not_to_say",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional();

/** Profile basics: name, birth year, gender and picture, written to the user's row. */
export const profileRequirement = defineRequirement({
	id: "core.profile",
	version: 1,
	contexts: [GLOBAL_CONTEXT],
	title: t("core.requirements.profile.title"),
	description: t("core.requirements.profile.description"),
	view: "core.profile",
	input: z.object({
		name: z
			.string()
			.trim()
			.min(1, t("core.requirements.profile.firstNameRequired"))
			.max(100),
		familyName: z
			.string()
			.trim()
			.min(1, t("core.requirements.profile.lastNameRequired"))
			.max(100),
		yearOfBirth: z
			.union([
				z.literal(""),
				z.coerce
					.number()
					.int()
					.min(1900, t("core.requirements.profile.validYear"))
					.max(
						new Date().getFullYear(),
						t("core.requirements.profile.validYear"),
					),
			])
			.optional(),
		sex: z.union([z.literal(""), z.enum(SEX_OPTIONS)]).optional(),
		profilePicture: optionalText(500),
		profilePictureSmall: optionalText(500),
	}),
	async prepare(user) {
		const row = await usersService.getPrivateById(user.id);
		return {
			// The user's OWN profile, to prefill the form.
			values: {
				name: row?.name ?? "",
				familyName: row?.familyName ?? "",
				yearOfBirth: row?.yearOfBirth ?? null,
				sex: row?.sex ?? "",
			},
		};
	},
	async save(user, input) {
		// usersService.update drops picture keys outside the profile-picture prefixes.
		await usersService.update(user.id, {
			name: input.name,
			familyName: input.familyName,
			yearOfBirth:
				input.yearOfBirth === "" || input.yearOfBirth === undefined
					? null
					: input.yearOfBirth,
			sex: input.sex || null,
			...(input.profilePicture ? { profilePicture: input.profilePicture } : {}),
			...(input.profilePictureSmall
				? { profilePictureSmall: input.profilePictureSmall }
				: {}),
		});
		return null;
	},
});

const coordinate = (min: number, max: number) =>
	z
		.string()
		.trim()
		.refine(
			(v) =>
				v === "" ||
				(Number.isFinite(Number(v)) &&
					Math.abs(Number(v)) <= max &&
					Number(v) >= min),
			t("core.requirements.location.invalidCoordinate"),
		)
		.optional();

/** Location: the user confirms where they are (city/country, coordinates from the geocoder). */
export const locationRequirement = defineRequirement({
	id: "core.location",
	version: 1,
	contexts: [GLOBAL_CONTEXT],
	title: t("core.requirements.location.title"),
	description: t("core.requirements.location.description"),
	view: "core.location",
	input: z.object({
		city: optionalText(200),
		country: optionalText(200),
		latitude: coordinate(-90, 90),
		longitude: coordinate(-180, 180),
	}),
	async prepare(user) {
		const row = await usersService.getPrivateById(user.id);
		return { values: { city: row?.city ?? "", country: row?.country ?? "" } };
	},
	async save(user, input) {
		await usersService.update(user.id, {
			city: input.city || null,
			country: input.country || null,
			latitude: input.latitude || null,
			longitude: input.longitude || null,
		});
		return null;
	},
});

/** The active onboarding form of the root (`core.onboarding`), if an admin picked one. */
async function activeOnboardingForm() {
	const root = await getRootScope();
	return root
		? await formAssignmentsService.activeFor(ONBOARDING_PURPOSE, root.id)
		: undefined;
}

const answersSchema = z.object({
	answers: z
		.record(z.string(), z.union([z.string(), z.array(z.string())]))
		.optional(),
});

/**
 * The onboarding survey: the active `core.onboarding` form (admins configure its questions and
 * which form is active). Without an active form the requirement does not apply.
 */
export const onboardingSurveyRequirement = defineRequirement({
	id: "core.onboarding",
	version: 1,
	contexts: [GLOBAL_CONTEXT],
	title: t("core.requirements.onboarding.title"),
	description: t("core.requirements.onboarding.description"),
	view: "core.form",
	input: answersSchema,
	isApplicable: async () => Boolean(await activeOnboardingForm()),
	async prepare(user: RequirementUser) {
		const form = await activeOnboardingForm();
		if (!form) return { data: null };
		const existing = await formResultsService.getByFormAndUser(
			form.id,
			user.id,
		);
		return {
			values: (existing?.answers as Record<string, unknown>) ?? {},
			data: { formTitle: form.title, questions: formQuestions(form.schema) },
		};
	},
	async save(user, input) {
		const form = await activeOnboardingForm();
		if (!form)
			throw new RequirementInputError(t("core.requirements.stepDoesNotApply"));
		let answers: Record<string, unknown>;
		try {
			answers = formsService.validateAnswers(form, input.answers ?? {});
		} catch (err) {
			if (err instanceof FormAnswerError)
				throw new RequirementInputError(err.message, err.fieldErrors);
			throw err;
		}
		const result = await formResultsService.saveOwn({
			formId: form.id,
			userId: user.id,
			answers,
		});
		return { formId: form.id, resultId: result.id };
	},
});

export const coreRequirements = [
	profileRequirement,
	locationRequirement,
	onboardingSurveyRequirement,
];
