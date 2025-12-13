import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { getAllEvents } from '~/services/events.service';
import { format } from 'date-fns/format';
import { Button } from '~/components/ui/Button';

export const useEvents = routeLoader$(async () => {
  const events = await getAllEvents();
  return events;
});

export default component$(() => {
  const events = useEvents();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Events</h2>
        <a href="/admin/events/new">
          <Button>Create New Event</Button>
        </a>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organizer
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {events.value.map((event) => (
              <tr key={event.id} class="hover:bg-gray-50">
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">
                    {event.title}
                  </div>
                  <div class="text-sm text-gray-500 line-clamp-1">
                    {event.description}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    {event.city && event.country
                      ? `${event.city}, ${event.country}`
                      : event.location}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    {event.organizer_name}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    {format(new Date(event.event_date), 'MMM d, yyyy')}
                  </div>
                  <div class="text-sm text-gray-500">{event.event_time}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <a
                    href={`/admin/events/${event.id}/edit`}
                    class="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.value.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            No events found. Create your first event!
          </div>
        )}
      </div>
    </div>
  );
});
