import type { User } from "~/core/users/schema";

/** The only user fields that may be serialized to pages or loaders about another user. */
export type PublicUser = Pick<User, "id" | "name" | "familyName">;

/**
 * Public subset of a users row (id and name). Everything else on the row (email, loginId,
 * location, birth year, consent, role, private S3 keys, ...) is dropped, so a loader can
 * hand it a full row without leaking it. Call this in the loader, before Qwik serializes.
 */
export function toPublicUser(user: PublicUser): PublicUser {
	return { id: user.id, name: user.name, familyName: user.familyName };
}
