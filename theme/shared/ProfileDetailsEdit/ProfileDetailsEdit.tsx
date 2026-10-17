import { component$, useSignal, useTask$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { t } from "~/contracts/i18n";
import type { UpdateDetailsAction } from "~/contracts/profile";

export interface ProfileDetailsEditProps {
	yearOfBirth?: number | null;
	sex?: string | null;
	updateAction: UpdateDetailsAction;
}

const SEX_LABELS: Record<string, string> = {
	male: t("theme.profileDetailsEdit.male"),
	female: t("theme.profileDetailsEdit.female"),
	other: t("theme.profileDetailsEdit.other"),
	prefer_not_to_say: t("theme.profileDetailsEdit.preferNotToSay"),
};

/** In-place editor for year of birth / gender, shown in the owner-only details bar. */
export const ProfileDetailsEdit = component$<ProfileDetailsEditProps>(
	(props) => {
		const { yearOfBirth, sex, updateAction } = props;
		const isEditing = useSignal(false);

		useTask$(({ track }) => {
			const result = track(() => updateAction.value);
			if (result?.success) isEditing.value = false;
		});

		if (!isEditing.value) {
			return (
				<button
					type="button"
					onClick$={() => {
						isEditing.value = true;
					}}
					class="flex items-center gap-3 text-sm text-text-secondary hover:text-primary"
				>
					{yearOfBirth && (
						<span>
							<span class="font-medium">
								{t("theme.profileDetailsEdit.yearOfBirth")}
							</span>{" "}
							{yearOfBirth}
						</span>
					)}
					{sex && (
						<span>
							<span class="font-medium">
								{t("theme.profileDetailsEdit.gender")}
							</span>{" "}
							{SEX_LABELS[sex] ?? sex}
						</span>
					)}
					{!yearOfBirth && !sex && (
						<span>{t("theme.profileDetailsEdit.addYearOfBirthGender")}</span>
					)}
					<svg
						aria-hidden="true"
						class="w-3.5 h-3.5 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.79l-4 1 1-4L16.862 4.487Z"
						/>
					</svg>
				</button>
			);
		}

		return (
			<Form action={updateAction} class="flex flex-wrap items-end gap-2">
				{(updateAction.value as any)?.error && (
					<p class="text-xs text-error w-full">
						{(updateAction.value as any).error}
					</p>
				)}
				<Input
					label={t("theme.profileDetailsEdit.yearOfBirth2")}
					name="year_of_birth"
					type="number"
					value={yearOfBirth ?? ""}
					class="w-28"
				/>
				<Select
					label={t("theme.profileDetailsEdit.gender2")}
					name="sex"
					value={sex ?? ""}
					class="w-40"
				>
					<option value="">{t("theme.profileDetailsEdit.selectGender")}</option>
					<option value="male">{t("theme.profileDetailsEdit.male")}</option>
					<option value="female">{t("theme.profileDetailsEdit.female")}</option>
					<option value="other">{t("theme.profileDetailsEdit.other")}</option>
					<option value="prefer_not_to_say">
						{t("theme.profileDetailsEdit.preferNotToSay")}
					</option>
				</Select>
				<Button type="submit" size="sm">
					{t("theme.profileDetailsEdit.save")}
				</Button>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					onClick$={() => {
						isEditing.value = false;
					}}
				>
					{t("theme.profileDetailsEdit.cancel")}
				</Button>
			</Form>
		);
	},
);
