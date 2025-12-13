import { supabase } from '~/db/connection';
import { createClient } from '@supabase/supabase-js';
import type { Event, NewEvent } from '~/db/schema';

export type EventWithUser = Event & { user: { displayName: string; email: string } };

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

export const eventsService = {
  async getAll(filters?: { userId?: string; locationType?: string; upcoming?: boolean }): Promise<EventWithUser[]> {
    let query = supabase
      .from('events')
      .select(
        `
        *,
        user:users!events_user_id_fkey(display_name, email)
      `
      )
      .order('start_date', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.locationType) {
      query = query.eq('location_type', filters.locationType);
    }

    if (filters?.upcoming) {
      query = query.gte('start_date', new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map((event: any) => ({
      id: event.id,
      title: event.title,
      body: event.body,
      startDate: event.start_date,
      endDate: event.end_date,
      locationType: event.location_type,
      address: event.address,
      city: event.city,
      country: event.country,
      longitude: event.longitude,
      latitude: event.latitude,
      onlineUrl: event.online_url,
      userId: event.user_id,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
      user: {
        displayName: event.user.display_name,
        email: event.user.email,
      },
    })) as EventWithUser[];
  },

  async getUpcoming(limit: number = 3): Promise<EventWithUser[]> {
    const { data, error } = await supabase
      .from('events')
      .select(
        `
        *,
        user:users!events_user_id_fkey(display_name, email)
      `
      )
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((event: any) => ({
      id: event.id,
      title: event.title,
      body: event.body,
      startDate: event.start_date,
      endDate: event.end_date,
      locationType: event.location_type,
      address: event.address,
      city: event.city,
      country: event.country,
      longitude: event.longitude,
      latitude: event.latitude,
      onlineUrl: event.online_url,
      userId: event.user_id,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
      user: {
        displayName: event.user.display_name,
        email: event.user.email,
      },
    })) as EventWithUser[];
  },

  async getById(id: string): Promise<EventWithUser | undefined> {
    const { data, error } = await supabase
      .from('events')
      .select(
        `
        *,
        user:users!events_user_id_fkey(display_name, email)
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
      startDate: data.start_date,
      endDate: data.end_date,
      locationType: data.location_type,
      address: data.address,
      city: data.city,
      country: data.country,
      longitude: data.longitude,
      latitude: data.latitude,
      onlineUrl: data.online_url,
      userId: data.user_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      user: {
        displayName: (data.user as any).display_name,
        email: (data.user as any).email,
      },
    } as EventWithUser;
  },

  async create(data: Omit<NewEvent, 'id' | 'createdAt' | 'updatedAt'>, accessToken?: string, refreshToken?: string): Promise<Event> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);
    const { data: result, error } = await client
      .from('events')
      .insert({
        title: data.title,
        body: data.body,
        start_date: data.startDate,
        end_date: data.endDate,
        location_type: data.locationType,
        address: data.address,
        city: data.city,
        country: data.country,
        longitude: data.longitude,
        latitude: data.latitude,
        online_url: data.onlineUrl,
        user_id: data.userId,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: result.id,
      title: result.title,
      body: result.body,
      startDate: result.start_date,
      endDate: result.end_date,
      locationType: result.location_type,
      address: result.address,
      city: result.city,
      country: result.country,
      longitude: result.longitude,
      latitude: result.latitude,
      onlineUrl: result.online_url,
      userId: result.user_id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    } as Event;
  },

  async update(id: string, data: Partial<Omit<NewEvent, 'id' | 'createdAt'>>, accessToken?: string, refreshToken?: string): Promise<Event | undefined> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.title) updateData.title = data.title;
    if (data.body) updateData.body = data.body;
    if (data.startDate) updateData.start_date = data.startDate;
    if (data.endDate) updateData.end_date = data.endDate;
    if (data.locationType) updateData.location_type = data.locationType;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.onlineUrl !== undefined) updateData.online_url = data.onlineUrl;
    if (data.userId) updateData.user_id = data.userId;

    const { data: result, error } = await client.from('events').update(updateData).eq('id', id).select().single();

    if (error) throw error;
    return {
      id: result.id,
      title: result.title,
      body: result.body,
      startDate: result.start_date,
      endDate: result.end_date,
      locationType: result.location_type,
      address: result.address,
      city: result.city,
      country: result.country,
      longitude: result.longitude,
      latitude: result.latitude,
      onlineUrl: result.online_url,
      userId: result.user_id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    } as Event;
  },

  async delete(id: string, accessToken?: string, refreshToken?: string): Promise<void> {
    const client = await getAuthenticatedClient(accessToken, refreshToken);
    const { error } = await client.from('events').delete().eq('id', id);
    if (error) throw error;
  },
};

