import type { RequestHandler } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  familyName: z.string().min(1, 'Family name is required'),
  email: z.string().email('Invalid email address'),
  city: z.string().optional(),
  country: z.string().optional(),
  longitude: z.string().optional(),
  latitude: z.string().optional(),
  yearOfBirth: z.string().optional(),
  sex: z.string().optional(),
});

export const onGet: RequestHandler = async ({ json }) => {
  const users = await usersService.getAll();
  json(200, users);
};

export const onPost: RequestHandler = async ({ request, json }) => {
  try {
    const body = await request.json();
    const validated = createUserSchema.parse(body);

    const user = await usersService.create({
      name: validated.name,
      familyName: validated.familyName,
      email: validated.email,
      city: validated.city,
      country: validated.country,
      longitude: validated.longitude,
      latitude: validated.latitude,
      yearOfBirth: validated.yearOfBirth ? parseInt(validated.yearOfBirth) : undefined,
      sex: validated.sex,
    });

    json(201, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      json(400, { error: 'Validation failed', details: error.issues });
    } else {
      json(500, { error: 'Internal server error' });
    }
  }
};
