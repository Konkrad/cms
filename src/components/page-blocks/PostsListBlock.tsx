import { component$, useTask$, useSignal } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { format } from 'date-fns';
import type { BlockDefinition } from '~/db/schema';

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

export default component$<PostsListBlockProps>((props) => {
  const { limit = 6, sortOrder = 'desc' } = props;
  const posts = useSignal<any[]>([]);
  const isLoading = useSignal(true);

  useTask$(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('sort', sortOrder);

      const response = await fetch(`/api/posts?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        posts.value = data;
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      isLoading.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      <h2 class="text-3xl font-bold text-gray-900 mb-8">Latest Posts</h2>

      {isLoading.value ? (
        <div class="text-center py-12">
          <p class="text-gray-500">Loading posts...</p>
        </div>
      ) : posts.value.length === 0 ? (
        <Card>
          <p class="text-gray-500 text-center py-8">No posts found.</p>
        </Card>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.value.map((post: any) => (
            <Link key={post.id} href={`/posts/${post.id}`}>
              <Card hover>
                <h3 class="text-xl font-semibold text-gray-900 mb-3">{post.title}</h3>
                <p class="text-gray-600 line-clamp-3 mb-4">{post.body}</p>
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  {post.user && <span>{post.user.displayName}</span>}
                  <span>•</span>
                  <span>{format(new Date(post.createdAt), 'PPP')}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
