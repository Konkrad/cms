import { component$, useResource$, Resource } from '@builder.io/qwik';
import { Link, server$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { format } from 'date-fns';
import type { BlockDefinition } from '~/db/schema';
import { postsService } from '~/services/posts.service';

interface PostsListBlockProps {
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export const definition: BlockDefinition = {
  name: 'Posts List',
  componentType: 'PostsListBlock',
  category: 'dynamic',
  icon: '📰',
  configSchema: [
    {
      name: 'limit',
      label: 'Number of Posts',
      type: 'number',
      defaultValue: 6,
    },
    {
      name: 'sortOrder',
      label: 'Sort Order',
      type: 'select',
      defaultValue: 'desc',
      options: [
        { label: 'Oldest First', value: 'asc' },
        { label: 'Newest First', value: 'desc' },
      ],
    },
  ],
  defaultData: {
    limit: 6,
    sortOrder: 'desc',
  },
};

const fetchPosts = server$(async (limit: number, sortOrder: string) => {
  const posts = await postsService.getAll();

  const sortedPosts =
    sortOrder === 'asc'
      ? posts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      : posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return sortedPosts.slice(0, limit);
});

export default component$<PostsListBlockProps>((props) => {
  const { limit = 6, sortOrder = 'desc' } = props;

  const postsResource = useResource$(async () => {
    return fetchPosts(limit, sortOrder);
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      <h2 class="text-3xl font-bold text-gray-900 mb-8">Latest Posts</h2>

      <Resource
        value={postsResource}
        onPending={() => (
          <div class="text-center py-12">
            <p class="text-gray-500">Loading posts...</p>
          </div>
        )}
        onRejected={(error) => (
          <Card>
            <p class="text-red-500 text-center py-8">Failed to load posts: {error.message}</p>
          </Card>
        )}
        onResolved={(posts) =>
          posts.length === 0 ? (
            <Card>
              <p class="text-gray-500 text-center py-8">No posts found.</p>
            </Card>
          ) : (
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`}>
                  <Card hover>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">{post.title}</h3>
                    <p class="text-gray-600 line-clamp-3 mb-4">{post.body}</p>
                    <div class="flex items-center gap-2 text-sm text-gray-500">
                      {post.user && <span>{post.user.displayName}</span>}
                      <span>-</span>
                      <span>{format(new Date(post.createdAt), 'PPP')}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )
        }
      />
    </div>
  );
});
