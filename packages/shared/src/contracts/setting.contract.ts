import { initContract } from '@ts-rest/core';
import { z } from 'zod';

// TODO: 这些 schema 需要从 server-ng DTOs 迁移到 shared/schemas
// 暂时使用 z.any()，后续精确化
const UpdateAboutSchema = z.object({ content: z.string() });
const UpdateCustomCodeSchema = z.object({
  css: z.string().optional(),
  script: z.string().optional(),
  html: z.string().optional(),
  head: z.string().optional(),
});
const CreateFriendLinkSchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  avatar: z.string().optional(),
});
const UpdateFriendLinkSchema = CreateFriendLinkSchema.partial();
const UpdateNavigationSchema = z.object({ items: z.array(z.any()) });
const UpdateLayoutSchema = z.object({
  showRecentPosts: z.boolean().optional(),
  recentPostsCount: z.number().optional(),
  showCategories: z.boolean().optional(),
  showTags: z.boolean().optional(),
  showArchive: z.boolean().optional(),
  showAbout: z.boolean().optional(),
  showSearch: z.boolean().optional(),
});
const UpdateSiteInfoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});
const UpdateThemeSchema = z.object({
  primaryColor: z.string().optional(),
  darkMode: z.boolean().optional(),
});
const UpdateStaticSettingSchema = z.any();
const StaticSettingSchema = z.any();
const UpdateHttpsSettingSchema = z.any();
const HttpsSettingSchema = z.any();

export const createSettingContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    updateStatic: {
      method: 'PATCH',
      path: '/v2/settings/static',
      body: UpdateStaticSettingSchema,
      responses: {
        200: StaticSettingSchema,
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    updateHttps: {
      method: 'PATCH',
      path: '/v2/settings/https',
      body: UpdateHttpsSettingSchema,
      responses: {
        200: HttpsSettingSchema,
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    getSiteInfo: {
      method: 'GET',
      path: '/v2/settings/site-info',
      responses: {
        200: z.object({
          title: z.string(),
          description: z.string(),
          author: z.string(),
          keywords: z.array(z.string()),
        }),
      },
    },
    updateSiteInfo: {
      method: 'PATCH',
      path: '/v2/settings/site-info',
      body: UpdateSiteInfoSchema,
      responses: {
        200: z.object({
          title: z.string(),
          description: z.string(),
          author: z.string(),
          keywords: z.array(z.string()),
        }),
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    getLayout: {
      method: 'GET',
      path: '/v2/settings/layout',
      responses: {
        200: z.object({
          showRecentPosts: z.boolean(),
          recentPostsCount: z.number(),
          showCategories: z.boolean(),
          showTags: z.boolean(),
          showArchive: z.boolean(),
          showAbout: z.boolean(),
          showSearch: z.boolean(),
        }),
      },
    },
    updateLayout: {
      method: 'PATCH',
      path: '/v2/settings/layout',
      body: UpdateLayoutSchema,
      responses: {
        200: z.object({
          showRecentPosts: z.boolean(),
          recentPostsCount: z.number(),
          showCategories: z.boolean(),
          showTags: z.boolean(),
          showArchive: z.boolean(),
          showAbout: z.boolean(),
          showSearch: z.boolean(),
        }),
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    getTheme: {
      method: 'GET',
      path: '/v2/settings/theme',
      responses: {
        200: z.object({
          primaryColor: z.string(),
          darkMode: z.boolean(),
        }),
      },
    },
    updateTheme: {
      method: 'PATCH',
      path: '/v2/settings/theme',
      body: UpdateThemeSchema,
      responses: {
        200: z.object({
          primaryColor: z.string(),
          darkMode: z.boolean(),
        }),
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    getFriendLinks: {
      method: 'GET',
      path: '/v2/settings/friend-links',
      responses: {
        200: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional(),
            avatar: z.string().optional(),
          }),
        ),
      },
    },
    createFriendLink: {
      method: 'POST',
      path: '/v2/settings/friend-links',
      body: CreateFriendLinkSchema,
      responses: {
        201: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional(),
            avatar: z.string().optional(),
          }),
        ),
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    updateFriendLink: {
      method: 'PATCH',
      path: '/v2/settings/friend-links/:index',
      pathParams: z.object({ index: z.string() }),
      body: UpdateFriendLinkSchema,
      responses: {
        200: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional(),
            avatar: z.string().optional(),
          }),
        ),
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    deleteFriendLink: {
      method: 'DELETE',
      path: '/v2/settings/friend-links/:index',
      pathParams: z.object({ index: z.string() }),
      responses: {
        200: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional(),
            avatar: z.string().optional(),
          }),
        ),
      },
    },
    getNavigation: {
      method: 'GET',
      path: '/v2/settings/navigation',
      responses: {
        200: z.array(
          z.lazy(() =>
            z.object({
              name: z.string(),
              path: z.string(),
              icon: z.string().optional(),
              external: z.boolean().optional(),
              children: z
                .array(
                  z.object({
                    name: z.string(),
                    path: z.string(),
                    icon: z.string().optional(),
                    external: z.boolean().optional(),
                    children: z.array(z.any()).optional(),
                  }),
                )
                .optional(),
            }),
          ),
        ),
      },
    },
    updateNavigation: {
      method: 'PATCH',
      path: '/v2/settings/navigation',
      body: UpdateNavigationSchema,
      responses: {
        200: z.array(
          z.lazy(() =>
            z.object({
              name: z.string(),
              path: z.string(),
              icon: z.string().optional(),
              external: z.boolean().optional(),
              children: z
                .array(
                  z.object({
                    name: z.string(),
                    path: z.string(),
                    icon: z.string().optional(),
                    external: z.boolean().optional(),
                    children: z.array(z.any()).optional(),
                  }),
                )
                .optional(),
            }),
          ),
        ),
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    getCustomCode: {
      method: 'GET',
      path: '/v2/settings/custom-code',
      responses: {
        200: z.object({
          css: z.string().optional(),
          script: z.string().optional(),
          html: z.string().optional(),
          head: z.string().optional(),
        }),
      },
    },
    updateCustomCode: {
      method: 'PATCH',
      path: '/v2/settings/custom-code',
      body: UpdateCustomCodeSchema,
      responses: {
        200: z.object({
          css: z.string().optional(),
          script: z.string().optional(),
          html: z.string().optional(),
          head: z.string().optional(),
        }),
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
    getAbout: {
      method: 'GET',
      path: '/v2/settings/about',
      responses: {
        200: z.object({ content: z.string(), updatedAt: z.string() }),
      },
    },
    updateAbout: {
      method: 'PATCH',
      path: '/v2/settings/about',
      body: UpdateAboutSchema,
      responses: {
        200: z.object({ content: z.string(), updatedAt: z.string() }),
        400: z.object({ message: z.string(), issues: z.any() }),
      },
    },
  });
