import { component$, type QRL } from "@qwik.dev/core";
import { Form, type ActionStore } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";

interface InventoryGroupFormProps {
  action: any;
  onCancel: QRL<() => void>;
}

export const InventoryGroupForm = component$<InventoryGroupFormProps>(
  ({ action, onCancel }) => {
    return (
      <Form action={action} class="p-4 border rounded bg-white">
        <h3 class="font-bold mb-4 text-lg">New Inventory Group</h3>
        <div class="space-y-4">
          <Input name="name" label="Group Name" required />
          <Input
            name="maxCapacity"
            label="Max Capacity"
            type="number"
            min="1"
            required
          />
          <Input
            name="salesStartDate"
            label="Sales Start"
            type="datetime-local"
          />
          <Input name="salesEndDate" label="Sales End" type="datetime-local" />
          <p class="text-sm text-gray-500">
            Optional: limit when products in this group can be purchased
          </p>
          <label class="flex items-center gap-2">
            <input type="checkbox" name="needsTicket" value="true" />
            <span class="text-sm">
              Needs Ticket (Generate QR codes for entry)
            </span>
          </label>
          <div class="flex gap-2">
            <Button type="submit">Create Group</Button>
            <Button type="button" onClick$={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </Form>
    );
  },
);
