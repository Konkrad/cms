import { sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";
import { electionCycles } from "./election-cycles";

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
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("election_positions_cycle_id_idx").on(t.cycleId)],
);

const baseInsertSchema = createInsertSchema(electionPositions);

export const insertElectionPositionSchema = baseInsertSchema.extend({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export const updateElectionPositionSchema = baseInsertSchema
  .omit({ id: true, createdAt: true })
  .partial();

export type ElectionPosition = InferSelectModel<typeof electionPositions>;
export type InsertElectionPosition = z.infer<typeof insertElectionPositionSchema>;
export type UpdateElectionPosition = z.infer<typeof updateElectionPositionSchema>;
