import { relations, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import crypto from "crypto";
import LexicalHTMLRenderer from "@tryghost/kg-lexical-html-renderer";
// @ts-ignore - no types available
import { DEFAULT_NODES } from "@tryghost/kg-default-nodes";

const renderer = new LexicalHTMLRenderer({
  nodes: DEFAULT_NODES,
});

async function renderEditorState(editorState: string | null): Promise<string> {
  if (!editorState) {
    return "";
  }

  try {
    return await renderer.render(editorState);
  } catch (error) {
    console.error("Error rendering editor state:", error);
    return "";
  }
}

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  editorState: text("editor_state"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
}));

const baseInsertSchema = createInsertSchema(posts);
const baseSelectSchema = createSelectSchema(posts);

export const insertPostSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
    body: z.string().optional(),
  })
  .partial({
    id: true,
    createdAt: true,
    updatedAt: true,
    body: true,
  })
  .transform(async (data) => {
    console.log("insertPostSchema transform called with:", {
      hasEditorState: !!data.editorState,
      editorStatePreview: data.editorState?.substring(0, 100),
    });

    if (data.editorState) {
      const html = await renderEditorState(data.editorState);
      console.log("insertPostSchema: Rendered HTML:", html?.substring(0, 100));
      data.body = html;
    }
    if (!data.body) {
      data.body = "";
    }

    console.log(
      "insertPostSchema transform returning body:",
      data.body?.substring(0, 100),
    );
    return data;
  });

export const updatePostSchema = baseInsertSchema
  .omit({
    id: true,
    createdAt: true,
  })
  .partial()
  .extend({
    updatedAt: z
      .string()
      .default(() => new Date().toISOString())
      .optional(),
  })
  .transform(async (data) => {
    console.log("updatePostSchema transform called with:", {
      hasEditorState: !!data.editorState,
      editorStatePreview: data.editorState?.substring(0, 100),
      currentBody: data.body?.substring(0, 100),
    });

    if (data.editorState) {
      const html = await renderEditorState(data.editorState);
      console.log("updatePostSchema: Rendered HTML:", html?.substring(0, 100));
      data.body = html;
    }

    console.log(
      "updatePostSchema transform returning body:",
      data.body?.substring(0, 100),
    );
    return data;
  });

export const selectPostSchema = baseSelectSchema;

export type Post = z.infer<typeof selectPostSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;
