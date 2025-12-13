import type { RequestHandler } from '@builder.io/qwik-city';

export const onGet: RequestHandler = async ({ cookie, redirect }) => {
  cookie.delete('sb-access-token', { path: '/' });
  cookie.delete('sb-refresh-token', { path: '/' });

  throw redirect(302, '/');
};
