import { and, eq } from "drizzle-orm";
import { db, userTagsService } from "~/core";
import { events } from "../schema/events";
import { participationStatus } from "../schema/participation-status";
import { TAG_RULES } from "../tag-rules.config";

async function evaluateRulesForUser(userId: string): Promise<void> {
	const participations = await db
		.select({ p: participationStatus, event: events })
		.from(participationStatus)
		.leftJoin(events, eq(participationStatus.eventId, events.id))
		.where(
			and(
				eq(participationStatus.userId, userId),
				eq(participationStatus.status, "yes"),
			),
		);

	const now = new Date().toISOString();
	const pastYes = participations.filter(
		(row) => row.event && row.event.endDate < now,
	);

	for (const rule of TAG_RULES) {
		let count = 0;

		switch (rule.conditionType) {
			case "participation_total":
				count = pastYes.length;
				break;
			case "participation_locationType":
				count = pastYes.filter(
					(row) => row.event?.locationType === rule.conditionFilter,
				).length;
				break;
			case "participation_group":
				count = pastYes.filter(
					(row) => row.event?.scopeId === rule.conditionFilter,
				).length;
				break;
			case "participation_visibility":
				count = pastYes.filter(
					(row) => row.event?.visibility === rule.conditionFilter,
				).length;
				break;
		}

		if (count >= rule.conditionCount) {
			await userTagsService.grant(
				userId,
				rule.slug,
				rule.label,
				rule.category,
				"rule",
			);
		}
	}
}

/**
 * Re-runs the rules for every user who said "yes" to an event (the daily `tag-rules` schedule:
 * an event's end turns a "yes" into a past participation the rules count). Returns how many
 * users were evaluated.
 */
async function evaluateRulesForAll(): Promise<number> {
	const rows = await db
		.selectDistinct({ userId: participationStatus.userId })
		.from(participationStatus)
		.where(eq(participationStatus.status, "yes"));
	for (const { userId } of rows) await evaluateRulesForUser(userId);
	return rows.length;
}

export const tagRulesService = { evaluateRulesForUser, evaluateRulesForAll };
