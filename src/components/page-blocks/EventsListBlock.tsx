import { component$, useSignal, useTask$ } from '@builder.io/qwik';
import { Link, server$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { format } from 'date-fns';
import type { BlockDefinition } from '~/db/schema';
import { eventsService, type EventWithUser } from '~/services/events.service';

interface EventsListBlockProps {
  limit?: number;
  showPast?: boolean;
  sortOrder?: 'asc' | 'desc';
}

export const definition: BlockDefinition = {
  name: 'Events List',
  componentType: 'EventsListBlock',
  category: 'dynamic',
  icon: '📅',
  configSchema: [
    {
      name: 'limit',
      label: 'Number of Events',
      type: 'number',
      defaultValue: 6,
    },
    {
      name: 'showPast',
      label: 'Show Past Events',
      type: 'boolean',
      defaultValue: false,
    },
    {
      name: 'sortOrder',
      label: 'Sort Order',
      type: 'select',
      defaultValue: 'asc',
      options: [
        { label: 'Oldest First', value: 'asc' },
        { label: 'Newest First', value: 'desc' },
      ],
    },
  ],
  defaultData: {
    limit: 6,
    showPast: false,
    sortOrder: 'asc',
  },
};

const fetchEvents = server$(async (options: { limit: number; showPast: boolean; sortOrder: string }) => {
  const events = await eventsService.getAll({ upcoming: !options.showPast });

  const sortedEvents =
    options.sortOrder === 'asc'
      ? events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      : events.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return sortedEvents.slice(0, options.limit);
});

export default component$<EventsListBlockProps>((props) => {
  const events = useSignal<EventWithUser[]>([]);
  const isLoading = useSignal(true);
  const error = useSignal<string | null>(null);

  useTask$(async () => {
    try {
      const result = await fetchEvents({
        limit: props.limit ?? 6,
        showPast: props.showPast ?? false,
        sortOrder: props.sortOrder ?? 'asc',
      });
      events.value = result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load events';
    } finally {
      isLoading.value = false;
    }
  });

  const showPast = props.showPast ?? false;

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      <h2 class="text-3xl font-bold text-gray-900 mb-8">{showPast ? 'Events' : 'Upcoming Events'}</h2>

      {isLoading.value ? (
        <div class="text-center py-12">
          <p class="text-gray-500">Loading events...</p>
        </div>
      ) : error.value ? (
        <Card>
          <p class="text-red-500 text-center py-8">Failed to load events: {error.value}</p>
        </Card>
      ) : events.value.length === 0 ? (
        <Card>
          <p class="text-gray-500 text-center py-8">No events found.</p>
        </Card>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.value.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card hover>
                <div class="flex justify-between items-start mb-3">
                  <h3 class="text-lg font-semibold text-gray-900 flex-1">{event.title}</h3>
                  <span
                    class={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ml-2 ${
                      event.locationType === 'online'
                        ? 'bg-blue-100 text-blue-800'
                        : event.locationType === 'in_person'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {event.locationType?.replace('_', ' ')}
                  </span>
                </div>
                <p class="text-gray-600 line-clamp-2 mb-3">{event.body}</p>
                <div class="text-sm text-gray-500">
                  <p>{format(new Date(event.startDate), 'PPP p')}</p>
                  {event.user && <p class="mt-1">{event.user.displayName}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
