import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$ } from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { groupMemberships, users } from "~/db/schema";
import { groupsService } from "~/services/groups.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { groupRepresentativesService } from "~/services/group-representatives.service";
import { eventsService } from "~/services/events.service";
import { getCurrentUserData } from "~/utils/server-auth";
import { buildProfileUrl } from "~/utils/users";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
import { useThemeComponent$ } from "~/utils/theme-loader";
import { ThemeComponent } from "~/utils/theme-components";
import type { FC } from "react";

export const useGroupData = routeLoader$(async (event) => {
  const { params, redirect } = event;
  const group = await groupsService.getBySlug(params.slug);
  if (!group) throw redirect(302, "/groups");

  const user = await getCurrentUserData(event as any);
  const now = new Date().toISOString();

  const [
    memberCount,
    pastEventCount,
    rep,
    isMember,
    recentMembers,
    upcomingEvents,
    recentPosts,
  ] = await Promise.all([
    groupMembershipsService.countByGroupId(group.id),
    eventsService.countPastByGroupId(group.id),
    groupRepresentativesService.getFirstRepresentativeWithUser(group.id),
    user ? groupMembershipsService.isMember(user.id, group.id) : false,
    db
      .select({
        id: users.id,
        name: users.name,
        familyName: users.familyName,
        profilePicture: users.profilePicture,
        profilePictureSmall: users.profilePictureSmall,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(groupMemberships.userId, users.id))
      .where(eq(groupMemberships.groupId, group.id))
      .limit(6),
    db.query.events.findMany({
      where: {
        groupId: group.id,
        deletedAt: { isNull: true },
        endDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
      limit: 3,
    }),
    db.query.posts.findMany({
      with: { user: true },
      where: {
        groupId: group.id,
        deletedAt: { isNull: true },
      },
      orderBy: { createdAt: "desc" },
      limit: 3,
    }) as any,
  ]);

  const toPublicUrl = (key: string | null | undefined) =>
    publicImageUrlFromKey(key);

  const repData = rep
    ? {
        name: `${rep.user.name} ${rep.user.familyName}`,
        subtitle: `Local Rep ${group.name}`,
        profilePictureUrl: rep.user.profilePicture
          ? toPublicUrl(
              (rep.user as any).profilePictureSmall ??
                deriveThumbnailKey(rep.user.profilePicture),
            )
          : null,
        profileUrl: buildProfileUrl({
          id: rep.userId,
          name: rep.user.name,
          familyName: rep.user.familyName,
        }),
      }
    : null;

  return {
    group,
    memberCount,
    pastEventCount,
    recentMembers: recentMembers.map((m) => ({
      id: m.id,
      name: m.name,
      familyName: m.familyName,
      profilePictureSmall: m.profilePicture
        ? toPublicUrl(
            (m as any).profilePictureSmall ??
              deriveThumbnailKey(m.profilePicture),
          )
        : null,
      profileUrl: buildProfileUrl({
        id: m.id,
        name: m.name,
        familyName: m.familyName,
      }),
    })),
    rep: repData,
    isMember,
    isLoggedIn: !!user,
    upcomingEvents: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      image1: toPublicUrl(e.image1),
      locationType: e.locationType,
      city: e.city,
      address: e.address,
    })),
    recentPosts: recentPosts.map((p: any) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      createdAt: p.createdAt,
      featuredImage: toPublicUrl((p as any).featuredImage ?? null),
      authorName: `${(p as any).user.name} ${(p as any).user.familyName}`,
    })),
    groupImage1: toPublicUrl(group.image1),
    groupImage2: toPublicUrl(group.image2),
    groupImage3: toPublicUrl(group.image3),
  };
});

export const useJoinGroup = routeAction$(async (_data, event) => {
  const { params, redirect } = event;
  const user = await getCurrentUserData(event as any);
  if (!user) throw redirect(302, "/login");

  const group = await groupsService.getBySlug(params.slug);
  if (!group) return { success: false, error: "Group not found" };

  await groupMembershipsService.join(user.id, group.id);
  return { success: true };
});

export default component$(() => {
  const data = useGroupData();
  const joinAction = useJoinGroup();
  const GroupView = useThemeComponent$(
    () => import("~theme/routes/groups/GroupView"),
  );
  return (
    <ThemeComponent
      resource={GroupView}
      data={data.value}
      joinAction={joinAction}
    />
  );
});
