import { $, component$, useSignal } from "@qwik.dev/core";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";

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
						label="First Name"
						name="name"
						type="text"
						value={text(values.name)}
						error={errors.name}
						required
					/>
					<Input
						label="Last Name"
						name="familyName"
						type="text"
						value={text(values.familyName)}
						error={errors.familyName}
						required
					/>
					<Input
						label="Year of Birth"
						name="yearOfBirth"
						type="number"
						value={text(values.yearOfBirth)}
						error={errors.yearOfBirth}
					/>
					<Select
						label="Gender"
						name="sex"
						value={text(values.sex)}
						error={errors.sex}
					>
						<option value="">Select gender</option>
						<option value="male">Male</option>
						<option value="female">Female</option>
						<option value="other">Other</option>
						<option value="prefer_not_to_say">Prefer not to say</option>
					</Select>
				</div>

				<div>
					<p class="text-sm font-medium text-text-secondary mb-1">
						Profile Picture
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
