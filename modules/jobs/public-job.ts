import type { User } from "~/core-api";
import type { Job } from "./schema";

/** Author fields the job views show; never the full users row. */
export type PublicJobAuthor = Pick<User, "id" | "name" | "familyName">;
export type PublicJob = Job & { user: PublicJobAuthor | null };

export function toPublicJob(job: Job & { user?: User | null }): PublicJob {
	const { user, ...rest } = job;
	return {
		...rest,
		user: user
			? { id: user.id, name: user.name, familyName: user.familyName }
			: null,
	};
}
