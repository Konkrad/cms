import { component$ } from '@builder.io/qwik';
import { Link, routeLoader$ } from '@builder.io/qwik-city';
import { eventsService } from '~/services/events.service';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { format } from 'date-fns';

export const useEvents = routeLoader$(async () => {
  return await eventsService.getAll();
});

export default component$(() => {
  const events = useEvents();

  return (
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Events</h1>
        <Link href="/events/new">
          <Button>Create New Event</Button>
        </Link>
      </div>

      {events.value.length === 0 ? (
        <Card>
          <p class="text-gray-500 text-center py-8">No events found. Create your first event to get started.</p>
        </Card>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.value.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card hover>
                <div class="flex justify-between items-start mb-3">
                  <h2 class="text-xl font-semibold text-gray-900 flex-1">{event.title}</h2>
                  <span
                    class={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ml-2 ${
                      event.locationType === 'online'
                        ? 'bg-blue-100 text-blue-800'
                        : event.locationType === 'in_person'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {event.locationType.replace('_', ' ')}
                  </span>
                </div>
                <p class="text-gray-600 mb-3 line-clamp-2">{event.body}</p>
                <div class="space-y-1 text-sm text-gray-500">
                  <p>
                    <span class="font-medium">Starts:</span> {format(new Date(event.startDate), 'PPP p')}
                  </p>
                  <p>
                    <span class="font-medium">By:</span> {event.user.displayName}
                  </p>
                  {event.address && (
                    <p>
                      <span class="font-medium">Location:</span> {event.address}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
