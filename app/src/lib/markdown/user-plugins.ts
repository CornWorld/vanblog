/**
 * User-defined Markdown plugins — injection point for custom remark/rehype.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * vanblog's built-in markdown pipeline is in `./config.ts` and ships with a
 * fixed set of plugins (remarkDirective, remarkMath, remarkContainer,
 * rehypeKatex, rehypeEnhance, rehypeCodeBlock). To add your own — e.g.
 * auto-generated TOC, emoji shortcuts, external-link rewriting — edit this
 * file and rebuild the app (`pnpm --filter app build`). You do NOT need to
 * touch `config.ts` or any vanblog core code.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────
 * User plugins are appended AFTER the built-ins, so they run last. If you
 * need to run BEFORE the built-ins, edit `config.ts` directly (fork mode).
 *
 * ```ts
 * import remarkToc from "remark-toc";
 * import remarkEmoji from "remark-emoji";
 * import { remarkMyPlugin } from "./my-plugins/remark-my-plugin";
 *
 * export const userRemarkPlugins = [remarkToc, remarkEmoji, remarkMyPlugin()];
 * export const userRehypePlugins = [];  // add rehype plugins here
 * ```
 *
 * Each entry follows the unified `Plugin` shape — either a plugin function,
 * a `[plugin, options]` tuple, or a `[plugin]` single-element tuple. See
 * https://github.com/unifiedjs/unified#plugin for the full contract.
 */

import type { RemarkPlugin, RehypePlugin } from "@astrojs/markdown-remark";

/**
 * User-defined remark plugins. Empty by default — add yours here.
 *
 * Runs AFTER built-in remark plugins (remarkDirective, remarkMath,
 * remarkContainer).
 */
export const userRemarkPlugins: Array<RemarkPlugin | [RemarkPlugin, any]> = [];

/**
 * User-defined rehype plugins. Empty by default — add yours here.
 *
 * Runs AFTER built-in rehype plugins (rehypeKatex, rehypeEnhance,
 * rehypeCodeBlock).
 */
export const userRehypePlugins: Array<RehypePlugin | [RehypePlugin, any]> = [];
