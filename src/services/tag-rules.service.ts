import { and, eq } from "drizzle-orm";
import { TAG_RULES } from "~/config/tag-rules";
import { db } from "~/db/connection";
import { events } from "~/db/schemas/events";
import { participationStatus } from "~/db/schemas/participation-status";
import { userTagsService } from "~/services/user-tags.service";

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
					(row) => row.event?.groupId === rule.conditionFilter,
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

export const tagRulesService = { evaluateRulesForUser };
