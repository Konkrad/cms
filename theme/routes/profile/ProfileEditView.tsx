import { component$, $, useSignal } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { AddressAutocomplete } from "~/components/ui/AddressAutocomplete";
import type { ProfileEditData, UpdateProfileEditAction } from "~/contracts/profile";

/** Themed view for the profile edit route (`/profile/edit`). */
export const ProfileEditView = component$<{
  profile: ProfileEditData;
  updateAction: UpdateProfileEditAction;
}>(({ profile, updateAction }) => {
  const isSubmitting = useSignal(false);
  const triggerUpload = useSignal(false);
  const uploadedPictureUrl = useSignal<string | undefined>(undefined);
  const uploadedThumbnailPath = useSignal<string | undefined>(undefined);
  const city = useSignal(profile.city || "");
  const country = useSignal(profile.country || "");
  const latitude = useSignal((profile as any).latitude || "");
  const longitude = useSignal((profile as any).longitude || "");

  const handleSubmit = $(() => {
    isSubmitting.value = true;
    triggerUpload.value = true;
  });

  const onSettled = $(() => {
    const form = document.querySelector('form');
    if (!form) return;
    const fd = new FormData(form);
    if (uploadedPictureUrl.value && !fd.get('profilePicture')) {
      fd.set('profilePicture', uploadedPictureUrl.value);
    }
    if (uploadedThumbnailPath.value && !fd.get('profilePictureSmall')) {
      fd.set('profilePictureSmall', uploadedThumbnailPath.value);
    }
    updateAction.submit(fd);
  });

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <h1 class="text-3xl font-bold mb-6">Edit Profile</h1>

      {updateAction.value?.error && (
        <div class="mb-4 p-3 bg-error-bg border border-error-border text-error rounded-sm">
          {updateAction.value.error}
        </div>
      )}

      <Card>
        <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-4">
          <p class="text-sm font-medium text-text-secondary mb-1">Profile Picture</p>
          <ImageUploader
            name="profilePicture"
            pipeline="profile-picture"
            path="private/profile-pictures"
            aspectRatio="1/1"
            crop
            cropAspectRatio="1/1"
            triggerSignal={triggerUpload}
            onSettled$={onSettled}
            onFileUploaded$={$((response: any) => {
              uploadedPictureUrl.value = response.url || response.filePath || undefined;
              if (response.thumbnailPath) uploadedThumbnailPath.value = response.thumbnailPath;
            })}
            currentUrl={profile.profilePictureUrl || undefined}
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="name"
              type="text"
              value={profile.name}
              required
            />

            <Input
              label="Last Name"
              name="family_name"
              type="text"
              value={profile.familyName}
              required
            />

            <div class="md:col-span-2">
              <input type="hidden" name="city" value={city.value} />
              <input type="hidden" name="country" value={country.value} />
              <input type="hidden" name="latitude" value={latitude.value} />
              <input type="hidden" name="longitude" value={longitude.value} />
              <AddressAutocomplete
                name="location_search"
                label="City / Location"
                placeholder="Start typing your city..."
                value={[city.value, country.value].filter(Boolean).join(", ")}
                latitudeSignal={latitude}
                longitudeSignal={longitude}
                citySignal={city}
                countrySignal={country}
              />
            </div>
          </div>

          <div class="flex items-center gap-4 py-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Saving..." : "Save Changes"}
            </Button>
            <Button href="/profile" variant="secondary">Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
});
