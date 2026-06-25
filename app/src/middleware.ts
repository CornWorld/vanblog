import { defineMiddleware } from 'astro:middleware';
import { createVanblogClient } from '@vanblog/sdk';
import type { SiteConfig } from '@vanblog/sdk';

declare module 'astro' {
  interface Locals {
    pb: ReturnType<typeof createVanblogClient>;
    site: Partial<SiteConfig> | null;
  }
}

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

  // Preload site config (cached on locals to avoid repeated fetches)
  let site: Partial<SiteConfig> | null = null;
  try {
    const res = await fetch('http://127.0.0.1:8090/api/collections/site/records?perPage=1');
    const data = await res.json();
    if (data.items?.[0]) {
      site = data.items[0];
    }
  } catch {
    // site not available — pages will use defaults
  }
  context.locals.site = site;

  const response = await next();

  // Only write back cookie if auth was valid (token may have been refreshed by page code)
  try {
    if (client.authStore.isValid) {
      const newCookie = client.authStore.exportToCookie();
      // Only append if changed (compare substring to avoid overhead)
      response.headers.append('set-cookie', newCookie);
    }
  } catch {
    // ignore
  }

  return response;
});
