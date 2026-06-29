import { $, component$, useSignal, type Signal } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Alert } from "~/components/ui/Alert";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";

export type ProfileStepProps = {
  profile: {
    name: string;
    familyName: string;
    yearOfBirth?: number | null;
    sex?: string | null;
    profilePictureUrl?: string | null;
  };
  /** Pass the result of useUpdateProfile() (see ../../../src/components/setup/ProfileStep/useUpdateProfile) called in the parent route. */
  updateAction: any;
  onComplete?: () => void;
  saveTrigger?: Signal<number>;
};

export const ProfileStep = component$<ProfileStepProps>((props) => {
  const action = props.updateAction;

  const name = useSignal(props.profile.name || "");
  const familyName = useSignal(props.profile.familyName || "");
  const yearOfBirth = useSignal(props.profile.yearOfBirth?.toString() || "");
  const sex = useSignal(props.profile.sex || "");
  const thumbnailPath = useSignal("");

  // When the action is successful, call onComplete if available.
  if (action?.value?.success && props.onComplete) {
    props.onComplete();
  }

  const saveFn = $(async () => {
    const formData = new FormData();
    formData.set("name", name.value);
    formData.set("family_name", familyName.value);
    if (yearOfBirth.value) formData.set("year_of_birth", yearOfBirth.value);
    formData.set("sex", sex.value || "");
    const picInput = document.querySelector<HTMLInputElement>('input[name="profilePicture"][type="hidden"]');
    if (picInput?.value) formData.set("profilePicture", picInput.value);
    const thumbInput = document.querySelector<HTMLInputElement>('input[name="profilePictureSmall"][type="hidden"]');
    if (thumbInput?.value) formData.set("profilePictureSmall", thumbInput.value);

    if (props.updateAction && typeof props.updateAction.submit === "function") {
      await props.updateAction.submit(formData);
      if (props.updateAction.value?.success) {
        props.onComplete?.();
      }
      return props.updateAction.value;
    }

    return { error: "No server action available" };
  });



  return (
    <Card>
      {action?.value?.error && (
        <Alert variant="error" class="mb-4">{action.value.error}</Alert>
      )}

      <Form action={action} id="profile-step-form" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="First Name" name="name" type="text" value={name.value} onInput$={(e) => (name.value = (e.target as HTMLInputElement).value)} required />

          <Input label="Last Name" name="family_name" type="text" value={familyName.value} onInput$={(e) => (familyName.value = (e.target as HTMLInputElement).value)} required />

          <Input label="Year of Birth" name="year_of_birth" type="number" value={yearOfBirth.value} onInput$={(e) => (yearOfBirth.value = (e.target as HTMLInputElement).value)} />

          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1">
              Gender
            </label>
            <select name="sex" value={sex.value} onInput$={(e) => (sex.value = (e.target as HTMLSelectElement).value)} class="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-hidden focus:ring-2 focus:ring-primary">
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <div class="mt-4">
          <p class="text-sm font-medium text-text-secondary mb-1">Profile Picture</p>
          <ImageUploader
            name="profilePicture"
            pipeline="profile-picture"
            path="private/profile-pictures"
            aspectRatio="1/1"
            crop
            cropAspectRatio="1/1"
            autoUpload
            onFileUploaded$={$((response: any) => {
              if (response.thumbnailPath) thumbnailPath.value = response.thumbnailPath;
            })}
          />
          <input type="hidden" name="profilePictureSmall" value={thumbnailPath.value} />
        </div>

        <button type="submit" id="profile-form-save" class="hidden" />
      </Form>
    </Card>
  );
});
