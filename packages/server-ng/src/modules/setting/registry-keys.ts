import { z } from 'zod';

// Centralized config keys and schemas for Settings Registry
// Keep business-agnostic: only keys and pure validation schemas

// Sitemap
export const SITEMAP_EXTRA_STATIC_PATHS_KEY = 'sitemapExtraStaticPaths';
export const SitemapExtraStaticPathsSchema = z
  .union([z.string().trim().min(1), z.array(z.string().trim().min(1))])
  .transform<string[]>((v) => (Array.isArray(v) ? v : [v]));
