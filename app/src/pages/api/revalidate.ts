import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  // Only allow calls from the internal pb hook (same container).
  // Caddy proxies external requests with X-Forwarded-For; internal calls don't have it.
  const xff = context.request.headers.get("x-forwarded-for");
  if (xff) {
    return new Response("forbidden", { status: 403 });
  }

  const body = await context.request.json().catch(() => ({}));

  if (Array.isArray(body.tags) && body.tags.length > 0) {
    if (context.cache.enabled) {
      await context.cache.invalidate({ tags: body.tags });
    }
    return new Response(
      JSON.stringify({ purged: true, tags: body.tags, enabled: context.cache.enabled }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (typeof body.path === "string" && body.path) {
    if (context.cache.enabled) {
      await context.cache.invalidate({ path: body.path });
    }
    return new Response(
      JSON.stringify({ purged: true, path: body.path, enabled: context.cache.enabled }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ error: "Missing tags or path" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
};
