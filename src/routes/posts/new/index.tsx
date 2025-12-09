import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, zod$, z } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';
import { postsService } from '~/services/posts.service';
import { Card } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { TextArea } from '~/components/ui/TextArea';
import { Select } from '~/components/ui/Select';
import { Button } from '~/components/ui/Button';

export const useUsers = routeLoader$(async () => {
  return await usersService.getAll();
});

export const useCreatePost = routeAction$(
  async (data, { redirect }) => {
    await postsService.create({
      title: data.title,
      body: data.body,
      userId: data.userId,
    });

    throw redirect(303, '/posts');
  },
  zod$({
    title: z.string().min(1, 'Title is required'),
    body: z.string().min(1, 'Body is required'),
    userId: z.string().min(1, 'Please select an author'),
  })
);

export default component$(() => {
  const users = useUsers();
  const action = useCreatePost();

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Create New Post</h1>

      <Card>
        <Form action={action} class="space-y-6">
          <Select
            name="userId"
            label="Author"
            required
            value={action.formData?.get('userId') as string}
            error={action.value?.fieldErrors?.userId?.[0]}
          >
            <option value="">Select an author...</option>
            {users.value.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.email})
              </option>
            ))}
          </Select>

          <Input
            name="title"
            label="Title"
            required
            value={action.formData?.get('title') as string}
            error={action.value?.fieldErrors?.title?.[0]}
          />

          <TextArea
            name="body"
            label="Body"
            required
            rows={10}
            value={action.formData?.get('body') as string}
            error={action.value?.fieldErrors?.body?.[0]}
          />

          <div class="flex gap-4">
            <Button type="submit" disabled={action.isRunning}>
              {action.isRunning ? 'Creating...' : 'Create Post'}
            </Button>
            <Button type="button" variant="secondary" onClick$={() => window.history.back()}>
              Cancel
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
});
