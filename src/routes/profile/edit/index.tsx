import { component$, $, useSignal } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { db } from "~/db/connection";
import { users } from "~/db/schema";
import { env } from "~/env";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";

export const useProfile = routeLoader$(async (event) => {
  await requireAuth(event);
  const userData = await getCurrentUserData(event);

  if (!userData) {
    throw event.redirect(302, "/login");
  }

  // Build profile picture URL: new uploads store full URL; legacy entries store a path.
  let profilePictureUrl: string | null = null;
  const user = userData as any;
  if (user.profilePicture) {
    if (user.profilePicture.startsWith("http")) {
      profilePictureUrl = user.profilePicture;
    } else {
      const key = user.profilePicture;
      profilePictureUrl = env.AWS_ENDPOINT
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
        : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
    }
  }

  return {
    ...userData,
    profilePictureUrl,
  };
});

export const useUpdateProfile = routeAction$(
  async (data, event) => {
    await requireAuth(event);
    const currentUser = await getCurrentUserData(event);

    if (!currentUser) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const updateData: any = {
      name: data.name,
      familyName: data.family_name,
      city: data.city || null,
      country: data.country || null,
      yearOfBirth: data.year_of_birth ?? null,
      sex: data.sex || null,
      updatedAt: new Date().toISOString(),
    };

    if (data.profilePicture) {
      updateData.profilePicture = data.profilePicture;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, currentUser.id));

    throw event.redirect(302, "/profile");
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

export default component$(() => {
  const profile = useProfile();
  const updateAction = useUpdateProfile();
  const isSubmitting = useSignal(false);
  const triggerUpload = useSignal(false);

  const handleSubmit = $(() => {
    isSubmitting.value = true;
    triggerUpload.value = true;
  });

  const onSettled = $(() => {
    const form = document.querySelector('form');
    if (form) {
      updateAction.submit(new FormData(form));
    }
  });

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <h1 class="text-3xl font-bold mb-6">Edit Profile</h1>

      {updateAction.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {updateAction.value.error}
        </div>
      )}

      <Card>
        <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-4">
          <p class="text-sm font-medium text-gray-700 mb-1">Profile Picture</p>
          <ImageUploader
            name="profilePicture"
            pipeline="standard"
            path="public/profiles"
            aspectRatio="1/1"
            triggerSignal={triggerUpload}
            onSettled$={onSettled}
            currentUrl={profile.value.profilePictureUrl || undefined}
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="name"
              type="text"
              value={profile.value.name}
              required
            />

            <Input
              label="Last Name"
              name="family_name"
              type="text"
              value={profile.value.familyName}
              required
            />

            <Input
              label="City"
              name="city"
              type="text"
              value={profile.value.city || ""}
            />

            <Input
              label="Country"
              name="country"
              type="text"
              value={profile.value.country || ""}
            />
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
