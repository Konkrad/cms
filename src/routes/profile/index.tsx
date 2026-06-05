import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { env } from "~/env";
import { formResultsService } from "~/services/form-results.service";
import { userTagsService } from "~/services/user-tags.service";
import { electionsService } from "~/services/elections.service";
import { buildFormPath } from "~/utils/forms";
import { formatAffiliationResultJson } from "~/utils/affiliation";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";
import { deriveThumbnailKey } from "~/utils/images";
import { db } from "~/db/connection";
import { groupMemberships } from "~/db/schemas/group-memberships";
import { groups } from "~/db/schemas/groups";
import { eq } from "drizzle-orm";
import { UserProfile } from "~/components/user/UserProfile/UserProfile";

export const useProfile = routeLoader$(async (event) => {
  await requireAuth(event);
  const userData = await getCurrentUserData(event);

  if (!userData) {
    throw event.redirect(302, "/login");
  }

  const user = userData as any;

  const buildPicUrl = (key: string | null) => {
    if (!key) return null;
    return env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  };

  const profilePictureUrl = user.profilePicture
    ? buildPicUrl(deriveThumbnailKey(user.profilePicture))
    : null;

  const { participationService } = await import("~/services/participation.service");

  const [submittedForms, tags, electionApplications, communityRows, events] =
    await Promise.all([
      formResultsService.getByUser(user.id),
      userTagsService.getByUser(user.id),
      electionsService.getApplicationsByUser(user.id),
      db
        .select({ name: groups.name, slug: groups.slug })
        .from(groupMemberships)
        .innerJoin(groups, eq(groupMemberships.groupId, groups.id))
        .where(eq(groupMemberships.userId, user.id)),
      participationService.getByUserId(user.id),
    ]);

  const formatResponseValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value.trim() || "-";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
      const parts = value.map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "object" && item !== null) {
          return Object.entries(item as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(", ");
        }
        return String(item);
      }).filter(Boolean);
      return parts.length > 0 ? parts.join("; ") : "-";
    }
    return JSON.stringify(value);
  };

  const electionsByCycle = new Map<string, { title: string; year: number; apps: typeof electionApplications }>();
  for (const app of electionApplications) {
    if (!electionsByCycle.has(app.cycleId)) {
      electionsByCycle.set(app.cycleId, { title: app.cycle.title, year: app.cycle.year, apps: [] });
    }
    electionsByCycle.get(app.cycleId)!.apps.push(app);
  }

  return {
    name: user.name as string,
    familyName: user.familyName as string,
    role: user.role as string,
    city: user.city ?? null,
    country: user.country ?? null,
    profilePictureUrl,
    tags: tags.map((t) => ({ id: t.id, label: t.label })),
    communities: communityRows,
    upcomingEvents: events.upcoming,
    pastEvents: events.past,
    isOwner: true,
    email: (user.email as string | null) ?? null,
    yearOfBirth: user.yearOfBirth ?? null,
    sex: user.sex ?? null,
    electionGroups: [...electionsByCycle.values()]
      .sort((a, b) => b.year - a.year)
      .map((g) => ({
        ...g,
        apps: g.apps.map((a) => ({
          id: a.id,
          status: a.status,
          position: (a as any).position ?? null,
        })),
      })),
    submittedForms: submittedForms.map((s) => ({
      id: s.id,
      title: s.formTitle,
      submittedAt: s.submittedAt,
      path: buildFormPath({ id: s.formId, slug: s.formSlug }),
      responseEntries: s.formSlug === "onboarding"
        ? formatAffiliationResultJson(s.resultJson || {})
        : Object.entries(s.resultJson || {}).map(([question, value]) => ({
            question,
            answer: formatResponseValue(value),
          })),
    })),
  };
});

export default component$(() => {
  const profile = useProfile();
  return <UserProfile {...profile.value} />;
});
