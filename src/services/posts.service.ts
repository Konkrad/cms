import { desc, eq } from "drizzle-orm";
import { db } from "~/db/connection";
import type { NewPost, Post } from "~/db/schemas/posts";
import { posts } from "~/db/schemas/posts";
import type { User } from "~/db/schemas/users";
import { users } from "~/db/schemas/users";
import crypto from "crypto";

export type PostWithUser = Post & {
  user: { displayName: string; email?: string | null };
};

export const postsService = {
  async getAll(userId?: string): Promise<PostWithUser[]> {
    // Note: cast the select object to `any` to avoid strict SelectedFields typing issues
    let query: any = db
      .select({
        ...posts,
        user: {
          displayName: users.displayName,
        },
      } as any)
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id));

    if (userId) {
      query = query.where(eq(posts.userId, userId));
    }

    // Apply ordering after potential `where` to avoid typing issues with the query builder
    query = query.orderBy(desc(posts.createdAt));

    const results = (await query) as any[];
    return results.map((row: any) => ({
      id: row.id as string,
      title: row.title as string,
      body: row.body as string,
      userId: row.userId as string,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      user: {
        displayName: row.user?.displayName ?? "",
        // We no longer select `email` from the users table; keep value nullable for compatibility
        email: null,
      },
    }));
  },

  async getRecent(limit: number = 3): Promise<PostWithUser[]> {
    const results = (await db
      .select({
        ...posts,
        user: {
          displayName: users.displayName,
        },
      } as any)
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.createdAt))
      .limit(limit)) as any[];

    return results.map((row: any) => ({
      id: row.id as string,
      title: row.title as string,
      body: row.body as string,
      userId: row.userId as string,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      user: {
        displayName: row.user?.displayName ?? "",
        email: null,
      },
    }));
  },

  async getById(id: string): Promise<PostWithUser | undefined> {
    const results = (await db
      .select({
        ...posts,
        user: {
          displayName: users.displayName,
        },
      } as any)
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .where(eq(posts.id, id))) as any[];

    const row = results[0];
    if (!row) return undefined;

    return {
      id: row.id as string,
      title: row.title as string,
      body: row.body as string,
      userId: row.userId as string,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      user: {
        displayName: row.user?.displayName ?? "",
        email: null,
      },
    };
  },

  async create(
    data: Omit<NewPost, "id" | "createdAt" | "updatedAt">,
  ): Promise<Post> {
    // The DB schema requires `id` to be supplied on insert; generate one here.
    const id = crypto.randomUUID();
    const [result] = await db
      .insert(posts)
      .values({
        id,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return result as Post;
  },

  async update(
    id: string,
    data: Partial<Omit<NewPost, "id" | "createdAt">>,
  ): Promise<Post | undefined> {
    const [result] = await db
      .update(posts)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(posts.id, id))
      .returning();

    return result as Post | undefined;
  },

  async delete(id: string): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  },
};

export type AdminPost = {
  id: string;
  title: string;
  excerpt: string;
  author_name: string;
  category: string;
  published_at: string;
  image_url?: string | null;
  content?: string;
};

const generateExcerpt = (body: string) => {
  if (!body) return "";
  const trimmed = body.trim();
  if (trimmed.length <= 160) return trimmed;
  return trimmed.slice(0, 157) + "...";
};

export async function getAllPosts(): Promise<AdminPost[]> {
  const rows = await postsService.getAll();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: generateExcerpt(r.body),
    author_name: r.user?.displayName ?? r.user?.email ?? "",
    category: "",
    published_at: r.createdAt,
    image_url: null,
    content: r.body,
  }));
}

export async function getPostById(id: string): Promise<AdminPost | undefined> {
  const r = await postsService.getById(id);
  if (!r) return undefined;
  return {
    id: r.id,
    title: r.title,
    excerpt: generateExcerpt(r.body),
    author_name: r.user?.displayName ?? r.user?.email ?? "",
    category: "",
    published_at: r.createdAt,
    image_url: null,
    content: r.body,
  };
}

export async function createPost(
  data: {
    title: string;
    excerpt?: string;
    content: string;
    category?: string;
    image_url?: string | null;
  },
  event: any,
): Promise<{ error?: string } | undefined> {
  try {
    const { requireAdmin } = await import("~/utils/server-auth");
    const user = await requireAdmin(event);
    await postsService.create({
      title: data.title,
      body: data.content,
      userId: user.id,
    } as any);
    return undefined;
  } catch (err: any) {
    return { error: err?.message ?? "Failed to create post" };
  }
}

export async function updatePost(
  id: string,
  data: {
    title: string;
    excerpt?: string;
    content: string;
    category?: string;
    image_url?: string | null;
  },
  event: any,
): Promise<{ error?: string } | undefined> {
  try {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    const updated = await postsService.update(id, {
      title: data.title,
      body: data.content,
    } as any);
    if (!updated) return { error: "Post not found" };
    return undefined;
  } catch (err: any) {
    return { error: err?.message ?? "Failed to update post" };
  }
}

export async function deletePost(
  id: string,
  event: any,
): Promise<{ error?: string } | undefined> {
  try {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await postsService.delete(id);
    return undefined;
  } catch (err: any) {
    return { error: err?.message ?? "Failed to delete post" };
  }
}
