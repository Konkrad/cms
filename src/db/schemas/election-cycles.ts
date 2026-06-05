import { sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export const electionCycles = sqliteTable("election_cycles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["draft", "open", "closed"],
  })
    .notNull()
    .default("draft"),
  requiredMembershipTier: text("required_membership_tier", {
    enum: ["associated", "full"],
  }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(electionCycles);

export const insertElectionCycleSchema = baseInsertSchema.extend({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateElectionCycleSchema = baseInsertSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();

export type ElectionCycle = InferSelectModel<typeof electionCycles>;
export type InsertElectionCycle = z.infer<typeof insertElectionCycleSchema>;
export type UpdateElectionCycle = z.infer<typeof updateElectionCycleSchema>;
