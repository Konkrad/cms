import type { RequestHandler } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';
import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  familyName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  longitude: z.string().optional(),
  latitude: z.string().optional(),
  yearOfBirth: z.string().optional(),
  sex: z.string().optional(),
});

export const onGet: RequestHandler = async ({ params, json }) => {
  const user = await usersService.getById(params.id);

  if (!user) {
    json(404, { error: 'User not found' });
    return;
  }

  json(200, user);
};

export const onPut: RequestHandler = async ({ params, request, json }) => {
  try {
    const body = await request.json();
    const validated = updateUserSchema.parse(body);

    const updateData: any = {
      name: validated.name,
      familyName: validated.familyName,
      email: validated.email,
      city: validated.city,
      country: validated.country,
      longitude: validated.longitude,
      latitude: validated.latitude,
      yearOfBirth: validated.yearOfBirth ? parseInt(validated.yearOfBirth) : undefined,
      sex: validated.sex,
    };

    const user = await usersService.update(params.id, updateData);

    if (!user) {
      json(404, { error: 'User not found' });
      return;
    }

    json(200, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      json(400, { error: 'Validation failed', details: error.issues });
    } else {
      json(500, { error: 'Internal server error' });
    }
  }
};

export const onDelete: RequestHandler = async ({ params, json }) => {
  try {
    await usersService.delete(params.id);
    json(204, null);
  } catch (error) {
    json(500, { error: 'Internal server error' });
  }
};
