
// Virtual module declarations for @vanblog/base imports.
// The themes integration resolves these at build time via Vite aliases.
declare module "@vanblog/base/*" {
  const Component: import("astro").AstroComponentFactory;
  export default Component;
}

declare module "vanblog:theme" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";
  export const Page: AstroComponentFactory;
}

/** 本主题挂载前缀(/themes/<name>,shared-config vite.define 注入)。
 *  仅用于必须命中主题自有 SSR 端点的 URL(裸 /api/* 在 caddy 归 pb)。 */
declare const __VANBLOG_THEME_PREFIX__: string;


declare namespace App {
  interface Locals {
    pb: import("@vanblog/sdk").VanblogClient;
    pbUrl: string;
    getSite(): Promise<Partial<import("@vanblog/sdk").Site> | null>;
    getThemeSettings(): Promise<Record<string, unknown>>;
  }
}

interface Window {
  vanblog: { pb: import("@vanblog/sdk").VanblogClient };
}
