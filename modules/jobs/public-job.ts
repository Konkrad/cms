import { type PublicUser, toPublicUser } from "~/core";
import type { Job } from "./schema";

/** Author fields the job views show; never the full users row. */
export type PublicJobAuthor = PublicUser;
export type PublicJob = Job & { user: PublicJobAuthor | null };

export function toPublicJob(
	job: Job & { user?: PublicUser | null },
): PublicJob {
	const { user, ...rest } = job;
	return { ...rest, user: user ? toPublicUser(user) : null };
}
