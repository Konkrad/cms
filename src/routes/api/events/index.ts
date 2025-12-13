import type { RequestHandler } from '@builder.io/qwik-city';
import { eventsService } from '~/services/events.service';
import { z } from 'zod';
import { isAdmin } from '~/utils/server-auth';

const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  locationType: z.enum(['online', 'in_person', 'hybrid']),
  address: z.string().optional(),
  longitude: z.string().optional(),
  latitude: z.string().optional(),
  onlineUrl: z.string().url().optional().or(z.literal('')),
  userId: z.string().uuid('Invalid user ID'),
});

export const onGet: RequestHandler = async ({ query, json }) => {
  const userId = query.get('userId') || undefined;
  const locationType = query.get('locationType') || undefined;
  const upcoming = query.get('upcoming') === 'true';

  const events = await eventsService.getAll({ userId, locationType, upcoming });
  json(200, events);
};

export const onPost: RequestHandler = async (event) => {
  const { request, json } = event;

  const adminStatus = await isAdmin(event);
  if (!adminStatus) {
    json(403, { error: 'Forbidden: Admin access required' });
    return;
  }

  try {
    const body = await request.json();
    const validated = createEventSchema.parse(body);

    const eventData = await eventsService.create({
      title: validated.title,
      body: validated.body,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
      locationType: validated.locationType,
      address: validated.address,
      longitude: validated.longitude,
      latitude: validated.latitude,
      onlineUrl: validated.onlineUrl || undefined,
      userId: validated.userId,
    });

    json(201, eventData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      json(400, { error: 'Validation failed', details: error.issues });
    } else {
      json(500, { error: 'Internal server error' });
    }
  }
};
