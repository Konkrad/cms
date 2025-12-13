import type { RequestEventBase } from '@builder.io/qwik-city';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../db/connection';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export async function getServerSession(event: RequestEventBase) {
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

export async function getCurrentUserData(event: RequestEventBase) {
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

  return data;
}

export async function isAdmin(event: RequestEventBase): Promise<boolean> {
  const userData = await getCurrentUserData(event);

  if (!userData) {
    return false;
  }

  return userData.role === 'admin' || userData.role === 'community_manager';
}

export async function requireAuth(event: RequestEventBase) {
  const user = await getServerSession(event);

  if (!user) {
    throw event.redirect(302, '/login');
  }

  return user;
}

export async function requireAdmin(event: RequestEventBase) {
  const user = await requireAuth(event);
  const adminStatus = await isAdmin(event);

  if (!adminStatus) {
    throw event.redirect(302, '/');
  }

  return user;
}
