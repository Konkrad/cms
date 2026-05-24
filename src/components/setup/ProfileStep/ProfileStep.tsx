import { $, component$, useSignal, useVisibleTask$, type Signal } from "@qwik.dev/core";
import { Form, routeAction$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Alert } from "~/components/ui/Alert";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";

/**
 * Co-located server action — re-export this from any route that embeds ProfileStep.
 * e.g. export { useUpdateProfile } from "~/components/setup/ProfileStep";
 */
export const useUpdateProfile = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, {
      name: data.name,
      familyName: data.family_name,
      city: data.city || null,
      country: data.country || null,
      yearOfBirth: data.year_of_birth ?? null,
      sex: data.sex || null,
      ...(data.profilePicture ? { profilePicture: data.profilePicture } : {}),
    });
    await markConsentStepComplete(user.id, "lastProfileUpdate");
    return { success: true };
  },
  zod$({
    name: z.string().min(1, "Name is required"),
    family_name: z.string().min(1, "Family name is required"),
    city: z.string().optional(),
    country: z.string().optional(),
    year_of_birth: z.coerce.number().optional(),
    sex: z.string().optional(),
    profilePicture: z.string().optional(),
  }),
);

export type ProfileStepProps = {
  profile: {
    name: string;
    familyName: string;
    city?: string | null;
    country?: string | null;
    yearOfBirth?: number | null;
    sex?: string | null;
    profilePictureUrl?: string | null;
  };
  /** Pass the result of useUpdateProfile() called in the parent route. */
  updateAction: any;
  onComplete?: () => void;
  saveTrigger: Signal<number>;
};

export const ProfileStep = component$<ProfileStepProps>((props) => {
  const action = props.updateAction;

  const name = useSignal(props.profile.name || "");
  const familyName = useSignal(props.profile.familyName || "");
  const city = useSignal(props.profile.city || "");
  const country = useSignal(props.profile.country || "");
  const yearOfBirth = useSignal(props.profile.yearOfBirth?.toString() || "");
  const sex = useSignal(props.profile.sex || "");

  // When the action is successful, call onComplete if available.
  if (action?.value?.success && props.onComplete) {
    props.onComplete();
  }

  const saveFn = $(async () => {
    const formData = new FormData();
    formData.set("name", name.value);
    formData.set("family_name", familyName.value);
    formData.set("city", city.value || "");
    formData.set("country", country.value || "");
    if (yearOfBirth.value) formData.set("year_of_birth", yearOfBirth.value);
    formData.set("sex", sex.value || "");
    const picInput = document.querySelector<HTMLInputElement>('input[name="profilePicture"][type="hidden"]');
    if (picInput?.value) formData.set("profilePicture", picInput.value);

    if (props.updateAction && typeof props.updateAction.submit === "function") {
      await props.updateAction.submit(formData);
      if (props.updateAction.value?.success) {
        props.onComplete?.();
      }
      return props.updateAction.value;
    }

    return { error: "No server action available" };
  });

  const lastSaved = useSignal(props.saveTrigger?.value ?? 0);
  const triggerUpload = useSignal(false);
  useVisibleTask$(({ track }) => {
    track(() => props.saveTrigger.value);
    if (props.saveTrigger.value !== lastSaved.value) {
      lastSaved.value = props.saveTrigger.value;
      triggerUpload.value = true;
    }
  });

  return (
    <Card>
      {action?.value?.error && (
        <Alert variant="error" class="mb-4">{action.value.error}</Alert>
      )}

      <Form action={action} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="First Name" name="name" type="text" value={name.value} onInput$={(e) => (name.value = (e.target as HTMLInputElement).value)} required />

          <Input label="Last Name" name="family_name" type="text" value={familyName.value} onInput$={(e) => (familyName.value = (e.target as HTMLInputElement).value)} required />

          <Input label="City" name="city" type="text" value={city.value} onInput$={(e) => (city.value = (e.target as HTMLInputElement).value)} />

          <Input label="Country" name="country" type="text" value={country.value} onInput$={(e) => (country.value = (e.target as HTMLInputElement).value)} />

          <Input label="Year of Birth" name="year_of_birth" type="number" value={yearOfBirth.value} onInput$={(e) => (yearOfBirth.value = (e.target as HTMLInputElement).value)} />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select name="sex" value={sex.value} onInput$={(e) => (sex.value = (e.target as HTMLSelectElement).value)} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500">
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <div class="mt-4">
          <p class="text-sm font-medium text-gray-700 mb-1">Profile Picture</p>
          <ImageUploader
            name="profilePicture"
            pipeline="profile-picture"
            path="public/profiles"
            aspectRatio="1/1"
            crop
            cropAspectRatio="1/1"
            triggerSignal={triggerUpload}
            onSettled$={$(() => void saveFn())}
          />
        </div>

      </Form>
    </Card>
  );
});
