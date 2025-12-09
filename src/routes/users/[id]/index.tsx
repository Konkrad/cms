import { component$ } from '@builder.io/qwik';
import { Link, routeLoader$ } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';
import { postsService } from '~/services/posts.service';
import { eventsService } from '~/services/events.service';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { format } from 'date-fns';

export const useUser = routeLoader$(async ({ params }) => {
  const user = await usersService.getById(params.id);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
});

export const useUserPosts = routeLoader$(async ({ params }) => {
  return await postsService.getAll(params.id);
});

export const useUserEvents = routeLoader$(async ({ params }) => {
  return await eventsService.getAll({ userId: params.id });
});

export default component$(() => {
  const user = useUser();
  const posts = useUserPosts();
  const events = useUserEvents();

  return (
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="mb-8">
        <Link href="/users">
          <Button variant="secondary">← Back to Users</Button>
        </Link>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-1">
          <Card>
            <div class="flex justify-between items-start mb-4">
              <h1 class="text-2xl font-bold text-gray-900">{user.value.displayName}</h1>
              <Link href={`/users/${user.value.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            </div>

            <div class="space-y-3">
              <div>
                <p class="text-sm text-gray-500">Email</p>
                <p class="text-gray-900">{user.value.email}</p>
              </div>

              {user.value.city && (
                <div>
                  <p class="text-sm text-gray-500">City</p>
                  <p class="text-gray-900">{user.value.city}</p>
                </div>
              )}

              {user.value.country && (
                <div>
                  <p class="text-sm text-gray-500">Country</p>
                  <p class="text-gray-900">{user.value.country}</p>
                </div>
              )}

              {(user.value.latitude || user.value.longitude) && (
                <div>
                  <p class="text-sm text-gray-500">Coordinates</p>
                  <p class="text-gray-900">
                    {user.value.latitude}, {user.value.longitude}
                  </p>
                </div>
              )}

              {user.value.yearOfBirth && (
                <div>
                  <p class="text-sm text-gray-500">Year of Birth</p>
                  <p class="text-gray-900">{user.value.yearOfBirth}</p>
                </div>
              )}

              {user.value.sex && (
                <div>
                  <p class="text-sm text-gray-500">Sex</p>
                  <p class="text-gray-900 capitalize">{user.value.sex}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div class="lg:col-span-2 space-y-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Posts ({posts.value.length})</h2>
            {posts.value.length === 0 ? (
              <Card>
                <p class="text-gray-500 text-center py-4">No posts yet.</p>
              </Card>
            ) : (
              <div class="space-y-4">
                {posts.value.map((post) => (
                  <Link key={post.id} href={`/posts/${post.id}`}>
                    <Card hover>
                      <h3 class="text-lg font-semibold text-gray-900 mb-2">{post.title}</h3>
                      <p class="text-gray-600 line-clamp-2">{post.body}</p>
                      <p class="text-sm text-gray-500 mt-2">{format(new Date(post.createdAt!), 'PPP')}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Events ({events.value.length})</h2>
            {events.value.length === 0 ? (
              <Card>
                <p class="text-gray-500 text-center py-4">No events yet.</p>
              </Card>
            ) : (
              <div class="space-y-4">
                {events.value.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <Card hover>
                      <div class="flex justify-between items-start mb-2">
                        <h3 class="text-lg font-semibold text-gray-900">{event.title}</h3>
                        <span
                          class={`px-2 py-1 text-xs font-medium rounded-full ${
                            event.locationType === 'online'
                              ? 'bg-blue-100 text-blue-800'
                              : event.locationType === 'in_person'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {event.locationType}
                        </span>
                      </div>
                      <p class="text-gray-600 line-clamp-2">{event.body}</p>
                      <p class="text-sm text-gray-500 mt-2">{format(new Date(event.startDate), 'PPP p')}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
