import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import { postsService } from "~/services/posts.service";

export const usePost = routeLoader$(async ({ params, status }) => {
  const { id } = params;

  if (!id) {
    status(404);
    return null;
  }

  const post = await postsService.getById(id);

  if (!post) {
    status(404);
    return null;
  }

  return post;
});

export default component$(() => {
  const post = usePost();

  if (!post.value) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Post Not Found</h1>
        <p class="text-gray-600 mb-8">
          The post you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/" class="text-blue-600 hover:text-blue-800 font-medium">
          Go back home
        </Link>
      </div>
    );
  }

  const formattedDate = new Date(post.value.createdAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <article class="max-w-4xl mx-auto px-4 py-16">
      <header class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">
          {post.value.title}
        </h1>
        <div class="flex items-center gap-4 text-gray-600">
          <span>By {post.value.user.displayName}</span>
          <span>•</span>
          <time dateTime={post.value.createdAt}>{formattedDate}</time>
        </div>
      </header>

      <div class="prose prose-lg max-w-none">
        <div class="whitespace-pre-wrap text-gray-800">{post.value.body}</div>
      </div>

      <footer class="mt-12 pt-8 border-t border-gray-200">
        <Link href="/" class="text-blue-600 hover:text-blue-800 font-medium">
          ← Back to home
        </Link>
      </footer>
    </article>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePost);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return {
    title: post.title,
    meta: [
      {
        name: "description",
        content: post.body.slice(0, 160),
      },
    ],
  };
};
