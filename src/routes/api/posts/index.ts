import type { RequestHandler } from '@builder.io/qwik-city';
import { postsService } from '~/services/posts.service';
import { z } from 'zod';

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

export const onPost: RequestHandler = async ({ request, json }) => {
  try {
    const body = await request.json();
    const validated = createPostSchema.parse(body);

    const post = await postsService.create({
      title: validated.title,
      body: validated.body,
      userId: validated.userId,
    });

    json(201, post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      json(400, { error: 'Validation failed', details: error.issues });
    } else {
      json(500, { error: 'Internal server error' });
    }
  }
};
