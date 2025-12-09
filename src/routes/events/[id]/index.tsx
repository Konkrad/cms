import { component$ } from '@builder.io/qwik';
import { Link, routeLoader$ } from '@builder.io/qwik-city';
import { eventsService } from '~/services/events.service';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { format } from 'date-fns';

export const useEvent = routeLoader$(async ({ params }) => {
  const event = await eventsService.getById(params.id);
  if (!event) {
    throw new Error('Event not found');
  }
  return event;
});

export default component$(() => {
  const event = useEvent();

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="mb-8">
        <Link href="/events">
          <Button variant="secondary">← Back to Events</Button>
        </Link>
      </div>

      <Card>
        <div class="flex justify-between items-start mb-6">
          <div class="flex-1">
            <div class="flex items-start gap-4 mb-4">
              <h1 class="text-3xl font-bold text-gray-900 flex-1">{event.value.title}</h1>
              <span
                class={`px-3 py-1 text-sm font-medium rounded-full whitespace-nowrap ${
                  event.value.locationType === 'online'
                    ? 'bg-blue-100 text-blue-800'
                    : event.value.locationType === 'in_person'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-purple-100 text-purple-800'
                }`}
              >
                {event.value.locationType.replace('_', ' ')}
              </span>
            </div>
            <div class="flex items-center gap-4 text-sm text-gray-500">
              <Link href={`/users/${event.value.userId}`} class="hover:text-blue-500">
                Organized by {event.value.user.displayName}
              </Link>
            </div>
          </div>
          <Link href={`/events/${event.value.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        </div>

        <div class="border-t border-gray-200 pt-6 space-y-4">
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-1">Description</h3>
            <p class="text-gray-700 whitespace-pre-wrap">{event.value.body}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 class="text-sm font-medium text-gray-500 mb-1">Start Date & Time</h3>
              <p class="text-gray-900">{format(new Date(event.value.startDate), 'PPP p')}</p>
            </div>

            <div>
              <h3 class="text-sm font-medium text-gray-500 mb-1">End Date & Time</h3>
              <p class="text-gray-900">{format(new Date(event.value.endDate), 'PPP p')}</p>
            </div>
          </div>

          {event.value.address && (
            <div>
              <h3 class="text-sm font-medium text-gray-500 mb-1">Address</h3>
              <p class="text-gray-900">{event.value.address}</p>
              {(event.value.latitude || event.value.longitude) && (
                <p class="text-sm text-gray-500 mt-1">
                  Coordinates: {event.value.latitude}, {event.value.longitude}
                </p>
              )}
            </div>
          )}

          {event.value.onlineUrl && (
            <div>
              <h3 class="text-sm font-medium text-gray-500 mb-1">Online Meeting Link</h3>
              <a
                href={event.value.onlineUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-500 hover:text-blue-600 underline"
              >
                {event.value.onlineUrl}
              </a>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
});
