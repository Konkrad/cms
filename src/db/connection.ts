import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = import.meta.env.VITE_SUPABASE_URL
  ? `postgresql://postgres:postgres@${new URL(import.meta.env.VITE_SUPABASE_URL).hostname}:5432/postgres`
  : 'postgresql://postgres:postgres@localhost:5432/postgres';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
