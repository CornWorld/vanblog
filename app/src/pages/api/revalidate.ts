import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));

  if (body.tags && Array.isArray(body.tags)) {
    return new Response(JSON.stringify({ purged: true, tags: body.tags }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.path && typeof body.path === 'string') {
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
