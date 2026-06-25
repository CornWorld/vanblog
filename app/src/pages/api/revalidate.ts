import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => ({}));

  // Invalidate by tags
  if (body.tags && Array.isArray(body.tags)) {
    try {
      await context.cache?.invalidate({ tags: body.tags });
    } catch (e) {
      console.error('[revalidate] cache.invalidate failed:', e);
    }
    return new Response(JSON.stringify({ purged: true, tags: body.tags }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Invalidate by path
  if (body.path && typeof body.path === 'string') {
    try {
      await context.cache?.invalidate({ path: body.path });
    } catch (e) {
      console.error('[revalidate] cache.invalidate failed:', e);
    }
    return new Response(JSON.stringify({ purged: true, path: body.path }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Missing tags or path' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};
