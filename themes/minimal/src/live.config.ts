// Minimal theme exports an empty collections object. The builtin
// `pages/posts/[id].astro` falls back to direct PocketBase fetches when
// `getLiveEntry('posts', ...)` misses, so omitting the live collection here
// is safe — it just means the theme build skips the Astro content layer
// pipeline and uses the in-process SDK instead.
//
// Theme authors who want live collections can replace this file with their
// own loader wiring (the post loader from app/src/loaders/posts.ts is the
// canonical implementation to copy).
export const collections = {};
