import { groupRepresentativesService } from "~/services/group-representatives.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import type { User } from "~/db/schema";

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
