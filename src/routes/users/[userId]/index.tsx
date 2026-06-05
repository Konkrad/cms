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
import { formatUserName, buildProfileUrl } from "~/utils/users";
import { deriveThumbnailKey } from "~/utils/images";

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

  // Resolve profile user's email from logins table
  let email: string | null = null;
  if (user.loginId) {
    const [loginRow] = await db
      .select()
      .from(logins)
      .where(eq(logins.id, user.loginId));
    if (loginRow?.email) email = loginRow.email;
  }

  const buildPicUrl = (s3Key: string | null) => {
    if (!s3Key) return null;
    return env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${s3Key}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}`;
  };

  const { userTagsService } = await import("~/services/user-tags.service");
  const [groups, participation, tags] = await Promise.all([
    groupMembershipsService.getUserGroups(user.id),
    participationService.getByUserId(user.id),
    userTagsService.getByUser(user.id),
  ]);

  const payload = {
    id: user.id,
    name: user.name,
    familyName: user.familyName,
    role: user.role,
    city: user.city ?? null,
    country: user.country ?? null,
    profilePictureUrl: buildPicUrl(user.profilePicture ?? null),
    profilePictureSmallUrl: user.profilePicture ? buildPicUrl(deriveThumbnailKey(user.profilePicture)) : null,
    isOwner,
    email,
    yearOfBirth: user.yearOfBirth ?? null,
    groups: groups.map((g) => ({ id: g.id, name: g.name, slug: g.slug })),
    upcomingEvents: participation.upcoming,
    pastEvents: participation.past,
    tags: tags.map((t) => ({ id: t.id, slug: t.slug, label: t.label, category: t.category })),
  };

  // Principle VIII — privacy at serialization boundary
  if (!isOwner) {
    delete (payload as any).email;
    delete (payload as any).yearOfBirth;
  }

  return payload;
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

  const profile = data.value;
  const displayName = formatUserName({ name: profile.name, familyName: profile.familyName });
  const initials = `${profile.name?.charAt(0) ?? ""}${profile.familyName?.charAt(0) ?? ""}`.toUpperCase();

  const formatEventDate = (startDate: string) => {
    return new Date(startDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {profile.profilePictureUrl ? (
          <img
            src={profile.profilePictureUrl}
            alt={`${displayName}'s profile picture`}
            width={100}
            height={100}
            class="w-[100px] h-[100px] rounded-full object-cover border-2 border-gray-200 shadow-xs shrink-0"
          />
        ) : (
          <div class="w-[100px] h-[100px] rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300 shrink-0">
            <span class="text-gray-500 font-semibold text-2xl">{initials}</span>
          </div>
        )}
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{displayName}</h1>
          <span class="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
            {profile.role.replace("_", " ")}
          </span>
          {(profile.city || profile.country) && (
            <p class="text-gray-500 text-sm mt-1">
              {[profile.city, profile.country].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Owner bar — only shown to the profile owner */}
      {"email" in profile && profile.isOwner && (
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <a
            href="/profile/edit"
            class="text-sm font-medium text-blue-700 hover:underline"
          >
            Edit profile
          </a>
          {"email" in profile && (
            <span class="text-sm text-gray-700">
              <span class="font-medium">Email:</span> {(profile as any).email}
            </span>
          )}
          {"yearOfBirth" in profile && (profile as any).yearOfBirth && (
            <span class="text-sm text-gray-700">
              <span class="font-medium">Year of birth:</span> {(profile as any).yearOfBirth}
            </span>
          )}
        </div>
      )}

      {/* Tags / Achievements */}
      {profile.tags.length > 0 && (
        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">Achievements</h2>
          <div class="flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <span
                key={tag.id}
                class="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
              >
                {tag.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Communities */}
      <section>
        <h2 class="text-xl font-semibold text-gray-800 mb-3">Communities</h2>
        {profile.groups.length === 0 ? (
          <p class="text-gray-500 text-sm">Not a member of any community yet.</p>
        ) : (
          <ul class="flex flex-wrap gap-2">
            {profile.groups.map((g) => (
              <li key={g.id}>
                <a
                  href={`/groups/${g.slug}`}
                  class="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-800"
                >
                  {g.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upcoming Events */}
      <section>
        <h2 class="text-xl font-semibold text-gray-800 mb-3">Upcoming Events</h2>
        {profile.upcomingEvents.length === 0 ? (
          <p class="text-gray-500 text-sm">No upcoming events.</p>
        ) : (
          <ul class="space-y-2">
            {profile.upcomingEvents.map((e) => (
              <li key={e.id}>
                <a
                  href={`/events/${e.id}`}
                  class="block p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <p class="font-medium text-gray-900">{e.title}</p>
                  <p class="text-sm text-gray-500 mt-0.5">
                    {formatEventDate(e.startDate)}
                    {(e.city || e.country) && (
                      <> · {[e.city, e.country].filter(Boolean).join(", ")}</>
                    )}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Past Events */}
      <section>
        <h2 class="text-xl font-semibold text-gray-800 mb-3">Past Events</h2>
        {profile.pastEvents.length === 0 ? (
          <p class="text-gray-500 text-sm">No past events attended.</p>
        ) : (
          <ul class="space-y-2">
            {profile.pastEvents.map((e) => (
              <li key={e.id}>
                <a
                  href={`/events/${e.id}`}
                  class="block p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <p class="font-medium text-gray-900">{e.title}</p>
                  <p class="text-sm text-gray-500 mt-0.5">
                    {formatEventDate(e.startDate)}
                    {(e.city || e.country) && (
                      <> · {[e.city, e.country].filter(Boolean).join(", ")}</>
                    )}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
});
