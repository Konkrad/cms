import { groupRepresentativesService } from "~/services/group-representatives.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { membershipsService } from "~/services/memberships.service";
import type { User } from "~/db/schema";
import type { RequestEvent } from "~/utils/server-auth";
import { requireAuth } from "~/utils/server-auth";

export async function canManageGroupContent(
  userId: string,
  groupId: string
): Promise<boolean> {
  return await groupRepresentativesService.isRepresentative(userId, groupId);
}

export async function canViewGroupOnlyContent(
  userId: string,
  groupId: string
): Promise<boolean> {
  return await groupMembershipsService.isMember(userId, groupId);
}

export function isPlatformAdmin(user: User): boolean {
  return user.role === "admin";
}

export async function hasMembership(
  userId: string,
  minTier: "associated" | "full",
): Promise<boolean> {
  return membershipsService.hasTier(userId, minTier);
}

export async function requireMembership(
  event: RequestEvent,
  minTier: "associated" | "full",
): Promise<void> {
  const user = await requireAuth(event);
  const ok = await membershipsService.hasTier(user.id, minTier);
  if (!ok) throw event.redirect(302, "/");
}
