import type { User } from "~/db/schemas/users";

export type UserWithDisplayName = User & { displayName: string };

export function formatUser<T extends Record<string, any>>(
  user: T,
  isLoggedIn: boolean = false,
): T & { displayName: string } {
  const displayName = isLoggedIn
    ? `${(user as any).name} ${(user as any).familyName}`
    : (user as any).name;
  return {
    ...user,
    displayName,
  } as T & { displayName: string };
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
