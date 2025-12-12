import { createClient } from '@supabase/supabase-js';

let supabase: ReturnType<typeof createClient>;

if (typeof window === 'undefined') {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  supabase = null as any;
}

export { supabase };
