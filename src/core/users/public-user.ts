import { deriveThumbnailKey, publicImageUrlFromKey } from "~/core/media/images";
import type { User } from "~/core/users/schema";
import { users } from "~/core/users/schema";

/** The only user fields that may be serialized to pages or loaders about another user. */
export type PublicUser = Pick<User, "id" | "name" | "familyName">;

/**
 * Drizzle relational `columns` for loading another user publicly:
 * `with: { user: { columns: publicUserColumns } }`. Every relation to `users`
 * must use this (or an explicit column list); `user: true` would load the full
 * row (email login id, location, role, private S3 keys...).
 * Enforced by tests/unit/public-user-columns.spec.ts.
 */
export const publicUserColumns = {
	id: true,
	name: true,
	familyName: true,
} as const;

/** Same public subset for core `db.select({ user: publicUserSelect })` joins. */
export const publicUserSelect = {
	id: users.id,
	name: users.name,
	familyName: users.familyName,
};

/**
 * Public subset of a users row (id and name). Everything else on the row (email, loginId,
 * location, birth year, role, private S3 keys, ...) is dropped, so a loader can
 * hand it a full row without leaking it. Call this in the loader, before Qwik serializes.
 */
export function toPublicUser(user: PublicUser): PublicUser {
	return { id: user.id, name: user.name, familyName: user.familyName };
}

/**
 * Public thumbnail URL of a user's profile picture, or null. Reads the private full-size key
 * only to derive the public thumbnail; services return this URL, never `profilePicture`.
 */
export function publicUserThumbnailUrl(user: {
	profilePicture?: string | null;
	profilePictureSmall?: string | null;
}): string | null {
	if (!user.profilePicture && !user.profilePictureSmall) return null;
	return publicImageUrlFromKey(
		user.profilePictureSmall ??
			(user.profilePicture ? deriveThumbnailKey(user.profilePicture) : null),
	);
}
