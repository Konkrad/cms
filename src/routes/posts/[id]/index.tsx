import { component$ } from '@builder.io/qwik';
import { Link, routeLoader$ } from '@builder.io/qwik-city';
import { postsService } from '~/services/posts.service';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { format } from 'date-fns';

export const usePost = routeLoader$(async ({ params }) => {
  const post = await postsService.getById(params.id);
  if (!post) {
    throw new Error('Post not found');
  }
  return post;
});

export default component$(() => {
  const post = usePost();

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="mb-8">
        <Link href="/posts">
          <Button variant="secondary">← Back to Posts</Button>
        </Link>
      </div>

      <Card>
        <div class="flex justify-between items-start mb-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 mb-4">{post.value.title}</h1>
            <div class="flex items-center gap-4 text-sm text-gray-500">
              <Link href={`/users/${post.value.userId}`} class="hover:text-blue-500">
                By {post.value.user.displayName}
              </Link>
              <span>•</span>
              <span>{format(new Date(post.value.createdAt!), 'PPP')}</span>
            </div>
          </div>
          <Link href={`/posts/${post.value.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        </div>

        <div class="prose max-w-none">
          <p class="text-gray-700 whitespace-pre-wrap">{post.value.body}</p>
        </div>
      </Card>
    </div>
  );
});
