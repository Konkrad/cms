import { sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, unique, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";
import { users } from "./users";
import { electionCycles } from "./election-cycles";
import { electionPositions } from "./election-positions";

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
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    unique().on(t.positionId, t.userId),
    index("election_applications_cycle_status_idx").on(t.cycleId, t.status),
    index("election_applications_user_id_idx").on(t.userId),
  ],
);

const baseInsertSchema = createInsertSchema(electionApplications);

export const insertElectionApplicationSchema = baseInsertSchema.extend({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateElectionApplicationSchema = baseInsertSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();

export type ElectionApplication = InferSelectModel<typeof electionApplications>;
export type InsertElectionApplication = z.infer<typeof insertElectionApplicationSchema>;
export type UpdateElectionApplication = z.infer<typeof updateElectionApplicationSchema>;
