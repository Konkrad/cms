import { component$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { useCreatePosition } from "./actions";
import type { AdminNewPositionData } from "./data";

export const AdminNewPosition = component$<{ data: AdminNewPositionData }>(
	({ data: guard }) => {
		const createAction = useCreatePosition();

		return (
			<div class="max-w-lg">
				<h2 class="text-2xl font-bold text-gray-800 mb-6">Add Position</h2>

				<Form
					action={createAction}
					class="bg-white rounded-lg shadow-sm p-6 space-y-4"
				>
					<input type="hidden" name="cycleId" value={guard.cycle.id} />
					<div>
						<label
							for="f-title"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							Position Title
						</label>
						<input
							id="f-title"
							type="text"
							name="title"
							required
							placeholder="e.g. Treasurer"
							class="w-full border rounded-md px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label
							for="f-description"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							Description (optional)
						</label>
						<textarea
							id="f-description"
							name="description"
							rows={2}
							class="w-full border rounded-md px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label
							for="f-maxCandidates"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							Max Candidates (optional)
						</label>
						<input
							id="f-maxCandidates"
							type="number"
							name="maxCandidates"
							min={1}
							class="w-full border rounded-md px-3 py-2 text-sm"
						/>
					</div>
					<div class="flex gap-3 pt-2">
						<button
							type="submit"
							class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
						>
							Add Position
						</button>
						<a
							href={`/admin/root/elections/${guard.cycle.id}`}
							class="text-sm text-gray-500 hover:text-gray-700 py-2"
						>
							Cancel
						</a>
					</div>
				</Form>
			</div>
		);
	},
);
