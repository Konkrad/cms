import { component$, useSignal, useTask$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import type { UpdateDetailsAction } from "~/contracts/profile";

export interface ProfileDetailsEditProps {
  yearOfBirth?: number | null;
  sex?: string | null;
  updateAction: UpdateDetailsAction;
}

const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

/** In-place editor for year of birth / gender, shown in the owner-only details bar. */
export const ProfileDetailsEdit = component$<ProfileDetailsEditProps>((props) => {
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
        onClick$={() => { isEditing.value = true; }}
        class="flex items-center gap-3 text-sm text-text-secondary hover:text-primary"
      >
        {yearOfBirth && (
          <span><span class="font-medium">Year of birth:</span> {yearOfBirth}</span>
        )}
        {sex && (
          <span><span class="font-medium">Gender:</span> {SEX_LABELS[sex] ?? sex}</span>
        )}
        {!yearOfBirth && !sex && <span>Add year of birth / gender</span>}
        <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
        <p class="text-xs text-error w-full">{(updateAction.value as any).error}</p>
      )}
      <Input
        label="Year of birth"
        name="year_of_birth"
        type="number"
        value={yearOfBirth ?? ""}
        class="w-28"
      />
      <Select label="Gender" name="sex" value={sex ?? ""} class="w-40">
        <option value="">Select gender</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
        <option value="prefer_not_to_say">Prefer not to say</option>
      </Select>
      <Button type="submit" size="sm">Save</Button>
      <Button type="button" variant="secondary" size="sm" onClick$={() => { isEditing.value = false; }}>
        Cancel
      </Button>
    </Form>
  );
});
