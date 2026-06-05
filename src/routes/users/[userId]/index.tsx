import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { logins } from "~/db/schemas/logins";
import { env } from "~/env";
import { usersService } from "~/services/users.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { participationService } from "~/services/participation.service";
import { formResultsService } from "~/services/form-results.service";
import { electionsService } from "~/services/elections.service";
import { buildFormPath } from "~/utils/forms";
import { formatAffiliationResultJson } from "~/utils/affiliation";
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

  const isAdmin = currentUser?.role === "admin";

  const { userTagsService } = await import("~/services/user-tags.service");
  const [groups, participation, tags, submittedFormRows, electionApplications] = await Promise.all([
    groupMembershipsService.getUserGroups(user.id),
    participationService.getByUserId(user.id),
    userTagsService.getByUser(user.id),
    formResultsService.getByUser(user.id),
    isOwner ? electionsService.getApplicationsByUser(user.id) : Promise.resolve([]),
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
    electionGroups: isOwner
      ? [...electionsByCycle.values()]
          .sort((a, b) => b.year - a.year)
          .map((g) => ({
            ...g,
            apps: g.apps.map((a) => ({
              id: a.id,
              status: a.status,
              position: (a as any).position ?? null,
            })),
          }))
      : undefined,
    affiliationEntries: (() => {
      const onboarding = submittedFormRows.find((s) => s.formSlug === "onboarding");
      return onboarding ? formatAffiliationResultJson(onboarding.resultJson || {}) : [];
    })(),
    submittedForms: isOwner
      ? submittedFormRows
          .map((s) => ({
            id: s.id,
            title: s.formTitle,
            submittedAt: s.submittedAt,
            path: buildFormPath({ id: s.formId, slug: s.formSlug }),
            responseEntries: Object.entries(s.resultJson || {}).map(([question, value]) => ({
              question,
              answer: formatResponseValue(value),
            })),
          }))
      : undefined,
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
