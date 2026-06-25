import { defineMiddleware } from 'astro:middleware';
import { createVanblogClient } from '@vanblog/sdk';

export const onRequest = defineMiddleware(async (context, next) => {
  const client = createVanblogClient({
    url: 'http://127.0.0.1:8090',
  });

  // Load auth from cookie if present
  const cookie = context.request.headers.get('cookie') || '';
  if (cookie) {
    try {
      client.authStore.loadFromCookie(cookie);
    } catch {
      // ignore invalid cookie
    }
  }

  context.locals.pb = client;

  const response = await next();

  // Write back auth cookie if changed
  try {
    if (client.authStore.isValid) {
      response.headers.append('set-cookie', client.authStore.exportToCookie());
    }
  } catch {
    // ignore
  }

  return response;
});
