import { component$ } from "@builder.io/qwik";
import { Form, type ActionStore } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";

interface InventoryGroupFormProps {
  action: any;
  onCancel: () => void;
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
          <label class="flex items-center gap-2">
            <input type="checkbox" name="needsTicket" checked />
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
