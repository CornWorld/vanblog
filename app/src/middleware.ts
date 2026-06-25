import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@vanblog/sdk/server';

export const onRequest = defineMiddleware(async (context, next) => {
  const client = createServerClient({
    url: 'http://127.0.0.1:8090',
    cookie: context.request.headers.get('cookie') || '',
  });

  context.locals.pb = client;

  const response = await next();

  // Write back refreshed auth cookie
  response.headers.append('set-cookie', client.authStore.exportToCookie());

  return response;
});
