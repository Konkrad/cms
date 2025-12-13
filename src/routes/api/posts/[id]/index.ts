import type { RequestHandler } from '@builder.io/qwik-city';
import { postsService } from '~/services/posts.service';
import { z } from 'zod';
import { isAdmin } from '~/utils/server-auth';

const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  userId: z.string().uuid().optional(),
});

export const onGet: RequestHandler = async ({ params, json }) => {
  const post = await postsService.getById(params.id);

  if (!post) {
    json(404, { error: 'Post not found' });
    return;
  }

  json(200, post);
};

export const onPut: RequestHandler = async (event) => {
  const { params, request, json, cookie } = event;

  const adminStatus = await isAdmin(event);
  if (!adminStatus) {
    json(403, { error: 'Forbidden: Admin access required' });
    return;
  }

  const accessToken = cookie.get('sb-access-token')?.value;
  const refreshToken = cookie.get('sb-refresh-token')?.value;

  try {
    const body = await request.json();
    const validated = updatePostSchema.parse(body);

    const post = await postsService.update(params.id, validated, accessToken, refreshToken);

    if (!post) {
      json(404, { error: 'Post not found' });
      return;
    }

    json(200, post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      json(400, { error: 'Validation failed', details: error.issues });
    } else {
      json(500, { error: 'Internal server error' });
    }
  }
};

export const onDelete: RequestHandler = async (event) => {
  const { params, json, cookie } = event;

  const adminStatus = await isAdmin(event);
  if (!adminStatus) {
    json(403, { error: 'Forbidden: Admin access required' });
    return;
  }

  const accessToken = cookie.get('sb-access-token')?.value;
  const refreshToken = cookie.get('sb-refresh-token')?.value;

  try {
    await postsService.delete(params.id, accessToken, refreshToken);
    json(204, null);
  } catch (error) {
    json(500, { error: 'Internal server error' });
  }
};
