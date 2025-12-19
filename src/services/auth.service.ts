import { db } from "~/db/connection";
import { users } from "~/db/schemas/users";
import { eq } from "drizzle-orm";
import type { User, NewUser } from "~/db/schemas/users";

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  family_name: string;
  city?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
  year_of_birth?: number;
  sex?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Simple in-memory session store (replace with Redis or DB for production)
const sessions = new Map<string, string>();

function generateSessionToken(): string {
  return (
    Math.random().toString(36).substring(2) +
    Math.random().toString(36).substring(2)
  );
}

export const authService = {
  async signUp(data: SignUpData): Promise<User> {
    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email));
    if (existing.length > 0) {
      throw new Error("User already exists");
    }

    // Store password as plain text for demo only (never do this in production!)
    // Use bcrypt or argon2 for real password hashing.
    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: data.email,
        name: data.name,
        familyName: data.family_name,
        displayName: data.name,
        password: data.password,
        city: data.city,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        yearOfBirth: data.year_of_birth,
        sex: data.sex,
        role: "user",
      } as any)
      .returning();

    return user;
  },

  async signIn(data: SignInData): Promise<{ token: string; user: User }> {
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email));
    if (found.length === 0) {
      throw new Error("Invalid email or password");
    }
    const user = found[0] as User & { password?: string };
    // Plain text password check (replace with hash check in production)
    if (user.password !== data.password) {
      throw new Error("Invalid email or password");
    }
    const token = generateSessionToken();
    sessions.set(token, user.id);
    return { token, user };
  },

  async signOut(token: string) {
    sessions.delete(token);
  },

  async getCurrentUser(token: string): Promise<User | null> {
    const userId = sessions.get(token);
    if (!userId) return null;
    const found = await db.select().from(users).where(eq(users.id, userId));
    return found.length > 0 ? (found[0] as User) : null;
  },

  // For demo: get session token for a user (not secure)
  getSessionUserId(token: string): string | undefined {
    return sessions.get(token);
  },
};
