import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { logins } from "~/db/schemas/logins";
import { env } from "~/env";
import { usersService } from "~/services/users.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { participationService } from "~/services/participation.service";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";
import { deriveThumbnailKey } from "~/utils/images";
import { UserProfile } from "~/components/user/UserProfile/UserProfile";

export const usePublicProfile = routeLoader$(async (event) => {
  await requireAuth(event);

  const uuid = event.params.userId.substring(0, 36);
  const user = await usersService.getById(uuid);

  if (!user) {
    event.status(404);
    return null;
  }

  const currentUser = await getCurrentUserData(event);
  const isOwner = currentUser?.id === user.id;

  let email: string | null = null;
  if (isOwner && user.loginId) {
    const [row] = await db.select().from(logins).where(eq(logins.id, user.loginId));
    if (row?.email) email = row.email;
  }

  const buildPicUrl = (key: string | null) => {
    if (!key) return null;
    return env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  };

  const { userTagsService } = await import("~/services/user-tags.service");
  const [groups, participation, tags] = await Promise.all([
    groupMembershipsService.getUserGroups(user.id),
    participationService.getByUserId(user.id),
    userTagsService.getByUser(user.id),
  ]);

  return {
    name: user.name,
    familyName: user.familyName,
    role: user.role,
    city: user.city ?? null,
    country: user.country ?? null,
    profilePictureUrl: buildPicUrl(user.profilePicture ? deriveThumbnailKey(user.profilePicture) : null),
    tags: tags.map((t) => ({ id: t.id, label: t.label })),
    communities: groups.map((g) => ({ name: g.name, slug: g.slug })),
    upcomingEvents: participation.upcoming,
    pastEvents: participation.past,
    isOwner,
    email: isOwner ? email : null,
    yearOfBirth: isOwner ? (user.yearOfBirth ?? null) : null,
    sex: isOwner ? (user.sex ?? null) : null,
  };
});

export default component$(() => {
  const data = usePublicProfile();

  if (!data.value) {
    return (
      <div class="container mx-auto px-4 py-16 max-w-4xl text-center">
        <h1 class="text-2xl font-bold text-gray-800">Profile not found</h1>
        <p class="text-gray-500 mt-2">This profile does not exist.</p>
      </div>
    );
  }

  return <UserProfile {...data.value} />;
});
