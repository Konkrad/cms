import type { RequestHandler } from '@builder.io/qwik-city';
import { eventsService } from '~/services/events.service';
import { z } from 'zod';

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  locationType: z.enum(['online', 'in_person', 'hybrid']).optional(),
  address: z.string().optional(),
  longitude: z.string().optional(),
  latitude: z.string().optional(),
  onlineUrl: z.string().url().optional().or(z.literal('')),
  userId: z.string().uuid().optional(),
});

export const onGet: RequestHandler = async ({ params, json }) => {
  const event = await eventsService.getById(params.id);

  if (!event) {
    json(404, { error: 'Event not found' });
    return;
  }

  json(200, event);
};

export const onPut: RequestHandler = async ({ params, request, json }) => {
  try {
    const body = await request.json();
    const validated = updateEventSchema.parse(body);

    const updateData: any = {
      title: validated.title,
      body: validated.body,
      startDate: validated.startDate ? new Date(validated.startDate) : undefined,
      endDate: validated.endDate ? new Date(validated.endDate) : undefined,
      locationType: validated.locationType,
      address: validated.address,
      longitude: validated.longitude,
      latitude: validated.latitude,
      onlineUrl: validated.onlineUrl || undefined,
      userId: validated.userId,
    };

    const event = await eventsService.update(params.id, updateData);

    if (!event) {
      json(404, { error: 'Event not found' });
      return;
    }

    json(200, event);
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
    await eventsService.delete(params.id);
    json(204, null);
  } catch (error) {
    json(500, { error: 'Internal server error' });
  }
};
