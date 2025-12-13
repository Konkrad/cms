import { supabase } from '~/db/connection';
import { createClient } from '@supabase/supabase-js';
import type { Post, NewPost } from '~/db/schema';

export type PostWithUser = Post & { user: { displayName: string; email: string } };

const getSupabaseClient = (accessToken?: string) => {
  if (accessToken) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    return createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }
  return supabase;
};

export const postsService = {
  async getAll(userId?: string, accessToken?: string): Promise<PostWithUser[]> {
    const client = getSupabaseClient(accessToken);
    let query = client
      .from('posts')
      .select(
        `
        *,
        user:users!posts_user_id_fkey(display_name, email)
      `
      )
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map((post: any) => ({
      id: post.id,
      title: post.title,
      body: post.body,
      userId: post.user_id,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      user: {
        displayName: post.user.display_name,
        email: post.user.email,
      },
    })) as PostWithUser[];
  },

  async getRecent(limit: number = 3, accessToken?: string): Promise<PostWithUser[]> {
    const client = getSupabaseClient(accessToken);
    const { data, error } = await client
      .from('posts')
      .select(
        `
        *,
        user:users!posts_user_id_fkey(display_name, email)
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((post: any) => ({
      id: post.id,
      title: post.title,
      body: post.body,
      userId: post.user_id,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      user: {
        displayName: post.user.display_name,
        email: post.user.email,
      },
    })) as PostWithUser[];
  },

  async getById(id: string, accessToken?: string): Promise<PostWithUser | undefined> {
    const client = getSupabaseClient(accessToken);
    const { data, error } = await client
      .from('posts')
      .select(
        `
        *,
        user:users!posts_user_id_fkey(display_name, email)
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return undefined;

    return {
      id: data.id,
      title: data.title,
      body: data.body,
      userId: data.user_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      user: {
        displayName: (data.user as any).display_name,
        email: (data.user as any).email,
      },
    } as PostWithUser;
  },

  async create(data: Omit<NewPost, 'id' | 'createdAt' | 'updatedAt'>, accessToken?: string): Promise<Post> {
    const client = getSupabaseClient(accessToken);
    const { data: result, error } = await client
      .from('posts')
      .insert({
        title: data.title,
        body: data.body,
        user_id: data.userId,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: result.id,
      title: result.title,
      body: result.body,
      userId: result.user_id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    } as Post;
  },

  async update(id: string, data: Partial<Omit<NewPost, 'id' | 'createdAt'>>, accessToken?: string): Promise<Post | undefined> {
    const client = getSupabaseClient(accessToken);
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.title) updateData.title = data.title;
    if (data.body) updateData.body = data.body;
    if (data.userId) updateData.user_id = data.userId;

    const { data: result, error } = await client.from('posts').update(updateData).eq('id', id).select().single();

    if (error) throw error;
    return {
      id: result.id,
      title: result.title,
      body: result.body,
      userId: result.user_id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    } as Post;
  },

  async delete(id: string, accessToken?: string): Promise<void> {
    const client = getSupabaseClient(accessToken);
    const { error } = await client.from('posts').delete().eq('id', id);
    if (error) throw error;
  },
};
