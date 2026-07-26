import type { APIRoute } from "astro";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const prerender = false;

// Public palette enumeration. Used by the admin UI to populate the palette
// picker. Returns [{ name, label, version }, ...] from hooks/palettes/*.
//
// Palettes live outside themes so that a single palette can be shared across
// themes — see docs/agent-theme-architecture.md §4.
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const PALETTES_ROOT = join(REPO_ROOT, "hooks", "palettes");

function listPalettes(): Array<{ name: string; label?: string; version?: string }> {
  if (!existsSync(PALETTES_ROOT)) return [];
  return readdirSync(PALETTES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const paletteJsonPath = join(PALETTES_ROOT, entry.name, "palette.json");
      let label: string | undefined;
      let version: string | undefined;
      if (existsSync(paletteJsonPath)) {
        try {
          const meta = JSON.parse(readFileSync(paletteJsonPath, "utf8"));
          label = typeof meta.label === "string" ? meta.label : undefined;
          version = typeof meta.version === "string" ? meta.version : undefined;
        } catch {
          // Malformed palette.json — fall through with just the directory name.
        }
      }
      return { name: entry.name, label, version };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ palettes: listPalettes() }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
