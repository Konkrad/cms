import type { RequestHandler } from '@builder.io/qwik-city';
import { postsService } from '~/services/posts.service';
import { z } from 'zod';
import { isAdmin } from '~/utils/server-auth';

const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  userId: z.string().uuid('Invalid user ID'),
});

export const onGet: RequestHandler = async ({ query, json }) => {
  const userId = query.get('userId');
  const posts = await postsService.getAll(userId || undefined);
  json(200, posts);
};

export const onPost: RequestHandler = async (event) => {
  const { request, json, cookie } = event;

  const adminStatus = await isAdmin(event);
  if (!adminStatus) {
    json(403, { error: 'Forbidden: Admin access required' });
    return;
  }

  const accessToken = cookie.get('sb-access-token')?.value;
  const refreshToken = cookie.get('sb-refresh-token')?.value;

  try {
    const body = await request.json();
    const validated = createPostSchema.parse(body);

    const post = await postsService.create({
      title: validated.title,
      body: validated.body,
      userId: validated.userId,
    }, accessToken, refreshToken);

    json(201, post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      json(400, { error: 'Validation failed', details: error.issues });
    } else {
      json(500, { error: 'Internal server error' });
    }
  }
};
