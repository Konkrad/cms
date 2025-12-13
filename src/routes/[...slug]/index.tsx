import { component$ } from '@builder.io/qwik';
import { routeLoader$, type DocumentHead } from '@builder.io/qwik-city';
import { pagesService } from '~/services/pages.service';
import { BlockRenderer } from '~/components/builder/BlockRenderer';

export const usePage = routeLoader$(async ({ params, status }) => {
  const slug = params.slug === '' || params.slug === undefined ? '/' : params.slug;

  const page = await pagesService.getBySlug(slug);

  if (!page) {
    status(404);
    return null;
  }

  if (page.status !== 'published') {
    status(404);
    return null;
  }

  return page;
});

export default component$(() => {
  const page = usePage();

  if (!page.value) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Page Not Found</h1>
        <p class="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been removed.
        </p>
        <a href="/" class="text-blue-600 hover:text-blue-800 font-medium">
          Go back home
        </a>
      </div>
    );
  }

  return (
    <div class="min-h-screen">
      {page.value.content && page.value.content.length > 0 ? (
        <div>
          {page.value.content
            .sort((a, b) => a.order - b.order)
            .map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
        </div>
      ) : (
        <div class="max-w-4xl mx-auto px-4 py-16">
          <h1 class="text-4xl font-bold text-gray-900 mb-4">{page.value.title}</h1>
          <p class="text-gray-600">This page is empty. Add content in the page builder.</p>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const page = resolveValue(usePage);

  if (!page) {
    return {
      title: 'Page Not Found',
    };
  }

  return {
    title: page.title,
  };
};
