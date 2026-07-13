import { component$, useSignal, useTask$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import type { UpdateNameAction } from "~/contracts/profile";

export interface ProfileNameEditProps {
  name: string;
  familyName: string;
  updateAction: UpdateNameAction;
}

/** In-place name editor: click the heading to edit first/last name inline. */
export const ProfileNameEdit = component$<ProfileNameEditProps>((props) => {
  const { name, familyName, updateAction } = props;
  const isEditing = useSignal(false);
  const displayName = `${name} ${familyName}`.trim();

  useTask$(({ track }) => {
    const result = track(() => updateAction.value);
    if (result?.success) isEditing.value = false;
  });

  if (!isEditing.value) {
    return (
      <div class="flex items-center gap-2 group">
        <h1 class="text-3xl font-bold text-text-heading">{displayName}</h1>
        <button
          type="button"
          aria-label="Edit name"
          onClick$={() => { isEditing.value = true; }}
          class="text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.79l-4 1 1-4L16.862 4.487Z"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <Form action={updateAction} class="space-y-2">
      {(updateAction.value as any)?.error && (
        <p class="text-xs text-error">{(updateAction.value as any).error}</p>
      )}
      <div class="flex flex-wrap gap-2">
        <Input name="name" type="text" value={name} placeholder="First name" required class="w-36" />
        <Input name="family_name" type="text" value={familyName} placeholder="Last name" required class="w-36" />
      </div>
      <div class="flex gap-2">
        <Button type="submit" size="sm">Save</Button>
        <Button type="button" variant="secondary" size="sm" onClick$={() => { isEditing.value = false; }}>
          Cancel
        </Button>
      </div>
    </Form>
  );
});
