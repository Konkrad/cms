import { db } from '~/db/connection';
import { users, type User, type NewUser } from '~/db/schema';
import { eq } from 'drizzle-orm';

export const usersService = {
  async getAll(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  },

  async getById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  },

  async create(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const displayName = `${data.name} ${data.familyName}`;
    const result = await db
      .insert(users)
      .values({
        ...data,
        displayName,
      })
      .returning();
    return result[0];
  },

  async update(id: string, data: Partial<Omit<NewUser, 'id' | 'createdAt'>>): Promise<User | undefined> {
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.name || data.familyName) {
      const user = await this.getById(id);
      if (user) {
        const newName = data.name || user.name;
        const newFamilyName = data.familyName || user.familyName;
        updateData.displayName = `${newName} ${newFamilyName}`;
      }
    }

    const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return result[0];
  },

  async delete(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  },
};
