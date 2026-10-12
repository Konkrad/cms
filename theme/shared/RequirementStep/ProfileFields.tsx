import { $, component$, useSignal } from "@qwik.dev/core";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { t } from "~/contracts/i18n";

export type ProfileFieldsProps = {
	/** The viewer's own current profile (prefill). */
	values: Record<string, unknown>;
	errors: Record<string, string>;
};

const text = (v: unknown) => (v == null ? "" : String(v));

/** Fields of the `core.profile` requirement step (inside `RequirementStep`'s form). */
export const ProfileFields = component$<ProfileFieldsProps>(
	({ values, errors }) => {
		const thumbnailPath = useSignal("");

		return (
			<div class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Input
						label={t("theme.profileFields.firstName")}
						name="name"
						type="text"
						value={text(values.name)}
						error={errors.name}
						required
					/>
					<Input
						label={t("theme.profileFields.lastName")}
						name="familyName"
						type="text"
						value={text(values.familyName)}
						error={errors.familyName}
						required
					/>
					<Input
						label={t("theme.profileFields.yearOfBirth")}
						name="yearOfBirth"
						type="number"
						value={text(values.yearOfBirth)}
						error={errors.yearOfBirth}
					/>
					<Select
						label={t("theme.profileFields.gender")}
						name="sex"
						value={text(values.sex)}
						error={errors.sex}
					>
						<option value="">{t("theme.profileFields.selectGender")}</option>
						<option value="male">{t("theme.profileFields.male")}</option>
						<option value="female">{t("theme.profileFields.female")}</option>
						<option value="other">{t("theme.profileFields.other")}</option>
						<option value="prefer_not_to_say">
							{t("theme.profileFields.preferNotToSay")}
						</option>
					</Select>
				</div>

				<div>
					<p class="text-sm font-medium text-text-secondary mb-1">
						{t("theme.profileFields.profilePicture")}
					</p>
					<ImageUploader
						name="profilePicture"
						pipeline="profile-picture"
						path="private/profile-pictures"
						aspectRatio="1/1"
						crop
						cropAspectRatio="1/1"
						autoUpload
						onFileUploaded$={$((response: { thumbnailPath?: string }) => {
							if (response.thumbnailPath)
								thumbnailPath.value = response.thumbnailPath;
						})}
					/>
					<input
						type="hidden"
						name="profilePictureSmall"
						value={thumbnailPath.value}
					/>
				</div>
			</div>
		);
	},
);
