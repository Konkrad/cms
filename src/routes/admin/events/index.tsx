import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { supabase } from '~/db/connection';
import { format } from 'date-fns';

export const useEvents = routeLoader$(async () => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      users (display_name)
    `)
    .order('start_date', { ascending: false });

  if (error) throw error;
  return (data || []) as any[];
});

export const useDeleteEvent = routeAction$(
  async (data) => {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', data.eventId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  },
  zod$({
    eventId: z.string(),
  })
);

export default component$(() => {
  const events = useEvents();
  const deleteEventAction = useDeleteEvent();

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Manage Events</h2>
        <a href="/events/new">
          <Button variant="primary">Create New Event</Button>
        </a>
      </div>

      {deleteEventAction.value?.success && (
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Event deleted successfully
        </div>
      )}

      {deleteEventAction.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {deleteEventAction.value.error}
        </div>
      )}

      <Card>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Date
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location Type
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creator
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {events.value.map((event) => (
                <tr key={event.id}>
                  <td class="px-6 py-4">
                    <div class="max-w-xs truncate">{event.title}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(event.start_date), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {event.location_type}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {event.users?.display_name || 'Unknown'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <div class="flex gap-2">
                      <a
                        href={`/events/${event.id}`}
                        class="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </a>
                      <a
                        href={`/events/${event.id}/edit`}
                        class="text-green-600 hover:text-green-900"
                      >
                        Edit
                      </a>
                      <Form action={deleteEventAction} class="inline">
                        <input type="hidden" name="eventId" value={event.id} />
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          onClick$={(e) => {
                            if (!confirm('Are you sure you want to delete this event?')) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
});
