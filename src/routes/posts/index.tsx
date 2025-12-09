import { component$ } from '@builder.io/qwik';
import { Link, routeLoader$ } from '@builder.io/qwik-city';
import { postsService } from '~/services/posts.service';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { format } from 'date-fns';

export const usePosts = routeLoader$(async () => {
  return await postsService.getAll();
});

export default component$(() => {
  const posts = usePosts();

  return (
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Posts</h1>
        <Link href="/posts/new">
          <Button>Create New Post</Button>
        </Link>
      </div>

      {posts.value.length === 0 ? (
        <Card>
          <p class="text-gray-500 text-center py-8">No posts found. Create your first post to get started.</p>
        </Card>
      ) : (
        <div class="space-y-4">
          {posts.value.map((post) => (
            <Link key={post.id} href={`/posts/${post.id}`}>
              <Card hover>
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h2 class="text-xl font-semibold text-gray-900 mb-2">{post.title}</h2>
                    <p class="text-gray-600 mb-3 line-clamp-2">{post.body}</p>
                    <div class="flex items-center gap-4 text-sm text-gray-500">
                      <span>By {post.user.displayName}</span>
                      <span>•</span>
                      <span>{format(new Date(post.createdAt!), 'PPP')}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
