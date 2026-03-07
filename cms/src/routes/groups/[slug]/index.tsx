import { component$ } from "@builder.io/qwik";
import { routeAction$, routeLoader$, Form } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { groupMemberships, users } from "~/db/schema";
import { groupsService } from "~/services/groups.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { groupRepresentativesService } from "~/services/group-representatives.service";
import { eventsService } from "~/services/events.service";
import { getCurrentUserData } from "~/utils/server-auth";
import { FeatureGrid } from "~/components/page-blocks/FeatureBlock/FeatureGrid";
import { ImageTile } from "~/components/page-blocks/FeatureBlock/ImageTile";
import { ParticipantsTile } from "~/components/page-blocks/FeatureBlock/ParticipantsTile";
import { LocalRepTile } from "~/components/groups/LocalRepTile";

const GRID_LAYOUT = `"left-top middle right-top" "left-bottom middle right-top" "left-bottom middle right-bottom"`;

const FALLBACK =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800";

export const useGroupData = routeLoader$(async (event) => {
  const { params, redirect } = event;
  const group = await groupsService.getBySlug(params.slug);

  if (!group) {
    throw redirect(302, "/groups");
  }

  const user = await getCurrentUserData(event as any);

  const [memberCount, pastEventCount, rep, isMember, recentMembers] =
    await Promise.all([
      groupMembershipsService.countByGroupId(group.id),
      eventsService.countPastByGroupId(group.id),
      groupRepresentativesService.getFirstRepresentativeWithUser(group.id),
      user ? groupMembershipsService.isMember(user.id, group.id) : false,
      db
        .select({
          id: users.id,
          name: users.name,
          familyName: users.familyName,
          profilePictureSmall: users.profilePictureSmall,
        })
        .from(groupMemberships)
        .innerJoin(users, eq(groupMemberships.userId, users.id))
        .where(eq(groupMemberships.groupId, group.id))
        .limit(6),
    ]);

  const memberParticipants = recentMembers.map((m) => ({
    id: m.id,
    displayName: `${m.name} ${m.familyName}`,
    profilePictureSmallUrl: m.profilePictureSmall,
    groupLabel: null,
    city: null,
    country: null,
  }));

  const repData = rep
    ? {
        name: `${rep.user.name} ${rep.user.familyName}`,
        subtitle: `Local Rep ${group.name}`,
        profilePictureUrl: rep.user.profilePictureSmall,
        profileUrl: `/profile/${rep.userId}`,
      }
    : null;

  return {
    group,
    memberCount,
    pastEventCount,
    memberParticipants,
    rep: repData,
    isMember,
    isLoggedIn: !!user,
  };
});

export const useJoinGroup = routeAction$(async (_data, event) => {
  const { params, redirect } = event;
  const user = await getCurrentUserData(event as any);

  if (!user) {
    throw redirect(302, "/login");
  }

  const group = await groupsService.getBySlug(params.slug);
  if (!group) {
    return { success: false, error: "Group not found" };
  }

  await groupMembershipsService.join(user.id, group.id);
  return { success: true };
});

export default component$(() => {
  const data = useGroupData();
  const joinAction = useJoinGroup();
  const {
    group,
    memberCount,
    pastEventCount,
    memberParticipants,
    rep,
    isMember,
    isLoggedIn,
  } = data.value;

  return (
    <div>
      {/* Heading */}
      <div class="max-w-[1290px] mx-auto px-4 pt-12 pb-4 text-center">
        <h1 class="font-['Rubik',sans-serif] font-semibold text-[40px] md:text-[52px] leading-[1.1] text-gray-900">
          {group.name}
        </h1>
      </div>

      {/* Feature Grid */}
      <div class="max-w-[1290px] mx-auto px-4 py-8">
        <FeatureGrid layout={GRID_LAYOUT} gap={24}>
          {/* left-top: community members */}
          <ParticipantsTile
            area="left-top"
            participants={memberParticipants}
            participantCount={memberCount}
            title="Community Members"
            seeAllLabel="See All Members"
            seeAllHref={`/groups/${group.slug}/members`}
            emptyTitle="No members yet"
            emptyBody="Be the first to join this community"
            isLoggedIn={isLoggedIn}
          />

          {/* left-bottom: image 1 */}
          <ImageTile
            area="left-bottom"
            image={group.image1 ?? FALLBACK}
            alt={group.name}
          />

          {/* middle: image 2 with past event count overlay */}
          <ImageTile
            area="middle"
            image={group.image2 ?? FALLBACK}
            alt={group.name}
            overlayText={`${pastEventCount} local meet-up${pastEventCount === 1 ? "" : "s"} and counting`}
          />

          {/* right-top: image 3 */}
          <ImageTile
            area="right-top"
            image={group.image3 ?? FALLBACK}
            alt={group.name}
          />

          {/* right-bottom: local rep or join CTA */}
          {rep ? (
            <LocalRepTile
              area="right-bottom"
              name={rep.name}
              subtitle={rep.subtitle}
              profilePictureUrl={rep.profilePictureUrl}
              profileUrl={rep.profileUrl}
            />
          ) : (
            <div
              class="bg-[#034ea2] rounded-[25px] p-8 flex flex-col justify-between h-full"
              style={{ gridArea: "right-bottom" }}
            >
              <h3 class="font-['Rubik',sans-serif] font-semibold text-[24px] text-white">
                Join the community
              </h3>
              {isMember ? (
                <p class="font-['Lato',sans-serif] text-[16px] text-white/80 mt-4">
                  ✓ You are a member
                </p>
              ) : (
                <Form action={joinAction} class="mt-6">
                  <button
                    type="submit"
                    class="px-6 py-3 bg-white text-[#034ea2] rounded-full font-bold text-[15px] hover:bg-white/90 transition-colors disabled:opacity-50"
                    disabled={joinAction.isRunning}
                  >
                    {joinAction.isRunning ? "Joining..." : "Join This Group"}
                  </button>
                </Form>
              )}
            </div>
          )}
        </FeatureGrid>
      </div>

      {/* Join / member status — shown below grid when a rep tile occupies the bottom-right */}
      {rep && (
        <div class="max-w-[1290px] mx-auto px-4 pb-12 flex flex-col items-center gap-3">
          {isMember ? (
            <div class="bg-green-50 border border-green-200 text-green-800 px-6 py-3 rounded-full font-medium">
              ✓ You are a member of this group
            </div>
          ) : (
            <Form action={joinAction}>
              <button
                type="submit"
                class="px-8 py-3 bg-[#034ea2] text-white rounded-full font-bold text-[16px] hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={joinAction.isRunning}
              >
                {joinAction.isRunning ? "Joining..." : "Join This Group"}
              </button>
            </Form>
          )}
          {joinAction.value?.error && (
            <p class="text-red-600 text-sm">{joinAction.value.error}</p>
          )}
        </div>
      )}
    </div>
  );
});
