import { supabase } from '~/db/connection';
import { createClient } from '@supabase/supabase-js';
import type { Page, NewPage } from '~/db/schema';
import { menuItemsService } from './menu-items.service';

export type PageWithParent = Page & { parent: { title: string } | null };

const getAuthenticatedClient = async (accessToken?: string, refreshToken?: string) => {
  if (!accessToken) {
    return supabase;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const client = createClient(supabaseUrl, supabaseKey);

  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken || '',
  });

  if (error) {
    console.error('Error setting session:', error);
    return supabase;
  }

  return client;
};

const RESERVED_SLUGS = [
  'admin',
  'api',
  'login',
  'signup',
  'profile',
];

export const pagesService = {
  async getAll(): Promise<PageWithParent[]> {
    console.log('[PagesService] getAll - starting query');
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('[PagesService] getAll - query result:', { hasData: !!data, hasError: !!error });
    if (error) throw error;

    const pages = data || [];
    console.log('[PagesService] getAll - pages count:', pages.length);
    const pageMap = new Map(pages.map((p: any) => [p.id, p]));

    return pages.map((page: any) => {
      const parentPage = page.parent_id ? pageMap.get(page.parent_id) : null;
      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        parentId: page.parent_id,
        content: page.content || [],
        status: page.status,
        createdAt: page.created_at,
        updatedAt: page.updated_at,
        parent: parentPage ? { title: parentPage.title } : null,
      };
    }) as PageWithParent[];
  },

  async getById(id: string): Promise<Page | undefined> {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return undefined;

    const page = data as any;
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      parentId: page.parent_id,
      content: page.content || [],
      status: page.status,
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    } as Page;
  },

  async getBySlug(slug: string): Promise<Page | undefined> {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw error;
    if (!data) return undefined;

    const page = data as any;
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      parentId: page.parent_id,
      content: page.content || [],
      status: page.status,
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    } as Page;
  },

  async validateSlug(slug: string, excludeId?: string): Promise<boolean> {
    if (RESERVED_SLUGS.includes(slug)) {
      return false;
    }

    let query = supabase.from('pages').select('id').eq('slug', slug);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return !data;
  },

  async create(
    data: Omit<NewPage, 'id' | 'createdAt' | 'updatedAt'>,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Page> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);

    const isValid = await this.validateSlug(data.slug);
    if (!isValid) {
      throw new Error('Slug is already in use or reserved');
    }

    const { data: result, error } = await client
      .from('pages')
      .insert({
        title: data.title,
        slug: data.slug,
        parent_id: data.parentId || null,
        content: data.content || [],
        status: data.status || 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: result.id,
      title: result.title,
      slug: result.slug,
      parentId: result.parent_id,
      content: result.content || [],
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    } as Page;
  },

  async update(
    id: string,
    data: Partial<Omit<NewPage, 'id' | 'createdAt'>>,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Page | undefined> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);

    const oldPage = await this.getById(id);
    const wasPublished = oldPage?.status === 'published';
    const isNowPublished = data.status === 'published';

    if (data.slug) {
      const isValid = await this.validateSlug(data.slug, id);
      if (!isValid) {
        throw new Error('Slug is already in use or reserved');
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.parentId !== undefined) updateData.parent_id = data.parentId;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.status !== undefined) updateData.status = data.status;

    const { data: result, error } = await client
      .from('pages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const updatedPage = {
      id: result.id,
      title: result.title,
      slug: result.slug,
      parentId: result.parent_id,
      content: result.content || [],
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    } as Page;

    if (!wasPublished && isNowPublished) {
      const menuItems = await menuItemsService.getAll('main');
      const pageUrl = `/${updatedPage.slug}`;
      const isInMenu = menuItems.some((item) => item.url === pageUrl);

      if (!isInMenu) {
        const maxPosition = menuItems.reduce((max, item) => Math.max(max, item.position), 0);
        await menuItemsService.create(
          {
            menuName: 'main',
            label: updatedPage.title,
            url: pageUrl,
            parentId: null,
            position: maxPosition + 1,
            icon: null,
            target: '_self',
          },
          accessToken,
          refreshToken
        );
      }
    }

    return updatedPage;
  },

  async delete(id: string, accessToken?: string, refreshToken?: string): Promise<void> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);

    const { data: children } = await client
      .from('pages')
      .select('id')
      .eq('parent_id', id);

    if (children && children.length > 0) {
      throw new Error('Cannot delete page with child pages');
    }

    const { error } = await client.from('pages').delete().eq('id', id);
    if (error) throw error;
  },

  async getHierarchy(): Promise<PageWithParent[]> {
    const pages = await this.getAll();
    return pages;
  },
};
