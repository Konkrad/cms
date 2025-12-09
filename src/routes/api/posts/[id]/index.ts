import type { RequestHandler } from '@builder.io/qwik-city';
import { postsService } from '~/services/posts.service';
import { z } from 'zod';

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

export const onPut: RequestHandler = async ({ params, request, json }) => {
  try {
    const body = await request.json();
    const validated = updatePostSchema.parse(body);

    const post = await postsService.update(params.id, validated);

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

export const onDelete: RequestHandler = async ({ params, json }) => {
  try {
    await postsService.delete(params.id);
    json(204, null);
  } catch (error) {
    json(500, { error: 'Internal server error' });
  }
};
