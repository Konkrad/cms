import { supabase } from '~/db/connection';
import { createClient } from '@supabase/supabase-js';
import type { MenuItem, NewMenuItem, MenuItemTree } from '~/db/schema';

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

function buildMenuTree(items: MenuItem[]): MenuItemTree[] {
  const itemMap = new Map<string, MenuItemTree>();
  const roots: MenuItemTree[] = [];

  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  items.forEach((item) => {
    const node = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortByPosition = (a: MenuItemTree, b: MenuItemTree) => a.position - b.position;

  roots.sort(sortByPosition);
  roots.forEach((root) => {
    if (root.children) {
      root.children.sort(sortByPosition);
    }
  });

  return roots;
}

export const menuItemsService = {
  async getAll(menuName?: string): Promise<MenuItem[]> {
    let query = supabase.from('menu_items').select('*').order('position', { ascending: true });

    if (menuName) {
      query = query.eq('menu_name', menuName);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map((item: any) => ({
      id: item.id,
      menuName: item.menu_name,
      label: item.label,
      url: item.url,
      parentId: item.parent_id,
      position: item.position,
      icon: item.icon,
      target: item.target,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })) as MenuItem[];
  },

  async getMenuTree(menuName: string): Promise<MenuItemTree[]> {
    const items = await this.getAll(menuName);
    return buildMenuTree(items);
  },

  async getById(id: string): Promise<MenuItem | undefined> {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return undefined;

    return {
      id: data.id,
      menuName: data.menu_name,
      label: data.label,
      url: data.url,
      parentId: data.parent_id,
      position: data.position,
      icon: data.icon,
      target: data.target,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } as MenuItem;
  },

  async create(
    data: Omit<NewMenuItem, 'id' | 'createdAt' | 'updatedAt'>,
    accessToken?: string,
    refreshToken?: string
  ): Promise<MenuItem> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);

    const { data: existingItems } = await client
      .from('menu_items')
      .select('position')
      .eq('menu_name', data.menuName)
      .eq('parent_id', data.parentId || null)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existingItems && existingItems.length > 0 ? existingItems[0].position + 1 : 0;

    const { data: result, error } = await client
      .from('menu_items')
      .insert({
        menu_name: data.menuName,
        label: data.label,
        url: data.url,
        parent_id: data.parentId || null,
        position: data.position !== undefined ? data.position : nextPosition,
        icon: data.icon || null,
        target: data.target || '_self',
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: result.id,
      menuName: result.menu_name,
      label: result.label,
      url: result.url,
      parentId: result.parent_id,
      position: result.position,
      icon: result.icon,
      target: result.target,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    } as MenuItem;
  },

  async update(
    id: string,
    data: Partial<Omit<NewMenuItem, 'id' | 'createdAt'>>,
    accessToken?: string,
    refreshToken?: string
  ): Promise<MenuItem | undefined> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.menuName !== undefined) updateData.menu_name = data.menuName;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.parentId !== undefined) updateData.parent_id = data.parentId;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.target !== undefined) updateData.target = data.target;

    const { data: result, error } = await client
      .from('menu_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      id: result.id,
      menuName: result.menu_name,
      label: result.label,
      url: result.url,
      parentId: result.parent_id,
      position: result.position,
      icon: result.icon,
      target: result.target,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    } as MenuItem;
  },

  async delete(id: string, accessToken?: string, refreshToken?: string): Promise<void> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);
    const { error } = await client.from('menu_items').delete().eq('id', id);
    if (error) throw error;
  },

  async reorderItems(
    items: { id: string; position: number }[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<void> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);

    for (const item of items) {
      await client.from('menu_items').update({ position: item.position }).eq('id', item.id);
    }
  },

  async getMenuNames(): Promise<string[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select('menu_name')
      .order('menu_name');

    if (error) throw error;

    const uniqueNames = [...new Set((data || []).map((item: any) => item.menu_name))];
    return uniqueNames;
  },
};
