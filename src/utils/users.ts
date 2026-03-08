import type { User } from "~/db/schema";

export type UserWithDisplayName = User & { displayName: string };

export function formatUser(
  user: User,
  isLoggedIn: boolean = false,
): UserWithDisplayName {
  return {
    ...user,
    displayName: isLoggedIn ? `${user.name} ${user.familyName}` : user.name,
  };
}

export function formatUserName(user: Pick<User, "name" | "familyName">): string {
  return `${user.name} ${user.familyName}`;
}

export function buildProfileUrl(user: Pick<User, "id" | "name" | "familyName">): string {
  const slug = `${user.name ?? ""} ${user.familyName ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `/users/${user.id}-${slug}`;
}
