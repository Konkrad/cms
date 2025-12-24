import { desc, eq, lt } from "drizzle-orm";
import { db } from "~/db/connection";
import type { InsertPost, UpdatePost, Post } from "~/db/schemas/posts";
import { posts, insertPostSchema, updatePostSchema } from "~/db/schemas/posts";
import { decodeCursor, getNextCursorFromRows } from "~/services/pagination";

export type PostWithUser = Post & {
  user: User;
};

import type { User } from "~/db/schemas/users";

const LexicalHTMLRenderer = require("@tryghost/kg-lexical-html-renderer");
const renderer = new LexicalHTMLRenderer.Renderer();

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

export const postsService = {
  async getAll(
    limit: number = 10,
    cursor?: string | null,
  ): Promise<{ items: PostWithUser[]; nextCursor?: string | null }> {
    const cursorObj = decodeCursor(cursor ?? null);

    const results = await db.query.posts.findMany({
      with: {
        user: true,
      },
      orderBy: [desc(posts.createdAt), desc(posts.id)],
      limit: limit + 1,
      where: cursorObj?.createdAt
        ? lt(posts.createdAt, cursorObj.createdAt)
        : undefined,
    });

    let nextCursor: string | undefined | null = undefined;
    let items = results;
    if (results.length > limit) {
      nextCursor = getNextCursorFromRows(results, ["createdAt"], limit);
      items = results.slice(0, limit);
    }

    return {
      items: items as PostWithUser[],
      nextCursor: nextCursor ?? null,
    };
  },

  async getRecent(limit: number = 3): Promise<PostWithUser[]> {
    const res = await this.getAll(limit);
    return res.items;
  },

  async getById(id: string): Promise<PostWithUser | undefined> {
    const result = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: {
        user: true,
      },
    });

    return result as PostWithUser | undefined;
  },

  async create(data: InsertPost): Promise<Post> {
    const parsed = insertPostSchema.parse(data);

    // Render HTML from editor state if provided
    if (parsed.editorState) {
      const html = await renderEditorState(parsed.editorState);
      parsed.body = html;
    }

    const [result] = await db
      .insert(posts)
      .values(parsed as any)
      .returning();

    return result;
  },

  async update(id: string, data: UpdatePost): Promise<Post | undefined> {
    const parsed = updatePostSchema.parse(data);

    // Render HTML from editor state if provided
    if (parsed.editorState) {
      const html = await renderEditorState(parsed.editorState);
      parsed.body = html;
    }

    const [result] = await db
      .update(posts)
      .set(parsed as any)
      .where(eq(posts.id, id))
      .returning();

    return result;
  },

  async delete(id: string): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  },
};
