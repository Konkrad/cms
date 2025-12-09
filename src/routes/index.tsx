import { component$ } from '@builder.io/qwik';
import { Link, routeLoader$, type DocumentHead } from '@builder.io/qwik-city';
import { postsService } from '~/services/posts.service';
import { eventsService } from '~/services/events.service';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { format } from 'date-fns';

export const useRecentPosts = routeLoader$(async () => {
  return await postsService.getRecent(3);
});

export const useUpcomingEvents = routeLoader$(async () => {
  return await eventsService.getUpcoming(3);
});

export default component$(() => {
  const recentPosts = useRecentPosts();
  const upcomingEvents = useUpcomingEvents();

  return (
    <div class="max-w-7xl mx-auto px-4 py-12">
      <div class="text-center mb-16">
        <h1 class="text-5xl font-bold text-gray-900 mb-4">Welcome to Community Hub</h1>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">
          Connect with members, share posts, and join exciting events in our vibrant community
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <Link href="/users">
          <Card hover class="text-center">
            <div class="text-4xl mb-4">👥</div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Users</h2>
            <p class="text-gray-600">Browse and connect with community members</p>
          </Card>
        </Link>

        <Link href="/posts">
          <Card hover class="text-center">
            <div class="text-4xl mb-4">📝</div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Posts</h2>
            <p class="text-gray-600">Read and share community posts</p>
          </Card>
        </Link>

        <Link href="/events">
          <Card hover class="text-center">
            <div class="text-4xl mb-4">📅</div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Events</h2>
            <p class="text-gray-600">Discover and join upcoming events</p>
          </Card>
        </Link>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Recent Posts</h2>
            <Link href="/posts">
              <Button variant="secondary">View All</Button>
            </Link>
          </div>

          {recentPosts.value.length === 0 ? (
            <Card>
              <p class="text-gray-500 text-center py-8">No posts yet. Be the first to create one!</p>
            </Card>
          ) : (
            <div class="space-y-4">
              {recentPosts.value.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`}>
                  <Card hover>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">{post.title}</h3>
                    <p class="text-gray-600 line-clamp-2 mb-3">{post.body}</p>
                    <div class="flex items-center gap-2 text-sm text-gray-500">
                      <span>{post.user.displayName}</span>
                      <span>•</span>
                      <span>{format(new Date(post.createdAt!), 'PPP')}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Upcoming Events</h2>
            <Link href="/events">
              <Button variant="secondary">View All</Button>
            </Link>
          </div>

          {upcomingEvents.value.length === 0 ? (
            <Card>
              <p class="text-gray-500 text-center py-8">No upcoming events. Create one to get started!</p>
            </Card>
          ) : (
            <div class="space-y-4">
              {upcomingEvents.value.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card hover>
                    <div class="flex justify-between items-start mb-2">
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
                        {event.locationType.replace('_', ' ')}
                      </span>
                    </div>
                    <p class="text-gray-600 line-clamp-2 mb-3">{event.body}</p>
                    <div class="text-sm text-gray-500">
                      <p>{format(new Date(event.startDate), 'PPP p')}</p>
                      <p class="mt-1">{event.user.displayName}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Community Hub - Connect, Share, Participate',
  meta: [
    {
      name: 'description',
      content: 'A vibrant community platform for connecting with members, sharing posts, and participating in events',
    },
  ],
};
