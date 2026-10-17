import { and, eq } from "drizzle-orm";
import {
	db,
	publicUserColumns,
	publicUserThumbnailUrl,
	requirementValuesByUser,
} from "~/core";
import { logins, users } from "~/core/schema";
import {
	foodPreferenceLabel,
	foodPreferenceRequirement,
	photoConsentRequirement,
} from "../requirements";
import { events } from "../schema/events";
import {
	type InsertParticipationStatus,
	insertParticipationStatusSchema,
	type ParticipationStatus,
	participationStatus,
} from "../schema/participation-status";

export const participationService = {
	async create(data: InsertParticipationStatus): Promise<ParticipationStatus> {
		const validated = insertParticipationStatusSchema.parse(data);
		const [result] = await db
			.insert(participationStatus)
			.values(validated as any)
			.returning();
		return result;
	},

	async upsert(
		userId: string,
		eventId: string,
		status: "yes" | "no" | "maybe",
	): Promise<ParticipationStatus> {
		const existing = await this.getStatus(userId, eventId);

		const result = existing
			? await this.updateStatus(userId, eventId, status)
			: await this.create({
					userId,
					eventId,
					status,
					updatedAt: new Date().toISOString(),
				});

		if (status === "yes") {
			const { tagRulesService } = await import("./tag-rules");
			await tagRulesService.evaluateRulesForUser(userId);
		}

		return result;
	},

	async updateStatus(
		userId: string,
		eventId: string,
		status: "yes" | "no" | "maybe",
	): Promise<ParticipationStatus> {
		const [result] = await db
			.update(participationStatus)
			.set({
				status,
				updatedAt: new Date().toISOString(),
			})
			.where(
				and(
					eq(participationStatus.userId, userId),
					eq(participationStatus.eventId, eventId),
				),
			)
			.returning();
		return result;
	},

	async getStatus(
		userId: string,
		eventId: string,
	): Promise<ParticipationStatus | undefined> {
		const result = await db.query.participationStatus.findFirst({
			where: { userId, eventId },
		});
		return result;
	},

	async getSummary(eventId: string): Promise<{
		yes: number;
		no: number;
		maybe: number;
		total: number;
	}> {
		const results = await db.query.participationStatus.findMany({
			where: { eventId },
		});

		const summary = {
			yes: 0,
			no: 0,
			maybe: 0,
			total: results.length,
		};

		for (const result of results) {
			if (result.status === "yes") summary.yes++;
			else if (result.status === "no") summary.no++;
			else if (result.status === "maybe") summary.maybe++;
		}

		return summary;
	},

	/**
	 * PRIVATE: an event's RSVPs with each user's name and login email, for the admin
	 * participation page only. The public event page uses `getGoingParticipants`.
	 */
	async getByEventIdWithEmails(eventId: string) {
		const rows = await db
			.select({
				status: participationStatus,
				name: users.name,
				familyName: users.familyName,
				email: logins.email,
			})
			.from(participationStatus)
			.innerJoin(users, eq(users.id, participationStatus.userId))
			.leftJoin(logins, eq(logins.id, users.loginId))
			.where(eq(participationStatus.eventId, eventId));
		return rows.map((r) => ({
			...r.status,
			user: {
				id: r.status.userId,
				name: r.name,
				familyName: r.familyName,
				email: r.email,
			},
		}));
	},

	/**
	 * ADMIN ONLY: `getByEventIdWithEmails` plus each user's food preference (label) and photo
	 * consent, read from their event requirement answers (spec 4.6). Private answers: for the
	 * organisers' participant list only; null = not answered.
	 */
	async getByEventIdWithEmailsAndRequirementValues(eventId: string) {
		const rows = await participationService.getByEventIdWithEmails(eventId);
		const values = await requirementValuesByUser(
			[foodPreferenceRequirement.id, photoConsentRequirement.id],
			rows.map((r) => r.userId),
		);
		return rows.map((row) => {
			const answers = values.get(row.userId) ?? {};
			const food = answers[foodPreferenceRequirement.id] as
				| { foodPreference?: unknown }
				| undefined;
			const photo = answers[photoConsentRequirement.id] as
				| { photoConsentGiven?: unknown }
				| undefined;
			return {
				...row,
				foodPreference: foodPreferenceLabel(food?.foodPreference),
				photoConsentGiven:
					typeof photo?.photoConsentGiven === "boolean"
						? photo.photoConsentGiven
						: null,
			};
		});
	},

	/**
	 * Users who said "yes" or "maybe" to an event, as public cards: name, public
	 * thumbnail and city/country (never the private full-size picture key).
	 */
	async getGoingParticipants(eventId: string) {
		const rows = await db.query.participationStatus.findMany({
			where: { eventId, status: { in: ["yes", "maybe"] } },
			with: {
				user: {
					columns: {
						...publicUserColumns,
						city: true,
						country: true,
						profilePicture: true,
						profilePictureSmall: true,
					},
				},
			},
		});
		return rows.flatMap((r) => {
			if (!r.user) return [];
			const { profilePicture, profilePictureSmall, ...user } = r.user;
			return [
				{
					...user,
					profilePictureSmallUrl: publicUserThumbnailUrl({
						profilePicture,
						profilePictureSmall,
					}),
				},
			];
		});
	},

	async autoUpgradeToYes(
		userId: string,
		eventId: string,
	): Promise<ParticipationStatus | null> {
		const existing = await this.getStatus(userId, eventId);

		// Only upgrade if current status is "maybe"
		if (existing && existing.status === "maybe") {
			return this.updateStatus(userId, eventId, "yes");
		}

		// If no existing status or already "yes"/"no", create/keep as "yes"
		if (!existing) {
			return this.upsert(userId, eventId, "yes");
		}

		return existing;
	},

	async delete(userId: string, eventId: string): Promise<void> {
		await db
			.delete(participationStatus)
			.where(
				and(
					eq(participationStatus.userId, userId),
					eq(participationStatus.eventId, eventId),
				),
			);
	},

	async getByUserId(userId: string): Promise<{
		past: Array<{
			id: string;
			scopeId: string;
			slug: string;
			title: string;
			startDate: string;
			endDate: string;
			city: string | null;
			country: string | null;
		}>;
		upcoming: Array<{
			id: string;
			scopeId: string;
			slug: string;
			title: string;
			startDate: string;
			endDate: string;
			city: string | null;
			country: string | null;
		}>;
	}> {
		const rows = await db.query.participationStatus.findMany({
			where: {
				userId,
				status: "yes",
			},
			with: { event: true },
		});

		const now = new Date().toISOString();
		const past = [];
		const upcoming = [];

		for (const row of rows) {
			const e = row.event;
			const entry = {
				id: e.id,
				scopeId: e.scopeId,
				slug: e.slug,
				title: e.title,
				startDate: e.startDate,
				endDate: e.endDate,
				city: e.city ?? null,
				country: e.country ?? null,
			};
			if (e.endDate < now) {
				past.push(entry);
			} else {
				upcoming.push(entry);
			}
		}

		past.sort((a, b) => b.startDate.localeCompare(a.startDate));
		upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));

		return { past, upcoming };
	},
};
