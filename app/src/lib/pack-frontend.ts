// Runtime pack-frontend manifest (app/src/lib — 禁覆盖区,平台层基础设施).
//
// Layouts consume this instead of the historical build-time virtual module
// (`virtual:vanblog/pack-frontend`): the manifest is fetched per render from
// GET /api/vanblog/packs/frontend, which reads the LIVE (builtin + user,
// user-wins) pack directories. A pack installed into VANBLOG_PACKS_DIR (plus
// the PB restart its hooks need) therefore shows up in every theme without a
// theme rebuild.
//
// The Go response sets `Cache-Control: max-age=10`; the module-level cache
// below mirrors that TTL. On fetch failure we keep serving the last good
// manifest (nav/asset lists degrade to empty only before the first success)
// — same posture as the palettes lookup in BaseLayout.
import type { PackFrontendManifest } from '@vanblog/sdk';

const CACHE_TTL_MS = 10_000;

let cached: { at: number; data: PackFrontendManifest } | null = null;

const EMPTY_MANIFEST: PackFrontendManifest = { packs: [], contributions: [] };

export async function getPackFrontend(pb: {
  vanblog: { packs: { frontend(): Promise<PackFrontendManifest> } };
}): Promise<PackFrontendManifest> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }
  try {
    const data = await pb.vanblog.packs.frontend();
    cached = { at: Date.now(), data };
    return data;
  } catch {
    return cached?.data ?? EMPTY_MANIFEST;
  }
}
