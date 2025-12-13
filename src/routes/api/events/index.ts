import type { RequestHandler } from '@builder.io/qwik-city';
import { eventsService } from '~/services/events.service';

export const onGet: RequestHandler = async ({ url, json }) => {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const upcoming = url.searchParams.get('upcoming') === 'true';
    const sort = url.searchParams.get('sort') || 'desc';

    const events = await eventsService.getAll({ upcoming });

    const sortedEvents = sort === 'asc'
      ? events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      : events.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const limitedEvents = sortedEvents.slice(0, limit);

    json(200, limitedEvents);
  } catch (error) {
    console.error('API error fetching events:', error);
    json(500, { error: 'Failed to fetch events' });
  }
};
