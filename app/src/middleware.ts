import { defineMiddleware } from "astro:middleware";
import { createVanblogClient } from "@vanblog/sdk";
import type { SiteConfig } from "@vanblog/sdk";

let cachedSite: Partial<SiteConfig> | null = null;
let siteFetchTime = 0;
const SITE_CACHE_TTL = 60_000; // 1 min

/**
 * Check if the current request is authenticated.
 * Returns true if the pb authStore has a valid token.
 * Use in admin pages: if (!requireAuth(Astro)) return Astro.redirect('/_/');
 */
export function isAuthenticated(context: { locals: App.Locals }): boolean {
  return context.locals.pb.authStore.isValid;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const client = createVanblogClient({ url: "http://127.0.0.1:8090" });

  const cookie = context.request.headers.get("cookie") || "";
  if (cookie) {
    try {
      client.authStore.loadFromCookie(cookie);
    } catch {}
  }

  context.locals.pb = client;

  // Lazy site config — only fetched when a page actually calls getSite()
  context.locals.getSite = async () => {
    if (cachedSite && Date.now() - siteFetchTime < SITE_CACHE_TTL)
      return cachedSite;
    try {
      const res = await fetch(
        "http://127.0.0.1:8090/api/collections/site/records?perPage=1"
      );
      const data = await res.json();
      cachedSite = data.items?.[0] || null;
      siteFetchTime = Date.now();
    } catch {}
    return cachedSite;
  };

  const response = await next();

  try {
    if (client.authStore.isValid)
      response.headers.append("set-cookie", client.authStore.exportToCookie());
  } catch {}

  return response;
});
