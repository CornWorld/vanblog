/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    pb: import('@vanblog/sdk').VanblogClient;
    getSite(): Promise<Partial<import('@vanblog/sdk').SiteConfig> | null>;
  }
}
