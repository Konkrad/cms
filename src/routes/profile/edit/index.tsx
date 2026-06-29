import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { users } from "~/db/schema";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";
import { resolvePrivateImageUrl } from "~/utils/secure-urls";
import { ProfileEditView } from "~theme/routes/profile/ProfileEditView";

export const useProfile = routeLoader$(async (event) => {
  await requireAuth(event);
  const userData = await getCurrentUserData(event);

  if (!userData) {
    throw event.redirect(302, "/login");
  }

  let profilePictureUrl: string | null = null;
  const user = userData as any;
  if (user.profilePicture) {
    if (user.profilePicture.startsWith("http")) {
      profilePictureUrl = user.profilePicture;
    } else {
      profilePictureUrl = await resolvePrivateImageUrl(user.profilePicture);
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
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      yearOfBirth: data.year_of_birth ?? null,
      sex: data.sex || null,
      updatedAt: new Date().toISOString(),
    };

    // The stored key is later presigned server-side via resolvePrivateImageUrl, so an
    // arbitrary key would grant a working read URL for any private object. Only accept
    // keys under the profile-picture prefixes the upload pipeline actually writes to.
    if (data.profilePicture && data.profilePicture.startsWith("private/profile-pictures/")) {
      updateData.profilePicture = data.profilePicture;
    }
    if (
      data.profilePictureSmall &&
      data.profilePictureSmall.startsWith("public/profile-pictures/")
    ) {
      updateData.profilePictureSmall = data.profilePictureSmall;
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
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    year_of_birth: z.coerce.number().optional(),
    sex: z.string().optional(),
    profilePicture: z.string().optional(),
    profilePictureSmall: z.string().optional(),
  }),
);

export default component$(() => {
  const profile = useProfile();
  const updateAction = useUpdateProfile();
  return <ProfileEditView profile={profile.value} updateAction={updateAction} />;
});
