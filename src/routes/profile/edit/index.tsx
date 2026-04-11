import { component$ } from "@qwik.dev/core";
import { component$, $ } from "@qwik.dev/core";
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
import { ImageUpload } from "~/components/ui/ImageUpload";
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
      const key = user.profilePicture.replace(/^\//, "");
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
    const user = await requireAuth(event);
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

  const handleSubmit = $(async (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    const pending: Record<string, () => Promise<string>> = (window as any).__deferredUploads ?? {};
    for (const [field, uploadFn] of Object.entries(pending)) {
      const url = await uploadFn();
      formData.set(field, url);
    }

    await updateAction.submit(formData);
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
        <form onSubmit$={handleSubmit} class="space-y-4">
          <ImageUpload
            name="profilePicture"
            label="Profile Picture"
            pipeline="profile-picture"
            previewShape="circle"
            currentImageUrl={profile.value.profilePictureUrl}
            deferred={true}
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

            <Input
              label="Year of Birth"
              name="year_of_birth"
              type="number"
              value={profile.value.yearOfBirth?.toString() || ""}
            />

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                name="sex"
                value={profile.value.sex || ""}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div class="flex gap-4 pt-4">
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
            <Button href="/profile" variant="secondary">
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
});
