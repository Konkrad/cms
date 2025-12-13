import type { RequestHandler } from '@builder.io/qwik-city';
import { postsService } from '~/services/posts.service';

export const onGet: RequestHandler = async ({ url, json }) => {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const sort = url.searchParams.get('sort') || 'desc';

    const posts = await postsService.getAll();

    const sortedPosts = sort === 'asc'
      ? posts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      : posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const limitedPosts = sortedPosts.slice(0, limit);

    json(200, limitedPosts);
  } catch (error) {
    console.error('API error fetching posts:', error);
    json(500, { error: 'Failed to fetch posts' });
  }
};
