import { supabase } from '~/db/connection';
import type { User, NewUser } from '~/db/schema';

export const usersService = {
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((user: any) => ({
      id: user.id,
      name: user.name,
      familyName: user.family_name,
      displayName: user.display_name,
      email: user.email,
      city: user.city,
      country: user.country,
      longitude: user.longitude,
      latitude: user.latitude,
      yearOfBirth: user.year_of_birth,
      sex: user.sex,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })) as User[];
  },

  async getById(id: string): Promise<User | undefined> {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();

    if (error) throw error;
    if (!data) return undefined;

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
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    } as User;
  },

  async create(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const displayName = `${data.name} ${data.familyName}`;

    const { data: result, error } = await supabase
      .from('users')
      .insert({
        name: data.name,
        family_name: data.familyName,
        display_name: displayName,
        email: data.email,
        city: data.city,
        country: data.country,
        longitude: data.longitude,
        latitude: data.latitude,
        year_of_birth: data.yearOfBirth,
        sex: data.sex,
      })
      .select()
      .single();

    if (error) throw error;
    const userData = result as any;
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
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    } as User;
  },

  async update(id: string, data: Partial<Omit<NewUser, 'id' | 'createdAt'>>): Promise<User | undefined> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name) updateData.name = data.name;
    if (data.familyName) updateData.family_name = data.familyName;
    if (data.email) updateData.email = data.email;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.yearOfBirth !== undefined) updateData.year_of_birth = data.yearOfBirth;
    if (data.sex !== undefined) updateData.sex = data.sex;

    if (data.name || data.familyName) {
      const user = await this.getById(id);
      if (user) {
        const newName = data.name || user.name;
        const newFamilyName = data.familyName || user.familyName;
        updateData.display_name = `${newName} ${newFamilyName}`;
      }
    }

    const { data: result, error } = await supabase.from('users').update(updateData).eq('id', id).select().single();

    if (error) throw error;
    const userData = result as any;
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
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    } as User;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },
};
