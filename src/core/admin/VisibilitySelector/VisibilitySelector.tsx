import { component$ } from "@qwik.dev/core";
import { t } from "~/core/i18n";
import { VISIBILITIES, type Visibility } from "~/core/scopes/visibility";
import { VISIBILITY_LABELS } from "~/core/scopes/visibility-labels";

interface VisibilitySelectorProps {
	name?: string;
	value?: Visibility;
	disabled?: boolean;
	/** The visibilities to offer (default: all). */
	options?: readonly Visibility[];
}

export const VisibilitySelector = component$<VisibilitySelectorProps>(
	({
		name = "visibility",
		value = "public",
		disabled = false,
		options = VISIBILITIES,
	}) => {
		return (
			<div class="space-y-3">
				<span class="block text-sm font-medium text-gray-700">
					{t("admin.visibilitySelector.visibility")}
				</span>
				<div class="space-y-2">
					{options.map((option) => (
						<label
							key={option}
							class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
						>
							<input
								type="radio"
								name={name}
								value={option}
								checked={value === option}
								disabled={disabled}
								class="w-4 h-4 text-blue-600"
							/>
							<div class="flex-1">
								<div class="font-medium text-gray-900">
									{VISIBILITY_LABELS[option].label}
								</div>
								<div class="text-sm text-gray-600">
									{VISIBILITY_LABELS[option].description}
								</div>
							</div>
						</label>
					))}
				</div>
			</div>
		);
	},
);
