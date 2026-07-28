import type { APIRoute } from "astro";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const prerender = false;

// Public theme enumeration. Returns [{ name, label, version }, ...] from
// themes/*.
//
// Themes are independent Astro projects (see docs/agent-theme-architecture.md
// §5). Each theme ships a theme.json with the metadata returned here.
//
// THEMES_ROOT resolution order:
//   1. VANBLOG_THEMES_DIR env var (set by the dispatcher in prod)
//   2. Relative path from this compiled chunk (works in dev and local build)
//   3. Fallback to "/var/lib/vanblog/themes" (Docker prod default)
const THEMES_ROOT =
  process.env.VANBLOG_THEMES_DIR ||
  (() => {
    try {
      return join(
        fileURLToPath(new URL("../../../../", import.meta.url)),
        "themes"
      );
    } catch {
      return "/var/lib/vanblog/themes";
    }
  })();

interface ThemeMeta {
  name: string;
  label?: string;
  version?: string;
  author?: string;
  description?: string;
  screenshot?: string;
  recommendedPalette?: string;
  paletteMigrationMode?: string;
}

function listThemes(): ThemeMeta[] {
  if (!existsSync(THEMES_ROOT)) return [];
  return readdirSync(THEMES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const themeJsonPath = join(THEMES_ROOT, entry.name, "theme.json");
      const meta: ThemeMeta = { name: entry.name };
      if (existsSync(themeJsonPath)) {
        try {
          const raw = JSON.parse(readFileSync(themeJsonPath, "utf8"));
          if (typeof raw.label === "string") meta.label = raw.label;
          if (typeof raw.version === "string") meta.version = raw.version;
          if (typeof raw.author === "string") meta.author = raw.author;
          if (typeof raw.description === "string")
            meta.description = raw.description;
          if (typeof raw.screenshot === "string")
            meta.screenshot = raw.screenshot;
          if (typeof raw.recommendedPalette === "string")
            meta.recommendedPalette = raw.recommendedPalette;
          if (typeof raw.paletteMigrationMode === "string")
            meta.paletteMigrationMode = raw.paletteMigrationMode;
        } catch {
          // Malformed theme.json — fall through with just the directory name.
        }
      }
      return meta;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ themes: listThemes() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
