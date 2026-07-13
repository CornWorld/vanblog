import type { APIRoute } from "astro";
import { createVanblogClient } from "@vanblog/sdk";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const c = createVanblogClient({ url: locals.pbUrl });
  try {
    const xml = await c.vanblog.feed.sitemap();
    return new Response(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch (e) {
    return new Response(`<!-- sitemap error: ${(e as Error).message} -->`, {
      status: 502,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }
};
