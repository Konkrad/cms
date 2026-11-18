import { and, eq, inArray } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { type UserRequirement, userRequirements } from "./schema";

/**
 * Storage of completed requirements (spec 4.6). The stored `value`s are private: they leave
 * this service only through `requirements.steps` (the user's own prefill) and the explicitly
 * named admin reader `valuesByUser`.
 */
export const requirementsService = {
	/** The user's completions of these requirements (any version). */
	async rowsFor(
		userId: string,
		requirementIds: readonly string[],
	): Promise<UserRequirement[]> {
		if (requirementIds.length === 0) return [];
		return db
			.select()
			.from(userRequirements)
			.where(
				and(
					eq(userRequirements.userId, userId),
					inArray(userRequirements.requirementId, [...requirementIds]),
				),
			);
	},

	/** Records a completion at `version` (replacing an older one) with its value. */
	async complete(
		userId: string,
		requirementId: string,
		version: number,
		value: unknown,
		completedAt: string = new Date().toISOString(),
	): Promise<void> {
		const row = {
			userId,
			requirementId,
			version,
			completedAt,
			value: value ?? null,
		};
		await db
			.insert(userRequirements)
			.values(row)
			.onConflictDoUpdate({
				target: [userRequirements.userId, userRequirements.requirementId],
				set: { version, completedAt, value: row.value },
			});
	},

	/**
	 * ADMIN ONLY: the stored values of these requirements for these users, by user id and then
	 * requirement id (any version; a user without a row is missing). Private answers: call it
	 * only from admin loaders that allow the fields in their leak check.
	 */
	async valuesByUser(
		requirementIds: readonly string[],
		userIds: readonly string[],
	): Promise<Map<string, Record<string, unknown>>> {
		const result = new Map<string, Record<string, unknown>>();
		if (requirementIds.length === 0 || userIds.length === 0) return result;
		const rows = await db
			.select({
				userId: userRequirements.userId,
				requirementId: userRequirements.requirementId,
				value: userRequirements.value,
			})
			.from(userRequirements)
			.where(
				and(
					inArray(userRequirements.requirementId, [...requirementIds]),
					inArray(userRequirements.userId, [...new Set(userIds)]),
				),
			);
		for (const row of rows) {
			const byRequirement = result.get(row.userId) ?? {};
			byRequirement[row.requirementId] = row.value;
			result.set(row.userId, byRequirement);
		}
		return result;
	},
};
