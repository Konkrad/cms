import type { RequestEventLoader, RequestEventAction, RequestEventCommon } from '@builder.io/qwik-city';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../db/connection';
import type { User } from '../db/schema';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export type RequestEvent = RequestEventLoader | RequestEventAction | RequestEventCommon;

export async function getServerSession(event: RequestEvent) {
  const accessToken = event.cookie.get('sb-access-token')?.value;

  if (!accessToken) {
    return null;
  }

  const serverSupabase = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error } = await serverSupabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getCurrentUserData(event: RequestEvent): Promise<User | null> {
  const user = await getServerSession(event);

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const userData = data as any;
  return {
    id: userData.id,
    name: userData.name,
    familyName: userData.family_name,
    displayName: userData.display_name,
    email: userData.email,
    city: userData.city,
    country: userData.country,
    longitude: userData.longitude,
    latitude: userData.latitude,
    yearOfBirth: userData.year_of_birth,
    sex: userData.sex,
    role: userData.role,
    createdAt: userData.created_at,
    updatedAt: userData.updated_at,
  };
}

export async function isAdmin(event: RequestEvent): Promise<boolean> {
  const userData = await getCurrentUserData(event);

  if (!userData) {
    return false;
  }

  return userData.role === 'admin' || userData.role === 'moderator';
}

export async function requireAuth(event: RequestEvent) {
  const user = await getServerSession(event);

  if (!user) {
    throw event.redirect(302, '/login');
  }

  return user;
}

export async function requireAdmin(event: RequestEvent) {
  const user = await requireAuth(event);
  const adminStatus = await isAdmin(event);

  if (!adminStatus) {
    throw event.redirect(302, '/');
  }

  return user;
}
