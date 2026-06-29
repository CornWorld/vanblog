/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    pb: import("@vanblog/sdk").VanblogClient;
    getSite(): Promise<Partial<import("@vanblog/sdk").SiteConfig> | null>;
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
