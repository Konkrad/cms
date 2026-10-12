import { component$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { t } from "~/core/ui";
import { useCreateCycle } from "./actions";
import type { AdminNewElectionData } from "./data";

export const AdminNewElection = component$<{ data: AdminNewElectionData }>(
	({ data }) => {
		const createAction = useCreateCycle();

		return (
			<div class="max-w-lg">
				<h2 class="text-2xl font-bold text-gray-800 mb-6">
					{t("elections.admin.new.newElectionCycle")}
				</h2>

				{createAction.value?.failed && (
					<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
						{String(
							createAction.value.fieldErrors ??
								t("elections.admin.new.somethingWentWrong"),
						)}
					</div>
				)}

				<Form
					action={createAction}
					class="bg-white rounded-lg shadow-sm p-6 space-y-4"
				>
					<div>
						<label
							for="f-title"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							{t("elections.admin.new.title")}
						</label>
						<input
							id="f-title"
							type="text"
							name="title"
							required
							placeholder={t("elections.admin.new.eGBoardElections2026")}
							class="w-full border rounded-md px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label
							for="f-year"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							{t("elections.admin.new.year")}
						</label>
						<input
							id="f-year"
							type="number"
							name="year"
							required
							value={new Date().getFullYear()}
							class="w-full border rounded-md px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label
							for="f-description"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							{t("elections.admin.new.descriptionOptional")}
						</label>
						<textarea
							id="f-description"
							name="description"
							rows={3}
							class="w-full border rounded-md px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label
							for="f-requiredMembershipTier"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							{t("elections.admin.new.requiredMembershipTier")}
						</label>
						<select
							id="f-requiredMembershipTier"
							name="requiredMembershipTier"
							class="w-full border rounded-md px-3 py-2 text-sm"
						>
							<option value="">
								{t("elections.admin.new.noneAnyAuthenticatedUser")}
							</option>
							<option value="associated">
								{t("elections.admin.new.associatedMember")}
							</option>
							<option value="full">
								{t("elections.admin.new.fullMember")}
							</option>
						</select>
					</div>
					<div class="flex gap-3 pt-2">
						<button
							type="submit"
							class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
						>
							{t("elections.admin.new.createCycle")}
						</button>
						<a
							href={`${data.adminBase}/elections`}
							class="text-sm text-gray-500 hover:text-gray-700 py-2"
						>
							{t("elections.admin.new.cancel")}
						</a>
					</div>
				</Form>
			</div>
		);
	},
);
