/// <reference path="../.astro/types.d.ts" />

declare module "vanblog:theme" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";
  export const Page: AstroComponentFactory;
}

declare module "virtual:vanblog/packs" {
  export interface PackRouteMetadata {
    pattern: string;
    page: string;
  }

  export interface PackMetadata {
    name: string;
    version: string;
    title: string;
    nav: { label: string; href: string } | null;
    routes: PackRouteMetadata[];
  }

  export const packs: PackMetadata[];
  export default packs;
}

declare namespace App {
  interface Locals {
    pb: import("@vanblog/sdk").VanblogClient;
    pbUrl: string;
    getSite(): Promise<Partial<import("@vanblog/sdk").Site> | null>;
    getNavItems(): Promise<import("@vanblog/sdk").PluginNavItem[]>;
  }
}

interface Window {
  __pb: import("@vanblog/sdk").VanblogClient | undefined;
  __bytemdEditor:
    | {
        $on(
          event: string,
          cb: (e: { detail: { value: string } }) => void
        ): void;
        $set(props: { value: string }): void;
      }
    | undefined;
}
