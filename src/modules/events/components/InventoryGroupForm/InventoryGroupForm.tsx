import { component$, type QRL } from "@qwik.dev/core";
import { type ActionStore, Form } from "@qwik.dev/router";
import { Button, Input, t } from "~/core/ui";

interface InventoryGroupFormProps {
	action: any;
	onCancel: QRL<() => void>;
}

export const InventoryGroupForm = component$<InventoryGroupFormProps>(
	({ action, onCancel }) => {
		return (
			<Form action={action} class="p-4 border rounded-sm bg-white">
				<h3 class="font-bold mb-4 text-lg">
					{t("events.inventoryGroupForm.newInventoryGroup")}
				</h3>
				<div class="space-y-4">
					<Input
						name="name"
						label={t("events.inventoryGroupForm.groupName")}
						required
					/>
					<Input
						name="maxCapacity"
						label={t("events.inventoryGroupForm.maxCapacity")}
						type="number"
						min="1"
						required
					/>
					<Input
						name="salesStartDate"
						label={t("events.inventoryGroupForm.salesStart")}
						type="datetime-local"
					/>
					<Input
						name="salesEndDate"
						label={t("events.inventoryGroupForm.salesEnd")}
						type="datetime-local"
					/>
					<p class="text-sm text-gray-500">
						{t("events.inventoryGroupForm.optionalLimitWhenProductsIn")}
					</p>
					<label class="flex items-center gap-2">
						<input type="checkbox" name="needsTicket" value="true" />
						<span class="text-sm">
							{t("events.inventoryGroupForm.needsTicketGenerateQrCodes")}
						</span>
					</label>
					<div class="flex gap-2">
						<Button type="submit">
							{t("events.inventoryGroupForm.createGroup")}
						</Button>
						<Button type="button" onClick$={onCancel}>
							{t("events.inventoryGroupForm.cancel")}
						</Button>
					</div>
				</div>
			</Form>
		);
	},
);
