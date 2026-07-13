import { $, component$, useSignal } from "@qwik.dev/core";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import type { UpdatePictureAction } from "~/contracts/profile";

export interface ProfileAvatarEditProps {
  displayName: string;
  profilePictureUrl?: string | null;
  initials: string;
  updateAction: UpdatePictureAction;
}

/** In-place avatar editor: click the picture to upload a replacement. */
export const ProfileAvatarEdit = component$<ProfileAvatarEditProps>((props) => {
  const { displayName, profilePictureUrl, initials, updateAction } = props;
  const isEditing = useSignal(false);

  return (
    <div class="relative w-[100px] h-[100px] shrink-0 group">
      {profilePictureUrl ? (
        <img
          src={profilePictureUrl}
          alt={`${displayName}'s profile picture`}
          width={100}
          height={100}
          class="w-[100px] h-[100px] rounded-full object-cover border-2 border-border shadow-xs"
        />
      ) : (
        <div class="w-[100px] h-[100px] rounded-full bg-border flex items-center justify-center border-2 border-border-strong">
          <span class="text-text-muted font-semibold text-2xl">{initials}</span>
        </div>
      )}

      {!isEditing.value && (
        <button
          type="button"
          aria-label="Change profile picture"
          onClick$={() => { isEditing.value = true; }}
          class="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors cursor-pointer"
        >
          <svg
            class="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.79l-4 1 1-4L16.862 4.487Z"
            />
          </svg>
        </button>
      )}

      {isEditing.value && (
        <div class="absolute top-0 left-[110px] w-72 bg-white border border-border rounded-lg shadow-lg p-3 z-10">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium text-text">Update photo</p>
            <button
              type="button"
              aria-label="Close photo editor"
              onClick$={() => { isEditing.value = false; }}
              class="text-text-muted hover:text-text"
            >
              ✕
            </button>
          </div>
          {(updateAction.value as any)?.error && (
            <p class="text-xs text-error mb-2">{(updateAction.value as any).error}</p>
          )}
          <ImageUploader
            pipeline="profile-picture"
            path="private/profile-pictures"
            aspectRatio="1/1"
            crop
            cropAspectRatio="1/1"
            autoUpload
            currentUrl={profilePictureUrl || undefined}
            onFileUploaded$={$(async (response: any) => {
              const formData = new FormData();
              // filePath is the raw storage key (e.g. "private/profile-pictures/…"),
              // which is what usersService.update's prefix check requires. response.url
              // is a presigned GET URL for this pipeline, not a storage key - using it
              // here would fail that check and get silently dropped.
              if (response.filePath || response.url) {
                formData.set("profilePicture", response.filePath || response.url);
              }
              if (response.thumbnailPath) {
                formData.set("profilePictureSmall", response.thumbnailPath);
              }
              await updateAction.submit(formData);
              if (updateAction.value?.success) {
                isEditing.value = false;
              }
            })}
          />
        </div>
      )}
    </div>
  );
});
