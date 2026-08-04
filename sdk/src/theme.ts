// Theme & palette persistence (browser-side, SSR-safe).
//
// Model (VSCode Color Theme style — atomic palettes):
//   - A palette is the single appearance unit: `{ name, type: 'dark'|'light', tokens }`.
//   - The user's ONLY preference is which palette is active, persisted in
//     localStorage under `vanblog-palette`. There is deliberately NO separate
//     light/dark ("theme mode") preference — light/dark IS the palette's
//     `type`. Picking a palette decides both the colors and the light/dark
//     rendering, exactly like picking a Color Theme in VSCode.
//   - `site.palette` is the site-wide default palette (fallback when the
//     visitor has no localStorage preference).

export type PaletteType = "dark" | "light";

/** Metadata shape returned by GET /api/palettes. */
export type PaletteMeta = {
  name: string;
  label?: string;
  version?: string;
  type?: PaletteType;
};

export const PALETTE_KEY = "vanblog-palette";

/** Pseudo-palette name for "follow system": resolves to the site default palette + OS light/dark. */
export const SYSTEM_PALETTE = "system";

function hasStorage(): boolean {
  return typeof localStorage !== "undefined";
}

/** Detect OS-level dark preference. Fails safe to light when matchMedia is unavailable. */
function systemPrefersDark(): boolean {
  try {
    return (
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-color-scheme: dark)").matches
    );
  } catch {
    return false;
  }
}

// ── Palette (the user's only appearance preference) ────────────────────

/** Read the persisted palette name. `default` / `system` / empty resolve to null (use site config + system light/dark). */
export function getPalette(): string | null {
  if (!hasStorage()) return null;
  const p = localStorage.getItem(PALETTE_KEY);
  return p && p !== "default" && p !== SYSTEM_PALETTE ? p : null;
}

export function setPalette(name: string): void {
  if (!hasStorage()) return;
  localStorage.setItem(PALETTE_KEY, name);
}

export function clearPalette(): void {
  if (!hasStorage()) return;
  localStorage.removeItem(PALETTE_KEY);
}

/** Build the palette.css href for a resolved palette + cache-busting version. */
export function paletteCssUrl(
  palette?: string | null,
  siteUpdated?: string
): string {
  const q =
    palette && palette !== "default"
      ? `?name=${encodeURIComponent(palette)}`
      : "";
  const v = siteUpdated
    ? `${q ? "&" : "?"}v=${encodeURIComponent(siteUpdated)}`
    : "";
  return `/api/palette.css${q}${v}`;
}

/** Resolve the effective palette name: user preference first, then site default. */
export function resolvePaletteName(
  userPreference: string | null,
  sitePalette?: string | null
): string | null {
  const p =
    userPreference &&
    userPreference !== "default" &&
    userPreference !== SYSTEM_PALETTE
      ? userPreference
      : null;
  if (p) return p;
  return sitePalette && sitePalette !== "default" ? sitePalette : null;
}

/**
 * Whether a palette renders dark. `palettes` maps name → type; an unknown
 * palette resolves to light (false) to stay safe on first load.
 */
export function paletteIsDark(
  name: string | null,
  palettes: Record<string, PaletteType>
): boolean {
  return !!name && palettes[name] === "dark";
}

/**
 * Build a name → type map from a palette metadata list (from /api/palettes).
 * Entries without a known type are skipped so the light fallback stays safe.
 */
export function buildPaletteTypeMap(
  palettes: PaletteMeta[]
): Record<string, PaletteType> {
  const map: Record<string, PaletteType> = {};
  for (const p of palettes) {
    if (p.type === "dark" || p.type === "light") map[p.name] = p.type;
  }
  return map;
}

/** Fetch the installed palette list (browser helper; no pb client needed). */
export async function fetchPalettes(): Promise<PaletteMeta[]> {
  try {
    const res = await fetch("/api/palettes");
    if (!res.ok) return [];
    const data = (await res.json()) as { palettes?: PaletteMeta[] };
    return data.palettes ?? [];
  } catch {
    return [];
  }
}

/**
 * Apply a palette selection in the browser: persist it (localStorage), toggle
 * `html.dark` by the palette's `type`, swap the `link[data-vanblog-palette]`
 * href, and run the switch progressively via runWithTransition(). The caller
 * is responsible for re-rendering its own picker UI.
 */
export function applyPalette(
  name: string,
  opts: { sitePalette?: string | null; palettes?: PaletteMeta[] } = {}
): void {
  const { sitePalette, palettes = [] } = opts;
  const isSystem = name === SYSTEM_PALETTE || name === "default";
  // system/default = no persisted preference: site palette + OS light/dark.
  if (isSystem) clearPalette();
  else setPalette(name);
  const dark = isSystem
    ? systemPrefersDark()
    : paletteIsDark(name, buildPaletteTypeMap(palettes));
  runWithTransition(() => {
    const doc = typeof document !== "undefined" ? document : null;
    if (!doc) return;
    doc.documentElement.classList.toggle("dark", dark);
    doc.documentElement.dispatchEvent(
      new CustomEvent("darkmodechange", { detail: { dark } })
    );
    const link = doc.querySelector<HTMLLinkElement>(
      "link[data-vanblog-palette]"
    );
    if (link) {
      // system → site default palette (or endpoint fallback); explicit → that palette.
      const target = isSystem ? sitePalette || null : name;
      const base = paletteCssUrl(target, undefined);
      const sep = base.includes("?") ? "&" : "?";
      link.href = `${base}${sep}v=${Date.now()}`;
    }
  });
}

// ── Inline <head> init script (prevents FOUC) ──────────────────────────

/**
 * Self-contained IIFE string for the `<head>` (cannot use imports):
 *  1. Resolves the effective palette (localStorage preference → site default).
 *  2. Adds `dark` to `<html>` before paint:
 *     - explicit palette → its `type` decides light/dark;
 *     - no preference (or `system`/`default`) → follow OS `prefers-color-scheme`.
 *  3. Swaps `link[data-vanblog-palette]` to the effective palette.
 * Fallbacks: matchMedia unavailable → light; unknown palette → light;
 * no site palette → skip palette.css (built-in default), still follow system.
 * Injected by BaseLayout via `<script is:inline set:html={...} />`.
 */
export function buildThemeInitScript(
  opts: {
    sitePalette?: string | null;
    siteUpdated?: string;
    palettes?: Record<string, PaletteType>;
  } = {}
): string {
  const { sitePalette, siteUpdated, palettes = {} } = opts;
  const sitePal = sitePalette && sitePalette !== "default" ? sitePalette : null;
  const typeMapJson = JSON.stringify(palettes);
  return `(() => {
  var PK = ${JSON.stringify(PALETTE_KEY)};
  var SYSMODE = ${JSON.stringify(SYSTEM_PALETTE)};
  var sitePal = ${JSON.stringify(sitePal ?? "")};
  var siteUpd = ${JSON.stringify(siteUpdated ?? "")};
  var types = ${typeMapJson};
  function isSystemDark() {
    try { return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (e) { return false; }
  }
  var pal = localStorage.getItem(PK);
  var hasUserPal = pal && pal !== 'default' && pal !== SYSMODE;
  var name = hasUserPal ? pal : sitePal;
  var dark = hasUserPal ? (types[pal] === 'dark') : isSystemDark();
  if (dark) document.documentElement.classList.add('dark');
  if (name) {
    var link = document.querySelector('link[data-vanblog-palette]');
    if (link) {
      var v = siteUpd ? '&v=' + encodeURIComponent(siteUpd) : '';
      link.href = '/api/palette.css?name=' + encodeURIComponent(name) + v;
    }
  }
})();`;
}

// ── Progressive (animated) palette/theme switching ──────────────────────

/**
 * Run a DOM-mutating callback with a progressive color transition:
 *  - prefers the View Transitions API (whole-page cross-fade / layered
 *    animation) when available;
 *  - otherwise temporarily adds `fallbackClass` to `<html>` so CSS can drive a
 *    layered color transition, then removes it after `fallbackDurationMs`;
 *  - respects `prefers-reduced-motion` (applies synchronously when reduced).
 *
 * Example:
 * ```js
 * runWithTransition(() => {
 *   document.documentElement.classList.toggle('dark', true);
 *   link.href = '/api/palette.css?name=default-dark';
 * });
 * ```
 */
export function runWithTransition(
  fn: () => void,
  fallbackClass = "theme-transition",
  fallbackDurationMs = 700
): void {
  const doc = typeof document !== "undefined" ? document : null;
  if (!doc) {
    fn();
    return;
  }
  const reduceMotion =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vt = (
    doc as Document & { startViewTransition?: (cb: () => void) => unknown }
  ).startViewTransition;
  if (!reduceMotion && vt) {
    vt(fn);
    return;
  }
  const root = doc.documentElement;
  if (!reduceMotion && fallbackClass) {
    root.classList.add(fallbackClass);
    fn();
    setTimeout(() => root.classList.remove(fallbackClass), fallbackDurationMs);
  } else {
    fn();
  }
}
