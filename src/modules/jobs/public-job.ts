import type { JobAuthor, PublicJob } from "~/contracts/jobs";
import { type PublicUser, toPublicUser } from "~/core";
import type { Job } from "./schema";

export type { JobAuthor as PublicJobAuthor, PublicJob };

export function toPublicJob(
	job: Job & { user?: PublicUser | null },
): PublicJob {
	const { user, ...rest } = job;
	return { ...rest, user: user ? toPublicUser(user) : null };
}
