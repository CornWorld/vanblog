import type { APIRoute } from "astro";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const prerender = false;

// Dynamic palette CSS endpoint.
//
// Reads site.palette from the current site record, then concatenates the
// matching palette's tokens.css → typography.css → components.css (in that
// fixed order — @import inside palette files is not supported) and returns
// the result as text/css.
//
// Why an endpoint instead of a static file?
//   - site.palette is runtime state (admin can change it). Serving via SSR
//     means palette switches take effect on the next page load without any
//     build step, satisfying the "zero-risk" promise of palettes in
//     docs/agent-theme-architecture.md §7.
//   - The Caddy layer does not need to know about palettes at all. The
//     browser fetches /api/palette.css through the same reverse proxy that
//     serves the rest of the app, so palette routing inherits whatever TLS
//     and caching headers the site already uses.
//
// Cache-Control is set to no-cache so the `?v={site.updated}` query string
// in BaseLayout forces a re-fetch whenever the palette changes.

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const PALETTES_ROOT = join(REPO_ROOT, "hooks", "palettes");
const PALETTE_FILES = ["tokens.css", "typography.css", "components.css"] as const;

function readPaletteFiles(name: string): string | null {
  const dir = join(PALETTES_ROOT, name);
  if (!existsSync(dir)) return null;
  // Guard against `name` containing `..` or absolute paths.
  const normalised = normalize(dir);
  const rel = relative(PALETTES_ROOT, normalised);
  if (rel.startsWith(`..${sep}`) || rel === `..` || rel === "") return null;

  const chunks: string[] = [];
  for (const file of PALETTE_FILES) {
    const path = join(normalised, file);
    if (existsSync(path)) {
      chunks.push(`/* ${name}/${file} */`);
      chunks.push(readFileSync(path, "utf8"));
    }
  }
  return chunks.length === 0 ? "" : chunks.join("\n\n");
}

export const GET: APIRoute = async ({ locals }) => {
  let paletteName = "";
  try {
    const site = await locals.getSite();
    paletteName = typeof site?.palette === "string" ? site.palette : "";
  } catch {
    // Site not ready yet (fresh DB, before setup). Fall through to 404.
  }

  if (!paletteName) {
    // No palette configured — return an empty CSS so the browser doesn't
    // error out. BaseLayout still injects the link unconditionally so that
    // switching to a palette later just needs a refresh.
    return new Response("/* no palette configured */", {
      status: 200,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  const css = readPaletteFiles(paletteName);
  if (css === null) {
    return new Response(`/* palette "${paletteName}" not found */`, {
      status: 404,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  return new Response(css, {
    status: 200,
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
};
