import crypto from "crypto";
import { type InferSelectModel, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { defineModuleSchema, users } from "~/core/schema";

export const electionCycles = sqliteTable("election_cycles", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	year: integer("year").notNull(),
	description: text("description"),
	status: text("status", {
		enum: ["draft", "open", "voting", "closed"],
	})
		.notNull()
		.default("draft"),
	requiredMembershipTier: text("required_membership_tier", {
		enum: ["associated", "full"],
	}),
	votingUrl: text("voting_url"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

const electionCycleBase = createInsertSchema(electionCycles);

export const insertElectionCycleSchema = electionCycleBase.extend({
	id: z
		.string()
		.uuid()
		.default(() => crypto.randomUUID()),
	createdAt: z.string().default(() => new Date().toISOString()),
	updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateElectionCycleSchema = electionCycleBase
	.omit({ id: true, createdAt: true, updatedAt: true })
	.partial();

export type ElectionCycle = InferSelectModel<typeof electionCycles>;
export type InsertElectionCycle = z.infer<typeof insertElectionCycleSchema>;
export type UpdateElectionCycle = z.infer<typeof updateElectionCycleSchema>;

export const electionPositions = sqliteTable(
	"election_positions",
	{
		id: text("id").primaryKey(),
		cycleId: text("cycle_id")
			.notNull()
			.references(() => electionCycles.id),
		title: text("title").notNull(),
		description: text("description"),
		maxCandidates: integer("max_candidates"),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(t) => [index("election_positions_cycle_id_idx").on(t.cycleId)],
);

const electionPositionBase = createInsertSchema(electionPositions);

export const insertElectionPositionSchema = electionPositionBase.extend({
	id: z
		.string()
		.uuid()
		.default(() => crypto.randomUUID()),
	createdAt: z.string().default(() => new Date().toISOString()),
});

export const updateElectionPositionSchema = electionPositionBase
	.omit({ id: true, createdAt: true })
	.partial();

export type ElectionPosition = InferSelectModel<typeof electionPositions>;
export type InsertElectionPosition = z.infer<
	typeof insertElectionPositionSchema
>;
export type UpdateElectionPosition = z.infer<
	typeof updateElectionPositionSchema
>;

export const electionApplications = sqliteTable(
	"election_applications",
	{
		id: text("id").primaryKey(),
		positionId: text("position_id")
			.notNull()
			.references(() => electionPositions.id),
		cycleId: text("cycle_id")
			.notNull()
			.references(() => electionCycles.id),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		status: text("status", {
			enum: ["pending", "approved", "rejected"],
		})
			.notNull()
			.default("pending"),
		motivationWhy: text("motivation_why").notNull(),
		motivationExperience: text("motivation_experience").notNull(),
		motivationGoals: text("motivation_goals").notNull(),
		adminNote: text("admin_note"),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(t) => [
		unique().on(t.positionId, t.userId),
		index("election_applications_cycle_status_idx").on(t.cycleId, t.status),
		index("election_applications_user_id_idx").on(t.userId),
	],
);

const electionApplicationBase = createInsertSchema(electionApplications);

export const insertElectionApplicationSchema = electionApplicationBase.extend({
	id: z
		.string()
		.uuid()
		.default(() => crypto.randomUUID()),
	createdAt: z.string().default(() => new Date().toISOString()),
	updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateElectionApplicationSchema = electionApplicationBase
	.omit({ id: true, createdAt: true, updatedAt: true })
	.partial();

export type ElectionApplication = InferSelectModel<typeof electionApplications>;
export type InsertElectionApplication = z.infer<
	typeof insertElectionApplicationSchema
>;
export type UpdateElectionApplication = z.infer<
	typeof updateElectionApplicationSchema
>;

export default defineModuleSchema({
	tables: { electionCycles, electionPositions, electionApplications },
	relations: (r) => ({
		electionCycles: {
			positions: r.many.electionPositions({
				from: r.electionCycles.id,
				to: r.electionPositions.cycleId,
			}),
		},
		electionPositions: {
			cycle: r.one.electionCycles({
				from: r.electionPositions.cycleId,
				to: r.electionCycles.id,
				optional: false,
			}),
			applications: r.many.electionApplications({
				from: r.electionPositions.id,
				to: r.electionApplications.positionId,
			}),
		},
		electionApplications: {
			position: r.one.electionPositions({
				from: r.electionApplications.positionId,
				to: r.electionPositions.id,
				optional: false,
			}),
			cycle: r.one.electionCycles({
				from: r.electionApplications.cycleId,
				to: r.electionCycles.id,
				optional: false,
			}),
			user: r.one.users({
				from: r.electionApplications.userId,
				to: r.users.id,
				optional: false,
			}),
		},
		users: {
			electionApplications: r.many.electionApplications({
				from: r.users.id,
				to: r.electionApplications.userId,
			}),
		},
	}),
});
